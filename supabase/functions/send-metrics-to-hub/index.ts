import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hubServiceKey = Deno.env.get("HUB_SERVICE_KEY");
    const hubServiceId = Deno.env.get("HUB_SERVICE_ID");

    if (!hubServiceKey || !hubServiceId) {
      throw new Error("Missing HUB_SERVICE_KEY or HUB_SERVICE_ID secrets");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Total users (profiles)
    const { count: totalUsers, error: profilesErr } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (profilesErr) throw profilesErr;

    // Active users: profiles created or with sessions in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Count distinct teacher_ids with rooms that had sessions in last 30 days
    const { data: activeSessions } = await supabase
      .from("student_sessions")
      .select("room_id")
      .gte("created_at", thirtyDaysAgo);

    const activeRoomIds = [...new Set((activeSessions || []).map((s) => s.room_id))];

    let activeTeachers = 0;
    if (activeRoomIds.length > 0) {
      const { data: activeRooms } = await supabase
        .from("rooms")
        .select("teacher_id")
        .in("id", activeRoomIds);
      activeTeachers = new Set((activeRooms || []).map((r) => r.teacher_id)).size;
    }

    // Count active students (distinct sessions in last 30 days)
    const activeStudents = new Set((activeSessions || []).map((s) => s.room_id)).size > 0
      ? (activeSessions || []).length
      : 0;

    const activeUsers = activeTeachers + activeStudents;

    const payload = {
      service_id: hubServiceId,
      total_users: totalUsers ?? 0,
      active_users: activeUsers,
      subscribers: 0,
      ai_requests: 0,
      ai_tokens_used: 0,
      ai_cost_usd: 0,
      revenue_usd: 0,
      mrr_usd: 0,
    };

    console.log("Sending metrics to hub:", JSON.stringify(payload));

    const response = await fetch(
      "https://slmnpcabhjsqithkmkxn.supabase.co/functions/v1/report-metrics",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-key": hubServiceKey,
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Hub responded with ${response.status}: ${responseText}`);
      return new Response(JSON.stringify({ error: "Hub request failed", status: response.status, body: responseText }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Metrics sent successfully:", responseText);

    return new Response(JSON.stringify({ success: true, metrics: payload }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending metrics:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
