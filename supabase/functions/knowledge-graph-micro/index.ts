import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { nodeId } = await req.json();
    if (!nodeId) return json({ error: "nodeId obrigatório" }, 400);

    const { data: node } = await svc.from("knowledge_nodes").select("*").eq("id", nodeId).maybeSingle();
    if (!node) return json({ error: "Nó não encontrado" }, 404);

    // Pull room materials for grounding (truncated)
    const { data: materials } = await svc.from("materials")
      .select("title, transcript, content_extracted").eq("room_id", node.room_id).limit(20);
    const corpus = (materials || []).map((m: any) =>
      `# ${m.title}\n${((m.transcript || m.content_extracted || "") + "").slice(0, 2000)}`
    ).join("\n\n").slice(0, 30000);

    const customKeys = await getCustomProviderKeys(svc);
    const ai = await callAiWithFallbackDetailed({
      messages: [
        {
          role: "system",
          content: `Você é um tutor. Gere um MICRO-CONTEÚDO didático em markdown sobre o nó conceitual abaixo, ancorado nos materiais da disciplina. Máximo 250 palavras. Estrutura:
- **Definição** (1 frase)
- **Por que importa** (2-3 frases)
- **Exemplo prático**
- **Dica de revisão rápida** (1 mnemônico ou pergunta auto-teste)

Não invente fatos fora dos materiais. Se o material for insuficiente, diga isso brevemente.`,
        },
        {
          role: "user",
          content: `NÓ: ${node.label}\nTIPO: ${node.kind}\nRESUMO PRÉVIO: ${node.summary || "(nenhum)"}\n\nMATERIAIS DA SALA:\n${corpus}`,
        },
      ],
      customProviderKeys: customKeys,
    });

    return json({ success: true, content: ai.content.trim(), node });
  } catch (e: any) {
    console.error("knowledge-graph-micro", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
