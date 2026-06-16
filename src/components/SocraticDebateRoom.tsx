import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Play, Square, Loader2, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";

type Turn = { role: "examiner" | "student"; text: string; at: string };

export default function SocraticDebateRoom({
  roomId, topic, studentName, studentEmail,
}: { roomId: string; topic: string; studentName?: string; studentEmail?: string }) {
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [manualText, setManualText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [ending, setEnding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const requestExaminer = async (newTranscript: Turn[]) => {
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke("socratic-turn", {
        body: { roomId, topic, transcript: newTranscript },
      });
      if (error) throw error;
      const q = data?.question || "Pode elaborar mais?";
      const turn: Turn = { role: "examiner", text: q, at: new Date().toISOString() };
      setTranscript([...newTranscript, turn]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar próxima pergunta");
    } finally {
      setThinking(false);
    }
  };

  const startDebate = async () => {
    setActive(true);
    setTranscript([]);
    setResult(null);
    setStartTime(Date.now());
    await requestExaminer([]);
  };

  const sendStudentText = async (text: string) => {
    if (!text.trim()) return;
    const turn: Turn = { role: "student", text: text.trim(), at: new Date().toISOString() };
    const next = [...transcript, turn];
    setTranscript(next);
    setManualText("");
    await requestExaminer(next);
  };

  const endDebate = async () => {
    setEnding(true);
    try {
      const durationSec = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      const { data, error } = await supabase.functions.invoke("socratic-end", {
        body: { roomId, topic, transcript, studentName, studentEmail, durationSec },
      });
      if (error) throw error;
      setResult(data);
      setActive(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao encerrar");
    } finally {
      setEnding(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold">Debate Socrático</h3>
          <p className="text-xs text-muted-foreground">Tópico: <strong>{topic}</strong> · Interação por texto</p>
        </div>
        {!active && !result && (
          <Button onClick={startDebate} disabled={thinking}>
            <Play className="w-4 h-4 mr-2" /> Iniciar debate
          </Button>
        )}
        {active && (
          <Button variant="destructive" onClick={endDebate} disabled={ending}>
            {ending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
            Encerrar e avaliar
          </Button>
        )}
      </div>

      {(active || transcript.length > 0) && (
        <div ref={scrollRef} className="border rounded-md max-h-96 overflow-y-auto p-3 space-y-2 bg-muted/30">
          {transcript.map((t, i) => (
            <div key={i} className={`flex ${t.role === "student" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${t.role === "examiner" ? "bg-primary/10 text-foreground" : "bg-background border"}`}>
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">{t.role === "examiner" ? "Examinador" : "Você"}</div>
                {t.text}
              </div>
            </div>
          ))}
          {thinking && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Examinador formulando próxima pergunta…</div>}
        </div>
      )}

      {active && (
        <div className="flex gap-2 items-end">
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendStudentText(manualText);
              }
            }}
            placeholder="Digite sua resposta (Enter envia, Shift+Enter quebra linha)"
            disabled={thinking}
            rows={3}
            className="flex-1"
          />
          <Button onClick={() => sendStudentText(manualText)} disabled={thinking || !manualText.trim()}>
            <Send className="w-4 h-4 mr-2" /> Enviar
          </Button>
        </div>
      )}

      {result && (
        <Card className="p-4 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /><strong>Avaliação</strong></div>
          <div className="text-3xl font-bold">{Number(result.final_grade).toFixed(1)}<span className="text-base text-muted-foreground">/10</span></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {result.rubric && Object.entries(result.rubric).map(([k, v]) => {
              const labels: Record<string, string> = {
                clinical_reasoning: "Raciocínio Clínico",
                evidence_use: "Uso de Evidências",
                clarity: "Clareza",
                depth: "Profundidade",
                raciocinio_clinico: "Raciocínio Clínico",
                uso_de_evidencias: "Uso de Evidências",
                clareza: "Clareza",
                profundidade: "Profundidade",
              };
              const label = labels[k] || k.replace(/_/g, " ");
              return (
                <div key={k} className="flex items-center justify-between border rounded px-2 py-1">
                  <span>{label}</span>
                  <Badge variant="secondary">{String(v)}/10</Badge>
                </div>
              );
            })}
          </div>
          {result.feedback_md && <div className="text-sm whitespace-pre-wrap">{result.feedback_md}</div>}
          <Button variant="outline" onClick={() => { setResult(null); setTranscript([]); }}>Novo debate</Button>
        </Card>
      )}
    </Card>
  );
}
