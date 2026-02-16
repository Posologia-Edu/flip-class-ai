import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um gerador de atividades educacionais baseadas em casos reais para um sistema de Sala de Aula Invertida.

Dado o CONTEÚDO de um material educacional (pode ser transcrição de vídeo, texto de artigo, conteúdo de PDF, transcrição de podcast ou apresentação), você DEVE gerar atividades baseadas em CASOS REAIS e APLICADOS diretamente relacionados ao conteúdo ESPECÍFICO fornecido.

IMPORTANTE:
- NÃO gere questões de múltipla escolha ou verdadeiro/falso.
- TODOS os itens devem ser CASOS REAIS com contexto detalhado e perguntas dissertativas.
- Os casos devem ser ALTAMENTE APLICADOS, simulando situações reais que um profissional enfrentaria.
- Os casos DEVEM ser baseados DIRETAMENTE no conteúdo fornecido. Use termos, conceitos e exemplos mencionados no material.
- Cada caso deve ter um contexto narrativo detalhado (pelo menos 3-4 frases) seguido de uma pergunta que exija análise e raciocínio.

Retorne um JSON com esta estrutura EXATA:
{
  "levels": [
    {
      "level": 1,
      "label": "Nível 1 — Aplicação Básica",
      "questions": [
        {
          "question": "Com base no caso apresentado, como você agiria?",
          "type": "case_study",
          "context": "Descrição detalhada de um caso real aplicado...",
          "correct_answer": "Resposta esperada com fundamentação..."
        }
      ]
    },
    {
      "level": 2,
      "label": "Nível 2 — Caso Intermediário",
      "questions": [
        {
          "question": "Analise o caso e proponha uma solução fundamentada.",
          "type": "case_study",
          "context": "Caso mais complexo com múltiplas variáveis...",
          "correct_answer": "Resposta esperada com análise aprofundada..."
        }
      ]
    },
    {
      "level": 3,
      "label": "Nível 3 — Caso Complexo",
      "questions": [
        {
          "question": "Diante deste cenário complexo, elabore uma estratégia completa.",
          "type": "case_study",
          "context": "Caso complexo que exige síntese e pensamento crítico...",
          "correct_answer": "Resposta modelo com síntese e proposição..."
        }
      ]
    }
  ]
}

Regras:
- Nível 1: 2 casos. Aplicação direta dos conceitos do material em situações reais simples.
- Nível 2: 2 casos. Cenários com múltiplas variáveis que exigem análise mais profunda do conteúdo.
- Nível 3: 1 caso. Cenário complexo que exige síntese, pensamento crítico e integração de múltiplos conceitos.
- TODOS os casos devem ser em Português (Brasil).
- TODOS os casos devem estar DIRETAMENTE relacionados ao conteúdo fornecido.
- Retorne APENAS o JSON, sem markdown, sem explicação.`;

async function extractTextFromFileUrl(fileUrl: string, materialType: string, apiKey: string): Promise<string> {
  console.log("Fetching file from URL:", fileUrl);
  
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) {
    throw new Error(`Falha ao baixar arquivo: ${fileResponse.status}`);
  }
  
  const fileBuffer = await fileResponse.arrayBuffer();
  const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
  
  const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
  console.log("File content-type:", contentType, "size:", fileBuffer.byteLength);

  // Determine MIME type for Gemini
  let mimeType = contentType;
  if (materialType === "pdf" || fileUrl.endsWith(".pdf")) {
    mimeType = "application/pdf";
  } else if (materialType === "presentation" || fileUrl.endsWith(".pptx")) {
    mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  } else if (fileUrl.endsWith(".ppt")) {
    mimeType = "application/vnd.ms-powerpoint";
  } else if (fileUrl.endsWith(".docx")) {
    mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (fileUrl.endsWith(".doc")) {
    mimeType = "application/msword";
  }

  // Use Gemini multimodal to extract and understand the document content
  const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extraia TODO o conteúdo textual deste documento de forma detalhada e completa. Mantenha a estrutura, títulos, subtítulos e informações. Retorne APENAS o texto extraído, sem comentários adicionais."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!extractionResponse.ok) {
    const errorText = await extractionResponse.text();
    console.error("Extraction AI error:", extractionResponse.status, errorText);
    throw new Error("Falha ao extrair conteúdo do documento com IA");
  }

  const extractionData = await extractionResponse.json();
  const extractedText = extractionData.choices?.[0]?.message?.content;
  
  if (!extractedText || extractedText.length < 50) {
    throw new Error("Não foi possível extrair conteúdo suficiente do documento");
  }

  console.log("Extracted text length:", extractedText.length);
  return extractedText;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentText, roomId, materialId, materialType, fileUrl } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Determine the content to use for quiz generation
    let finalContent = contentText || "";

    // If we have a file URL and no/insufficient text content, extract from file
    if (fileUrl && (!finalContent || finalContent.length < 50 || finalContent.startsWith("YouTube video ID:"))) {
      console.log("Extracting content from file:", fileUrl);
      finalContent = await extractTextFromFileUrl(fileUrl, materialType || "file", LOVABLE_API_KEY);
      
      // Save extracted text back to the material for future use
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      if (materialId) {
        await supabase.from("materials").update({ content_text_for_ai: finalContent }).eq("id", materialId);
        console.log("Saved extracted text to material");
      }
    }

    if (!finalContent || finalContent.length < 50) {
      return new Response(
        JSON.stringify({ error: "Conteúdo do material não fornecido ou muito curto. Para vídeos do YouTube, cole a transcrição." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating quiz from content:", finalContent.length, "chars, type:", materialType || "unknown");

    const typeLabel = materialType === "video" ? "TRANSCRIÇÃO DO VÍDEO"
      : materialType === "pdf" ? "CONTEÚDO DO PDF"
      : materialType === "article" ? "CONTEÚDO DO ARTIGO"
      : materialType === "podcast" ? "TRANSCRIÇÃO DO PODCAST"
      : materialType === "presentation" ? "CONTEÚDO DA APRESENTAÇÃO"
      : "CONTEÚDO DO MATERIAL";

    const userPrompt = `Gere atividades baseadas em casos reais e altamente aplicados com base no conteúdo abaixo. Os casos DEVEM usar os conceitos, termos e exemplos mencionados no material.

${typeLabel}:
${finalContent}

IMPORTANTE: Use EXCLUSIVAMENTE o conteúdo acima para criar os casos. Não invente informações que não estejam no material.`;

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
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
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

    console.log("AI response length:", content.length);

    let quizJson: any;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      quizJson = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Não foi possível interpretar a resposta da IA");
    }

    // Save to database
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: insertError } = await supabase.from("activities").insert({
      room_id: roomId,
      material_id: materialId || null,
      quiz_data: quizJson,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Falha ao salvar atividade");
    }

    return new Response(JSON.stringify({ success: true, quiz: quizJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
