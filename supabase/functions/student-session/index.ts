import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    if (req.method === "GET") {
      // Fetch student session data by sessionId
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "sessionId is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Fetch session, activity logs, and teacher feedback in parallel
      const [sessRes, logsRes, feedbackRes] = await Promise.all([
        supabase.from("student_sessions").select("*").eq("id", sessionId).single(),
        supabase.from("student_activity_logs").select("*").eq("session_id", sessionId),
        supabase.from("teacher_feedback").select("*").eq("session_id", sessionId),
      ]);

      if (sessRes.error || !sessRes.data) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      return new Response(JSON.stringify({
        session: sessRes.data,
        activityLogs: logsRes.data || [],
        teacherFeedbacks: feedbackRes.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action, sessionId, roomId, data } = body;

      if (action === "create_session") {
        // Server-side validated student session creation
        if (!roomId || typeof roomId !== "string") {
          return new Response(JSON.stringify({ error: "roomId is required" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        const name = typeof data?.student_name === "string" ? data.student_name.trim() : "";
        const email = typeof data?.student_email === "string" ? data.student_email.trim().toLowerCase() : "";

        if (name.length < 2 || name.length > 100) {
          return new Response(JSON.stringify({ error: "Nome deve ter entre 2 e 100 caracteres" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        // Strip HTML tags from name to prevent XSS
        const sanitizedName = name.replace(/<[^>]*>/g, "");

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
          return new Response(JSON.stringify({ error: "Email inválido" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        // Verify room exists
        const { data: room, error: roomErr } = await supabase
          .from("rooms").select("id").eq("id", roomId).single();
        if (roomErr || !room) {
          return new Response(JSON.stringify({ error: "Sala não encontrada" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          });
        }

        const { data: session, error: insertErr } = await supabase
          .from("student_sessions")
          .insert({
            room_id: roomId,
            student_name: sanitizedName,
            student_email: email,
          })
          .select("id")
          .single();

        if (insertErr) throw insertErr;

        return new Response(JSON.stringify({ sessionId: session.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!sessionId) {
        return new Response(JSON.stringify({ error: "sessionId is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      if (action === "submit") {
        // Submit quiz answers - only if not already completed
        const { data: existing } = await supabase
          .from("student_sessions")
          .select("completed_at")
          .eq("id", sessionId)
          .single();

        if (existing?.completed_at) {
          return new Response(JSON.stringify({ error: "Session already completed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        const { error } = await supabase.from("student_sessions").update({
          score: data.score,
          answers: data.answers,
          completed_at: new Date().toISOString(),
        }).eq("id", sessionId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "log_activity") {
        // Log student activity
        const { error } = await supabase.from("student_activity_logs").insert({
          session_id: sessionId,
          room_id: roomId,
          activity_type: data.activity_type,
          material_id: data.material_id || null,
          duration_seconds: data.duration_seconds || 0,
        });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
