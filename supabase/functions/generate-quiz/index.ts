import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um gerador de atividades educacionais baseadas em casos reais para um sistema de Sala de Aula Invertida.

Dado a TRANSCRIÇÃO COMPLETA de um vídeo educacional, você DEVE gerar atividades baseadas em CASOS REAIS e APLICADOS diretamente relacionados ao conteúdo ESPECÍFICO da transcrição.

IMPORTANTE:
- NÃO gere questões de múltipla escolha ou verdadeiro/falso.
- TODOS os itens devem ser CASOS REAIS com contexto detalhado e perguntas dissertativas.
- Os casos devem ser ALTAMENTE APLICADOS, simulando situações reais que um profissional enfrentaria.
- Os casos DEVEM ser baseados DIRETAMENTE no conteúdo da transcrição fornecida. Use termos, conceitos e exemplos mencionados no vídeo.
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
- Nível 1: 2 casos. Aplicação direta dos conceitos do vídeo em situações reais simples.
- Nível 2: 2 casos. Cenários com múltiplas variáveis que exigem análise mais profunda do conteúdo do vídeo.
- Nível 3: 1 caso. Cenário complexo que exige síntese, pensamento crítico e integração de múltiplos conceitos do vídeo.
- TODOS os casos devem ser em Português (Brasil).
- TODOS os casos devem estar DIRETAMENTE relacionados ao conteúdo da transcrição do vídeo.
- Retorne APENAS o JSON, sem markdown, sem explicação.`;

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/|\/watch\?v=)([^&?\s]+)/);
  return match?.[1] || null;
}

async function fetchYoutubeTranscript(videoId: string): Promise<string> {
  console.log("Fetching transcript for video:", videoId);

  // Step 1: Get the video page to extract caption track info
  const videoPageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  const html = await videoPageRes.text();

  // Extract captions data from the page
  const captionsMatch = html.match(/"captions":\s*(\{.*?"playerCaptionsTracklistRenderer".*?\})\s*,\s*"videoDetails"/s);
  if (!captionsMatch) {
    console.log("No captions found in page, trying alternative method...");
    // Try alternative: extract from ytInitialPlayerResponse
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!playerMatch) {
      throw new Error("Não foi possível encontrar dados do vídeo. Verifique se o vídeo possui legendas.");
    }
    
    try {
      const playerData = JSON.parse(playerMatch[1]);
      const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) {
        throw new Error("Este vídeo não possui legendas/transcrição disponíveis.");
      }
      
      // Prefer Portuguese, then auto-generated Portuguese, then any
      const ptTrack = captionTracks.find((t: any) => t.languageCode === "pt") 
        || captionTracks.find((t: any) => t.languageCode?.startsWith("pt"))
        || captionTracks.find((t: any) => t.languageCode === "en")
        || captionTracks[0];
      
      console.log("Found caption track:", ptTrack.languageCode, ptTrack.name?.simpleText);
      
      const captionUrl = ptTrack.baseUrl;
      const captionRes = await fetch(captionUrl);
      const captionXml = await captionRes.text();
      
      // Parse XML transcript
      const textSegments = captionXml.match(/<text[^>]*>(.*?)<\/text>/gs) || [];
      const transcript = textSegments.map((seg: string) => {
        const content = seg.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
        return content.trim();
      }).filter(Boolean).join(" ");
      
      if (!transcript || transcript.length < 50) {
        throw new Error("Transcrição encontrada mas está vazia ou muito curta.");
      }
      
      console.log(`Transcript fetched successfully: ${transcript.length} chars`);
      return transcript;
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error("Erro ao processar dados do vídeo.");
      }
      throw e;
    }
  }

  // Parse captions from the first match approach
  try {
    const captionsJson = JSON.parse(`{${captionsMatch[1].match(/"playerCaptionsTracklistRenderer".*$/s)?.[0] || ""}}`);
    const captionTracks = captionsJson?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      throw new Error("Este vídeo não possui legendas/transcrição disponíveis.");
    }

    const ptTrack = captionTracks.find((t: any) => t.languageCode === "pt")
      || captionTracks.find((t: any) => t.languageCode?.startsWith("pt"))
      || captionTracks.find((t: any) => t.languageCode === "en")
      || captionTracks[0];

    const captionRes = await fetch(ptTrack.baseUrl);
    const captionXml = await captionRes.text();

    const textSegments = captionXml.match(/<text[^>]*>(.*?)<\/text>/gs) || [];
    const transcript = textSegments.map((seg: string) => {
      return seg.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
    }).filter(Boolean).join(" ");

    if (!transcript || transcript.length < 50) {
      throw new Error("Transcrição encontrada mas está vazia ou muito curta.");
    }

    console.log(`Transcript fetched successfully: ${transcript.length} chars`);
    return transcript;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error("Erro ao processar legendas do vídeo.");
    }
    throw e;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentText, roomId, materialId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let videoTitle = "";
    let videoUrl = "";
    let transcript = "";

    // Fetch material data
    if (materialId) {
      const { data: material } = await supabase.from("materials").select("*").eq("id", materialId).single();
      if (material) {
        videoTitle = material.title || "";
        videoUrl = material.url || "";
      }
    }

    // Extract YouTube ID and fetch transcript
    const ytId = extractYoutubeId(videoUrl);
    if (ytId) {
      try {
        transcript = await fetchYoutubeTranscript(ytId);
        // Save transcript to material for future use
        if (materialId) {
          await supabase.from("materials").update({ content_text_for_ai: transcript }).eq("id", materialId);
        }
      } catch (e) {
        console.error("Transcript fetch error:", e);
        return new Response(
          JSON.stringify({ error: e instanceof Error ? e.message : "Não foi possível obter a transcrição do vídeo." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "URL do YouTube inválida. Não foi possível extrair o ID do vídeo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Gere atividades baseadas em casos reais e altamente aplicados com base na TRANSCRIÇÃO COMPLETA do vídeo abaixo. Os casos DEVEM usar os conceitos, termos e exemplos mencionados na transcrição.

Título do vídeo: ${videoTitle}

TRANSCRIÇÃO DO VÍDEO:
${transcript}

IMPORTANTE: Use EXCLUSIVAMENTE o conteúdo da transcrição acima para criar os casos. Não invente informações que não estejam na transcrição.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
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

    let quizJson: any;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      quizJson = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Não foi possível interpretar a resposta da IA");
    }

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
