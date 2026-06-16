import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Stethoscope, Clock, ChevronRight, Loader2, Send, User, Hourglass } from "lucide-react";
import { toast } from "sonner";

type Station = { id: string; type: string; title: string; prompt: string; duration_sec: number; max_score: number; rubric_criteria: any[] };
type Exam = { id: string; room_id: string; title: string; passing_score: number; stations: Station[] };
type Turn = { role: "student" | "patient"; text: string };

// Tipos de estação que usam paciente virtual interativo
const INTERACTIVE_TYPES = ["anamnese", "comunicacao", "comunicação"];

export default function OSCEPlayer({ exam, studentName, studentEmail, onFinish }:
  { exam: Exam; studentName?: string; studentEmail?: string; onFinish?: () => void }) {
  const [started, setStarted] = useState(false);
  const [stationIdx, setStationIdx] = useState(0);
  const [responses, setResponses] = useState<any[]>([]);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [patientThinking, setPatientThinking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const stationStartRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const station = exam.stations[stationIdx];
  const isInteractive = station && INTERACTIVE_TYPES.includes(station.type?.toLowerCase());

  useEffect(() => {
    if (!started || finished) return;
    setTimeLeft(station.duration_sec);
    setTranscript([]);
    setDraft("");
    setWrittenAnswer("");
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, patientThinking]);

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

  const sendToPatient = async () => {
    const msg = draft.trim();
    if (!msg || patientThinking) return;
    const newTurns: Turn[] = [...transcript, { role: "student", text: msg }];
    setTranscript(newTurns);
    setDraft("");
    setPatientThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke("osce-patient", {
        body: { station, history: newTurns, studentMessage: msg },
      });
      if (error) throw error;
      setTranscript([...newTurns, { role: "patient", text: data.reply || "..." }]);
    } catch (e: any) {
      toast.error(e.message || "Paciente não respondeu");
    } finally {
      setPatientThinking(false);
    }
  };

  const submitStation = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    const timeUsed = Math.round((Date.now() - stationStartRef.current) / 1000);
    try {
      const body: any = { station };
      if (isInteractive) body.transcript = transcript;
      else body.response = writtenAnswer.trim() || (auto ? "(sem resposta — tempo esgotado)" : "(em branco)");

      const { data, error } = await supabase.functions.invoke("osce-evaluate", { body });
      if (error) throw error;

      const stationResp = {
        station_id: station.id,
        type: station.type,
        title: station.title,
        mode: isInteractive ? "chat" : "written",
        transcript: isInteractive ? transcript : undefined,
        response: isInteractive ? undefined : writtenAnswer,
        time_used_sec: timeUsed,
        ai_score: data.score,
        criteria_scores: data.criteria_scores || [],
        ai_feedback: data.feedback,
        strengths: data.strengths || [],
        improvements: data.improvements || [],
      };
      const next = [...responses, stationResp];
      setResponses(next);

      if (stationIdx + 1 < exam.stations.length) {
        setStationIdx(stationIdx + 1);
      } else {
        const total = next.reduce((s, r) => s + Number(r.ai_score || 0), 0) / next.length;
        await supabase.from("osce_attempts" as any).update({
          station_responses: next,
          total_score: total,
          completed_at: new Date().toISOString(),
          teacher_reviewed: false,
          released_to_student: false,
        }).eq("id", attemptId!);
        setFinished(true);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao avaliar");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (finished) {
    return (
      <Card className="p-6 space-y-4 text-center">
        <Hourglass className="w-12 h-12 mx-auto text-primary" />
        <h2 className="text-xl font-bold">OSCE concluído!</h2>
        <p className="text-sm text-muted-foreground">
          Sua avaliação foi gerada pela IA e enviada ao professor para revisão final.
          O <strong>relatório de desempenho</strong> com a nota oficial e o feedback consolidado
          ficará disponível assim que o professor concluir os ajustes.
        </p>
        <Button onClick={onFinish} variant="outline">Voltar</Button>
      </Card>
    );
  }

  if (!started) {
    return (
      <Card className="p-6 space-y-3 text-center">
        <Stethoscope className="w-10 h-10 mx-auto text-primary" />
        <h2 className="text-xl font-bold">{exam.title}</h2>
        <p className="text-sm text-muted-foreground">
          {exam.stations.length} estações cronometradas. Em estações de <strong>anamnese</strong> e
          <strong> comunicação</strong> você conversará com um paciente padronizado virtual.
          <br />Demais estações pedem resposta escrita (prescrição, cálculo, raciocínio).
          <br />Ao zerar o tempo, a estação é finalizada automaticamente. O professor fará a revisão final antes da nota oficial.
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
        <div className="text-xs font-semibold mb-1 text-muted-foreground">CASO / TAREFA</div>
        <div className="text-sm whitespace-pre-wrap">{station.prompt}</div>
      </Card>

      {isInteractive ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3" /> Conversa com o paciente padronizado
          </div>
          <div className="border rounded-md bg-background max-h-[360px] overflow-y-auto p-3 space-y-2">
            {transcript.length === 0 && !patientThinking && (
              <div className="text-xs text-muted-foreground italic text-center py-4">
                Comece a consulta — cumprimente o paciente e conduza a anamnese.
              </div>
            )}
            {transcript.map((t, i) => (
              <div key={i} className={`flex ${t.role === "student" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  t.role === "student" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <div className="text-[10px] opacity-70 mb-0.5">{t.role === "student" ? "Você" : "Paciente"}</div>
                  {t.text}
                </div>
              </div>
            ))}
            {patientThinking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                  <Loader2 className="w-3 h-3 inline animate-spin mr-1" /> paciente digitando…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Fale com o paciente..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendToPatient(); }
              }}
              disabled={patientThinking || submitting}
            />
            <Button onClick={sendToPatient} disabled={patientThinking || submitting || !draft.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Textarea
          value={writtenAnswer}
          onChange={(e) => setWrittenAnswer(e.target.value)}
          rows={8}
          placeholder="Sua resposta (prescrição, cálculo, raciocínio clínico)..."
          disabled={submitting}
        />
      )}

      <Button onClick={() => submitStation(false)} disabled={submitting} className="w-full" variant={isInteractive ? "secondary" : "default"}>
        {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronRight className="w-4 h-4 mr-2" />}
        {stationIdx + 1 < exam.stations.length ? "Encerrar estação e avançar" : "Encerrar e finalizar OSCE"}
      </Button>
    </Card>
  );
}
