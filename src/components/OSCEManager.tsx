import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Stethoscope, Sparkles, Plus, Loader2, Eye, Trash2, FileCheck, User, Send, CheckCircle2, Hourglass } from "lucide-react";
import { toast } from "sonner";

type Station = { id: string; type: string; title: string; prompt: string; duration_sec: number; max_score: number; rubric_criteria: Array<{ criterion: string; weight: number }> };
type Exam = { id: string; title: string; description: string | null; stations: Station[]; passing_score: number; is_published: boolean; created_at: string };
type Attempt = {
  id: string; student_email: string; student_name: string | null; total_score: number | null;
  passed: boolean | null; completed_at: string | null; station_responses: any[];
  teacher_reviewed?: boolean; released_to_student?: boolean;
  teacher_score?: number | null; teacher_feedback?: string | null; final_score?: number | null;
  certificate_id?: string | null;
};

export default function OSCEManager({ roomId, isOwner }: { roomId: string; isOwner: boolean }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [numStations, setNumStations] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [reviewing, setReviewing] = useState<{ exam: Exam; attempt: Attempt } | null>(null);
  const [reviewScore, setReviewScore] = useState<string>("");
  const [reviewFeedback, setReviewFeedback] = useState<string>("");
  const [savingReview, setSavingReview] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("osce_exams" as any).select("*").eq("room_id", roomId).order("created_at", { ascending: false });
    setExams((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [roomId]);

  const loadAttempts = async (examId: string) => {
    const { data } = await supabase.from("osce_attempts" as any).select("*").eq("exam_id", examId).order("started_at", { ascending: false });
    setAttempts((data as any) || []);
  };

  const generate = async () => {
    if (!topic.trim()) return toast.error("Informe o tópico");
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("osce-generate", {
        body: { roomId, topic, numStations },
      });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("osce_exams" as any).insert({
        room_id: roomId,
        title: title.trim() || `OSCE: ${topic}`,
        description: `Gerado pela IA · ${data.stations.length} estações`,
        stations: data.stations,
        passing_score: 6,
        is_published: false,
        created_by: user?.id,
      });
      if (insErr) throw insErr;
      toast.success("OSCE gerado!");
      setOpen(false);
      setTopic(""); setTitle("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setGenerating(false);
    }
  };

  const togglePublish = async (e: Exam) => {
    await supabase.from("osce_exams" as any).update({ is_published: !e.is_published }).eq("id", e.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir este OSCE?")) return;
    await supabase.from("osce_exams" as any).delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">OSCE Virtual</h2>
          <Badge variant="outline" className="text-xs">Beta</Badge>
        </div>
        {isOwner && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />Novo OSCE</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Gerar OSCE com IA</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Título (opcional)</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: OSCE Farmacoterapia HAS" />
                </div>
                <div>
                  <label className="text-sm font-medium">Tópico clínico</label>
                  <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: hipertensão arterial em paciente idoso polifarmácia" rows={3} />
                </div>
                <div>
                  <label className="text-sm font-medium">Nº de estações: {numStations}</label>
                  <input type="range" min={2} max={6} value={numStations} onChange={(e) => setNumStations(Number(e.target.value))} className="w-full" />
                </div>
                <Button onClick={generate} disabled={generating} className="w-full">
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Gerar com IA
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Carregando…</div> : exams.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum OSCE criado. Use "Novo OSCE" para gerar estações clínicas avaliadas por IA.
        </Card>
      ) : (
        <div className="space-y-2">
          {exams.map((e) => (
            <Card key={e.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{e.title} {e.is_published && <Badge variant="secondary" className="ml-1 text-[10px]">Publicado</Badge>}</div>
                  <div className="text-xs text-muted-foreground">{e.description} · {e.stations?.length || 0} estações · Nota mínima {e.passing_score}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => { setPreviewExam(e); loadAttempts(e.id); }}><Eye className="w-3 h-3 mr-1" />Detalhes</Button>
                  {isOwner && <Button variant="outline" size="sm" onClick={() => togglePublish(e)}>{e.is_published ? "Despublicar" : "Publicar"}</Button>}
                  {isOwner && <Button variant="ghost" size="sm" onClick={() => remove(e.id)}><Trash2 className="w-3 h-3" /></Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewExam} onOpenChange={(v) => !v && setPreviewExam(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {previewExam && (
            <>
              <DialogHeader><DialogTitle>{previewExam.title}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Estações</h4>
                  {previewExam.stations.map((s, i) => (
                    <Card key={s.id} className="p-3 mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-medium text-sm">{i + 1}. {s.title} <Badge variant="outline" className="text-[10px] ml-1">{s.type}</Badge></div>
                        <Badge variant="secondary" className="text-[10px]">{Math.round(s.duration_sec / 60)} min</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap">{s.prompt}</div>
                      <div className="mt-2 text-[11px]">
                        <strong>Rubrica:</strong>
                        <ul className="list-disc list-inside">
                          {(s.rubric_criteria || []).map((c, j) => <li key={j}>{c.criterion} <span className="text-muted-foreground">(peso {c.weight})</span></li>)}
                        </ul>
                      </div>
                    </Card>
                  ))}
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><FileCheck className="w-4 h-4" /> Tentativas ({attempts.length})</h4>
                  {attempts.length === 0 ? <div className="text-xs text-muted-foreground">Nenhuma tentativa ainda.</div> : (
                    <div className="space-y-1">
                      {attempts.map(a => {
                        const score = a.final_score ?? a.teacher_score ?? a.total_score;
                        return (
                          <div key={a.id} className="flex justify-between items-center text-xs border rounded p-2 gap-2">
                            <span className="truncate">{a.student_name || a.student_email}</span>
                            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                              <span>{score != null ? `${Number(score).toFixed(1)}/10` : "—"}</span>
                              {!a.completed_at && <Badge variant="outline" className="text-[10px]">Em andamento</Badge>}
                              {a.completed_at && !a.teacher_reviewed && <Badge variant="outline" className="text-[10px]"><Hourglass className="w-2.5 h-2.5 mr-0.5" />Aguardando</Badge>}
                              {a.released_to_student && <Badge variant="secondary" className="text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />Liberado</Badge>}
                              {a.completed_at && previewExam && (
                                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => {
                                  setReviewing({ exam: previewExam, attempt: a });
                                  setReviewScore(String(a.teacher_score ?? a.total_score ?? ""));
                                  setReviewFeedback(a.teacher_feedback ?? "");
                                }}>
                                  {a.teacher_reviewed ? "Editar" : "Revisar"}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewing} onOpenChange={(v) => !v && setReviewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {reviewing && (
            <>
              <DialogHeader>
                <DialogTitle>Revisão do OSCE — {reviewing.attempt.student_name || reviewing.attempt.student_email}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Avaliação inicial gerada pela IA. Ajuste a nota final e o feedback consolidado antes de liberar o relatório ao aluno.
                </div>
                <div className="space-y-2">
                  {(reviewing.attempt.station_responses || []).map((r: any, i: number) => (
                    <Card key={i} className="p-3">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <strong>{i + 1}. {r.title} <Badge variant="outline" className="text-[10px] ml-1">{r.type}</Badge></strong>
                        <Badge variant="secondary">IA: {Number(r.ai_score).toFixed(1)}/10</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground italic mb-2 whitespace-pre-wrap">{r.ai_feedback}</div>
                      {r.criteria_scores?.length > 0 && (
                        <div className="text-[11px] space-y-0.5 mb-2">
                          {r.criteria_scores.map((c: any, j: number) => (
                            <div key={j} className="flex justify-between gap-2">
                              <span>• {c.criterion}</span>
                              <span className="text-muted-foreground">{c.score}{c.max ? `/${c.max}` : ""} — {c.comment}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.mode === "chat" && r.transcript?.length > 0 ? (
                        <details>
                          <summary className="text-xs cursor-pointer text-primary"><User className="w-3 h-3 inline mr-1" />Diálogo com paciente padronizado ({r.transcript.length} turnos)</summary>
                          <div className="mt-2 space-y-1 text-xs bg-muted/40 p-2 rounded">
                            {r.transcript.map((t: any, j: number) => (
                              <div key={j}><strong>{t.role === "student" ? "Aluno" : "Paciente"}:</strong> {t.text}</div>
                            ))}
                          </div>
                        </details>
                      ) : r.response ? (
                        <details>
                          <summary className="text-xs cursor-pointer text-primary">Ver resposta escrita</summary>
                          <div className="mt-2 text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap">{r.response}</div>
                        </details>
                      ) : null}
                    </Card>
                  ))}
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div>
                    <label className="text-sm font-medium">Nota final (0-10)</label>
                    <Input
                      type="number" min={0} max={10} step={0.1}
                      value={reviewScore}
                      onChange={(e) => setReviewScore(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Feedback consolidado para o aluno</label>
                    <Textarea
                      rows={5}
                      value={reviewFeedback}
                      onChange={(e) => setReviewFeedback(e.target.value)}
                      placeholder="Comentários, ajustes e orientações que comporão o relatório final do aluno."
                    />
                  </div>
                  <div className="flex gap-2 justify-end flex-wrap">
                    <Button variant="outline" onClick={() => setReviewing(null)}>Cancelar</Button>
                    <Button
                      variant="secondary"
                      disabled={savingReview}
                      onClick={async () => {
                        setSavingReview(true);
                        const sc = Number(reviewScore);
                        const { error } = await supabase.from("osce_attempts" as any).update({
                          teacher_score: isNaN(sc) ? null : sc,
                          teacher_feedback: reviewFeedback || null,
                          teacher_reviewed: true,
                          teacher_reviewed_at: new Date().toISOString(),
                          released_to_student: false,
                        }).eq("id", reviewing.attempt.id);
                        setSavingReview(false);
                        if (error) return toast.error(error.message);
                        toast.success("Rascunho salvo");
                        loadAttempts(reviewing.exam.id);
                      }}
                    >
                      Salvar rascunho
                    </Button>
                    <Button
                      disabled={savingReview || !reviewScore}
                      onClick={async () => {
                        setSavingReview(true);
                        const sc = Number(reviewScore);
                        if (isNaN(sc)) { setSavingReview(false); return toast.error("Nota inválida"); }
                        const passed = sc >= reviewing.exam.passing_score;
                        const certId = passed && !reviewing.attempt.certificate_id
                          ? `OSCE-${Date.now().toString(36).toUpperCase()}` : reviewing.attempt.certificate_id ?? null;
                        const { error } = await supabase.from("osce_attempts" as any).update({
                          teacher_score: sc,
                          final_score: sc,
                          teacher_feedback: reviewFeedback || null,
                          teacher_reviewed: true,
                          teacher_reviewed_at: new Date().toISOString(),
                          released_to_student: true,
                          passed,
                          certificate_id: certId,
                        }).eq("id", reviewing.attempt.id);
                        setSavingReview(false);
                        if (error) return toast.error(error.message);
                        toast.success("Relatório liberado ao aluno");
                        setReviewing(null);
                        loadAttempts(reviewing.exam.id);
                      }}
                    >
                      <Send className="w-4 h-4 mr-1" /> Liberar relatório
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
