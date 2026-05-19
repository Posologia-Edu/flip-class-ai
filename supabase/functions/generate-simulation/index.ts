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

const SYSTEM_PROMPT = `Você é um designer instrucional especializado em criar SIMULAÇÕES INTERATIVAS RAMIFICADAS para aprendizagem experiencial.

A partir dos materiais educacionais fornecidos e do objetivo de aprendizagem, gere o CENÁRIO INICIAL de uma simulação ramificada onde o aluno tomará decisões sequenciais que afetam o desfecho.

Retorne JSON ESTRITO neste formato:
{
  "title": "Título curto da simulação",
  "setting": "Contexto detalhado da simulação: papel do aluno, ambiente, situação inicial, atores envolvidos. 3-5 frases.",
  "initial_situation": "Primeira situação concreta que o aluno enfrenta — descreva claramente o que está acontecendo agora. Termine com 'O que você faz?' ou similar.",
  "initial_options": [
    { "label": "Opção A — descrição curta da decisão", "quality": "good|neutral|bad" },
    { "label": "Opção B — descrição curta da decisão", "quality": "good|neutral|bad" },
    { "label": "Opção C — descrição curta da decisão", "quality": "good|neutral|bad" },
    { "label": "Opção D — descrição curta da decisão", "quality": "good|neutral|bad" }
  ],
  "rubric": "Critérios pedagógicos pelos quais o desempenho do aluno será avaliado ao final (3-5 critérios baseados no objetivo)."
}

REGRAS:
- 4 opções iniciais, com qualidades variadas (não todas boas).
- A simulação deve ser BASEADA no conteúdo fornecido — use conceitos, termos e fatos do material.
- Linguagem em português do Brasil.
- NÃO inclua a resposta correta nas opções visíveis — apenas marque "quality" para uso interno.`;

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

    const { roomId, materialIds = [], title, description, learningObjectives, maxSteps = 6 } = await req.json();
    if (!roomId || !learningObjectives) {
      return new Response(JSON.stringify({ error: "roomId e learningObjectives são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const svc = createClient(url, service);
    const { data: room } = await svc.from("rooms").select("teacher_id").eq("id", roomId).single();
    if (!room || room.teacher_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Concatenate selected materials' content
    let context = "";
    if (materialIds.length > 0) {
      const { data: mats } = await svc.from("materials").select("title, content_text_for_ai, type").in("id", materialIds);
      context = (mats || []).map((m: any) => `## ${m.title} (${m.type})\n${(m.content_text_for_ai || "").slice(0, 8000)}`).join("\n\n");
    }
    const MAX = 30000;
    if (context.length > MAX) context = context.slice(0, MAX) + "\n[truncado]";

    const customKeys = await getCustomProviderKeys(svc);
    const userPrompt = `OBJETIVO DE APRENDIZAGEM: ${learningObjectives}

${description ? `DESCRIÇÃO ADICIONAL: ${description}\n` : ""}
${context ? `MATERIAIS DA SALA:\n${context}` : "Crie a simulação com base apenas no objetivo de aprendizagem."}

A simulação terá no máximo ${maxSteps} passos. Gere o CENÁRIO INICIAL conforme o JSON especificado.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const result = await callAiWithFallbackDetailed({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        signal: controller.signal,
        customProviderKeys: customKeys,
      });
      clearTimeout(timeout);

      const cleaned = result.content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("IA retornou formato inválido");
      const scenario = JSON.parse(match[0]);

      const { data: inserted, error: insErr } = await svc.from("simulations").insert({
        room_id: roomId,
        title: title || scenario.title || "Simulação Interativa",
        description: description || "",
        learning_objectives: learningObjectives,
        material_ids: materialIds,
        scenario,
        max_steps: maxSteps,
      }).select("*").single();
      if (insErr) throw new Error(insErr.message);

      await svc.from("ai_usage_log").insert({
        user_id: user.id,
        usage_type: "generation",
        provider: result.provider,
        model: result.model,
        prompt_type: "simulation_generation",
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
        estimated_cost_usd: estimateCost(result.provider, result.tokens_input, result.tokens_output),
      });

      return new Response(JSON.stringify({ success: true, simulation: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }
  } catch (e: any) {
    console.error("generate-simulation error", e);
    return new Response(JSON.stringify({ error: e.message || "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
