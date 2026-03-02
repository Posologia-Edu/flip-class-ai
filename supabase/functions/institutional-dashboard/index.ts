import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TEACHERS = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { action } = body;

    // Helper: get current invite count for this user
    const getInviteCount = async () => {
      const { data } = await adminClient
        .from("admin_invites")
        .select("id")
        .eq("invited_by", userId)
        .in("status", ["active", "pending"]);
      return data?.length || 0;
    };

    if (action === "get_teachers") {
      const { data: invites } = await adminClient
        .from("admin_invites")
        .select("email, granted_plan, status, activated_at, created_at")
        .eq("invited_by", userId)
        .in("status", ["active", "pending"]);

      if (!invites || invites.length === 0) {
        return new Response(JSON.stringify({ teachers: [], count: 0, limit: MAX_TEACHERS, aiUsageMonthly: { generations: 0, corrections: 0 } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

      const teachers = [];
      for (const invite of invites) {
        const authUser = authUsers?.users?.find((u: any) => u.email?.toLowerCase() === invite.email.toLowerCase());
        if (!authUser) {
          teachers.push({
            email: invite.email,
            name: invite.email,
            status: invite.status,
            userId: null,
            roomCount: 0,
            studentCount: 0,
            completionRate: 0,
          });
          continue;
        }

        const { data: rooms } = await adminClient
          .from("rooms")
          .select("id")
          .eq("teacher_id", authUser.id);

        const roomIds = (rooms || []).map((r: any) => r.id);
        let studentCount = 0;
        let completedCount = 0;

        if (roomIds.length > 0) {
          const { data: sessions } = await adminClient
            .from("student_sessions")
            .select("id, completed_at")
            .in("room_id", roomIds);
          studentCount = (sessions || []).length;
          completedCount = (sessions || []).filter((s: any) => s.completed_at).length;
        }

        const profile = authUser.user_metadata;
        teachers.push({
          email: invite.email,
          name: profile?.full_name || invite.email,
          status: invite.status,
          userId: authUser.id,
          roomCount: roomIds.length,
          studentCount,
          completionRate: studentCount > 0 ? Math.round((completedCount / studentCount) * 100) : 0,
        });
      }

      const trackedUserIds = Array.from(
        new Set([userId, ...teachers.map((t: any) => t.userId).filter(Boolean)])
      );

      let aiUsageMonthly = { generations: 0, corrections: 0 };
      if (trackedUserIds.length > 0) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data: usageRows } = await adminClient
          .from("ai_usage_log")
          .select("usage_type")
          .in("user_id", trackedUserIds)
          .gte("created_at", startOfMonth);

        aiUsageMonthly = {
          generations: (usageRows || []).filter((u: any) => u.usage_type === "generation").length,
          corrections: (usageRows || []).filter((u: any) => u.usage_type === "correction").length,
        };
      }

      return new Response(JSON.stringify({ teachers, count: invites.length, limit: MAX_TEACHERS, aiUsageMonthly }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "invite_teacher") {
      const email = (body.email || "").trim().toLowerCase();
      if (!email) {
        return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check limit
      const currentCount = await getInviteCount();
      if (currentCount >= MAX_TEACHERS) {
        return new Response(JSON.stringify({ error: `Limite de ${MAX_TEACHERS} professores atingido` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already invited
      const { data: existing } = await adminClient
        .from("admin_invites")
        .select("id, status")
        .eq("email", email)
        .eq("invited_by", userId)
        .in("status", ["active", "pending"])
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Este professor já foi convidado" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already exists in auth
      let existingUser: any = null;
      try {
        const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        existingUser = authUsers?.users?.find(
          (u: any) => u.email?.toLowerCase() === email
        ) || null;
      } catch (listErr) {
        console.error("Error listing users:", listErr);
      }

      if (existingUser) {
        // User already has an account — add them directly as active
        // Check for any existing record for this email (any status) to avoid conflicts
        const { data: anyExisting } = await adminClient
          .from("admin_invites")
          .select("id, status")
          .eq("email", email)
          .eq("invited_by", userId)
          .maybeSingle();

        if (anyExisting) {
          // Update existing record instead of inserting
          const { error: updateError } = await adminClient
            .from("admin_invites")
            .update({
              status: "active",
              activated_at: new Date().toISOString(),
              granted_plan: "institutional",
            })
            .eq("id", anyExisting.id);

          if (updateError) {
            console.error("Error updating invite:", updateError);
            return new Response(JSON.stringify({ error: updateError.message }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          const { error: insertError } = await adminClient
            .from("admin_invites")
            .insert({
              email,
              invited_by: userId,
              granted_plan: "institutional",
              status: "active",
              activated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error("Error inserting invite:", insertError);
            return new Response(JSON.stringify({ error: insertError.message }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Approve their profile
        await adminClient
          .from("profiles")
          .update({ approval_status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
          .eq("user_id", existingUser.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // New user — create user and generate invite link, then send email via Resend
      const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "https://flip.posologia.app";

      // Generate the invite link (does NOT send email)
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: `${origin}/reset-password`,
        },
      });

      if (linkError) {
        console.error("Error generating invite link:", linkError);
        return new Response(JSON.stringify({ error: `Erro ao gerar convite: ${linkError.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build the confirmation URL with the token
      const actionLink = linkData?.properties?.action_link;
      if (!actionLink) {
        console.error("No action_link in generateLink response:", linkData);
        return new Response(JSON.stringify({ error: "Erro ao gerar link de convite" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send invite email via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.error("RESEND_API_KEY not configured");
        return new Response(JSON.stringify({ error: "Serviço de email não configurado" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#ffffff;font-family:'Segoe UI',Roboto,sans-serif;">
          <div style="max-width:520px;margin:40px auto;padding:32px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="font-size:24px;color:#0d9488;margin:0;">FlipClass</h1>
            </div>
            <h2 style="font-size:18px;color:#111827;margin-bottom:16px;">Você foi convidado!</h2>
            <p style="font-size:15px;color:#374151;line-height:1.6;">
              Você recebeu um convite para fazer parte da plataforma <strong>FlipClass</strong> como professor.
            </p>
            <p style="font-size:15px;color:#374151;line-height:1.6;">
              Clique no botão abaixo para criar sua senha e acessar o sistema:
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${actionLink}" style="display:inline-block;padding:14px 32px;background-color:#0d9488;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">
                Aceitar Convite
              </a>
            </div>
            <p style="font-size:13px;color:#6b7280;line-height:1.5;">
              Se o botão não funcionar, copie e cole este link no seu navegador:<br>
              <a href="${actionLink}" style="color:#0d9488;word-break:break-all;">${actionLink}</a>
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="font-size:12px;color:#9ca3af;text-align:center;">
              FlipClass — Plataforma de Sala de Aula Invertida
            </p>
          </div>
        </body>
        </html>
      `;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FlipClass <noreply@notify.tbl.posologia.app>",
          to: [email],
          subject: "Você foi convidado para o FlipClass!",
          html: emailHtml,
        }),
      });

      if (!resendRes.ok) {
        const resendError = await resendRes.text();
        console.error("Resend error:", resendRes.status, resendError);
        return new Response(JSON.stringify({ error: `Erro ao enviar email: ${resendError}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert as pending — will become active when user confirms
      const { error: insertError } = await adminClient
        .from("admin_invites")
        .insert({
          email,
          invited_by: userId,
          granted_plan: "institutional",
          status: "pending",
        });

      if (insertError) {
        console.error("Error inserting invite:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create/update profile for the newly invited user
      if (linkData?.user) {
        await adminClient
          .from("profiles")
          .upsert({
            user_id: linkData.user.id,
            approval_status: "approved",
            approved_by: userId,
            approved_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove_teacher") {
      const email = (body.email || "").trim().toLowerCase();
      if (!email) {
        return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient
        .from("admin_invites")
        .update({ status: "revoked" })
        .eq("email", email)
        .eq("invited_by", userId)
        .in("status", ["active", "pending"]);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("institutional-dashboard error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
