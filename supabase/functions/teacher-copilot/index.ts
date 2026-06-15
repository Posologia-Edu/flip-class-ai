import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COST_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  groq: { input: 0.59, output: 0.79 },
  openai: { input: 0.15, output: 0.60 },
  openrouter: { input: 0.15, output: 0.60 },
  google: { input: 0.15, output: 0.60 },
  anthropic: { input: 3.0, output: 15.0 },
  lovable: { input: 0.15, output: 0.60 },
};
const estimateCost = (p: string, i: number, o: number) => {
  const r = COST_PER_M_TOKENS[p] || COST_PER_M_TOKENS.lovable;
  return (i * r.input + o * r.output) / 1_000_000;
};

const SYSTEM_PROMPT = `Você é o **Copilot Pedagógico**, um assistente de IA para professores em uma plataforma de Sala de Aula Invertida.

Sua função: ajudar o professor a entender o desempenho da turma, identificar alunos em risco, sugerir intervenções, propor questões e atividades, e responder dúvidas com base nos DADOS REAIS da sala fornecidos no contexto.

DIRETRIZES:
- Use markdown (listas, **negrito**, tabelas) para clareza.
- Quando citar alunos, use o nome real fornecido no contexto. Nunca invente nomes, notas ou dados.
- Ao responder sobre **alunos em risco**, baseie-se SEMPRE na seção "Alunos EM RISCO" do contexto (que considera acesso, % de materiais vistos, conclusão e tempo na plataforma) — NÃO use apenas "nota < 6". Liste cada aluno com seus motivos de risco.
- Diferencie claramente: "nunca acessaram a sala" vs. "acessaram mas com baixo engajamento" vs. "concluíram com nota baixa".
- Seja conciso e prático: vá direto à ação recomendada.
- Quando faltar dado, diga "não há dados suficientes" em vez de inventar.
- Linguagem em português do Brasil, tom profissional e acolhedor.
- Quando o professor pedir para "gerar questões", "rascunhar atividade" ou "escrever feedback", entregue o texto pronto para copiar.`;

