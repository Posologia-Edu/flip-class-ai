import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-student-token",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `Você é um EXAMINADOR SOCRÁTICO especializado em farmácia/saúde, conduzindo uma avaliação oral 1:1 com um estudante.

REGRAS:
- Faça UMA pergunta por turno, curta e direta (1-3 frases).
- Use o método socrático: parta do que o aluno disse, peça justificativa, contraponha, force evidências dos materiais da sala.
- Aumente a complexidade gradualmente: nível 1 (conceito), nível 2 (aplicação), nível 3 (raciocínio clínico/crítico).
- Se o aluno errar, NÃO entregue a resposta — reformule ou aprofunde com pista.
- Linguagem em português do Brasil, tom firme mas respeitoso.
- Não use markdown — sua resposta será falada em voz alta.
- Se for o PRIMEIRO turno, abra com uma pergunta inicial sobre o tópico.
- Após ~6-8 trocas significativas, você pode sinalizar encerramento com: "Vamos encerrar aqui. Última pergunta: ..."`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(url, service);

    const { roomId, topic, transcript } = await req.json();
    if (!roomId || !topic) return json({ error: "roomId e topic obrigatórios" }, 400);

    // Build RAG context: materials titles/snippets
    const { data: mats } = await svc.from("materials").select("title, transcript_text, description").eq("room_id", roomId).eq("is_published", true).limit(20);
    let ragContext = "";
    let used = 0;
    for (const m of (mats || [])) {
      const piece = `### ${m.title}\n${(m.transcript_text || m.description || "").slice(0, 4000)}\n\n`;
      if (used + piece.length > 30000) break;
      ragContext += piece;
      used += piece.length;
    }

    const turns = Array.isArray(transcript) ? transcript : [];
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "system", content: `TÓPICO DO DEBATE: ${topic}\n\nMATERIAIS DA SALA (use para fundamentar perguntas e identificar erros):\n${ragContext || "(sem materiais)"}` },
      ...turns.slice(-12).map((t: any) => ({ role: t.role === "examiner" ? "assistant" : "user", content: String(t.text || "").slice(0, 2000) })),
    ];
    if (turns.length === 0) {
      messages.push({ role: "user", content: "Inicie o debate com sua primeira pergunta." });
    }

    const customKeys = await getCustomProviderKeys(svc);
    const result = await callAiWithFallbackDetailed({ messages, customProviderKeys: customKeys });

    return json({ success: true, question: result.content.trim(), provider: result.provider });
  } catch (e: any) {
    console.error("socratic-turn", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
