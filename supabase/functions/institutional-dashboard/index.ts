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
      const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existingUser = authUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === email
      );

      if (existingUser) {
        // User already has an account — add them directly as active
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
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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

      // New user — invite via Supabase Auth (sends invite email with password setup link)
      // Determine the app URL from the request origin or referer
      const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "";
      const redirectUrl = origin ? `${origin}/reset-password` : undefined;

      const inviteOptions: any = {};
      if (redirectUrl) {
        inviteOptions.redirectTo = redirectUrl;
      }

      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, inviteOptions);

      if (inviteError) {
        return new Response(JSON.stringify({ error: `Erro ao enviar convite: ${inviteError.message}` }), {
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
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create profile as pending for the newly invited user
      if (inviteData?.user) {
        await adminClient
          .from("profiles")
          .upsert({
            user_id: inviteData.user.id,
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
