import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find rooms that will unlock within the next 1 hour and haven't been notified yet
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, title, unlock_at")
      .not("unlock_at", "is", null)
      .gte("unlock_at", now)
      .lte("unlock_at", oneHourFromNow);

    if (!rooms || rooms.length === 0) {
      return new Response(JSON.stringify({ message: "No upcoming deadlines" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notificationsCreated = 0;

    for (const room of rooms) {
      // Check if we already sent a deadline notification for this room recently
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("room_id", room.id)
        .eq("type", "deadline_approaching")
        .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Get all student sessions in this room
      const { data: sessions } = await supabase
        .from("student_sessions")
        .select("id")
        .eq("room_id", room.id)
        .is("completed_at", null);

      if (!sessions || sessions.length === 0) continue;

      const notifications = sessions.map((s: any) => ({
        room_id: room.id,
        session_id: s.id,
        type: "deadline_approaching",
        title: "Atividade será liberada em breve!",
        message: `A atividade da sala "${room.title}" será desbloqueada em menos de 1 hora. Prepare-se!`,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (!error) notificationsCreated += notifications.length;
    }

    return new Response(
      JSON.stringify({ success: true, notificationsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-deadlines:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
