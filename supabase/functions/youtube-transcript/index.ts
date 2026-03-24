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

    const rawText = await response.text();
    console.log(`[yt-tx] Status: ${response.status}, Raw (first 3000):`, rawText.substring(0, 3000));

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `API error: ${response.status}`, details: rawText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON from API", raw: rawText.substring(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log structure for debugging
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      console.log(`[yt-tx] Item type: ${typeof item}, keys: ${typeof item === 'object' ? Object.keys(item).join(',') : 'N/A'}`);
      // Log first nested array element if any
      for (const key of Object.keys(item || {})) {
        const val = item[key];
        if (Array.isArray(val)) {
          console.log(`[yt-tx] Key "${key}" is array, length=${val.length}, first element:`, JSON.stringify(val[0]).substring(0, 300));
        }
      }
    }

    // Extract transcript from response - try all known structures
    let fullText = "";

    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      
      // Try common structures
      const arrayKeys = Object.keys(item || {}).filter(k => Array.isArray(item[k]));
      
      for (const key of arrayKeys) {
        const arr = item[key];
        if (arr.length > 0) {
          const first = arr[0];
          if (typeof first === "object" && first !== null) {
            // Find text field
            const textKey = Object.keys(first).find(k => typeof first[k] === "string" && first[k].length > 1 && k !== "offset" && k !== "duration" && k !== "start" && k !== "end");
            if (textKey) {
              fullText = arr.map((t: any) => t[textKey] || "").join(" ");
              console.log(`[yt-tx] Extracted from key="${key}", textField="${textKey}", length=${fullText.length}`);
              break;
            }
          } else if (typeof first === "string") {
            fullText = arr.join(" ");
            break;
          }
        }
      }

      // Fallback: try direct string properties
      if (!fullText) {
        for (const key of Object.keys(item || {})) {
          if (typeof item[key] === "string" && item[key].length > 50) {
            fullText = item[key];
            console.log(`[yt-tx] Used string property "${key}"`);
            break;
          }
        }
      }
    }

    if (!fullText || fullText.trim().length < 20) {
      console.log(`[yt-tx] No usable transcript found`);
      return new Response(JSON.stringify({ 
        error: "no_transcript", 
        message: "Nenhuma transcrição encontrada para este vídeo.",
        debug_keys: Array.isArray(data) && data[0] ? Object.keys(data[0]) : "no data"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    fullText = fullText.replace(/\s+/g, " ").trim();
    console.log(`[yt-tx] Success: ${fullText.length} chars`);

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
