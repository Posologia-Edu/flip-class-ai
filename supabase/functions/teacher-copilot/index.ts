import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COST_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  groq: { input: 0.59, output: 0.79 },
  openai: { input: 0.15, output: 0.60 },
  openrouter: { input: 0.15, output: 0.60 },
  google: { input: 0.15, output: 0.60 },
  anthropic: { input: 3.0, output: 15.0 },
  lovable: { input: 0.15, output: 0.60 },
};
const estimateCost = (p: string, i: number, o: number) => {
  const r = COST_PER_M_TOKENS[p] || COST_PER_M_TOKENS.lovable;
  return (i * r.input + o * r.output) / 1_000_000;
};

const SYSTEM_PROMPT = `Você é o **Copilot Pedagógico**, um assistente de IA para professores em uma plataforma de Sala de Aula Invertida.

Sua função: ajudar o professor a entender o desempenho da turma, identificar alunos em risco, sugerir intervenções, propor questões e atividades, e responder dúvidas com base nos DADOS REAIS da sala fornecidos no contexto.

DIRETRIZES:
- Use markdown (listas, **negrito**, tabelas) para clareza.
- Quando citar alunos, use o nome real fornecido. Nunca invente nomes, notas ou dados.
- Seja conciso e prático: vá direto à ação recomendada.
- Quando faltar dado, diga claramente "não há dados suficientes" em vez de inventar.
- Linguagem em português do Brasil, tom profissional e acolhedor.
- Quando o professor pedir para "gerar questões", "rascunhar atividade" ou "escrever feedback", entregue o texto pronto para copiar.`;

async function buildRoomContext(svc: any, roomId: string) {
  const [{ data: room }, { data: students }, { data: activities }, { data: materials }, { data: sims }, { data: feedback }] = await Promise.all([
    svc.from("rooms").select("id, title, description, discipline_id").eq("id", roomId).single(),
    svc.from("student_sessions").select("id, student_name, student_email, total_score, completed_at, created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
    svc.from("activities").select("id, title, type, is_published").eq("room_id", roomId),
    svc.from("materials").select("id, title, type").eq("room_id", roomId),
    svc.from("simulations").select("id, title, is_longitudinal, total_chapters").eq("room_id", roomId),
    svc.from("teacher_feedback").select("student_session_id, score, feedback_text").eq("room_id", roomId).limit(200),
  ]);

  const studentList = (students || []).map((s: any) =>
    `- ${s.student_name}${s.student_email ? ` (${s.student_email})` : ""}: nota total ${s.total_score ?? "—"}${s.completed_at ? " ✓ concluiu" : " ⏳ em andamento"}`
  ).join("\n");

  const completed = (students || []).filter((s: any) => s.completed_at);
  const avgScore = completed.length > 0
    ? (completed.reduce((a: number, s: any) => a + (Number(s.total_score) || 0), 0) / completed.length).toFixed(2)
    : "n/a";

  const atRisk = completed.filter((s: any) => (Number(s.total_score) || 0) < 6).map((s: any) => s.student_name);

  // Recent simulation sessions for diagnostic
  let simInsights = "";
  if (sims && sims.length > 0) {
    const { data: simRuns } = await svc.from("simulation_sessions")
      .select("simulation_id, ai_score, chapter, status, student_session_id")
      .in("simulation_id", sims.map((s: any) => s.id))
      .limit(100);
    const avgSim = (simRuns || []).filter((r: any) => r.ai_score != null);
    if (avgSim.length > 0) {
      const mean = (avgSim.reduce((a: number, r: any) => a + r.ai_score, 0) / avgSim.length).toFixed(2);
      simInsights = `Simulações: ${sims.length} criadas, ${avgSim.length} concluídas, nota média IA ${mean}.`;
    }
  }

  return `## DADOS DA SALA: ${room?.title || "Sem título"}
Descrição: ${room?.description || "—"}

### Resumo numérico
- Alunos com sessão: ${(students || []).length}
- Alunos que concluíram: ${completed.length}
- Nota média (concluídos): ${avgScore}
- Alunos em risco (nota < 6): ${atRisk.length > 0 ? atRisk.join(", ") : "nenhum"}
- Atividades: ${(activities || []).length} (publicadas: ${(activities || []).filter((a: any) => a.is_published).length})
- Materiais: ${(materials || []).length}
- ${simInsights || "Nenhuma simulação criada ainda."}

### Lista de alunos (até 200)
${studentList || "Nenhum aluno acessou ainda."}

### Atividades
${(activities || []).map((a: any) => `- ${a.title} (${a.type})${a.is_published ? "" : " [rascunho]"}`).join("\n") || "—"}

### Materiais
${(materials || []).map((m: any) => `- ${m.title} (${m.type})`).join("\n") || "—"}

### Feedbacks já lançados
${(feedback || []).length} feedbacks registrados.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: uerr } = await authClient.auth.getUser();
    if (uerr || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { roomId, messages } = await req.json();
    if (!roomId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "roomId e messages obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const svc = createClient(url, service);
    const { data: room } = await svc.from("rooms").select("teacher_id").eq("id", roomId).single();
    const { data: isCollab } = await svc.rpc("is_room_collaborator", { _room_id: roomId, _user_id: user.id });
    if (!room || (room.teacher_id !== user.id && !isCollab)) {
      return new Response(JSON.stringify({ error: "Sem acesso a esta sala" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const context = await buildRoomContext(svc, roomId);

    // Limit conversation to last 16 messages to stay within token budget
    const trimmed = messages.slice(-16).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 8000),
    }));

    const customKeys = await getCustomProviderKeys(svc);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const result = await callAiWithFallbackDetailed({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: context },
          ...trimmed,
        ],
        signal: controller.signal,
        customProviderKeys: customKeys,
      });
      clearTimeout(timeout);

      await svc.from("ai_usage_log").insert({
        user_id: user.id,
        usage_type: "chat",
        provider: result.provider,
        model: result.model,
        prompt_type: "teacher_copilot",
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
        estimated_cost_usd: estimateCost(result.provider, result.tokens_input, result.tokens_output),
      });

      return new Response(JSON.stringify({ success: true, message: result.content, provider: result.provider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }
  } catch (e: any) {
    console.error("teacher-copilot error", e);
    return new Response(JSON.stringify({ error: e.message || "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
