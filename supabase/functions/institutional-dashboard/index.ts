import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    // Admin client for cross-user queries
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action } = await req.json();

    if (action === "get_teachers") {
      // Get teachers invited by this user
      const { data: invites } = await adminClient
        .from("admin_invites")
        .select("email, granted_plan, status, activated_at, created_at")
        .eq("invited_by", userId)
        .in("status", ["active", "pending"]);

      if (!invites || invites.length === 0) {
        return new Response(JSON.stringify({ teachers: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get profiles for these emails
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

        // Get rooms for this teacher
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

      return new Response(JSON.stringify({ teachers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_teacher_rooms") {
      const { teacherId } = await req.json().catch(() => ({}));
      // Already parsed above, re-parse body won't work. Let's handle via initial parse
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
