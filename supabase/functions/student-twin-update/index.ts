import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Ebbinghaus retention: R = e^(-t/S). S grows with reviews.
function retention(lastSeenMs: number, reviews: number) {
  const days = (Date.now() - lastSeenMs) / (1000 * 60 * 60 * 24);
  const S = Math.max(1, 1 + reviews * 2); // strength
  return Math.exp(-days / S);
}

function dominantStyle(secByType: Record<string, number>) {
  const map: Record<string, "visual" | "reader" | "practical"> = {
    video: "visual",
    youtube: "visual",
    pdf: "reader",
    text: "reader",
    audio: "reader",
    simulation: "practical",
    quiz: "practical",
    activity: "practical",
  };
  const tot: Record<string, number> = { visual: 0, reader: 0, practical: 0 };
  let total = 0;
  for (const [k, v] of Object.entries(secByType)) {
    const s = map[k] || "reader";
    tot[s] += v;
    total += v;
  }
  if (total < 60) return { style: "mixed", confidence: 0 };
  const sorted = Object.entries(tot).sort((a, b) => b[1] - a[1]);
  const [top, topVal] = sorted[0];
  const confidence = Math.min(1, topVal / total);
  return { style: confidence < 0.4 ? "mixed" : top, confidence: Number(confidence.toFixed(2)) };
}

