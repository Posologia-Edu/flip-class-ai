import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Stethoscope, Clock, ChevronRight, Award, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Station = { id: string; type: string; title: string; prompt: string; duration_sec: number; max_score: number; rubric_criteria: any[] };
type Exam = { id: string; room_id: string; title: string; passing_score: number; stations: Station[] };

export default function OSCEPlayer({ exam, studentName, studentEmail, onFinish }:
  { exam: Exam; studentName?: string; studentEmail?: string; onFinish?: () => void }) {
  const [started, setStarted] = useState(false);
  const [stationIdx, setStationIdx] = useState(0);
  const [responses, setResponses] = useState<any[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [finalResult, setFinalResult] = useState<any | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const stationStartRef = useRef<number>(0);

  const station = exam.stations[stationIdx];

  useEffect(() => {
    if (!started || finalResult) return;
    setTimeLeft(station.duration_sec);
    stationStartRef.current = Date.now();
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(iv); submitStation(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationIdx, started]);

  const start = async () => {
    const { data, error } = await supabase.from("osce_attempts" as any).insert({
      exam_id: exam.id,
      room_id: exam.room_id,
      student_email: (studentEmail || "anon@anon").toLowerCase(),
      student_name: studentName,
      station_responses: [],
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setAttemptId((data as any).id);
    setStarted(true);
  };

  const submitStation = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    const timeUsed = Math.round((Date.now() - stationStartRef.current) / 1000);
    const text = currentText.trim() || (auto ? "(sem resposta — tempo esgotado)" : "(em branco)");
    try {
      const { data, error } = await supabase.functions.invoke("osce-evaluate", {
        body: { station, response: text },
      });
      if (error) throw error;
      const stationResp = {
        station_id: station.id,
        type: station.type,
        title: station.title,
        response: text,
        time_used_sec: timeUsed,
        ai_score: data.score,
        criteria_scores: data.criteria_scores || [],
        ai_feedback: data.feedback,
      };
      const next = [...responses, stationResp];
      setResponses(next);
      setCurrentText("");

      if (stationIdx + 1 < exam.stations.length) {
        setStationIdx(stationIdx + 1);
      } else {
        const total = next.reduce((s, r) => s + Number(r.ai_score || 0), 0) / next.length;
        const passed = total >= exam.passing_score;
        const certId = passed ? `OSCE-${Date.now().toString(36).toUpperCase()}` : null;
        await supabase.from("osce_attempts" as any).update({
          station_responses: next,
          total_score: total,
          passed,
          certificate_id: certId,
          completed_at: new Date().toISOString(),
        }).eq("id", attemptId!);
        setFinalResult({ total, passed, certId, responses: next });
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao avaliar");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (finalResult) {
    return (
      <Card className="p-6 space-y-4">
        <div className="text-center">
          <Award className={`w-12 h-12 mx-auto ${finalResult.passed ? "text-green-600" : "text-muted-foreground"}`} />
          <h2 className="text-2xl font-bold mt-2">{finalResult.passed ? "Aprovado!" : "Reprovado"}</h2>
          <div className="text-4xl font-bold mt-2">{Number(finalResult.total).toFixed(1)}<span className="text-lg text-muted-foreground">/10</span></div>
          <div className="text-xs text-muted-foreground">Nota mínima: {exam.passing_score}</div>
          {finalResult.certId && (
            <Card className="mt-4 p-4 bg-primary/5">
              <div className="text-sm">Certificado de Competência</div>
              <div className="font-mono text-xs mt-1">{finalResult.certId}</div>
              <div className="text-xs text-muted-foreground mt-1">{studentName || studentEmail} · {exam.title}</div>
            </Card>
          )}
        </div>
        <div className="space-y-2">
          {finalResult.responses.map((r: any, i: number) => (
            <Card key={i} className="p-3">
              <div className="flex justify-between text-sm">
                <strong>{i + 1}. {r.title}</strong>
                <Badge variant="secondary">{Number(r.ai_score).toFixed(1)}/10</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{r.ai_feedback}</div>
            </Card>
          ))}
        </div>
        <Button onClick={onFinish} variant="outline" className="w-full">Voltar</Button>
      </Card>
    );
  }

  if (!started) {
    return (
      <Card className="p-6 space-y-3 text-center">
        <Stethoscope className="w-10 h-10 mx-auto text-primary" />
        <h2 className="text-xl font-bold">{exam.title}</h2>
        <p className="text-sm text-muted-foreground">
          {exam.stations.length} estações cronometradas · nota mínima {exam.passing_score}/10
          <br/>Você não poderá voltar a uma estação após avançar. Ao zerar o tempo, a resposta é enviada automaticamente.
        </p>
        <Button onClick={start} size="lg"><ChevronRight className="w-4 h-4 mr-1" /> Iniciar OSCE</Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xs text-muted-foreground">Estação {stationIdx + 1}/{exam.stations.length}</div>
          <h3 className="font-bold">{station.title} <Badge variant="outline" className="text-[10px] ml-1">{station.type}</Badge></h3>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${timeLeft < 30 ? "text-red-600" : ""}`}>
            <Clock className="w-5 h-5 inline mr-1" />{fmt(timeLeft)}
          </div>
        </div>
      </div>
      <Progress value={((stationIdx + 1) / exam.stations.length) * 100} />
      <Card className="p-3 bg-muted/40">
        <div className="text-sm whitespace-pre-wrap">{station.prompt}</div>
      </Card>
      <Textarea
        value={currentText}
        onChange={(e) => setCurrentText(e.target.value)}
        rows={8}
        placeholder="Sua resposta..."
        disabled={submitting}
      />
      <Button onClick={() => submitStation(false)} disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronRight className="w-4 h-4 mr-2" />}
        {stationIdx + 1 < exam.stations.length ? "Próxima estação" : "Finalizar OSCE"}
      </Button>
    </Card>
  );
}
