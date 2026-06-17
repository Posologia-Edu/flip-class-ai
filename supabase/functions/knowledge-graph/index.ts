import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(url, service);

    const { roomId, studentEmail } = await req.json();
    if (!roomId) return json({ error: "roomId obrigatório" }, 400);

    const [{ data: nodes }, { data: edges }] = await Promise.all([
      svc.from("knowledge_nodes").select("*").eq("room_id", roomId),
      svc.from("knowledge_edges").select("*").eq("room_id", roomId),
    ]);

    // Compute mastery per question node using teacher_feedback for this student (or aggregate across students for teacher view)
    let mastery: Record<string, number> = {}; // node_id -> 0..1
    let gaps: any[] = []; // for teacher: topics with low avg mastery

    const questionNodes = (nodes || []).filter((n: any) => n.kind === "question");

    // Build session list
    let sessions: any[] = [];
    if (studentEmail) {
      const { data } = await svc.from("student_sessions").select("id, answers")
        .eq("room_id", roomId).eq("student_email", studentEmail);
      sessions = data || [];
    } else {
      const { data } = await svc.from("student_sessions").select("id, answers, student_email").eq("room_id", roomId);
      sessions = data || [];
    }
    const sessionIds = sessions.map((s) => s.id);

    let feedbacks: any[] = [];
    if (sessionIds.length) {
      const { data } = await svc.from("teacher_feedback").select("session_id, question_key, grade").in("session_id", sessionIds);
      feedbacks = data || [];
    }

    // For each question node, average grade across feedbacks where question_key matches activity+index
    for (const qn of questionNodes) {
      const meta = qn.ref_meta || {};
      const matching = feedbacks.filter((f: any) => {
        if (!f.question_key) return false;
        // question_key pattern "li-qi" — we don't know level index, accept anything ending the global index
        return f.question_key.endsWith(`-${meta.question_index}`) && f.grade != null;
      });
      if (matching.length > 0) {
        const avg = matching.reduce((s: number, m: any) => s + Number(m.grade), 0) / matching.length;
        mastery[qn.id] = Math.max(0, Math.min(1, avg / 10));
      }
    }

    // Propagate to topic nodes via question-topic edges
    const topicNodes = (nodes || []).filter((n: any) => n.kind === "topic");
    for (const tn of topicNodes) {
      const linkedQs = (edges || []).filter((e: any) => e.target_id === tn.id && e.kind === "question-topic");
      const scores = linkedQs.map((e: any) => mastery[e.source_id]).filter((v: any) => v != null);
      if (scores.length > 0) {
        const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        mastery[tn.id] = avg;
        if (avg < 0.5) gaps.push({ node_id: tn.id, label: tn.label, mastery: avg, sample_size: scores.length });
      }
    }

    return json({ success: true, nodes, edges, mastery, gaps });
  } catch (e: any) {
    console.error("knowledge-graph", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
