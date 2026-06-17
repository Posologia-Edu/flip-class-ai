import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAiWithFallbackDetailed, getCustomProviderKeys } from "../_shared/ai-with-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(url, service);

    const { assignmentId, reviewId, criteria, scores, comment, revieweeAnswers, reviewerSessionId } = await req.json();
    if (!assignmentId || !criteria || !scores) return json({ error: "assignmentId, criteria, scores obrigatórios" }, 400);

    // Fetch assignment to get room_id and prior reviews by same reviewer (for retaliation detection)
    const { data: assignment } = await svc.from("peer_review_assignments")
      .select("*").eq("id", assignmentId).maybeSingle();
    if (!assignment) return json({ error: "Avaliação não encontrada" }, 404);

    // Look up reviewer email
    let reviewerEmail: string | null = null;
    if (reviewerSessionId) {
      const { data: rs } = await svc.from("student_sessions").select("student_email").eq("id", reviewerSessionId).maybeSingle();
      reviewerEmail = rs?.student_email || null;
    }

    // Reviewer's prior reviews in same room (history pattern)
    let history: any[] = [];
    if (reviewerSessionId) {
      const { data: prior } = await svc.from("peer_review_assignments")
        .select("id, reviewee_session_id").eq("reviewer_session_id", reviewerSessionId);
      const priorIds = (prior || []).map((p: any) => p.id);
      if (priorIds.length) {
        const { data: priorRevs } = await svc.from("peer_reviews")
          .select("criteria_scores, comment, assignment_id").in("assignment_id", priorIds);
        history = priorRevs || [];
      }
    }

    const avg = (obj: Record<string, number>) => {
      const vals = Object.values(obj || {}).map(Number).filter((n) => !isNaN(n));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const currentAvg = avg(scores);
    const historyAvgs = history.map((h: any) => avg(h.criteria_scores || {}));
    const overallAvg = historyAvgs.length ? historyAvgs.reduce((a, b) => a + b, 0) / historyAvgs.length : null;

    const answersText = Object.entries(revieweeAnswers || {})
      .map(([k, v]) => `[${k}]: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n").slice(0, 8000);

    const criteriaText = (criteria || []).map((c: any) =>
      `- ${c.label} (máx ${c.maxScore}): ${c.description} → Nota dada: ${scores[c.id] ?? "—"}`
    ).join("\n");

    const customKeys = await getCustomProviderKeys(svc);
    const ai = await callAiWithFallbackDetailed({
      messages: [
        {
          role: "system",
          content: `Você é um IA-MEDIADOR de avaliação por pares com foco em ANTI-VIÉS e QUALIDADE DO FEEDBACK. Sua tarefa: analisar o feedback que um revisor está prestes a enviar e detectar problemas ANTES do envio.

ANALISE:
1. QUALIDADE DO FEEDBACK (0-100): especificidade, construtividade, justificativa baseada nas respostas, profundidade. Comentários vazios ("muito bom", "ok") = baixa qualidade.
2. VIESES DETECTADOS: lista de strings curtas. Exemplos:
   - "Nota inflada sem justificativa nos comentários"
   - "Possível retaliação (notas muito abaixo do padrão do revisor)"
   - "Comentário genérico que não cita a resposta avaliada"
   - "Discrepância entre comentário positivo e nota baixa"
   - "Halo effect: nota máxima em todos os critérios sem distinção"
3. BIAS_SCORE (0-100): 0=sem indícios, 100=fortemente enviesado.
4. SUGGESTED_REWRITE: reescrita do comentário em PT-BR, mantendo o espírito do revisor mas mais específica, citando trechos das respostas, construtiva, sem viés. Se o comentário original já for excelente, repita-o.
5. AI_RATIONALE: 2-3 frases explicando a análise para o revisor.

Responda APENAS com JSON válido:
{ "feedback_quality": 0-100, "bias_score": 0-100, "detected_biases": [], "suggested_rewrite": "...", "ai_rationale": "..." }`,
        },
        {
          role: "user",
          content: `CRITÉRIOS E NOTAS DADAS:
${criteriaText}

MÉDIA DESTA AVALIAÇÃO: ${currentAvg.toFixed(1)}
${overallAvg != null ? `MÉDIA HISTÓRICA DESTE REVISOR (n=${historyAvgs.length}): ${overallAvg.toFixed(1)}` : "Sem histórico prévio."}

COMENTÁRIO ESCRITO PELO REVISOR:
"""
${comment || "(em branco)"}
"""

RESPOSTAS DO COLEGA AVALIADO:
${answersText || "(sem respostas textuais — modo grupo/participação)"}`,
        },
      ],
      customProviderKeys: customKeys,
    });

    let parsed: any = {};
    try {
      const m = ai.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : ai.content);
    } catch {
      parsed = { feedback_quality: 50, bias_score: 0, detected_biases: [], suggested_rewrite: comment || "", ai_rationale: "Não foi possível analisar automaticamente." };
    }

    // Persist analysis
    const payload: any = {
      assignment_id: assignmentId,
      review_id: reviewId || null,
      room_id: assignment.room_id || assignment.activity_id ? assignment.room_id : null,
      reviewer_session_id: reviewerSessionId || null,
      reviewer_email: reviewerEmail,
      feedback_quality: Math.round(parsed.feedback_quality ?? 50),
      bias_score: Math.round(parsed.bias_score ?? 0),
      detected_biases: parsed.detected_biases || [],
      suggested_rewrite: parsed.suggested_rewrite || "",
      ai_rationale: parsed.ai_rationale || "",
      accepted: false,
    };
    // assignment.room_id may not exist on table directly — fetch via activity
    if (!payload.room_id && assignment.activity_id) {
      const { data: act } = await svc.from("activities").select("room_id").eq("id", assignment.activity_id).maybeSingle();
      if (act?.room_id) payload.room_id = act.room_id;
    }

    let savedId: string | null = null;
    if (payload.room_id) {
      const { data: ins } = await svc.from("peer_review_quality").insert(payload).select("id").maybeSingle();
      savedId = ins?.id || null;
    }

    return json({ success: true, analysis: parsed, id: savedId });
  } catch (e: any) {
    console.error("peer-review-mediate", e);
    return json({ error: e.message || "Erro" }, 500);
  }
});