async function buildRoomContext(svc: any, roomId: string) {
  const [
    { data: room },
    { data: sessions },
    { data: enrolled },
    { data: activities },
    { data: materials },
    { data: sims },
    { data: feedback },
    { data: logs },
  ] = await Promise.all([
    svc.from("rooms").select("id, title, description, discipline_id, unlock_at").eq("id", roomId).single(),
    svc.from("student_sessions").select("id, student_name, student_email, total_score, completed_at, created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(500),
    svc.from("room_students").select("student_name, student_email").eq("room_id", roomId).limit(500),
    svc.from("activities").select("id, title, is_published").eq("room_id", roomId),
    svc.from("materials").select("id, title").eq("room_id", roomId),
    svc.from("simulations").select("id, title, is_longitudinal, total_chapters").eq("room_id", roomId),
    svc.from("teacher_feedback").select("student_session_id, score").eq("room_id", roomId).limit(500),
    svc.from("student_activity_logs").select("session_id, activity_type, material_id, duration_seconds").eq("room_id", roomId).limit(5000),
  ]);

  const activitiesLocked = !!(room?.unlock_at && new Date(room.unlock_at) > new Date());
  const materialsCount = (materials || []).length;

  // Aggregate per-session engagement from logs
  const logsBySession = new Map<string, any[]>();
  for (const l of (logs || [])) {
    const arr = logsBySession.get(l.session_id) || [];
    arr.push(l);
    logsBySession.set(l.session_id, arr);
  }

  // Unify enrolled + sessions, keyed by lowercased email
  type Row = { name: string; email: string; session: any | null };
  const map = new Map<string, Row>();
  for (const es of (enrolled || [])) {
    const key = (es.student_email || "").toLowerCase();
    if (!key) continue;
    map.set(key, { email: es.student_email, name: es.student_name || es.student_email, session: null });
  }
  for (const s of (sessions || [])) {
    const email = (s.student_email || "").toLowerCase();
    const key = email || s.id;
    const existing = email ? map.get(email) : undefined;
    map.set(key, { email: s.student_email || "—", name: s.student_name || existing?.name || "—", session: s });
  }
  const allStudents = Array.from(map.values());

  // Per-student analysis matching the Analytics panel
  const analyzed = allStudents.map((st) => {
    const session = st.session;
    if (!session) {
      return { name: st.name, email: st.email, accessed: false, completed: false, score: null as number | null, minutes: 0, materialsPct: 0, risks: ["Nunca acessou a sala"] };
    }
    const sLogs = logsBySession.get(session.id) || [];
    const viewed = new Set(sLogs.filter((l) => ["material_view", "material_access"].includes(l.activity_type) && l.material_id).map((l) => l.material_id));
    const totalSec = sLogs.reduce((a, l) => a + (l.duration_seconds || 0), 0);
    const materialsPct = materialsCount > 0 ? Math.round((viewed.size / materialsCount) * 100) : 0;
    const risks: string[] = [];
    if (materialsPct < 50) risks.push("Menos de 50% dos materiais vistos");
    if (!session.completed_at && !activitiesLocked) risks.push("Atividade não concluída");
    if (totalSec < 60) risks.push("Menos de 1 min na plataforma");
    return {
      name: session.student_name || st.name,
      email: session.student_email || st.email,
      accessed: true,
      completed: !!session.completed_at,
      score: session.total_score != null ? Number(session.total_score) : null,
      minutes: +(totalSec / 60).toFixed(1),
      materialsPct,
      risks,
    };
  }).sort((a, b) => b.risks.length - a.risks.length);

  const accessedCount = analyzed.filter((s) => s.accessed).length;
  const completedCount = analyzed.filter((s) => s.completed).length;
  const scored = analyzed.filter((s) => s.completed && s.score != null);
  const avgScore = scored.length ? (scored.reduce((a, s) => a + (s.score as number), 0) / scored.length).toFixed(2) : "n/a";
  const atRisk = analyzed.filter((s) => s.risks.length > 0);
  const lowScore = scored.filter((s) => (s.score as number) < 6).map((s) => s.name);

  let simInsights = "";
  if (sims && sims.length > 0) {
    const { data: simRuns } = await svc.from("simulation_sessions")
      .select("simulation_id, ai_score")
      .in("simulation_id", sims.map((s: any) => s.id))
      .limit(200);
    const done = (simRuns || []).filter((r: any) => r.ai_score != null);
    if (done.length > 0) {
      const mean = (done.reduce((a: number, r: any) => a + r.ai_score, 0) / done.length).toFixed(2);
      simInsights = `Simulações: ${sims.length} criadas, ${done.length} concluídas, nota média IA ${mean}.`;
    }
  }

  const fmtStudent = (s: typeof analyzed[number]) => {
    if (!s.accessed) return `- ${s.name} (${s.email}) — ❌ NUNCA acessou`;
    const status = s.completed ? "✓ concluiu" : "⏳ em andamento";
    const r = s.risks.length ? ` | RISCOS: ${s.risks.join("; ")}` : "";
    return `- ${s.name} (${s.email}) — ${status} | nota: ${s.score ?? "—"} | tempo: ${s.minutes}min | materiais: ${s.materialsPct}%${r}`;
  };

  return `## DADOS DA SALA: ${room?.title || "Sem título"}
Descrição: ${room?.description || "—"}
Atividades bloqueadas no momento: ${activitiesLocked ? "SIM (não conte 'não concluído' como risco)" : "não"}

### Resumo numérico
- Total de alunos (matriculados + sessões): ${analyzed.length}
- Alunos que acessaram a sala: ${accessedCount}
- Alunos que nunca acessaram: ${analyzed.length - accessedCount}
- Alunos que concluíram a atividade: ${completedCount}
- Nota média (concluídos): ${avgScore}
- Alunos com nota < 6: ${lowScore.length ? lowScore.join(", ") : "nenhum"}
- **Alunos em risco (qualquer critério): ${atRisk.length}** — critérios: nunca acessou, <50% materiais vistos, atividade não concluída (quando liberada), <1min na plataforma
- Atividades: ${(activities || []).length} (publicadas: ${(activities || []).filter((a: any) => a.is_published).length})
- Materiais: ${materialsCount}
- ${simInsights || "Nenhuma simulação concluída ainda."}
- Feedbacks lançados pelo professor: ${(feedback || []).length}

### Alunos EM RISCO (${atRisk.length})
${atRisk.length ? atRisk.map(fmtStudent).join("\n") : "Nenhum aluno em risco."}

### Alunos SEM risco (${analyzed.length - atRisk.length})
${analyzed.filter((s) => s.risks.length === 0).map(fmtStudent).join("\n") || "—"}

### Atividades
${(activities || []).map((a: any) => `- ${a.title}${a.is_published ? "" : " [rascunho]"}`).join("\n") || "—"}

### Materiais
${(materials || []).map((m: any) => `- ${m.title}`).join("\n") || "—"}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: uerr } = await authClient.auth.getUser();
    if (uerr || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { roomId, messages } = await req.json();
    if (!roomId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "roomId e messages obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const svc = createClient(url, service);
    const { data: room } = await svc.from("rooms").select("teacher_id").eq("id", roomId).single();
    const { data: isCollab } = await svc.rpc("is_room_collaborator", { _room_id: roomId, _user_id: user.id });
    if (!room || (room.teacher_id !== user.id && !isCollab)) {
      return new Response(JSON.stringify({ error: "Sem acesso a esta sala" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const context = await buildRoomContext(svc, roomId);

    // Limit conversation to last 16 messages to stay within token budget
    const trimmed = messages.slice(-16).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 8000),
    }));

    const customKeys = await getCustomProviderKeys(svc);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const result = await callAiWithFallbackDetailed({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: context },
          ...trimmed,
        ],
        signal: controller.signal,
        customProviderKeys: customKeys,
      });
      clearTimeout(timeout);

      await svc.from("ai_usage_log").insert({
        user_id: user.id,
        usage_type: "chat",
        provider: result.provider,
        model: result.model,
        prompt_type: "teacher_copilot",
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
        estimated_cost_usd: estimateCost(result.provider, result.tokens_input, result.tokens_output),
      });

      return new Response(JSON.stringify({ success: true, message: result.content, provider: result.provider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }
  } catch (e: any) {
    console.error("teacher-copilot error", e);
    return new Response(JSON.stringify({ error: e.message || "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
