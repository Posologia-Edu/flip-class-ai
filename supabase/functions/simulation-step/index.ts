import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STEP_PROMPT = `Você é o motor narrativo de uma SIMULAÇÃO INTERATIVA RAMIFICADA para aprendizagem.

Retorne em JSON ESTRITO:
{
  "feedback_on_previous": "Feedback (2-4 frases) sobre a consequência da decisão.",
  "narrative": "Nova situação. Termine com 'O que você faz?'.",
  "options": [
    { "label": "Opção A — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção B — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção C — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção D — descrição curta", "quality": "good|neutral|bad" }
  ],
  "is_final": false
}

REGRAS: História coerente com decisões anteriores. 4 opções variadas. PT-BR.`;

const CHAPTER_FINAL_PROMPT = `Você é o avaliador parcial de uma SIMULAÇÃO LONGITUDINAL (paciente persistente).

Este capítulo está terminando, mas a simulação CONTINUA em capítulos futuros. Avalie APENAS este capítulo e ATUALIZE o estado do paciente.

Retorne JSON ESTRITO:
{
  "feedback_on_previous": "Feedback sobre a última decisão (2-3 frases).",
  "narrative": "Desfecho deste capítulo (3-4 frases) — não encerre o caso, apenas conclua o capítulo atual.",
  "options": [],
  "is_final": true,
  "chapter_score": 7.5,
  "chapter_summary": "Resumo objetivo (2-3 frases) do que aconteceu neste capítulo e das decisões-chave do aluno.",
  "patient_state_update": {
    "clinical": { "PA": "...", "FC": 0, "glicemia": 0 },
    "narrative_summary": "Como o paciente está AGORA, após este capítulo. Esta narrativa abrirá o próximo capítulo."
  }
}

REGRAS: O \`patient_state_update\` deve REFLETIR as decisões: decisões boas → melhora; ruins → piora/complicações. Mantenha a estrutura do estado.`;

const FINAL_PROMPT = `Você é o avaliador FINAL de uma SIMULAÇÃO INTERATIVA.

Retorne JSON ESTRITO:
{
  "feedback_on_previous": "Feedback sobre a última decisão (2-3 frases).",
  "narrative": "Desfecho final (3-5 frases) considerando TODOS os capítulos/decisões.",
  "options": [],
  "is_final": true,
  "ai_score": 7.5,
  "ai_feedback": "Avaliação detalhada (5-8 frases) baseada na rubrica e em TODOS os capítulos. Aponte acertos, erros, decisões críticas e sugestões de estudo."
}

Nota 0-10, 1 casa decimal.`;

const NEXT_CHAPTER_PROMPT = `Você é o motor narrativo de uma SIMULAÇÃO LONGITUDINAL (paciente persistente).

Você recebe o estado atual do paciente (após capítulos anteriores) e deve INICIAR o próximo capítulo. O capítulo deve refletir a passagem de tempo e as consequências acumuladas.

Retorne JSON ESTRITO:
{
  "chapter_title": "Título do novo capítulo",
  "initial_situation": "Situação inicial deste capítulo, conectada ao estado atual do paciente. Termine com 'O que você faz?'.",
  "initial_options": [
    { "label": "Opção A — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção B — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção C — descrição curta", "quality": "good|neutral|bad" },
    { "label": "Opção D — descrição curta", "quality": "good|neutral|bad" }
  ]
}

REGRAS: 4 opções variadas. Conecte explicitamente com a evolução do paciente. PT-BR clínico.`;

