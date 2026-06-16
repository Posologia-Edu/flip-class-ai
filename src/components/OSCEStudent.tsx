import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, ChevronRight, Award, Loader2 } from "lucide-react";
import OSCEPlayer from "./OSCEPlayer";

type Station = { id: string; type: string; title: string; prompt: string; duration_sec: number; max_score: number; rubric_criteria: any[] };
type Exam = { id: string; room_id: string; title: string; description: string | null; passing_score: number; stations: Station[] };
type Attempt = { id: string; exam_id: string; total_score: number | null; passed: boolean | null; certificate_id: string | null; completed_at: string | null };

export default function OSCEStudent({ roomId, studentName, studentEmail }: { roomId: string; studentName?: string; studentEmail?: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Exam | null>(null);

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
        .select("id,exam_id,total_score,passed,certificate_id,completed_at")
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
      <p className="text-sm text-muted-foreground">Exames clínicos com estações cronometradas avaliadas por IA. Ao alcançar a nota mínima, você recebe um certificado de competência.</p>
      {exams.map((e) => {
        const att = attempts.find(a => a.exam_id === e.id && a.completed_at);
        return (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold flex items-center gap-2 flex-wrap">
                  {e.title}
                  {att?.passed === true && <Badge variant="secondary" className="text-[10px]"><Award className="w-3 h-3 mr-1" />Aprovado</Badge>}
                  {att?.passed === false && <Badge variant="destructive" className="text-[10px]">Reprovado</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {e.description} · {e.stations?.length || 0} estações · nota mínima {e.passing_score}/10
                </div>
                {att?.completed_at && (
                  <div className="text-xs mt-1">Sua nota: <strong>{Number(att.total_score).toFixed(1)}/10</strong>{att.certificate_id && <span className="ml-2 font-mono text-muted-foreground">{att.certificate_id}</span>}</div>
                )}
              </div>
              <Button size="sm" onClick={() => setActive(e)}>
                {att?.completed_at ? "Refazer" : "Iniciar"} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
