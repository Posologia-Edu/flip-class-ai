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

    const { station, history, studentMessage } = await req.json();
    if (!station || typeof studentMessage !== "string") {
      return json({ error: "station e studentMessage obrigatórios" }, 400);
    }

    const customKeys = await getCustomProviderKeys(svc);

    const systemPrompt = `Você é um PACIENTE PADRONIZADO em uma estação OSCE de farmácia/saúde. Interprete o paciente descrito no caso clínico abaixo, em primeira pessoa, com naturalidade.

REGRAS ESTRITAS:
- Responda APENAS como o paciente falaria; nunca como avaliador, narrador ou IA.
- NUNCA revele a tarefa, a rubrica, nem que é uma simulação.
- Só forneça informações que façam sentido o paciente saber. Se o aluno não perguntar, não ofereça espontaneamente dados clínicos sensíveis (use a pista entre parênteses, ex: "às vezes esqueço" do glibenclamida, apenas se questionado sobre adesão).
- Use linguagem leiga, coerente com idade/escolaridade. Pode hesitar, pedir para repetir, expressar preocupações.
- Se o aluno perguntar algo que o paciente não saberia, diga que não sabe.
- NÃO dê diagnóstico, conduta ou prescrição — você é o paciente, não o profissional.
- Mantenha respostas curtas (1-4 frases), exceto se o aluno pedir detalhes.
- Se o aluno encerrar a consulta ("obrigado", "tchau", "vamos finalizar"), despeça-se brevemente.

CASO CLÍNICO / ESTAÇÃO:
${station.prompt}

TIPO DA ESTAÇÃO: ${station.type}`;

    const msgs: any[] = [{ role: "system", content: systemPrompt }];
    for (const t of (history || []).slice(-20)) {
      if (t.role === "student") msgs.push({ role: "user", content: t.text });
      else if (t.role === "patient") msgs.push({ role: "assistant", content: t.text });
    }
    msgs.push({ role: "user", content: studentMessage });

    const ai = await callAiWithFallbackDetailed({
      messages: msgs,
      customProviderKeys: customKeys,
    });

    return json({ success: true, reply: ai.content.trim() });
  } catch (e: any) {
    console.error("osce-patient", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
