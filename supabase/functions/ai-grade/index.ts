import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallback } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um professor universitário especialista em avaliação educacional. Sua tarefa é corrigir respostas dissertativas de alunos, fornecendo feedback detalhado e uma nota.

Você receberá:
1. A PERGUNTA feita ao aluno (com contexto do caso, se houver)
2. A RESPOSTA ESPERADA (gabarito do professor)
3. A RESPOSTA DO ALUNO

Você DEVE retornar um JSON com esta estrutura EXATA:
{
  "grade": <número de 0 a 10>,
  "feedback": "<feedback detalhado em português>",
  "strengths": ["<ponto forte 1>", "<ponto forte 2>"],
  "weaknesses": ["<ponto a melhorar 1>", "<ponto a melhorar 2>"],
  "suggestion": "<sugestão construtiva para o aluno>"
}

Critérios de avaliação:
- Precisão conceitual (peso 3): O aluno demonstra domínio dos conceitos abordados?
- Aplicação prática (peso 3): A resposta aplica corretamente os conceitos ao caso/contexto?
- Argumentação (peso 2): A resposta é bem fundamentada e coerente?
- Completude (peso 2): A resposta aborda todos os aspectos relevantes da pergunta?

Regras:
- Seja justo e construtivo no feedback
- Destaque pontos positivos antes de apontar melhorias
- A nota deve refletir fielmente a qualidade da resposta comparada ao gabarito
- Respostas em branco ou irrelevantes recebem nota 0
- Retorne APENAS o JSON, sem markdown, sem explicação adicional`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { question, context, correctAnswer, studentAnswer, batchItems } = await req.json();

    const items = batchItems || [{ question, context, correctAnswer, studentAnswer }];
    const results = [];

    for (const item of items) {
      if (!item.studentAnswer || item.studentAnswer.trim().length === 0) {
        results.push({
          grade: 0,
          feedback: "Resposta não fornecida pelo aluno.",
          strengths: [],
          weaknesses: ["Resposta em branco"],
          suggestion: "O aluno deve responder à questão com base no conteúdo estudado.",
        });
        continue;
      }

      const userPrompt = `Corrija a resposta do aluno abaixo:

PERGUNTA: ${item.question}
${item.context ? `\nCONTEXTO DO CASO: ${item.context}` : ""}

RESPOSTA ESPERADA (GABARITO): ${item.correctAnswer}

RESPOSTA DO ALUNO: ${item.studentAnswer}

Avalie a resposta do aluno e retorne o JSON com nota (0-10), feedback, pontos fortes, pontos a melhorar e sugestão.`;

      try {
        const content = await callAiWithFallback({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        });

        let gradeResult;
        const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Formato inválido da IA");

        try {
          gradeResult = JSON.parse(jsonMatch[0]);
        } catch {
          const fixed = jsonMatch[0]
            .replace(/,\s*([\]}])/g, "$1")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'");
          gradeResult = JSON.parse(fixed);
        }

        gradeResult.grade = Math.max(0, Math.min(10, Math.round(gradeResult.grade)));
        results.push(gradeResult);
      } catch (err) {
        if (err.message === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (err.message === "INSUFFICIENT_CREDITS") {
          return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw err;
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-grade error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
