import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Stethoscope, ChevronRight, Award, Loader2, Hourglass, FileText, User } from "lucide-react";
import OSCEPlayer from "./OSCEPlayer";

type Station = { id: string; type: string; title: string; prompt: string; duration_sec: number; max_score: number; rubric_criteria: any[] };
type Exam = { id: string; room_id: string; title: string; description: string | null; passing_score: number; stations: Station[] };
type Attempt = {
  id: string; exam_id: string; total_score: number | null; passed: boolean | null;
  certificate_id: string | null; completed_at: string | null;
  teacher_reviewed?: boolean; released_to_student?: boolean;
  final_score?: number | null; teacher_score?: number | null; teacher_feedback?: string | null;
  station_responses?: any[];
};

export default function OSCEStudent({ roomId, studentName, studentEmail }: { roomId: string; studentName?: string; studentEmail?: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Exam | null>(null);
  const [report, setReport] = useState<{ exam: Exam; attempt: Attempt } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: exData } = await supabase
      .from("osce_exams" as any)
      .select("*")
      .eq("room_id", roomId)
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    setExams(((exData as any) || []) as Exam[]);
    if (studentEmail) {
      const { data: atData } = await supabase
        .from("osce_attempts" as any)
        .select("*")
        .eq("room_id", roomId)
        .eq("student_email", studentEmail.toLowerCase());
      setAttempts(((atData as any) || []) as Attempt[]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [roomId, studentEmail]);

  if (active) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => { setActive(null); load(); }}>← Voltar à lista</Button>
        <OSCEPlayer exam={active} studentName={studentName} studentEmail={studentEmail} onFinish={() => { setActive(null); load(); }} />
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (exams.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-60" />
        Nenhum OSCE publicado nesta sala ainda.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Stethoscope className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">OSCE Virtual — Exames Estruturados</h2>
        <Badge variant="outline" className="text-xs">Beta</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Estações clínicas com <strong>paciente padronizado virtual</strong> (anamnese/comunicação) e tarefas escritas.
        A avaliação por IA é revisada pelo professor antes da liberação do relatório oficial.
      </p>
      {exams.map((e) => {
        const att = attempts.find(a => a.exam_id === e.id && a.completed_at);
        const released = att?.released_to_student;
        const displayScore = att?.final_score ?? att?.teacher_score ?? att?.total_score;
        return (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold flex items-center gap-2 flex-wrap">
                  {e.title}
                  {att && !att.completed_at && <Badge variant="outline" className="text-[10px]">Em andamento</Badge>}
                  {att?.completed_at && !released && (
                    <Badge variant="outline" className="text-[10px]"><Hourglass className="w-3 h-3 mr-1" />Aguardando revisão do professor</Badge>
                  )}
                  {released && att?.passed === true && <Badge variant="secondary" className="text-[10px]"><Award className="w-3 h-3 mr-1" />Aprovado</Badge>}
                  {released && att?.passed === false && <Badge variant="destructive" className="text-[10px]">Reprovado</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {e.description} · {e.stations?.length || 0} estações · nota mínima {e.passing_score}/10
                </div>
                {released && displayScore != null && (
                  <div className="text-xs mt-1">Nota oficial: <strong>{Number(displayScore).toFixed(1)}/10</strong>
                    {att?.certificate_id && <span className="ml-2 font-mono text-muted-foreground">{att.certificate_id}</span>}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {released && att && (
                  <Button size="sm" variant="outline" onClick={() => setReport({ exam: e, attempt: att })}>
                    <FileText className="w-4 h-4 mr-1" /> Relatório
                  </Button>
                )}
                {!att?.completed_at || released ? (
                  <Button size="sm" onClick={() => setActive(e)}>
                    {att?.completed_at ? "Refazer" : "Iniciar"} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button size="sm" disabled variant="secondary">
                    <Hourglass className="w-4 h-4 mr-1" /> Em revisão
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Dialog open={!!report} onOpenChange={(v) => !v && setReport(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {report && (
            <>
              <DialogHeader><DialogTitle>Relatório — {report.exam.title}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Card className="p-4 bg-primary/5">
                  <div className="text-sm">Nota oficial</div>
                  <div className="text-3xl font-bold">
                    {Number(report.attempt.final_score ?? report.attempt.teacher_score ?? report.attempt.total_score ?? 0).toFixed(1)}
                    <span className="text-base text-muted-foreground">/10</span>
                  </div>
                  {report.attempt.teacher_feedback && (
                    <div className="mt-2 text-sm">
                      <div className="font-semibold text-xs text-muted-foreground">Feedback do professor</div>
                      <div className="whitespace-pre-wrap">{report.attempt.teacher_feedback}</div>
                    </div>
                  )}
                </Card>
                <div className="space-y-2">
                  {(report.attempt.station_responses || []).map((r: any, i: number) => (
                    <Card key={i} className="p-3">
                      <div className="flex justify-between text-sm">
                        <strong>{i + 1}. {r.title}</strong>
                        <Badge variant="secondary">{Number(r.ai_score).toFixed(1)}/10</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.ai_feedback}</div>
                      {r.mode === "chat" && r.transcript?.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-primary"><User className="w-3 h-3 inline mr-1" />Ver diálogo com o paciente</summary>
                          <div className="mt-2 space-y-1 text-xs">
                            {r.transcript.map((t: any, j: number) => (
                              <div key={j}><strong>{t.role === "student" ? "Você" : "Paciente"}:</strong> {t.text}</div>
                            ))}
                          </div>
                        </details>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
