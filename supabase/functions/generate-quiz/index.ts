import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallback, callAiWithFallbackDetailed } from "../_shared/ai-with-fallback.ts";

// Estimated cost per 1M tokens (USD) by provider
const COST_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  groq: { input: 0.59, output: 0.79 },
  openai: { input: 0.15, output: 0.60 },
  openrouter: { input: 0.15, output: 0.60 },
  google: { input: 0.15, output: 0.60 },
  anthropic: { input: 3.0, output: 15.0 },
  lovable: { input: 0.15, output: 0.60 },
};

function estimateCost(provider: string, tokensIn: number, tokensOut: number): number {
  const rates = COST_PER_M_TOKENS[provider] || COST_PER_M_TOKENS.lovable;
  return (tokensIn * rates.input + tokensOut * rates.output) / 1_000_000;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CASE_STUDY_PROMPT = `Você é um gerador de atividades educacionais baseadas em casos reais para um sistema de Sala de Aula Invertida.

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


const INTERACTIVE_PROMPT = `Você é um gerador de atividades educacionais INTERATIVAS para um sistema de Sala de Aula Invertida.

Dado o CONTEÚDO de um material educacional, gere atividades interativas variadas usando os seguintes tipos:

1. **drag_and_drop** — O aluno arrasta itens para categorias corretas.
2. **fill_in_the_blank** — O aluno preenche lacunas em um texto com as palavras corretas.
3. **matching** — O aluno conecta pares de termos e definições.
4. **ordering** — O aluno ordena itens na sequência correta.

Retorne um JSON com esta estrutura EXATA:
{
  "levels": [
    {
      "level": 1,
      "label": "Atividades Interativas",
      "questions": [
        {
          "question": "Arraste cada conceito para a categoria correta:",
          "type": "drag_and_drop",
          "items": ["Item A", "Item B", "Item C", "Item D"],
          "categories": ["Categoria 1", "Categoria 2"],
          "correct_mapping": {"Item A": "Categoria 1", "Item B": "Categoria 2", "Item C": "Categoria 1", "Item D": "Categoria 2"}
        },
        {
          "question": "O ___ é o processo pelo qual ___ ocorre na célula.",
          "type": "fill_in_the_blank",
          "blanks": ["metabolismo", "energia"],
          "correct_answers": ["metabolismo", "produção de energia"]
        },
        {
          "question": "Conecte cada termo à sua definição:",
          "type": "matching",
          "pairs": [
            {"left": "Termo 1", "right": "Definição 1"},
            {"left": "Termo 2", "right": "Definição 2"},
            {"left": "Termo 3", "right": "Definição 3"}
          ]
        },
        {
          "question": "Ordene os passos do processo na sequência correta:",
          "type": "ordering",
          "items": ["Passo C", "Passo A", "Passo B"],
          "correct_order": [1, 2, 0]
        }
      ]
    }
  ]
}

Regras:
- Gere EXATAMENTE 5 questões interativas em um único nível chamado "Atividades Interativas".
- Use uma MIX dos 4 tipos: pelo menos 1 de cada tipo, e um tipo extra à sua escolha.
- Para drag_and_drop: 3-6 itens e 2-3 categorias.
- Para fill_in_the_blank: use ___ no texto para marcar lacunas. O campo "blanks" contém dicas. O campo "correct_answers" contém as respostas exatas.
- Para matching: 3-5 pares.
- Para ordering: 3-5 itens. O campo "correct_order" indica os índices corretos (0-based) a partir do array "items" embaralhado.
- TODAS as questões devem ser em Português (Brasil).
- TODAS devem estar DIRETAMENTE relacionadas ao conteúdo fornecido.
- Retorne APENAS o JSON, sem markdown, sem explicação.`;



Dado o CONTEÚDO de um material educacional, você DEVE gerar 5 questões de múltipla escolha com 4 alternativas cada uma, diretamente relacionadas ao conteúdo fornecido.

IMPORTANTE — DISTRIBUIÇÃO DE DIFICULDADE:
- 1 questão FÁCIL (20%): conceito básico, compreensão direta do material, alternativas claramente distintas.
- 3 questões MÉDIAS (60%): exigem compreensão e aplicação dos conceitos, alternativas plausíveis que requerem atenção.
- 1 questão DIFÍCIL (20%): exige análise crítica, integração de múltiplos conceitos do material, alternativas muito próximas que exigem conhecimento profundo. Deve ser genuinamente desafiadora mesmo para alunos que estudaram o material.

REGRAS:
- Gere EXATAMENTE 5 questões de múltipla escolha.
- Cada questão deve ter EXATAMENTE 4 alternativas (A, B, C, D).
- Apenas UMA alternativa deve ser correta.
- As questões devem cobrir diferentes aspectos do conteúdo fornecido.
- As alternativas incorretas devem ser plausíveis mas claramente distinguíveis da correta.
- Cada questão DEVE incluir um campo "difficulty" com valor "easy", "medium" ou "hard".
- Use português (Brasil).

Retorne um JSON com esta estrutura EXATA:
{
  "levels": [
    {
      "level": 1,
      "label": "Quiz — Múltipla Escolha",
      "questions": [
        {
          "question": "Pergunta fácil sobre o conteúdo?",
          "type": "multiple_choice",
          "difficulty": "easy",
          "options": ["A) Alternativa A", "B) Alternativa B", "C) Alternativa C", "D) Alternativa D"],
          "correct_answer": "A) Alternativa A"
        },
        {
          "question": "Pergunta média sobre o conteúdo?",
          "type": "multiple_choice",
          "difficulty": "medium",
          "options": ["A) Alternativa A", "B) Alternativa B", "C) Alternativa C", "D) Alternativa D"],
          "correct_answer": "B) Alternativa B"
        },
        {
          "question": "Pergunta difícil exigindo análise profunda?",
          "type": "multiple_choice",
          "difficulty": "hard",
          "options": ["A) Alternativa A", "B) Alternativa B", "C) Alternativa C", "D) Alternativa D"],
          "correct_answer": "C) Alternativa C"
        }
      ]
    }
  ]
}

Regras finais:
- EXATAMENTE 5 questões em um único nível chamado "Quiz — Múltipla Escolha".
- ORDEM: 1 fácil, 3 médias, 1 difícil (nesta ordem).
- Cada questão DEVE ter o campo "options" com EXATAMENTE 4 strings.
- O campo "correct_answer" DEVE ser exatamente igual a uma das opções.
- O campo "type" DEVE ser "multiple_choice".
- O campo "difficulty" DEVE ser "easy", "medium" ou "hard".
- A questão difícil deve ser GENUINAMENTE desafiadora, exigindo raciocínio avançado.
- TODAS as questões devem estar DIRETAMENTE relacionadas ao conteúdo fornecido.
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

async function stripeGet(path: string, stripeKey: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { "Authorization": `Bearer ${stripeKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function resolveServerPlan(serviceSupabase: any, userId: string): Promise<string> {
  const { data: userData } = await serviceSupabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  
  // Check if user is admin — admins get institutional (unlimited)
  const { data: roleData } = await serviceSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleData) {
    return "institutional";
  }

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

  // Check Stripe subscription using direct fetch
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && email) {
      const customers = await stripeGet(`/customers?email=${encodeURIComponent(email)}&limit=1`, stripeKey);
      if (customers.data.length > 0) {
        const customerId = customers.data[0].id;
        const [activeSubs, trialingSubs] = await Promise.all([
          stripeGet(`/subscriptions?customer=${customerId}&status=active&limit=1`, stripeKey),
          stripeGet(`/subscriptions?customer=${customerId}&status=trialing&limit=1`, stripeKey),
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

    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;
    console.log("Authenticated user:", userId);

    const { contentText, roomId, materialId, materialType, fileUrl, activityType } = await req.json();

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

    // Resolve private storage URLs to signed URLs before fetching
    let resolvedFileUrl = fileUrl;
    if (fileUrl) {
      const storagePrefix = "/storage/v1/object/public/materials/";
      const idx = fileUrl.indexOf(storagePrefix);
      if (idx !== -1) {
        const path = fileUrl.substring(idx + storagePrefix.length);
        try {
          const { data: signedData } = await serviceSupabase.storage.from("materials").createSignedUrl(path, 3600);
          if (signedData?.signedUrl) {
            resolvedFileUrl = signedData.signedUrl;
            console.log("Resolved private storage URL to signed URL");
          }
        } catch (e) {
          console.warn("Failed to create signed URL, using original:", e);
        }
      }
    }

    if (resolvedFileUrl && (!finalContent || finalContent.length < 50 || finalContent.startsWith("YouTube video ID:"))) {
      console.log("Extracting content from file:", resolvedFileUrl);
      finalContent = await extractTextFromFileUrl(resolvedFileUrl, materialType || "file");
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

    const isQuiz = activityType === "quiz";
    const systemPrompt = isQuiz ? QUIZ_PROMPT : CASE_STUDY_PROMPT;

    const userPrompt = isQuiz
      ? `Gere um quiz de múltipla escolha com 5 questões e 4 alternativas cada, com base no conteúdo abaixo.

${typeLabel}:
${finalContent}

IMPORTANTE: Use EXCLUSIVAMENTE o conteúdo acima para criar as questões. Não invente informações que não estejam no material.`
      : `Gere atividades baseadas em casos reais e altamente aplicados com base no conteúdo abaixo. Os casos DEVEM usar os conceitos, termos e exemplos mencionados no material.

${typeLabel}:
${finalContent}

IMPORTANTE: Use EXCLUSIVAMENTE o conteúdo acima para criar os casos. Não invente informações que não estejam no material.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const aiResult = await callAiWithFallbackDetailed({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let quizJson: any;
      let cleaned = aiResult.content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
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

      // Log successful AI usage with detailed metadata
      await serviceSupabase.from("ai_usage_log").insert({
        user_id: userId,
        usage_type: "generation",
        provider: aiResult.provider,
        model: aiResult.model,
        prompt_type: isQuiz ? "quiz_generation" : "case_study_generation",
        tokens_input: aiResult.tokens_input,
        tokens_output: aiResult.tokens_output,
        estimated_cost_usd: estimateCost(aiResult.provider, aiResult.tokens_input, aiResult.tokens_output),
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
