import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAiWithFallback } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um consultor de produto especializado em plataformas educacionais (EdTech).
O sistema é uma plataforma de ensino que permite:
- Professores criarem salas com atividades e quizzes
- Alunos acessarem via PIN e responderem atividades
- Correção automática por IA
- Upload de materiais (vídeos YouTube, PDFs)
- Transcrição automática de vídeos
- Revisão por pares entre alunos
- Fórum de discussão por sala
- Gestão institucional com painel admin
- Análise de desempenho e relatórios
- Banco de questões reutilizáveis
- Calendário de atividades
- Notificações em tempo real
- Planos de assinatura (Free, Professor, Institucional)

Analise o contexto do sistema e as funcionalidades já existentes (no changelog).
Proponha exatamente 7 novas funcionalidades altamente relevantes que agregariam muito valor ao sistema.
Para cada sugestão, defina uma prioridade (high, medium, low) baseada no impacto para os usuários.

Responda APENAS com um JSON array, sem markdown, sem explicações:
[{"title":"...","description":"...","priority":"high|medium|low"}]`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) throw new Error("Não autorizado");

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Acesso restrito a administradores");

    const { data: existing } = await serviceClient
      .from("system_updates")
      .select("title, status")
      .order("created_at", { ascending: false })
      .limit(50);

    const existingTitles = (existing || []).map((u: any) => `- ${u.title} (${u.status})`).join("\n");
    const userPrompt = `Funcionalidades já existentes ou planejadas:\n${existingTitles}\n\nProponha 7 novas funcionalidades que NÃO estejam na lista acima.`;

    const content = await callAiWithFallback({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Resposta da IA inválida");

    const suggestions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(suggestions) || suggestions.length === 0) throw new Error("Nenhuma sugestão gerada");

    const rows = suggestions.slice(0, 8).map((s: any) => ({
      title: s.title,
      description: s.description || "",
      type: "idea",
      status: "planned",
      priority: ["high", "medium", "low"].includes(s.priority) ? s.priority : "medium",
      created_by: user.id,
    }));

    const { error: insertError } = await serviceClient.from("system_updates").insert(rows);
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-roadmap error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
