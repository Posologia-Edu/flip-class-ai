import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an educational quiz generator for a Flipped Classroom LMS.
Given content about a topic (video description, transcript, or text), generate a structured quiz with 3 levels of progressive complexity.

You MUST return a JSON object with this exact structure:
{
  "levels": [
    {
      "level": 1,
      "label": "Nível 1 — Fácil",
      "questions": [
        {
          "question": "...",
          "type": "true_false" or "multiple_choice",
          "options": ["Verdadeiro", "Falso"] or ["A", "B", "C", "D"],
          "correct_answer": "..."
        }
      ]
    },
    {
      "level": 2,
      "label": "Nível 2 — Médio",
      "questions": [
        {
          "question": "...(scenario-based)...",
          "type": "multiple_choice",
          "options": ["A", "B", "C", "D"],
          "correct_answer": "..."
        }
      ]
    },
    {
      "level": 3,
      "label": "Nível 3 — Difícil",
      "questions": [
        {
          "question": "...(analysis/synthesis)...",
          "type": "open_ended",
          "correct_answer": "..."
        }
      ]
    }
  ]
}

Rules:
- Level 1 (Low Complexity): 3 questions. Fact-checking, memory recall, basic definitions. True/False or simple multiple choice.
- Level 2 (Medium Complexity): 2 questions. Application of concepts, scenarios. Multiple choice with 4 options.
- Level 3 (High Complexity): 1 question. Analysis, synthesis, or case study. Open-ended.
- All questions must be in Portuguese (Brazilian).
- Questions must be strictly based on the provided content.
- Return ONLY the JSON, no markdown, no explanation.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentText, roomId, materialId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
          { role: "user", content: `Generate a quiz based on this content:\n\n${contentText}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("No content from AI");

    // Parse JSON from response (handle possible markdown wrapping)
    let quizJson: any;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      quizJson = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not parse quiz JSON from AI response");
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
      throw new Error("Failed to save quiz");
    }

    return new Response(JSON.stringify({ success: true, quiz: quizJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