async function computeTwin(svc: any, roomId: string, email: string, studentName: string | null) {
  const emailLower = email.toLowerCase();
  const [
    { data: sessions },
    { data: logs },
    { data: feedback },
    { data: sims },
    { data: materials },
    { data: activities },
  ] = await Promise.all([
    svc.from("student_sessions").select("id, total_score, completed_at, created_at, student_name").eq("room_id", roomId).ilike("student_email", emailLower),
    svc.from("student_activity_logs").select("session_id, activity_type, material_id, duration_seconds, created_at").eq("room_id", roomId),
    svc.from("teacher_feedback").select("score, student_session_id").eq("room_id", roomId),
    svc.from("simulation_sessions").select("summary, total_score, completed_at, student_email").eq("room_id", roomId).ilike("student_email", emailLower),
    svc.from("materials").select("id, title").eq("room_id", roomId),
    svc.from("activities").select("id, title").eq("room_id", roomId),
  ]);

  const sessionIds = new Set((sessions || []).map((s: any) => s.id));
  const myLogs = (logs || []).filter((l: any) => sessionIds.has(l.session_id));

  // Time per type
  const secByType: Record<string, number> = {};
  const viewedMaterials = new Set<string>();
  for (const l of myLogs) {
    secByType[l.activity_type] = (secByType[l.activity_type] || 0) + (l.duration_seconds || 0);
    if (l.material_id) viewedMaterials.add(l.material_id);
  }
  const matsCount = (materials || []).length;
  const materialsPct = matsCount > 0 ? Math.round((viewedMaterials.size / matsCount) * 100) : 0;

  const totalSec = Object.values(secByType).reduce((a, b) => a + b, 0);
  const completed = (sessions || []).filter((s: any) => s.completed_at).length;
  const avgScore = (() => {
    const scored = (sessions || []).filter((s: any) => s.total_score != null);
    if (!scored.length) return null;
    return scored.reduce((a: number, s: any) => a + Number(s.total_score), 0) / scored.length;
  })();

  // Risk score 0-100
  let risk = 0;
  const risk_factors: string[] = [];
  if (sessionIds.size === 0) { risk += 50; risk_factors.push("Nunca acessou a sala"); }
  if (materialsPct < 30 && matsCount > 0) { risk += 20; risk_factors.push(`Apenas ${materialsPct}% dos materiais vistos`); }
  if (totalSec < 300 && sessionIds.size > 0) { risk += 15; risk_factors.push("Menos de 5 min de engajamento"); }
  if (completed === 0 && (activities || []).length > 0 && sessionIds.size > 0) { risk += 15; risk_factors.push("Nenhuma atividade concluída"); }
  if (avgScore != null && avgScore < 6) { risk += 20; risk_factors.push(`Média baixa (${avgScore.toFixed(1)})`); }
  risk = Math.min(100, risk);

  // Cognitive style
  const style = dominantStyle(secByType);

  // Memory decay per material/topic
  const lastSeenByMat = new Map<string, number>();
  const reviewsByMat = new Map<string, number>();
  for (const l of myLogs) {
    if (!l.material_id) continue;
    const t = new Date(l.created_at).getTime();
    const prev = lastSeenByMat.get(l.material_id) || 0;
    if (t > prev) lastSeenByMat.set(l.material_id, t);
    reviewsByMat.set(l.material_id, (reviewsByMat.get(l.material_id) || 0) + 1);
  }
  const memory_decay = (materials || []).map((m: any) => {
    const last = lastSeenByMat.get(m.id);
    if (!last) return { topic: m.title, strength: 0, last_seen: null, next_review_at: null };
    const rev = reviewsByMat.get(m.id) || 1;
    const r = retention(last, rev);
    const S = Math.max(1, 1 + rev * 2);
    const targetDays = S * Math.log(1 / 0.7); // schedule when R drops to ~70%
    const next = new Date(last + targetDays * 86400000).toISOString();
    return { topic: m.title, strength: Number(r.toFixed(2)), last_seen: new Date(last).toISOString(), next_review_at: next };
  }).sort((a: any, b: any) => (a.strength ?? 0) - (b.strength ?? 0));

  const weakTopics = memory_decay.filter((d: any) => d.last_seen && d.strength < 0.6).slice(0, 5).map((d: any) => d.topic);
  const unseenTopics = memory_decay.filter((d: any) => !d.last_seen).slice(0, 5).map((d: any) => d.topic);

  // AI recommendations
  let recommendations: any[] = [];
  try {
    const customKeys = await getCustomProviderKeys(svc);
    const ctx = `Aluno: ${studentName || email}
Risco: ${risk}/100 | Fatores: ${risk_factors.join(", ") || "—"}
Estilo cognitivo dominante: ${style.style} (confiança ${style.confidence})
Tempo total: ${Math.round(totalSec / 60)} min | Materiais vistos: ${materialsPct}% | Atividades concluídas: ${completed}
Tópicos fracos (baixa retenção): ${weakTopics.join("; ") || "—"}
Tópicos não vistos: ${unseenTopics.join("; ") || "—"}
Média de notas: ${avgScore?.toFixed(2) ?? "—"}`;
    const ai = await callAiWithFallbackDetailed({
      messages: [
        { role: "system", content: `Você é um tutor pedagógico. Gere EXATAMENTE 3 micro-intervenções para o aluno com base nos dados. Responda APENAS em JSON válido no formato: {"recommendations":[{"type":"review|quiz|material|debate","topic":"...","action":"...","duration_min":3-10,"priority":"high|medium|low"}]}. Sem markdown, sem texto extra.` },
        { role: "user", content: ctx },
      ],
      customProviderKeys: customKeys,
    });
    const raw = ai.content.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw);
    recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 3) : [];
  } catch (e) {
    console.warn("AI recs failed", String(e).slice(0, 200));
    recommendations = [
      weakTopics[0] && { type: "review", topic: weakTopics[0], action: `Revisão rápida de "${weakTopics[0]}"`, duration_min: 5, priority: "high" },
      unseenTopics[0] && { type: "material", topic: unseenTopics[0], action: `Assistir/ler "${unseenTopics[0]}"`, duration_min: 10, priority: "medium" },
    ].filter(Boolean);
  }

  return {
    room_id: roomId,
    student_email: emailLower,
    student_name: studentName,
    risk_score: risk,
    risk_factors,
    cognitive_style: style.style,
    style_confidence: style.confidence,
    memory_decay,
    recommendations,
    metrics: {
      total_minutes: Math.round(totalSec / 60),
      materials_pct: materialsPct,
      sessions: sessionIds.size,
      completed_activities: completed,
      avg_score: avgScore,
      simulations: (sims || []).length,
    },
    predicted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Auth required" }, 401);
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "Invalid auth" }, 401);

    const { roomId, batch } = await req.json();
    if (!roomId) return json({ error: "roomId required" }, 400);

    const svc = createClient(url, service);
    const { data: room } = await svc.from("rooms").select("teacher_id").eq("id", roomId).single();
    const { data: isCollab } = await svc.rpc("is_room_collaborator", { _room_id: roomId, _user_id: user.id });
    if (!room || (room.teacher_id !== user.id && !isCollab)) return json({ error: "Sem acesso" }, 403);

    // Gather targets
    const [{ data: enrolled }, { data: sessions }] = await Promise.all([
      svc.from("room_students").select("student_email, student_name").eq("room_id", roomId).limit(1000),
      svc.from("student_sessions").select("student_email, student_name").eq("room_id", roomId).limit(1000),
    ]);
    const map = new Map<string, { email: string; name: string | null }>();
    for (const r of (enrolled || [])) {
      if (!r.student_email) continue;
      map.set(r.student_email.toLowerCase(), { email: r.student_email, name: r.student_name });
    }
    for (const s of (sessions || [])) {
      if (!s.student_email) continue;
      const k = s.student_email.toLowerCase();
      if (!map.has(k)) map.set(k, { email: s.student_email, name: s.student_name });
    }

    let targets = Array.from(map.values());
    if (!batch && targets.length > 0) {
      // limit batch run to first chunk if many — caller can paginate
    }

    const results: any[] = [];
    for (const t of targets) {
      try {
        const twin = await computeTwin(svc, roomId, t.email, t.name);
        const { error: upErr } = await svc.from("student_twins").upsert(twin, { onConflict: "room_id,student_email" });
        if (upErr) console.warn("upsert", t.email, upErr.message);
        results.push({ email: t.email, risk: twin.risk_score });
      } catch (e: any) {
        console.error("twin compute failed", t.email, e.message);
      }
    }

    return json({ success: true, count: results.length, results });
  } catch (e: any) {
    console.error("student-twin-update", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
