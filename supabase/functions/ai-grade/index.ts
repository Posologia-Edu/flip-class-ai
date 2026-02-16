import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { question, context, correctAnswer, studentAnswer, batchItems } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Support batch grading (multiple questions at once)
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

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("Erro no serviço de IA");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Sem resposta da IA");

      // Parse JSON response
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

      // Ensure grade is within bounds
      gradeResult.grade = Math.max(0, Math.min(10, Math.round(gradeResult.grade)));
      results.push(gradeResult);
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
