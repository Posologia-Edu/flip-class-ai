import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("YOUTUBE_TRANSCRIPT_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "YOUTUBE_TRANSCRIPT_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { videoId } = await req.json();
    if (!videoId) {
      return new Response(JSON.stringify({ error: "videoId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[yt-tx] Fetching transcript for: ${videoId}`);

    const response = await fetch("https://www.youtube-transcript.io/api/transcripts", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: [videoId] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[yt-tx] API error ${response.status}: ${errorText}`);
      return new Response(JSON.stringify({ error: `API error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // The API returns: [{ text: "full transcript...", id: "...", title: "...", tracks: [...], ... }]
    let fullText = "";

    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      
      // Primary: use the "text" field which contains the full concatenated transcript
      if (item.text && typeof item.text === "string" && item.text.length > 20) {
        fullText = item.text;
      }
      // Fallback: extract from tracks[].transcript[].text
      else if (item.tracks && Array.isArray(item.tracks) && item.tracks.length > 0) {
        const track = item.tracks[0];
        if (track.transcript && Array.isArray(track.transcript)) {
          fullText = track.transcript.map((t: any) => t.text || "").join(" ");
        }
      }
    }

    if (!fullText || fullText.trim().length < 20) {
      console.log(`[yt-tx] No usable transcript found for ${videoId}`);
      return new Response(JSON.stringify({ 
        error: "no_transcript", 
        message: "Nenhuma transcrição encontrada para este vídeo." 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    fullText = fullText.replace(/\s+/g, " ").trim();
    console.log(`[yt-tx] Success: ${fullText.length} chars for ${videoId}`);

    return new Response(JSON.stringify({ transcript: fullText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[yt-tx] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