function safeParseJson(content: string) {
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA retornou formato inválido");
  return JSON.parse(match[0]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(url, service);

    const { action, simulationId, sessionRunId, studentSessionId, chosenIndex } = await req.json();

    // START
    if (action === "start") {
      if (!simulationId || !studentSessionId) {
        return new Response(JSON.stringify({ error: "simulationId e studentSessionId obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: existing } = await svc.from("simulation_sessions")
        .select("*").eq("simulation_id", simulationId).eq("student_session_id", studentSessionId).eq("status", "in_progress").maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ success: true, run: existing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: sim } = await svc.from("simulations").select("baseline_state, is_longitudinal").eq("id", simulationId).single();
      const { data: created, error } = await svc.from("simulation_sessions").insert({
        simulation_id: simulationId,
        student_session_id: studentSessionId,
        history: [],
        status: "in_progress",
        chapter: 1,
        patient_state: sim?.is_longitudinal ? (sim.baseline_state || {}) : {},
        chapters_history: [],
      }).select("*").single();
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, run: created }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // NEXT CHAPTER (longitudinal)
    if (action === "next_chapter") {
      if (!sessionRunId) throw new Error("sessionRunId obrigatório");
      const { data: run } = await svc.from("simulation_sessions").select("*").eq("id", sessionRunId).single();
      if (!run) throw new Error("Sessão não encontrada");
      const { data: sim } = await svc.from("simulations").select("*").eq("id", run.simulation_id).single();
      if (!sim || !sim.is_longitudinal) throw new Error("Simulação não é longitudinal");
      if (run.chapter >= sim.total_chapters) throw new Error("Não há próximo capítulo");

      const customKeys = await getCustomProviderKeys(svc);
      const newChapterNum = run.chapter + 1;
      const transcript = [
        `CENÁRIO GERAL: ${sim.scenario?.setting}`,
        `OBJETIVO: ${sim.learning_objectives}`,
        `RUBRICA: ${sim.scenario?.rubric || ""}`,
        ``,
        `PACIENTE BASAL: ${JSON.stringify(sim.baseline_state)}`,
        `ESTADO ATUAL DO PACIENTE: ${JSON.stringify(run.patient_state)}`,
        ``,
        `RESUMO DOS CAPÍTULOS ANTERIORES:`,
        ...(run.chapters_history || []).map((c: any, i: number) => `Capítulo ${i + 1}: ${c.summary || ""} (nota: ${c.score ?? "n/a"})`),
        ``,
        `Gere o CAPÍTULO ${newChapterNum} de ${sim.total_chapters}.`,
      ].join("\n");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const ai = await callAiWithFallbackDetailed({
        messages: [
          { role: "system", content: NEXT_CHAPTER_PROMPT },
          { role: "user", content: transcript },
        ],
        signal: controller.signal,
        customProviderKeys: customKeys,
      });
      clearTimeout(timeout);
      const ch = safeParseJson(ai.content);

      // Reset history for new chapter; keep chapters_history accumulated
      const newScenarioChapter = {
        initial_situation: ch.initial_situation,
        initial_options: ch.initial_options || [],
        chapter_title: ch.chapter_title,
      };
      const { data: updated, error: uerr } = await svc.from("simulation_sessions").update({
        chapter: newChapterNum,
        history: [],
        current_chapter_intro: newScenarioChapter as any,
      } as any).eq("id", run.id).select("*").single();
      // current_chapter_intro column may not exist; store via patient_state metadata instead
      let finalRun = updated;
      if (uerr) {
        const { data: u2, error: e2 } = await svc.from("simulation_sessions").update({
          chapter: newChapterNum,
          history: [],
          patient_state: { ...(run.patient_state || {}), __current_chapter_intro: newScenarioChapter },
        }).eq("id", run.id).select("*").single();
        if (e2) throw new Error(e2.message);
        finalRun = u2;
      }

      return new Response(JSON.stringify({ success: true, run: finalRun, chapter_intro: newScenarioChapter }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const currentChapterIntro = (run.patient_state as any)?.__current_chapter_intro || null;

    // Determine current options the student is choosing from
    let currentOptions: any[];
    let currentSituation: string;
    if (history.length === 0) {
      if (currentChapterIntro) {
        currentOptions = currentChapterIntro.initial_options || [];
        currentSituation = currentChapterIntro.initial_situation || "";
      } else {
        currentOptions = scenario.initial_options || [];
        currentSituation = scenario.initial_situation || "";
      }
    } else {
      currentOptions = history[history.length - 1].options || [];
      currentSituation = history[history.length - 1].narrative || "";
    }
    const chosen = currentOptions[chosenIndex];
    if (!chosen) throw new Error("Opção inválida");

    const stepsTaken = history.length + 1;
    const chapterFinal = stepsTaken >= (sim.max_steps || 6);
    const isLast = !!sim.is_longitudinal ? (chapterFinal && run.chapter >= sim.total_chapters) : chapterFinal;
    const isChapterFinalOnly = !!sim.is_longitudinal && chapterFinal && run.chapter < sim.total_chapters;

    const transcript = [
      `CENÁRIO: ${scenario.setting}`,
      `OBJETIVO: ${sim.learning_objectives}`,
      `RUBRICA: ${scenario.rubric || ""}`,
      ...(sim.is_longitudinal ? [
        `PACIENTE BASAL: ${JSON.stringify(sim.baseline_state)}`,
        `ESTADO ATUAL DO PACIENTE: ${JSON.stringify(run.patient_state)}`,
        `CAPÍTULO ATUAL: ${run.chapter} de ${sim.total_chapters}`,
        ...(run.chapters_history || []).map((c: any, i: number) => `Capítulo ${i + 1} resumo: ${c.summary || ""}`),
      ] : []),
      "",
      `SITUAÇÃO INICIAL DO CAPÍTULO: ${currentChapterIntro?.initial_situation || scenario.initial_situation}`,
      "",
      "HISTÓRICO DE DECISÕES NESTE CAPÍTULO:",
      ...history.map((h, i) =>
        `Passo ${i + 1}:\n  Situação: ${h.narrative}\n  Decisão: ${h.chosen?.label} (${h.chosen?.quality})\n  Consequência: ${h.feedback_on_previous}`
      ),
      "",
      `DECISÃO ATUAL (passo ${stepsTaken}): ${chosen.label} (${chosen.quality})`,
      isLast
        ? "\nEsta é a ÚLTIMA decisão da simulação. Gere o desfecho final e avaliação global."
        : isChapterFinalOnly
          ? "\nEsta é a ÚLTIMA decisão DESTE CAPÍTULO. Encerre o capítulo, atualize o estado do paciente e dê nota parcial."
          : "\nGere o próximo passo.",
    ].join("\n");

    const customKeys = await getCustomProviderKeys(svc);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const ai = await callAiWithFallbackDetailed({
      messages: [
        { role: "system", content: isLast ? FINAL_PROMPT : isChapterFinalOnly ? CHAPTER_FINAL_PROMPT : STEP_PROMPT },
        { role: "user", content: transcript },
      ],
      signal: controller.signal,
      customProviderKeys: customKeys,
    });
    clearTimeout(timeout);
    const step = safeParseJson(ai.content);

    const newEntry = {
      chosen,
      feedback_on_previous: step.feedback_on_previous,
      narrative: step.narrative,
      options: step.options || [],
      is_final: !!step.is_final || isLast || isChapterFinalOnly,
    };
    const newHistory = [...history, newEntry];

    const updates: any = { history: newHistory };

    if (isLast) {
      updates.status = "completed";
      updates.completed_at = new Date().toISOString();
      updates.ai_score = typeof step.ai_score === "number" ? step.ai_score : null;
      updates.ai_feedback = step.ai_feedback || null;
    } else if (isChapterFinalOnly) {
      // close chapter; keep session in_progress (awaiting next_chapter)
      const chapterRecord = {
        chapter: run.chapter,
        summary: step.chapter_summary || step.narrative,
        score: typeof step.chapter_score === "number" ? step.chapter_score : null,
        history: newHistory,
      };
      const newPatientState = step.patient_state_update
        ? { ...(run.patient_state || {}), ...step.patient_state_update, __current_chapter_intro: undefined }
        : { ...(run.patient_state || {}), __current_chapter_intro: undefined };
      delete newPatientState.__current_chapter_intro;
      updates.chapters_history = [...((run.chapters_history as any[]) || []), chapterRecord];
      updates.patient_state = newPatientState;
      updates.status = "chapter_ended";
    }

    const { data: updated, error: uerr } = await svc.from("simulation_sessions").update(updates).eq("id", run.id).select("*").single();
    if (uerr) throw new Error(uerr.message);

    return new Response(JSON.stringify({
      success: true,
      run: updated,
      step: newEntry,
      chapter_ended: isChapterFinalOnly,
      has_next_chapter: isChapterFinalOnly,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("simulation-step error", e);
    return new Response(JSON.stringify({ error: e.message || "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
