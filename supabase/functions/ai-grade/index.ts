import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallback } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um professor universitário especialista em avaliação educacional. Sua tarefa é corrigir respostas dissertativas de alunos, fornecendo feedback detalhado e uma nota.

Você receberá:
1. A PERGUNTA feita ao aluno (com contexto do caso, se houver)
2. A RESPOSTA ESPERADA (gabarito do professor)
3. A RESPOSTA DO ALUNO

Você DEVE retornar um JSON com esta estrutura EXATA:
{
  "grade": <número de 0 a 10>,
  "feedback": "<feedback detalhado em português>",
  "strengths": ["<ponto forte 1>", "<ponto forte 2>"],
  "weaknesses": ["<ponto a melhorar 1>", "<ponto a melhorar 2>"],
  "suggestion": "<sugestão construtiva para o aluno>"
}

Critérios de avaliação:
- Precisão conceitual (peso 3): O aluno demonstra domínio dos conceitos abordados?
- Aplicação prática (peso 3): A resposta aplica corretamente os conceitos ao caso/contexto?
- Argumentação (peso 2): A resposta é bem fundamentada e coerente?
- Completude (peso 2): A resposta aborda todos os aspectos relevantes da pergunta?

Regras:
- Seja justo e construtivo no feedback
- Destaque pontos positivos antes de apontar melhorias
- A nota deve refletir fielmente a qualidade da resposta comparada ao gabarito
- Respostas em branco ou irrelevantes recebem nota 0
- Retorne APENAS o JSON, sem markdown, sem explicação adicional`;

// Plan limits for AI corrections
const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  professor: 100,
  institutional: -1,
};

// Product ID to plan mapping (must match src/lib/subscription.ts)
const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U1yOTsueyuc6SQ": "professor",
  "prod_U1yOWsVEIi6joe": "institutional",
};

async function resolveServerPlan(serviceSupabase: any, userId: string): Promise<string> {
  const { data: userData } = await serviceSupabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  
  let adminPlan = "free";
  let stripePlan = "free";
  
  if (email) {
    const { data: invite } = await serviceSupabase
      .from("admin_invites").select("granted_plan")
      .eq("email", email.toLowerCase()).in("status", ["active", "pending"]).maybeSingle();
    if (invite?.granted_plan && invite.granted_plan in PLAN_LIMITS) adminPlan = invite.granted_plan;
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && email) {
      const Stripe = (await import("npm:stripe@18.5.0")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        const [activeSubs, trialingSubs] = await Promise.all([
          stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 }),
          stripe.subscriptions.list({ customer: customers.data[0].id, status: "trialing", limit: 1 }),
        ]);
        const sub = activeSubs.data[0] || trialingSubs.data[0];
        if (sub) {
          const productId = String(sub.items.data[0].price.product);
          stripePlan = PRODUCT_TO_PLAN[productId] || "free";
        }
      }
    }
  } catch (e) {
    console.warn("Stripe check failed:", e);
  }

  const hierarchy: Record<string, number> = { free: 0, professor: 1, institutional: 2 };
  return (hierarchy[adminPlan] ?? 0) >= (hierarchy[stripePlan] ?? 0) ? adminPlan : stripePlan;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check AI usage limits using resolved plan (admin + Stripe)
    const planKey = await resolveServerPlan(serviceSupabase, userId);
    const limit = PLAN_LIMITS[planKey] ?? 5;
    if (limit !== -1) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await serviceSupabase
        .from("ai_usage_log").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("usage_type", "correction").gte("created_at", startOfMonth);
      if ((count || 0) >= limit) {
        return new Response(JSON.stringify({ 
          error: `Limite de correções por IA atingido (${count}/${limit} este mês). Faça upgrade do seu plano.` 
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { question, context, correctAnswer, studentAnswer, batchItems } = await req.json();

    const items = batchItems || [{ question, context, correctAnswer, studentAnswer }];
    const results = [];

    for (const item of items) {
      if (!item.studentAnswer || item.studentAnswer.trim().length === 0) {
        results.push({
          grade: 0,
          feedback: "Resposta não fornecida pelo aluno.",
          strengths: [],
          weaknesses: ["Resposta em branco"],
          suggestion: "O aluno deve responder à questão com base no conteúdo estudado.",
        });
        continue;
      }

      const userPrompt = `Corrija a resposta do aluno abaixo:

PERGUNTA: ${item.question}
${item.context ? `\nCONTEXTO DO CASO: ${item.context}` : ""}

RESPOSTA ESPERADA (GABARITO): ${item.correctAnswer}

RESPOSTA DO ALUNO: ${item.studentAnswer}

Avalie a resposta do aluno e retorne o JSON com nota (0-10), feedback, pontos fortes, pontos a melhorar e sugestão.`;

      try {
        const content = await callAiWithFallback({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        });

        let gradeResult;
        const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Formato inválido da IA");

        try {
          gradeResult = JSON.parse(jsonMatch[0]);
        } catch {
          const fixed = jsonMatch[0]
            .replace(/,\s*([\]}])/g, "$1")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'");
          gradeResult = JSON.parse(fixed);
        }

        gradeResult.grade = Math.max(0, Math.min(10, Math.round(gradeResult.grade)));
        results.push(gradeResult);
      } catch (err) {
        if (err.message === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (err.message === "INSUFFICIENT_CREDITS") {
          return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw err;
      }
    }

    // Log successful AI corrections
    const correctionCount = items.filter((item: any) => item.studentAnswer?.trim().length > 0).length;
    if (correctionCount > 0) {
      const logs = Array.from({ length: correctionCount }, () => ({
        user_id: userId,
        usage_type: "correction",
      }));
      await serviceSupabase.from("ai_usage_log").insert(logs);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-grade error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
