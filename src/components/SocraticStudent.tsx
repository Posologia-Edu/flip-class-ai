import { useEffect, useState } from "react";
import { studentApi } from "@/lib/student-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mic, Loader2, Sparkles } from "lucide-react";
import SocraticDebateRoom from "./SocraticDebateRoom";

type Session = { id: string; topic: string; final_grade: number | null; ended_at: string | null; started_at: string };

export default function SocraticStudent({ roomId, sessionId, studentName, studentEmail }: { roomId: string; sessionId: string; studentName?: string; studentEmail?: string }) {
  const [topic, setTopic] = useState("");
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await studentApi<{ sessions: Session[] }>("list_socratic_sessions", sessionId);
      setHistory(res.sessions || []);
    } catch {
      setHistory([]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [roomId, sessionId]);


  if (started) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => { setStarted(false); load(); }}>← Voltar</Button>
        <SocraticDebateRoom roomId={roomId} topic={topic} studentName={studentName} studentEmail={studentEmail} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Debate Socrático com IA</h2>
        <Badge variant="outline" className="text-xs">Beta · Voz</Badge>
      </div>
      <Card className="p-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          Um examinador virtual conduzirá um diálogo socrático com você por voz (ou texto). Ao final, você recebe uma rubrica detalhada de raciocínio clínico, uso de evidências, clareza e profundidade.
        </p>
        <div>
          <label className="text-sm font-medium">Tópico para o debate</label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: manejo da hipertensão resistente" />
        </div>
        <Button onClick={() => topic.trim() && setStarted(true)} disabled={!topic.trim()} className="w-full">
          <Sparkles className="w-4 h-4 mr-2" /> Iniciar Debate
        </Button>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2">Seus debates anteriores</h3>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhum debate ainda.</div>
        ) : (
          <div className="space-y-2">
            {history.map(s => (
              <Card key={s.id} className="p-3 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium">{s.topic}</div>
                  <div className="text-xs text-muted-foreground">{new Date(s.started_at).toLocaleString("pt-BR")}</div>
                </div>
                <Badge variant={s.final_grade != null ? "secondary" : "outline"}>
                  {s.final_grade != null ? `${Number(s.final_grade).toFixed(1)}/10` : "Em andamento"}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
