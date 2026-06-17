import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

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

    const { roomId } = await req.json();
    if (!roomId) return json({ error: "roomId obrigatório" }, 400);

    // Fetch materials & activities
    const [{ data: materials }, { data: activities }] = await Promise.all([
      svc.from("materials").select("id, title, content_text_for_ai, type").eq("room_id", roomId),
      svc.from("activities").select("id, title, quiz_data").eq("room_id", roomId),
    ]);

    // Build a corpus summary for AI
    const matSummaries = (materials || []).map((m: any) => ({
      id: m.id,
      title: m.title || "Sem título",
      excerpt: ((m.content_text_for_ai || "") + "").slice(0, 1500),
    }));

    const questions: any[] = [];
    for (const act of (activities || [])) {
      const levels = (act.quiz_data?.levels || []) as any[];
      for (const lv of levels) {
        for (const q of (lv.questions || [])) {
          if (q.question) questions.push({ activity_id: act.id, text: q.question, context: q.context || "" });
        }
      }
    }

    // Truncate prompt context
    const corpus = JSON.stringify({ materials: matSummaries, questions: questions.slice(0, 80) }).slice(0, 38000);

    const customKeys = await getCustomProviderKeys(svc);
    const ai = await callAiWithFallbackDetailed({
      messages: [
        {
          role: "system",
          content: `Você é um especialista em mapeamento conceitual educacional. Receberá materiais e questões de uma disciplina. Sua tarefa: extrair 6 a 14 TÓPICOS centrais (conceitos abstratos da disciplina) e indicar quais materiais e quais questões pertencem a cada tópico. Também aponte relações entre tópicos.

Responda APENAS com JSON válido neste formato:
{
  "topics": [
    { "id": "t1", "label": "Nome do tópico", "summary": "1-2 frases explicando" }
  ],
  "material_links": [
    { "material_id": "uuid", "topic_id": "t1", "weight": 0.9 }
  ],
  "question_links": [
    { "question_index": 0, "topic_id": "t1", "weight": 0.8 }
  ],
  "topic_edges": [
    { "source": "t1", "target": "t2", "weight": 0.6 }
  ]
}

Use o índice numérico das questões na ordem em que aparecem na lista. Não inclua comentários nem texto fora do JSON.`,
        },
        { role: "user", content: corpus },
      ],
      customProviderKeys: customKeys,
    });

    // Parse JSON robustly
    let parsed: any = null;
    try {
      const match = ai.content.match(/\{[\s\S]*\}$/m) || ai.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : ai.content);
    } catch (e) {
      return json({ error: "Falha ao parsear resposta da IA", raw: ai.content.slice(0, 500) }, 500);
    }

    // Wipe existing graph
    await svc.from("knowledge_edges").delete().eq("room_id", roomId);
    await svc.from("knowledge_nodes").delete().eq("room_id", roomId);

    // Insert material nodes
    const matNodes: any[] = matSummaries.map((m) => ({
      room_id: roomId, kind: "material", label: m.title, ref_id: m.id,
    }));
    const { data: insertedMats } = await svc.from("knowledge_nodes").insert(matNodes).select("id, ref_id");
    const matIdMap = new Map((insertedMats || []).map((n: any) => [n.ref_id, n.id]));

    // Insert topic nodes
    const topics = (parsed.topics || []) as any[];
    const topicNodes = topics.map((t) => ({
      room_id: roomId, kind: "topic", label: t.label, summary: t.summary || null,
      ref_meta: { ai_id: t.id },
    }));
    const { data: insertedTopics } = await svc.from("knowledge_nodes").insert(topicNodes).select("id, ref_meta");
    const topicIdMap = new Map((insertedTopics || []).map((n: any) => [n.ref_meta?.ai_id, n.id]));

    // Insert question nodes (keep activity_id + index for mastery linking)
    const qNodes = questions.slice(0, 80).map((q, idx) => ({
      room_id: roomId, kind: "question", label: q.text.slice(0, 120),
      ref_meta: { activity_id: q.activity_id, question_index: idx },
    }));
    const { data: insertedQs } = await svc.from("knowledge_nodes").insert(qNodes).select("id, ref_meta");
    const qIdMap = new Map((insertedQs || []).map((n: any, i: number) => [i, n.id]));

    // Edges
    const edges: any[] = [];
    for (const ml of (parsed.material_links || [])) {
      const s = matIdMap.get(ml.material_id);
      const t = topicIdMap.get(ml.topic_id);
      if (s && t) edges.push({ room_id: roomId, source_id: s, target_id: t, weight: ml.weight || 0.7, kind: "material-topic" });
    }
    for (const ql of (parsed.question_links || [])) {
      const s = qIdMap.get(ql.question_index);
      const t = topicIdMap.get(ql.topic_id);
      if (s && t) edges.push({ room_id: roomId, source_id: s, target_id: t, weight: ql.weight || 0.7, kind: "question-topic" });
    }
    for (const te of (parsed.topic_edges || [])) {
      const s = topicIdMap.get(te.source);
      const t = topicIdMap.get(te.target);
      if (s && t && s !== t) edges.push({ room_id: roomId, source_id: s, target_id: t, weight: te.weight || 0.5, kind: "topic-topic" });
    }
    if (edges.length) await svc.from("knowledge_edges").insert(edges);

    return json({ success: true, topics: topics.length, materials: matSummaries.length, questions: questions.length, edges: edges.length });
  } catch (e: any) {
    console.error("knowledge-graph-build", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
