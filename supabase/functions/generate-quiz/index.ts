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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

async function fetchYoutubeTranscript(videoId: string): Promise<string> {
  console.log("Fetching transcript for video:", videoId);

  // Use TVHTML5_SIMPLY_EMBEDDED_PLAYER client - doesn't require login
  const playerPayload = {
    context: {
      client: {
        clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
        clientVersion: "2.0",
        hl: "pt",
        gl: "BR",
      },
      thirdParty: {
        embedUrl: "https://www.google.com",
      },
    },
    videoId: videoId,
  };

  const playerRes = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(playerPayload),
    }
  );

  if (!playerRes.ok) {
    const errText = await playerRes.text();
    console.error("Player API error:", playerRes.status, errText.substring(0, 300));
    throw new Error("Não foi possível acessar os dados do vídeo.");
  }

  const playerData = await playerRes.json();
  const playStatus = playerData?.playabilityStatus?.status;
  console.log("Player status:", playStatus);

  const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captionTracks || captionTracks.length === 0) {
    // Fallback: try WEB client with consent cookie
    console.log("No captions with embedded client, trying WEB client...");
    return await fetchWithWebClient(videoId);
  }

  return await downloadTranscript(captionTracks);
}

async function fetchWithWebClient(videoId: string): Promise<string> {
  const playerPayload = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20250101.00.00",
        hl: "pt",
        gl: "BR",
      },
    },
    videoId: videoId,
  };

  const playerRes = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Cookie": "CONSENT=YES+cb; SOCS=CAISEwgDEgk2NDU3NTY3ODAaAmVuIAEaBgiA_LyuBg",
      },
      body: JSON.stringify(playerPayload),
    }
  );

  if (!playerRes.ok) {
    throw new Error("Não foi possível acessar os dados do vídeo.");
  }

  const playerData = await playerRes.json();
  console.log("WEB client status:", playerData?.playabilityStatus?.status);

  const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captionTracks || captionTracks.length === 0) {
    // Last resort: try timedtext API directly
    console.log("No captions with WEB client, trying timedtext API...");
    return await fetchWithTimedTextApi(videoId);
  }

  return await downloadTranscript(captionTracks);
}

async function fetchWithTimedTextApi(videoId: string): Promise<string> {
  // Try common language codes
  const langs = ["pt", "pt-BR", "en", "a.pt", "a.en"];
  
  for (const lang of langs) {
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
    console.log("Trying timedtext API:", lang);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Cookie": "CONSENT=YES+cb; SOCS=CAISEwgDEgk2NDU3NTY3ODAaAmVuIAEaBgiA_LyuBg",
      },
    });
    
    if (res.ok) {
      const xml = await res.text();
      if (xml.length > 100) {
        console.log(`Found transcript via timedtext API (${lang}): ${xml.length} chars`);
        return parseTranscriptXml(xml);
      }
    } else {
      await res.text(); // consume body
    }
  }

  // Try auto-generated captions
  for (const lang of ["pt", "en"]) {
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr&fmt=srv3`;
    console.log("Trying auto-generated timedtext:", lang);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Cookie": "CONSENT=YES+cb; SOCS=CAISEwgDEgk2NDU3NTY3ODAaAmVuIAEaBgiA_LyuBg",
      },
    });
    
    if (res.ok) {
      const xml = await res.text();
      if (xml.length > 100) {
        console.log(`Found auto-generated transcript (${lang}): ${xml.length} chars`);
        return parseTranscriptXml(xml);
      }
    } else {
      await res.text();
    }
  }

  throw new Error(
    "Este vídeo não possui legendas/transcrição disponíveis no YouTube. " +
    "Verifique se o vídeo tem legendas (automáticas ou manuais) ativadas."
  );
}

function parseTranscriptXml(xml: string): string {
  const textSegments = xml.match(/<(?:text|p|s)[^>]*>([\s\S]*?)<\/(?:text|p|s)>/g) || [];
  const transcript = textSegments
    .map((seg: string) => decodeHtmlEntities(seg.replace(/<[^>]+>/g, "")))
    .filter(Boolean)
    .join(" ");

  if (!transcript || transcript.length < 30) {
    throw new Error("A transcrição encontrada está vazia ou muito curta.");
  }

  console.log(`Transcript parsed: ${transcript.length} chars. Preview: ${transcript.substring(0, 200)}`);
  return transcript;
}

async function downloadTranscript(captionTracks: any[]): Promise<string> {
  console.log("Caption tracks:", captionTracks.map((t: any) => `${t.languageCode} (${t.kind || "manual"})`));

  const track =
    captionTracks.find((t: any) => t.languageCode === "pt" && t.kind !== "asr") ||
    captionTracks.find((t: any) => t.languageCode === "pt") ||
    captionTracks.find((t: any) => t.languageCode?.startsWith("pt")) ||
    captionTracks.find((t: any) => t.languageCode === "en") ||
    captionTracks[0];

  console.log("Using track:", track.languageCode, track.kind || "manual");

  const captionRes = await fetch(track.baseUrl);
  if (!captionRes.ok) {
    throw new Error("Erro ao baixar a transcrição.");
  }
  const captionXml = await captionRes.text();
  return parseTranscriptXml(captionXml);
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
    let cachedTranscript = "";

    if (materialId) {
      const { data: material } = await supabase.from("materials").select("*").eq("id", materialId).single();
      if (material) {
        videoTitle = material.title || "";
        videoUrl = material.url || "";
        if (material.content_text_for_ai && material.content_text_for_ai.length > 100 && !material.content_text_for_ai.startsWith("YouTube video ID:")) {
          cachedTranscript = material.content_text_for_ai;
          console.log("Using cached transcript:", cachedTranscript.length, "chars");
        }
      }
    }

    const ytId = extractYoutubeId(videoUrl);
    if (!ytId) {
      return new Response(
        JSON.stringify({ error: "URL do YouTube inválida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let transcript = cachedTranscript;
    if (!transcript) {
      try {
        transcript = await fetchYoutubeTranscript(ytId);
        if (materialId) {
          await supabase.from("materials").update({ content_text_for_ai: transcript }).eq("id", materialId);
        }
      } catch (e) {
        console.error("Transcript error:", e);
        return new Response(
          JSON.stringify({ error: e instanceof Error ? e.message : "Não foi possível obter a transcrição." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
