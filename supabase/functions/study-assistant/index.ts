import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallback, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_LIMITS: Record<string, number> = {
  free: 10,
  professor: 50,
  institutional: -1, // unlimited
};

const PRODUCT_TO_PLAN: Record<string, string> = {
  prod_U1yOTsueyuc6SQ: "professor",
  prod_U1yOWsVEIi6joe: "institutional",
};

async function stripeGet(path: string, stripeKey: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Basic ${btoa(stripeKey + ":")}` },
  });
  return res.json();
}

async function resolveServerPlan(serviceSupabase: any, userId: string): Promise<string> {
  // Check admin role
  const { data: roleData } = await serviceSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleData) return "institutional";

  // Check admin_invites
  const { data: userData } = await serviceSupabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (email) {
    const { data: invite } = await serviceSupabase
      .from("admin_invites")
      .select("granted_plan")
      .eq("email", email.toLowerCase())
      .in("status", ["active", "pending"])
      .maybeSingle();
    if (invite?.granted_plan && invite.granted_plan in PLAN_LIMITS) return invite.granted_plan;
  }

  // Check Stripe
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeKey && email) {
    try {
      const customers = await stripeGet(`/customers?email=${encodeURIComponent(email)}&limit=1`, stripeKey);
      if (customers.data?.length > 0) {
        const subs = await stripeGet(`/subscriptions?customer=${customers.data[0].id}&status=active&limit=1`, stripeKey);
        const activeSub = subs.data?.[0];
        if (activeSub) {
          const productId = activeSub.items?.data?.[0]?.price?.product;
          if (productId && PRODUCT_TO_PLAN[productId]) return PRODUCT_TO_PLAN[productId];
        }
      }
    } catch (e) {
      console.warn("Stripe check failed:", e);
    }
  }

  return "free";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room_id, session_id, message, conversation_history } = await req.json();

    if (!room_id || !message) {
      return new Response(JSON.stringify({ error: "room_id and message are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const customProviderKeys = await getCustomProviderKeys(serviceSupabase);

    // Get room materials for context
    const { data: materials } = await serviceSupabase
      .from("materials")
      .select("title, content_text_for_ai, type")
      .eq("room_id", room_id)
      .eq("is_published", true);

    // Get student session for performance data
    let studentPerformance = "";
    if (session_id) {
      const { data: session } = await serviceSupabase
        .from("student_sessions")
        .select("student_name, score, completed_at, answers")
        .eq("id", session_id)
        .maybeSingle();

      if (session) {
        studentPerformance = `\n\nDados do aluno: ${session.student_name}`;
        if (session.completed_at) {
          studentPerformance += `, Atividade completada com pontuação: ${session.score || 0}`;
        } else {
          studentPerformance += `, Atividade ainda não completada`;
        }
      }

      // Check usage limits
      const { data: userData } = await serviceSupabase.auth.admin.getUserById(
        // Try to resolve user from session, but study assistant may not have auth
        // We'll track by session_id instead
        session_id
      ).catch(() => ({ data: null }));

      // For session-based usage, check by session_id approximation
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      // Count assistant interactions this month for this session's room
      const { count } = await serviceSupabase
        .from("ai_usage_log")
        .select("*", { count: "exact", head: true })
        .eq("prompt_type", "study_assistant")
        .gte("created_at", startOfMonth);
      
      // Simple rate limit: max 200 assistant calls per month across all sessions
      if ((count || 0) > 200) {
        return new Response(JSON.stringify({ error: "USAGE_LIMIT" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build context from materials
    let materialContext = "";
    if (materials && materials.length > 0) {
      const MAX_CONTEXT = 30000;
      let totalChars = 0;
      for (const mat of materials) {
        if (mat.content_text_for_ai && totalChars < MAX_CONTEXT) {
          const remaining = MAX_CONTEXT - totalChars;
          const text = mat.content_text_for_ai.substring(0, remaining);
          materialContext += `\n\n--- Material: ${mat.title || mat.type} ---\n${text}`;
          totalChars += text.length;
        }
      }
    }

    const systemPrompt = `Você é um assistente de estudo inteligente e pedagógico integrado a uma plataforma educacional.
Seu papel é ajudar os alunos a compreender melhor os materiais da sala de aula.

REGRAS:
- Responda SEMPRE em Português (Brasil).
- Seja pedagógico, claro e acolhedor.
- Baseie suas respostas nos materiais da sala quando possível.
- Quando o aluno pedir resumo, faça um resumo estruturado e didático.
- Quando pedir exercícios, gere exercícios práticos com gabarito.
- Quando pedir explicações, use exemplos simples e analogias.
- Se o aluno perguntar algo fora do escopo dos materiais, responda de forma geral mas sugira que consulte o professor.
- Use formatação markdown para melhor legibilidade.

CONTEXTO DOS MATERIAIS DA SALA:${materialContext || "\nNenhum material disponível ainda."}
${studentPerformance}`;

    // Build messages array
    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const msg of conversation_history.slice(-8)) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current message
    aiMessages.push({ role: "user", content: message });

    const response = await callAiWithFallback({
      messages: aiMessages,
      customProviderKeys,
    });

    // Log usage (use a placeholder user_id since students aren't authenticated)
    try {
      // We need a valid UUID for user_id. Use a deterministic one based on session.
      const placeholderUserId = "00000000-0000-0000-0000-000000000000";
      await serviceSupabase.from("ai_usage_log").insert({
        user_id: placeholderUserId,
        usage_type: "generation",
        provider: "assistant",
        prompt_type: "study_assistant",
        tokens_input: 0,
        tokens_output: 0,
        estimated_cost_usd: 0,
      });
    } catch (e) {
      console.warn("Failed to log usage:", e);
    }

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("study-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
