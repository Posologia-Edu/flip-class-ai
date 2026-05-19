import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STEP_PROMPT = `Você é o motor narrativo de uma SIMULAÇÃO INTERATIVA RAMIFICADA para aprendizagem.

Você recebe: o cenário base, o histórico de decisões do aluno e a última decisão tomada.
Retorne em JSON ESTRITO o próximo passo da simulação, respondendo às consequências da decisão do aluno:

{
  "feedback_on_previous": "Feedback imediato (2-4 frases) explicando a consequência da decisão tomada, com base em conceitos do material. Educativo, construtivo, em PT-BR.",
  "narrative": "Nova situação resultante da decisão. 2-4 frases. Termine com 'O que você faz?' ou similar.",
  "options": [
    { "label": "Opção A — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção B — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção C — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção D — descrição curta", "quality": "good|neutral|bad" }
  ],
  "is_final": false
}

REGRAS:
- A história deve ser COERENTE com decisões anteriores: decisões ruins levam a complicações; decisões boas abrem caminhos positivos.
- 4 opções por passo, qualidades variadas.
- Use conceitos do material/objetivo de aprendizagem.
- Linguagem PT-BR clara.`;

const FINAL_PROMPT = `Você é o avaliador de uma SIMULAÇÃO INTERATIVA RAMIFICADA.

Você recebe o cenário, a rubrica de avaliação, o histórico completo de decisões do aluno e a última decisão.
Gere o DESFECHO FINAL e a avaliação. Retorne JSON ESTRITO:

{
  "feedback_on_previous": "Feedback sobre a última decisão (2-3 frases).",
  "narrative": "Desfecho final da simulação: como a história termina dadas as decisões do aluno. 3-5 frases.",
  "options": [],
  "is_final": true,
  "ai_score": 7.5,
  "ai_feedback": "Avaliação detalhada baseada na rubrica (4-6 frases). Aponte acertos, erros, decisões críticas e o que poderia ter sido feito diferente. Inclua sugestões de estudo."
}

Nota de 0 a 10 com uma casa decimal. Seja justo: avalie a maioria das decisões boas como 8-10, mistas como 5-7, ruins como 0-4.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(url, service);

    const { action, simulationId, sessionRunId, studentSessionId, chosenIndex } = await req.json();

    if (action === "start") {
      if (!simulationId || !studentSessionId) {
        return new Response(JSON.stringify({ error: "simulationId e studentSessionId obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Create or reuse in_progress
      const { data: existing } = await svc.from("simulation_sessions")
        .select("*").eq("simulation_id", simulationId).eq("student_session_id", studentSessionId).eq("status", "in_progress").maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ success: true, run: existing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: created, error } = await svc.from("simulation_sessions").insert({
        simulation_id: simulationId,
        student_session_id: studentSessionId,
        history: [],
        status: "in_progress",
      }).select("*").single();
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, run: created }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action !== "step") {
      return new Response(JSON.stringify({ error: "ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!sessionRunId || chosenIndex == null) {
      return new Response(JSON.stringify({ error: "sessionRunId e chosenIndex obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: run, error: rerr } = await svc.from("simulation_sessions").select("*").eq("id", sessionRunId).single();
    if (rerr || !run) throw new Error("Sessão não encontrada");
    if (run.status === "completed") {
      return new Response(JSON.stringify({ error: "Simulação já concluída" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: sim, error: serr } = await svc.from("simulations").select("*").eq("id", run.simulation_id).single();
    if (serr || !sim) throw new Error("Simulação não encontrada");

    const scenario: any = sim.scenario || {};
    const history: any[] = Array.isArray(run.history) ? run.history : [];

    // Determine current options the student is choosing from
    const currentOptions = history.length === 0
      ? (scenario.initial_options || [])
      : (history[history.length - 1].options || []);
    const chosen = currentOptions[chosenIndex];
    if (!chosen) throw new Error("Opção inválida");

    const stepsTaken = history.length + 1;
    const isFinal = stepsTaken >= (sim.max_steps || 6);

    const transcript = [
      `CENÁRIO: ${scenario.setting}`,
      `OBJETIVO: ${sim.learning_objectives}`,
      `RUBRICA: ${scenario.rubric || "Aplicação dos conceitos do material e tomada de decisão crítica."}`,
      "",
      `SITUAÇÃO INICIAL: ${scenario.initial_situation}`,
      "",
      "HISTÓRICO DE DECISÕES:",
      ...history.map((h, i) =>
        `Passo ${i + 1}:\n  Situação: ${h.narrative}\n  Decisão escolhida: ${h.chosen?.label} (qualidade: ${h.chosen?.quality})\n  Consequência: ${h.feedback_on_previous}`
      ),
      "",
      `DECISÃO ATUAL (passo ${stepsTaken}): ${chosen.label} (qualidade: ${chosen.quality})`,
      isFinal
        ? "\nEsta é a ÚLTIMA decisão. Gere o desfecho final e a avaliação."
        : "\nGere o próximo passo da simulação.",
    ].join("\n");

    const customKeys = await getCustomProviderKeys(svc);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const ai = await callAiWithFallbackDetailed({
      messages: [
        { role: "system", content: isFinal ? FINAL_PROMPT : STEP_PROMPT },
        { role: "user", content: transcript },
      ],
      signal: controller.signal,
      customProviderKeys: customKeys,
    });
    clearTimeout(timeout);

    const cleaned = ai.content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("IA retornou formato inválido");
    const step = JSON.parse(match[0]);

    const newEntry = {
      chosen,
      feedback_on_previous: step.feedback_on_previous,
      narrative: step.narrative,
      options: step.options || [],
      is_final: !!step.is_final || isFinal,
    };
    const newHistory = [...history, newEntry];

    const updates: any = { history: newHistory };
    if (newEntry.is_final) {
      updates.status = "completed";
      updates.completed_at = new Date().toISOString();
      updates.ai_score = typeof step.ai_score === "number" ? step.ai_score : null;
      updates.ai_feedback = step.ai_feedback || null;
    }
    const { data: updated, error: uerr } = await svc.from("simulation_sessions").update(updates).eq("id", run.id).select("*").single();
    if (uerr) throw new Error(uerr.message);

    return new Response(JSON.stringify({ success: true, run: updated, step: newEntry }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("simulation-step error", e);
    return new Response(JSON.stringify({ error: e.message || "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
