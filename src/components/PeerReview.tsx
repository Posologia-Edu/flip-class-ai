import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Users, Star, Send, Loader2, CheckCircle2, Eye, MessageSquare, Shuffle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Json } from "@/integrations/supabase/types";

interface Criterion {
  id: string;
  label: string;
  description: string;
  maxScore: number;
}

interface PeerReviewTeacherProps {
  activityId: string;
  roomId: string;
  sessions: any[];
  quizData: any;
  peerReviewEnabled: boolean;
  peerReviewCriteria: Criterion[];
  onUpdate: () => void;
}

// ====================== TEACHER SIDE ======================
export const PeerReviewTeacher = ({
  activityId, roomId, sessions, quizData, peerReviewEnabled, peerReviewCriteria, onUpdate
}: PeerReviewTeacherProps) => {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<Criterion[]>(
    peerReviewCriteria.length > 0 ? peerReviewCriteria : [
      { id: "1", label: "Clareza", description: "A resposta é clara e bem organizada?", maxScore: 10 },
      { id: "2", label: "Fundamentação", description: "Usa conceitos do material corretamente?", maxScore: 10 },
      { id: "3", label: "Análise Crítica", description: "Demonstra pensamento crítico e profundidade?", maxScore: 10 },
    ]
  );
  const [enabled, setEnabled] = useState(peerReviewEnabled);
  const [saving, setSaving] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  const fetchAssignments = useCallback(async () => {
    const { data } = await supabase
      .from("peer_review_assignments" as any)
      .select("*")
      .eq("activity_id", activityId);
    setAssignments(data || []);

    if (data && data.length > 0) {
      const assignmentIds = data.map((a: any) => a.id);
      const { data: revData } = await supabase
        .from("peer_reviews" as any)
        .select("*")
        .in("assignment_id", assignmentIds);
      setReviews(revData || []);
    }
  }, [activityId]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // Only use realtime subscription, no polling to avoid refresh loops
  useEffect(() => {
    const channel = supabase
      .channel(`peer-review-teacher:${roomId}:${activityId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "peer_reviews",
      }, fetchAssignments)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, activityId, fetchAssignments]);

  const saveCriteria = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("activities")
        .update({
          peer_review_enabled: enabled,
          peer_review_criteria: criteria as unknown as Json,
        })
        .eq("id", activityId);
      if (error) throw error;
      toast({ title: "Configuração salva!" });
      onUpdate();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const addCriterion = () => {
    setCriteria(prev => [...prev, {
      id: String(Date.now()),
      label: "",
      description: "",
      maxScore: 10,
    }]);
  };

  const updateCriterion = (index: number, field: keyof Criterion, value: string | number) => {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const removeCriterion = (index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index));
  };

  const distributeReviews = async () => {
    setDistributing(true);
    try {
      const completedSessions = sessions.filter(s => s.completed_at);
      if (completedSessions.length < 2) {
        toast({ title: "Insuficiente", description: "São necessários pelo menos 2 alunos que concluíram a atividade.", variant: "destructive" });
        setDistributing(false);
        return;
      }

      // Delete existing assignments first
      if (assignments.length > 0) {
        await supabase
          .from("peer_review_assignments" as any)
          .delete()
          .eq("activity_id", activityId);
      }

      // Circular assignment
      const shuffled = [...completedSessions].sort(() => Math.random() - 0.5);
      const newAssignments = shuffled.map((session, i) => ({
        activity_id: activityId,
        reviewer_session_id: session.id,
        reviewee_session_id: shuffled[(i + 1) % shuffled.length].id,
      }));

      const { error } = await supabase
        .from("peer_review_assignments" as any)
        .insert(newAssignments);
      if (error) throw error;

      toast({ title: "Avaliações distribuídas!", description: `${newAssignments.length} avaliações por pares foram atribuídas.` });
      fetchAssignments();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setDistributing(false);
  };

  const completedCount = assignments.length > 0 ? reviews.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Avaliação por Pares
          </h3>
          <p className="text-sm text-muted-foreground">Alunos avaliam respostas de colegas com critérios definidos.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium">{enabled ? "Ativado" : "Desativado"}</span>
        </label>
      </div>

      {enabled && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Critérios de Avaliação</Label>
            {criteria.map((c, i) => (
              <div key={c.id} className="bg-secondary rounded-lg p-4 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Input placeholder="Nome do critério" value={c.label} onChange={(e) => updateCriterion(i, "label", e.target.value)} className="bg-background" />
                  </div>
                  <div className="w-24 space-y-1">
                    <Input type="number" min={1} max={10} value={c.maxScore} onChange={(e) => updateCriterion(i, "maxScore", parseInt(e.target.value) || 10)} className="bg-background" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeCriterion(i)} className="text-destructive">×</Button>
                </div>
                <Input placeholder="Descrição do critério..." value={c.description} onChange={(e) => updateCriterion(i, "description", e.target.value)} className="bg-background text-sm" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addCriterion}>+ Adicionar Critério</Button>
          </div>

          <div className="flex gap-3">
            <Button onClick={saveCriteria} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar Critérios
            </Button>
            <Button variant="outline" onClick={distributeReviews} disabled={distributing || !peerReviewEnabled}>
              {distributing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Shuffle className="w-4 h-4 mr-1" />}
              Distribuir Avaliações
            </Button>
          </div>

          {/* Assignment Status with Peer Review Results */}
          {assignments.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h4 className="font-semibold text-sm mb-3">Status das Avaliações</h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <p className="font-display text-xl font-bold text-foreground">{assignments.length}</p>
                  <p className="text-xs text-muted-foreground">Atribuídas</p>
                </div>
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <p className="font-display text-xl font-bold text-foreground">{completedCount}</p>
                  <p className="text-xs text-muted-foreground">Concluídas</p>
                </div>
              </div>
              <div className="space-y-3">
                {assignments.map((a: any) => {
                  const reviewer = sessions.find((s: any) => s.id === a.reviewer_session_id);
                  const reviewee = sessions.find((s: any) => s.id === a.reviewee_session_id);
                  const review = reviews.find((r: any) => r.assignment_id === a.id);
                  const reviewScores = review ? (review.criteria_scores as Record<string, number>) || {} : null;
                  return (
                    <div key={a.id} className="bg-secondary/50 rounded-lg px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span><span className="font-medium">{reviewer?.student_name || "?"}</span> → <span className="font-medium">{reviewee?.student_name || "?"}</span></span>
                        {review ? (
                          <span className="inline-flex items-center gap-1 text-xs text-level-easy"><CheckCircle2 className="w-3.5 h-3.5" /> Avaliado</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pendente</span>
                        )}
                      </div>
                      {/* Show review results for professor */}
                      {review && reviewScores && (
                        <div className="bg-background rounded-lg p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            {criteria.map((c) => (
                              <div key={c.id} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{c.label}</span>
                                <span className="font-bold text-primary">{reviewScores[c.id] ?? "—"}/{c.maxScore}</span>
                              </div>
                            ))}
                          </div>
                          {review.comment && (
                            <div className="border-t border-border pt-2 mt-2">
                              <p className="text-xs text-muted-foreground font-semibold mb-1">Comentário:</p>
                              <p className="text-xs text-foreground">{review.comment}</p>
                            </div>
                          )}
                          <div className="text-right">
                            <span className="text-xs font-bold text-primary">
                              Média: {(Object.values(reviewScores).reduce((s: number, v: any) => s + (Number(v) || 0), 0) / Math.max(Object.keys(reviewScores).length, 1)).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};


// ====================== STUDENT SIDE ======================

interface PeerReviewStudentProps {
  sessionId: string;
  roomId: string;
  quizData: any;
  studentName: string;
}

export const PeerReviewStudent = ({ sessionId, roomId, quizData, studentName }: PeerReviewStudentProps) => {
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<any>(null);
  const [revieweeAnswers, setRevieweeAnswers] = useState<Record<string, string>>({});
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [existingReview, setExistingReview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [receivedReviews, setReceivedReviews] = useState<any[]>([]);
  const [activeQuizData, setActiveQuizData] = useState<any>(quizData);
  const hasFetched = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [{ data: reviewerAssignments }, { data: revieweeAssignments }] = await Promise.all([
        supabase
          .from("peer_review_assignments" as any)
          .select("*")
          .eq("reviewer_session_id", sessionId)
          .order("created_at", { ascending: false }),
        supabase
          .from("peer_review_assignments" as any)
          .select("*")
          .eq("reviewee_session_id", sessionId)
          .order("created_at", { ascending: false }),
      ]);

      const reviewerRows = (reviewerAssignments || []) as any[];
      const revieweeRows = (revieweeAssignments || []) as any[];

      const allAssignments = [...reviewerRows, ...revieweeRows];
      const activityIds = Array.from(new Set(allAssignments.map((a) => a.activity_id).filter(Boolean)));

      let activityMap = new Map<string, any>();
      if (activityIds.length > 0) {
        const { data: activities } = await supabase
          .from("activities")
          .select("id, room_id, peer_review_enabled, peer_review_criteria, quiz_data")
          .in("id", activityIds)
          .eq("room_id", roomId);

        activityMap = new Map((activities || []).map((a: any) => [a.id, a]));
      }

      const activeReviewerAssignment = reviewerRows.find((a: any) => {
        const activity = activityMap.get(a.activity_id);
        return activity?.peer_review_enabled;
      }) as any;

      if (activeReviewerAssignment) {
        setAssignment(activeReviewerAssignment);

        const activity = activityMap.get(activeReviewerAssignment.activity_id);
        const actCriteria = (activity?.peer_review_criteria as Criterion[]) || [];
        setCriteria(actCriteria);
        setActiveQuizData((activity?.quiz_data as any) || quizData);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const revieweeRes = await fetch(
          `${supabaseUrl}/functions/v1/student-session?sessionId=${activeReviewerAssignment.reviewee_session_id}`,
          { headers: { apikey: supabaseKey, "Content-Type": "application/json" } }
        );
        const revieweePayload = await revieweeRes.json();
        setRevieweeAnswers((revieweePayload?.session?.answers as Record<string, string>) || {});

        const { data: existingData } = await supabase
          .from("peer_reviews" as any)
          .select("*")
          .eq("assignment_id", activeReviewerAssignment.id)
          .limit(1);

        if (existingData && existingData.length > 0) {
          const rev = existingData[0] as any;
          setExistingReview(rev);
          setScores((rev.criteria_scores as Record<string, number>) || {});
          setComment(rev.comment || "");
        } else {
          setExistingReview(null);
          // Don't reset scores/comment if they're mid-edit
          if (!hasFetched.current) {
            setScores({});
            setComment("");
          }
        }
      } else {
        setAssignment(null);
        setRevieweeAnswers({});
        if (!hasFetched.current) {
          setExistingReview(null);
        }
      }

      const validRevieweeAssignments = revieweeRows.filter((a: any) => activityMap.has(a.activity_id));
      const reviewAssignmentIds = validRevieweeAssignments.map((a: any) => a.id);

      if (!activeReviewerAssignment && validRevieweeAssignments.length > 0) {
        const firstActivity = activityMap.get(validRevieweeAssignments[0].activity_id);
        setCriteria((firstActivity?.peer_review_criteria as Criterion[]) || []);
      }

      if (reviewAssignmentIds.length > 0) {
        const { data: revData } = await supabase
          .from("peer_reviews" as any)
          .select("*")
          .in("assignment_id", reviewAssignmentIds);
        setReceivedReviews(revData || []);
      } else {
        setReceivedReviews([]);
      }

      hasFetched.current = true;
    } catch (err) {
      console.error("Peer review fetch error:", err);
    }
    setLoading(false);
  }, [sessionId, roomId, quizData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only listen for new assignments via realtime, NO polling
  useEffect(() => {
    const channel = supabase
      .channel(`peer-review-student:${roomId}:${sessionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "peer_review_assignments",
        filter: `reviewer_session_id=eq.${sessionId}`,
      }, fetchData)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "peer_review_assignments",
        filter: `reviewee_session_id=eq.${sessionId}`,
      }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, sessionId, fetchData]);

  const submitReview = async () => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      if (existingReview) {
        await supabase
          .from("peer_reviews" as any)
          .update({
            criteria_scores: scores as unknown as Json,
            comment,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existingReview.id);
      } else {
        await supabase
          .from("peer_reviews" as any)
          .insert({
            assignment_id: assignment.id,
            criteria_scores: scores as unknown as Json,
            comment,
          } as any);
      }
      toast({ title: "Avaliação enviada!", description: "Sua avaliação por pares foi salva com sucesso." });
      setExistingReview({ ...existingReview, criteria_scores: scores, comment });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando avaliação por pares...
      </div>
    );
  }

  if (!assignment && receivedReviews.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="w-8 h-8 mx-auto mb-2" />
        <p>Nenhuma avaliação por pares disponível ainda.</p>
        <p className="text-xs mt-1">O professor precisa distribuir as avaliações primeiro.</p>
      </div>
    );
  }

  const levels = activeQuizData?.levels || [];

  return (
    <div className="space-y-8">
      {/* Review to give */}
      {assignment && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" /> Avaliar Colega
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Leia as respostas do(a) colega e avalie de acordo com os critérios abaixo.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Respostas do Colega</h3>
              {levels.map((level: any, li: number) => (
                <div key={li}>
                  <p className="font-semibold text-sm text-primary mb-2">{level.label}</p>
                  {level.questions?.map((q: any, qi: number) => {
                    const key = `${li}-${qi}`;
                    const answer = revieweeAnswers[key];
                    return (
                      <div key={qi} className="mb-3 bg-secondary rounded-lg p-4">
                        {q.context && (
                          <p className="text-xs text-muted-foreground mb-2 italic">{q.context}</p>
                        )}
                        <p className="font-medium text-sm text-foreground mb-2">{qi + 1}. {q.question}</p>
                        <div className="bg-background rounded-lg p-3">
                          <p className="text-sm text-foreground">
                            {answer || <span className="italic text-muted-foreground">Não respondida</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Sua Avaliação</h3>
              {criteria.map((c) => (
                <div key={c.id} className="bg-secondary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="font-medium text-sm">{c.label}</Label>
                    <span className="text-xs text-muted-foreground">Nota: {scores[c.id] ?? "—"} / {c.maxScore}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{c.description}</p>
                  <div className="flex gap-1">
                    {Array.from({ length: c.maxScore }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => setScores(prev => ({ ...prev, [c.id]: n }))}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          scores[c.id] === n
                            ? "bg-primary text-primary-foreground"
                            : (scores[c.id] || 0) >= n
                              ? "bg-primary/20 text-primary"
                              : "bg-background text-muted-foreground hover:bg-primary/10"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Comentário Geral (opcional)</Label>
                <Textarea
                  placeholder="Deixe um comentário construtivo para o colega..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                />
              </div>

              <Button onClick={submitReview} disabled={submitting || criteria.some(c => !scores[c.id])}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                {existingReview ? "Atualizar Avaliação" : "Enviar Avaliação"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Reviews received */}
      {receivedReviews.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" /> Avaliações Recebidas
            </h2>
            {receivedReviews.map((review: any, i: number) => {
              const reviewScores = (review.criteria_scores as Record<string, number>) || {};
              return (
                <div key={review.id} className="bg-secondary rounded-lg p-4 space-y-3">
                  <p className="text-xs text-muted-foreground font-medium">Avaliação {i + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {criteria.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                        <span className="text-sm text-foreground">{c.label}</span>
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                          <Star className="w-3.5 h-3.5" /> {reviewScores[c.id] ?? "—"}/{c.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>
                  {review.comment && (
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Comentário:</p>
                      <p className="text-sm text-foreground">{review.comment}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};