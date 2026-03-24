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

    console.log(`[youtube-transcript] Fetching transcript for video: ${videoId}`);

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
      console.error(`[youtube-transcript] API error ${response.status}: ${errorText}`);
      return new Response(JSON.stringify({ error: `Transcript API error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log(`[youtube-transcript] Response received, entries: ${Array.isArray(data) ? data.length : 'not array'}`);

    // The API returns an array of transcript objects; each has a "tracks" array with segments
    let fullText = "";

    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      if (item.tracks && Array.isArray(item.tracks) && item.tracks.length > 0) {
        fullText = item.tracks.map((t: any) => t.text || "").join(" ");
      } else if (item.text) {
        fullText = item.text;
      } else if (typeof item === "string") {
        fullText = item;
      }
    }

    if (!fullText || fullText.trim().length < 20) {
      console.log(`[youtube-transcript] No usable transcript found for ${videoId}`);
      return new Response(JSON.stringify({ error: "no_transcript", message: "Nenhuma transcrição encontrada para este vídeo." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up common transcript artifacts
    fullText = fullText.replace(/\s+/g, " ").trim();

    console.log(`[youtube-transcript] Success: ${fullText.length} chars for ${videoId}`);

    return new Response(JSON.stringify({ transcript: fullText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[youtube-transcript] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
