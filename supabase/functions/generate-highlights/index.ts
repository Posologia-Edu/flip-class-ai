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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_CHARS_PER_MATERIAL = 15000;
const MAX_CHARS_TOTAL = 45000;

const SYSTEM_PROMPT = `Você é um assistente pedagógico para uma plataforma de Sala de Aula Invertida.

O professor quer abrir a aula presencial com uma rodada rápida de perguntas orais para verificar se os alunos estudaram os materiais em casa e chegaram aos pontos principais. Você receberá o conteúdo dos materiais e deve extrair os PONTOS PRINCIPAIS, transformando cada um em um card de pergunta e resposta.

REGRAS:
- Cada card tem uma PERGUNTA curta e direta, que o professor fará em voz alta, e uma RESPOSTA objetiva (1 a 3 frases) que ele revelará depois que os alunos responderem.
- Cubra os conceitos mais importantes de cada material, priorizando o que é indispensável para a atividade em sala. Não gere perguntas sobre detalhes secundários.
- Varie o tipo: definição, mecanismo/porquê, comparação, aplicação prática, erro comum.
- Use EXCLUSIVAMENTE o conteúdo fornecido. Não invente informações.
- Cada pergunta deve ser compreensível sozinha (sem depender de "o texto diz...") e não deve conter a resposta.
- Informe em "material" o título do material de onde o ponto veio, exatamente como foi fornecido.
- Português do Brasil.

Retorne APENAS um JSON válido, sem markdown, neste formato:
{
  "highlights": [
    { "question": "...", "answer": "...", "material": "Título do material" }
  ]
}`;

function parseJson(raw: string): any {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Não foi possível interpretar a resposta da IA");
  try {
    return JSON.parse(match[0]);
  } catch {
    const fixed = match[0]
      .replace(/,\s*([\]}])/g, "$1")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error("A IA retornou um formato inválido. Tente gerar novamente.");
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Auth required" }, 401);

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: uerr } = await authClient.auth.getUser();
    if (uerr || !user) return json({ error: "Invalid auth" }, 401);

    const { roomId, materialIds } = await req.json();
    if (!roomId) return json({ error: "roomId obrigatório" }, 400);

    const svc = createClient(url, service);
    const { data: room } = await svc.from("rooms").select("teacher_id, title").eq("id", roomId).single();
    const { data: isCollab } = await svc.rpc("is_room_collaborator", { _room_id: roomId, _user_id: user.id });
    if (!room || (room.teacher_id !== user.id && !isCollab)) return json({ error: "Sem acesso a esta sala" }, 403);

    let query = svc.from("materials").select("id, title, type, content_text_for_ai").eq("room_id", roomId).order("created_at");
    if (Array.isArray(materialIds) && materialIds.length > 0) query = query.in("id", materialIds);
    const { data: materials } = await query;

    const usable = (materials || []).filter((m: any) => {
      const t = m.content_text_for_ai || "";
      return t.length >= 50 && !t.startsWith("YouTube video ID:");
    });
    const skipped = (materials || []).filter((m: any) => !usable.includes(m)).map((m: any) => m.title || "Sem título");

    if (usable.length === 0) {
      return json({
        error: "Nenhum material tem conteúdo de texto para a IA. Abra um material em 'Gerar Atividade' para extrair/colar o texto, ou cole o conteúdo ao adicioná-lo.",
        skipped,
      }, 400);
    }

    // Share the budget evenly so one long material doesn't crowd out the others
    const perMaterial = Math.min(MAX_CHARS_PER_MATERIAL, Math.floor(MAX_CHARS_TOTAL / usable.length));
    const content = usable
      .map((m: any) => `=== MATERIAL: ${m.title || "Sem título"} ===\n${String(m.content_text_for_ai).slice(0, perMaterial)}`)
      .join("\n\n");

    const customKeys = await getCustomProviderKeys(svc);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const result = await callAiWithFallbackDetailed({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Sala: ${room.title}\n\nGere de 6 a 12 cards (proporcional à quantidade e tamanho dos materiais) com os pontos principais abaixo.\n\n${content}` },
        ],
        signal: controller.signal,
        customProviderKeys: customKeys,
      });
      clearTimeout(timeout);

      const parsed = parseJson(result.content);
      const highlights = (Array.isArray(parsed.highlights) ? parsed.highlights : [])
        .filter((h: any) => h && typeof h.question === "string" && typeof h.answer === "string" && h.question.trim() && h.answer.trim())
        .map((h: any) => ({
          question: h.question.trim(),
          answer: h.answer.trim(),
          material: typeof h.material === "string" ? h.material.trim() : "",
        }));
      if (highlights.length === 0) throw new Error("A IA não retornou nenhum ponto. Tente gerar novamente.");

      const { error: saveError } = await svc.from("room_highlights").upsert({
        room_id: roomId,
        highlights,
        updated_at: new Date().toISOString(),
      });
      if (saveError) throw new Error("Falha ao salvar os highlights");

      await svc.from("ai_usage_log").insert({
        user_id: user.id,
        usage_type: "chat",
        provider: result.provider,
        model: result.model,
        prompt_type: "highlights_generation",
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
        estimated_cost_usd: estimateCost(result.provider, result.tokens_input, result.tokens_output),
      });

      return json({ success: true, highlights, skipped });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.message === "RATE_LIMIT") return json({ error: "Limite de requisições excedido. Tente novamente." }, 429);
      if (err.message === "INSUFFICIENT_CREDITS") return json({ error: "Créditos insuficientes." }, 402);
      throw err;
    }
  } catch (e: any) {
    console.error("generate-highlights error", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
