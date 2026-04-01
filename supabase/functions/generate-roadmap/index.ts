import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAiWithFallback } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um consultor sênior de produto especializado em plataformas educacionais (EdTech).

O sistema é uma plataforma de Sala de Aula Invertida (Flipped Classroom) com as seguintes capacidades:
- Professores criam salas com atividades e quizzes gerados por IA
- Alunos acessam via PIN e respondem atividades com correção automática por IA
- Upload de materiais (vídeos YouTube com transcrição automática, PDFs com extração de texto)
- Geração automática de quizzes a partir dos materiais (múltipla escolha, dissertativas, drag-and-drop, fill-in-the-blank, matching, ordering)
- Revisão por pares entre alunos com critérios personalizáveis
- Fórum de discussão por sala
- Assistente de estudo por IA contextualizado nos materiais da sala
- Gestão institucional com painel admin e white-label
- Organização de salas por disciplinas
- Análise de desempenho e relatórios por sala e cross-room
- Banco de questões reutilizáveis
- Calendário de atividades com desbloqueio agendado
- Notificações em tempo real
- Planos de assinatura (Free, Professor, Institucional) via Stripe
- Sistema de convites e aprovação de professores
- Rastreamento de atividade dos alunos (tempo, materiais visualizados)
- Pipeline de atualizações com changelog e roadmap
- Feedback do professor por questão com envio de email transacional
- Cookie consent e políticas de privacidade

Sua tarefa é analisar profundamente as funcionalidades já existentes (listadas no contexto) e propor exatamente 6 novas funcionalidades que:
1. NÃO existam no sistema (nem implementadas, nem planejadas)
2. Tragam GRANDE IMPACTO para a experiência de ensino-aprendizagem
3. Sejam viáveis em uma plataforma web moderna com IA
4. Considerem tendências atuais em EdTech e pedagogia ativa
5. Complementem as funcionalidades já existentes de forma sinérgica

Para cada sugestão, forneça:
- title: nome claro e conciso da funcionalidade (máx 60 caracteres)
- description: descrição detalhada explicando o que faz, como funciona e qual o impacto pedagógico (2-3 frases)
- priority: high (impacto transformador), medium (melhoria significativa) ou low (nice-to-have)

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

    // Fetch existing updates for context
    const { data: existing } = await serviceClient
      .from("system_updates")
      .select("title, status, description")
      .order("created_at", { ascending: false })
      .limit(100);

    // Fetch system stats for richer context
    const [roomsCount, studentsCount, materialsCount, activitiesCount] = await Promise.all([
      serviceClient.from("rooms").select("*", { count: "exact", head: true }),
      serviceClient.from("student_sessions").select("*", { count: "exact", head: true }),
      serviceClient.from("materials").select("*", { count: "exact", head: true }),
      serviceClient.from("activities").select("*", { count: "exact", head: true }),
    ]);

    const existingList = (existing || []).map((u: any) => `- ${u.title} (${u.status})${u.description ? ': ' + u.description.substring(0, 100) : ''}`).join("\n");
    
    const userPrompt = `Contexto do sistema atual:
- ${roomsCount.count || 0} salas criadas
- ${studentsCount.count || 0} sessões de alunos
- ${materialsCount.count || 0} materiais enviados
- ${activitiesCount.count || 0} atividades geradas

Funcionalidades já existentes ou planejadas:
${existingList || "Nenhuma registrada ainda."}

Com base nesse contexto completo, proponha 6 novas funcionalidades de ALTO IMPACTO que ainda NÃO existem no sistema.`;

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

    const rows = suggestions.slice(0, 6).map((s: any) => ({
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
