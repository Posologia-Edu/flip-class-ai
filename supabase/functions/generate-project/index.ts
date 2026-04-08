import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallback, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em pedagogia ativa e aprendizagem baseada em projetos (PBL).
Dado o conteúdo de materiais educacionais, você DEVE gerar exatamente 3 ideias de projetos colaborativos em grupo.

Para CADA projeto, retorne:
- title: título curto e descritivo
- description: descrição de 2-3 frases explicando o projeto
- roles: array de 3-5 papéis (ex: "Pesquisador", "Designer", "Apresentador", "Redator", "Coordenador")
- resources: array de 3-5 recursos sugeridos (ex: "Google Docs para colaboração", "Canva para design")
- milestones: array de 4-6 etapas com { title, description } cada

Retorne APENAS JSON válido no formato:
{ "projects": [ { "title": "...", "description": "...", "roles": [...], "resources": [...], "milestones": [{ "title": "...", "description": "..." }, ...] }, ... ] }

Regras:
- Projetos devem ser relevantes ao conteúdo dos materiais
- Projetos devem fomentar trabalho em equipe e resolução de problemas
- Etapas devem ser progressivas e mensuráveis
- Responda SEMPRE em Português (Brasil)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room_id } = await req.json();
    if (!room_id) {
      return new Response(JSON.stringify({ error: "room_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const customProviderKeys = await getCustomProviderKeys(serviceSupabase);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await serviceSupabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify room ownership
    const { data: room } = await serviceSupabase
      .from("rooms")
      .select("id, title, teacher_id")
      .eq("id", room_id)
      .single();

    if (!room || room.teacher_id !== user.id) {
      const { data: collab } = await serviceSupabase
        .from("room_collaborators")
        .select("id")
        .eq("room_id", room_id)
        .eq("teacher_id", user.id)
        .maybeSingle();
      if (!collab) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get materials for context
    const { data: materials } = await serviceSupabase
      .from("materials")
      .select("title, content_text_for_ai, type")
      .eq("room_id", room_id)
      .eq("is_published", true);

    let materialContext = "";
    if (materials && materials.length > 0) {
      const MAX = 25000;
      let total = 0;
      for (const mat of materials) {
        if (mat.content_text_for_ai && total < MAX) {
          const text = mat.content_text_for_ai.substring(0, MAX - total);
          materialContext += `\n--- ${mat.title || mat.type} ---\n${text}`;
          total += text.length;
        }
      }
    }

    if (!materialContext) {
      materialContext = "Sala sem materiais textuais. Gere projetos genéricos de aprendizagem colaborativa.";
    }

    const response = await callAiWithFallback({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Sala: "${room?.title || "Sala"}"\n\nMateriais:\n${materialContext}\n\nGere 3 ideias de projetos colaborativos.` },
      ],
      customProviderKeys,
    });

    // Parse AI response
    let projects;
    try {
      const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      projects = parsed.projects || parsed;
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ projects }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-project error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
