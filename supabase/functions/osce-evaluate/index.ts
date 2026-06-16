import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-student-token",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function transcriptToText(history: any[]): string {
  return (history || [])
    .map((t) => `${t.role === "student" ? "ALUNO" : "PACIENTE"}: ${t.text}`)
    .join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(url, service);

    const { station, response, transcript } = await req.json();
    if (!station) return json({ error: "station obrigatório" }, 400);

    const studentContent =
      Array.isArray(transcript) && transcript.length
        ? `DIÁLOGO COM O PACIENTE PADRONIZADO:\n${transcriptToText(transcript)}`
        : `RESPOSTA ESCRITA DO ALUNO:\n${(response || "(sem resposta)").slice(0, 8000)}`;

    const customKeys = await getCustomProviderKeys(svc);
    const ai = await callAiWithFallbackDetailed({
      messages: [
        {
          role: "system",
          content: `Você é um AVALIADOR DE OSCE experiente. Avalie o desempenho do aluno na estação clínica usando os critérios da rubrica.

Considere:
- Se houver diálogo: qualidade da anamnese/comunicação, perguntas-chave feitas, empatia, organização, encerramento.
- Se houver resposta escrita: precisão técnica, completude, raciocínio clínico.
- Atribua nota por critério (proporcional ao peso) e nota global de 0 a ${station.max_score || 10}.
- Forneça feedback construtivo em 3-5 frases, citando pontos fortes e o que melhorar.

Responda APENAS JSON estrito (sem markdown):
{"score": <0-${station.max_score || 10}>, "criteria_scores":[{"criterion":"...","score":<n>,"max":<peso>,"comment":"..."}], "feedback":"<texto>", "strengths":["..."], "improvements":["..."]}`,
        },
        {
          role: "user",
          content: `ESTAÇÃO: ${station.title}
TIPO: ${station.type}
PROMPT DA ESTAÇÃO:
${station.prompt}

CRITÉRIOS DA RUBRICA: ${JSON.stringify(station.rubric_criteria)}

${studentContent}`,
        },
      ],
      customProviderKeys: customKeys,
    });

    let parsed: any = {};
    try {
      const raw = ai.content.trim().replace(/^```json\s*|\s*```$/g, "");
      parsed = JSON.parse(raw);
    } catch {
      parsed = { score: 0, criteria_scores: [], feedback: ai.content.slice(0, 800), strengths: [], improvements: [] };
    }

    return json({ success: true, ...parsed });
  } catch (e: any) {
    console.error("osce-evaluate", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
