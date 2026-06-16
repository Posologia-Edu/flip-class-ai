import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-student-token",
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

    const { station, response } = await req.json();
    if (!station || typeof response !== "string") return json({ error: "station e response obrigatórios" }, 400);

    const customKeys = await getCustomProviderKeys(svc);
    const ai = await callAiWithFallbackDetailed({
      messages: [
        { role: "system", content: `Você é um avaliador de OSCE. Avalie a resposta do aluno com base nos critérios. Responda APENAS JSON estrito (sem markdown):
{"score": <0-${station.max_score || 10}>, "criteria_scores": [{"criterion":"...","score":<n>,"comment":"..."}], "feedback":"<texto curto>"}` },
        { role: "user", content: `ESTAÇÃO: ${station.title}
TIPO: ${station.type}
PROMPT: ${station.prompt}
CRITÉRIOS: ${JSON.stringify(station.rubric_criteria)}

RESPOSTA DO ALUNO:
${response.slice(0, 8000)}` },
      ],
      customProviderKeys: customKeys,
    });

    let parsed: any = {};
    try {
      const raw = ai.content.trim().replace(/^```json\s*|\s*```$/g, "");
      parsed = JSON.parse(raw);
    } catch {
      parsed = { score: 0, criteria_scores: [], feedback: ai.content.slice(0, 500) };
    }

    return json({ success: true, ...parsed });
  } catch (e: any) {
    console.error("osce-evaluate", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
