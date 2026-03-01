import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallback } from "../_shared/ai-with-fallback.ts";

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

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function getMimeType(fileUrl: string, materialType: string): string {
  if (materialType === "pdf" || fileUrl.endsWith(".pdf")) return "application/pdf";
  if (materialType === "presentation" || fileUrl.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (fileUrl.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (fileUrl.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (fileUrl.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

async function extractTextFromFileUrl(fileUrl: string, materialType: string): Promise<string> {
  console.log("Fetching file for AI extraction:", fileUrl);
  const headResponse = await fetch(fileUrl, { method: "HEAD" });
  const contentLength = parseInt(headResponse.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande (${Math.round(contentLength / 1024 / 1024)}MB). Para arquivos acima de 15MB, cole o conteúdo textual manualmente.`);
  }
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) throw new Error(`Falha ao baixar arquivo: ${fileResponse.status}`);
  const fileBuffer = await fileResponse.arrayBuffer();
  const uint8 = new Uint8Array(fileBuffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
  }
  const base64Data = btoa(binary);
  const mimeType = getMimeType(fileUrl, materialType);
  const extractedText = await callAiWithFallback({
    messages: [
      { role: "user", content: [
        { type: "text", text: "Extraia TODO o conteúdo textual deste documento de forma detalhada e completa. Mantenha a estrutura, títulos, subtítulos e informações. Retorne APENAS o texto extraído, sem comentários adicionais." },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
      ] }
    ],
  });
  if (!extractedText || extractedText.length < 50) {
    throw new Error("Não foi possível extrair conteúdo suficiente do documento");
  }
  console.log("Extracted text length:", extractedText.length);
  return extractedText;
}

// Plan limits for AI usage
const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  professor: 30,
  institutional: -1, // unlimited
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
  
  // Check admin-granted plan
  if (email) {
    const { data: invite } = await serviceSupabase
      .from("admin_invites")
      .select("granted_plan")
      .eq("email", email.toLowerCase())
      .in("status", ["active", "pending"])
      .maybeSingle();
    if (invite?.granted_plan && invite.granted_plan in PLAN_LIMITS) {
      adminPlan = invite.granted_plan;
    }
  }

  // Check Stripe subscription
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
    console.warn("Stripe check failed in edge function:", e);
  }

  // Return highest plan
  const hierarchy: Record<string, number> = { free: 0, professor: 1, institutional: 2 };
  return (hierarchy[adminPlan] ?? 0) >= (hierarchy[stripePlan] ?? 0) ? adminPlan : stripePlan;
}

async function checkAndLogAiUsage(serviceSupabase: any, userId: string, usageType: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const planKey = await resolveServerPlan(serviceSupabase, userId);
  
  const limit = PLAN_LIMITS[planKey] ?? 3;
  if (limit === -1) return { allowed: true, used: 0, limit: -1 };

  // Count usage this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await serviceSupabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("usage_type", usageType)
    .gte("created_at", startOfMonth);

  const used = count || 0;
  return { allowed: used < limit, used, limit };
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

    const { contentText, roomId, materialId, materialType, fileUrl } = await req.json();

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: room } = await serviceSupabase.from("rooms").select("teacher_id").eq("id", roomId).single();
    if (!room || room.teacher_id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized: you don't own this room" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check AI usage limits
    const usageCheck = await checkAndLogAiUsage(serviceSupabase, userId, "generation");
    if (!usageCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: `Limite de gerações de IA atingido (${usageCheck.used}/${usageCheck.limit} este mês). Faça upgrade do seu plano para continuar.` 
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let finalContent = contentText || "";

    if (fileUrl && (!finalContent || finalContent.length < 50 || finalContent.startsWith("YouTube video ID:"))) {
      console.log("Extracting content from file:", fileUrl);
      finalContent = await extractTextFromFileUrl(fileUrl, materialType || "file");
      if (materialId) {
        await serviceSupabase.from("materials").update({ content_text_for_ai: finalContent }).eq("id", materialId);
        console.log("Saved extracted text to material");
      }
    }

    if (!finalContent || finalContent.length < 50) {
      return new Response(
        JSON.stringify({ error: "Conteúdo do material não fornecido ou muito curto. Para vídeos do YouTube, cole a transcrição." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MAX_CONTENT_LENGTH = 40000;
    if (finalContent.length > MAX_CONTENT_LENGTH) {
      finalContent = finalContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[Conteúdo truncado por limite de tamanho]";
    }

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const content = await callAiWithFallback({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let quizJson: any;
      let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Não foi possível interpretar a resposta da IA");

      try {
        quizJson = JSON.parse(jsonMatch[0]);
      } catch {
        let fixedJson = jsonMatch[0]
          .replace(/,\s*([\]}])/g, "$1")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2018\u2019]/g, "'");
        try {
          quizJson = JSON.parse(fixedJson);
        } catch {
          throw new Error("A IA retornou um formato inválido. Tente gerar novamente.");
        }
      }

      const { error: insertError } = await serviceSupabase.from("activities").insert({
        room_id: roomId,
        material_id: materialId || null,
        quiz_data: quizJson,
      });

      if (insertError) throw new Error("Falha ao salvar atividade");

      // Log successful AI usage
      await serviceSupabase.from("ai_usage_log").insert({
        user_id: userId,
        usage_type: "generation",
      });

      return new Response(JSON.stringify({ success: true, quiz: quizJson }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err.message === "RATE_LIMIT") {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (err.message === "INSUFFICIENT_CREDITS") {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw err;
    }
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
