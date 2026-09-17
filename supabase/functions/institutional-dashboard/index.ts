import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

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

      const { data: existing } = await adminClient
        .from("admin_invites")
        .select("id, status, invited_by")
        .eq("email", email)
        .maybeSingle();

      if (existing && existing.invited_by === userId && existing.status === "active") {
        return new Response(JSON.stringify({ success: true, warning: "Este professor já foi convidado e já está ativo." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If invite is pending for this same admin, allow re-send attempt.
      // We intentionally do not early-return here so the auth invite email can be sent again.

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

      // A user created by generateLink (invite) exists in auth but hasn't confirmed yet.
      // Only treat as "existing active user" if they have actually signed in before.
      const isConfirmedUser = existingUser && existingUser.last_sign_in_at;

      if (isConfirmedUser) {
        const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "https://flip.posologia.app";

        // Check for any existing record for this email (any status / inviter) to avoid unique key conflicts
        const { data: anyExisting } = await adminClient
          .from("admin_invites")
          .select("id, status")
          .eq("email", email)
          .maybeSingle();

        if (anyExisting) {
          const { error: updateError } = await adminClient
            .from("admin_invites")
            .update({
              status: "active",
              activated_at: new Date().toISOString(),
              granted_plan: "professor",
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
              granted_plan: "professor",
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

        const loginUrl = `${origin}/auth`;

        try {
          const sendResult = await sendTemplateEmail("institutional-account-added", email, {
            templateData: { loginUrl },
            idempotencyKey: `institutional-account-added-${anyExisting?.id || existingUser.id}`,
          });

          if (!sendResult.sent) {
            console.warn("Institutional account email suppressed");
          }
        } catch (emailErr) {
          console.error("Error sending email to existing user:", emailErr);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // New user OR unconfirmed user (created by previous invite but never signed in)
      const origin2 = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "https://flip.posologia.app";

      console.log("[INVITE] Starting invite flow for NEW/unconfirmed user:", email);

      // Step 1: Generate invite link (creates user in auth if needed) WITHOUT relying on auth-email-hook
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { invited_by_admin: true },
          redirectTo: `${origin2}/reset-password`,
        },
      });

      if (linkError) {
        console.error("[INVITE] generateLink error:", linkError);
        return new Response(JSON.stringify({ error: `Erro ao gerar link de convite: ${linkError.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const confirmationUrl = linkData?.properties?.action_link;
      if (!confirmationUrl) {
        console.error("[INVITE] No action_link returned from generateLink");
        return new Response(JSON.stringify({ error: "Erro interno: link de convite não gerado." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[INVITE] Link generated successfully for:", email);

      const sendResult = await sendTemplateEmail("institutional-invite", email, {
        templateData: { confirmationUrl },
        idempotencyKey: `institutional-invite-${linkData.user?.id || email}`,
      });

      if (!sendResult.sent) {
        return new Response(JSON.stringify({ error: `Convite criado, mas o email não pôde ser enviado. Tente reenviar.` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[INVITE] Email sent successfully");

      // Step 3: Save invite as pending — idempotent by email
      const { error: insertError } = await adminClient
        .from("admin_invites")
        .upsert({
          email,
          invited_by: userId,
          granted_plan: "professor",
          status: "pending",
          activated_at: null,
        }, { onConflict: "email" });

      if (insertError) {
        console.error("[INVITE] Error inserting invite record:", insertError);
      }

      // Step 4: Create/update profile for the newly invited user
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

    if (action === "get_rooms_analytics") {
      // Get all invited teachers' user IDs
      const { data: invites } = await adminClient
        .from("admin_invites")
        .select("email")
        .eq("invited_by", userId)
        .eq("status", "active");

      if (!invites || invites.length === 0) {
        return new Response(JSON.stringify({ rooms: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const teacherIds: string[] = [userId]; // include institutional owner's own rooms too

      for (const invite of invites) {
        const authUser = authUsers?.users?.find((u: any) => u.email?.toLowerCase() === invite.email.toLowerCase());
        if (authUser) teacherIds.push(authUser.id);
      }

      // Get all rooms for these teachers
      const { data: rooms } = await adminClient
        .from("rooms")
        .select("id, title, teacher_id")
        .in("teacher_id", teacherIds);

      if (!rooms || rooms.length === 0) {
        return new Response(JSON.stringify({ rooms: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const roomIds = rooms.map((r: any) => r.id);
      const { data: sessions } = await adminClient
        .from("student_sessions")
        .select("id, room_id, completed_at, score")
        .in("room_id", roomIds);

      // Map teacher_id to email for labeling
      const teacherEmailMap: Record<string, string> = {};
      for (const invite of invites) {
        const authUser = authUsers?.users?.find((u: any) => u.email?.toLowerCase() === invite.email.toLowerCase());
        if (authUser) teacherEmailMap[authUser.id] = invite.email;
      }

      const roomAnalytics = rooms.map((room: any) => {
        const roomSessions = (sessions || []).filter((s: any) => s.room_id === room.id);
        const completed = roomSessions.filter((s: any) => s.completed_at);
        const avgScore = completed.length > 0
          ? Math.round(completed.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / completed.length)
          : 0;

        return {
          roomId: room.id,
          title: room.title,
          teacherEmail: teacherEmailMap[room.teacher_id] || "Você",
          studentCount: roomSessions.length,
          completedCount: completed.length,
          avgScore,
          completionRate: roomSessions.length > 0 ? Math.round((completed.length / roomSessions.length) * 100) : 0,
        };
      });

      return new Response(JSON.stringify({ rooms: roomAnalytics }), {
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
