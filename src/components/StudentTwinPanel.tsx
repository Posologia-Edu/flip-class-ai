import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, RefreshCw, AlertTriangle, Sparkles, Eye, BookOpen, Activity } from "lucide-react";
import { toast } from "sonner";

type Twin = {
  id: string;
  student_email: string;
  student_name: string | null;
  risk_score: number;
  risk_factors: string[];
  cognitive_style: string | null;
  style_confidence: number | null;
  memory_decay: Array<{ topic: string; strength: number | null; last_seen: string | null; next_review_at: string | null }>;
  recommendations: Array<{ type: string; topic?: string; action: string; duration_min?: number; priority?: string }>;
  metrics: any;
  updated_at: string;
};

const styleIcon: Record<string, any> = { visual: Eye, reader: BookOpen, practical: Activity, mixed: Brain };
const styleLabel: Record<string, string> = { visual: "Visual", reader: "Leitor", practical: "Prático", mixed: "Misto" };

export default function StudentTwinPanel({ roomId }: { roomId: string }) {
  const [twins, setTwins] = useState<Twin[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_twins" as any)
      .select("*")
      .eq("room_id", roomId)
      .order("risk_score", { ascending: false });
    if (error) toast.error(error.message);
    setTwins((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [roomId]);

  const updateAll = async () => {
    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("student-twin-update", { body: { roomId, batch: true } });
      if (error) throw error;
      toast.success(`${data?.count || 0} gêmeos digitais atualizados`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    } finally {
      setUpdating(false);
    }
  };

  const riskColor = (r: number) => r >= 60 ? "bg-red-500/15 text-red-700 border-red-300" : r >= 30 ? "bg-amber-500/15 text-amber-700 border-amber-300" : "bg-green-500/15 text-green-700 border-green-300";
  const riskLabel = (r: number) => r >= 60 ? "Alto risco" : r >= 30 ? "Atenção" : "Estável";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Gêmeos Digitais dos Alunos</h2>
          <Badge variant="outline" className="text-xs">Beta</Badge>
        </div>
        <Button onClick={updateAll} disabled={updating} size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${updating ? "animate-spin" : ""}`} />
          {updating ? "Atualizando..." : "Atualizar gêmeos"}
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : twins.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum gêmeo digital ainda. Clique em "Atualizar gêmeos" para gerar previsões individualizadas para todos os alunos.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {twins.map((t) => {
            const Icon = styleIcon[t.cognitive_style || "mixed"] || Brain;
            const weak = (t.memory_decay || []).filter((d) => d.last_seen && (d.strength ?? 1) < 0.6).slice(0, 3);
            return (
              <Card key={t.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.student_name || t.student_email}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.student_email}</div>
                  </div>
                  <Badge className={`${riskColor(t.risk_score)} border`}>{riskLabel(t.risk_score)} {t.risk_score}</Badge>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Icon className="w-4 h-4 text-primary" />
                  <span>Estilo: <strong>{styleLabel[t.cognitive_style || "mixed"]}</strong></span>
                  {t.style_confidence != null && <span className="text-muted-foreground">({Math.round((t.style_confidence) * 100)}%)</span>}
                </div>

                {t.risk_factors?.length > 0 && (
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1 text-amber-700 font-medium"><AlertTriangle className="w-3 h-3" /> Fatores de risco</div>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {t.risk_factors.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {weak.length > 0 && (
                  <div className="text-xs">
                    <div className="font-medium mb-1">Memória em decaimento</div>
                    <div className="flex flex-wrap gap-1">
                      {weak.map((d, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {d.topic} · {Math.round((d.strength || 0) * 100)}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {t.recommendations?.length > 0 && (
                  <div className="text-xs space-y-1 border-t pt-2">
                    <div className="flex items-center gap-1 text-primary font-medium"><Sparkles className="w-3 h-3" /> Micro-intervenções</div>
                    <ul className="space-y-1">
                      {t.recommendations.slice(0, 3).map((r, i) => (
                        <li key={i} className="text-muted-foreground">
                          • {r.action} {r.duration_min ? <span className="text-[10px]">({r.duration_min} min)</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground border-t pt-2 flex justify-between">
                  <span>{t.metrics?.total_minutes ?? 0} min · {t.metrics?.materials_pct ?? 0}% materiais</span>
                  <span>Atualizado {new Date(t.updated_at).toLocaleString("pt-BR")}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
