import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Play, Square, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Turn = { role: "examiner" | "student"; text: string; at: string };

declare global {
  interface Window { webkitSpeechRecognition?: any; SpeechRecognition?: any; }
}

export default function SocraticDebateRoom({
  roomId, topic, studentName, studentEmail,
}: { roomId: string; topic: string; studentName?: string; studentEmail?: string }) {
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [partial, setPartial] = useState("");
  const [manualText, setManualText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [ending, setEnding] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, partial]);

  const speak = (text: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.rate = 1;
      synth.speak(u);
    } catch {/* ignore */}
  };

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
      speak(q);
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
    setPartial("");
    setManualText("");
    await requestExaminer(next);
  };

  const toggleListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Reconhecimento de voz não disponível neste navegador. Use o campo de texto.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setPartial(finalText + interim);
    };
    rec.onerror = (e: any) => { console.warn("STT err", e); setListening(false); };
    rec.onend = () => {
      setListening(false);
      const text = finalText.trim();
      if (text) sendStudentText(text);
    };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const endDebate = async () => {
    setEnding(true);
    try {
      window.speechSynthesis?.cancel();
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
          <h3 className="font-semibold">Debate Socrático por Voz</h3>
          <p className="text-xs text-muted-foreground">Tópico: <strong>{topic}</strong></p>
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
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${t.role === "examiner" ? "bg-primary/10 text-foreground" : "bg-background border"}`}>
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">{t.role === "examiner" ? "Examinador" : "Você"}</div>
                {t.text}
              </div>
            </div>
          ))}
          {thinking && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Examinador formulando próxima pergunta…</div>}
          {partial && <div className="text-xs italic text-muted-foreground">🎙️ {partial}</div>}
        </div>
      )}

      {active && (
        <div className="flex gap-2 items-center">
          <Button variant={listening ? "destructive" : "outline"} size="icon" onClick={toggleListen} disabled={thinking}>
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Input
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendStudentText(manualText); }}
            placeholder={listening ? "Falando..." : "Ou digite sua resposta e pressione Enter"}
            disabled={thinking || listening}
          />
          <Button onClick={() => sendStudentText(manualText)} disabled={thinking || !manualText.trim()}>Enviar</Button>
        </div>
      )}

      {result && (
        <Card className="p-4 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /><strong>Avaliação</strong></div>
          <div className="text-3xl font-bold">{Number(result.final_grade).toFixed(1)}<span className="text-base text-muted-foreground">/10</span></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {result.rubric && Object.entries(result.rubric).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border rounded px-2 py-1">
                <span className="capitalize">{k.replace(/_/g, " ")}</span>
                <Badge variant="secondary">{String(v)}/10</Badge>
              </div>
            ))}
          </div>
          {result.feedback_md && <div className="text-sm whitespace-pre-wrap">{result.feedback_md}</div>}
          <Button variant="outline" onClick={() => { setResult(null); setTranscript([]); }}>Novo debate</Button>
        </Card>
      )}
    </Card>
  );
}
