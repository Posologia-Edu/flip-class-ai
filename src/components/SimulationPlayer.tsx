import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Award, ChevronRight, CheckCircle2, MessageSquare, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Simulation {
  id: string;
  title: string;
  description: string;
  learning_objectives: string;
  scenario: any;
  max_steps: number;
}

interface Run {
  id: string;
  simulation_id: string;
  history: any[];
  status: string;
  ai_score: number | null;
  ai_feedback: string | null;
  teacher_score: number | null;
  teacher_feedback: string | null;
}

interface Props {
  roomId: string;
  sessionId: string;
}

export default function SimulationPlayer({ roomId, sessionId }: Props) {
  const { toast } = useToast();
  const [sims, setSims] = useState<Simulation[]>([]);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [activeSim, setActiveSim] = useState<Simulation | null>(null);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase
      .from("simulations")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    setSims((s as any) || []);
    if (s && s.length > 0) {
      const { data: r } = await supabase
        .from("simulation_sessions")
        .select("*")
        .eq("student_session_id", sessionId)
        .in("simulation_id", s.map((x: any) => x.id));
      const map: Record<string, Run> = {};
      (r || []).forEach((x: any) => { map[x.simulation_id] = x; });
      setRuns(map);
    }
  }, [roomId, sessionId]);

  useEffect(() => { load(); }, [load]);

  const startSim = async (sim: Simulation) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("simulation-step", {
        body: { action: "start", simulationId: sim.id, studentSessionId: sessionId },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const run = (data as any).run;
      setActiveSim(sim);
      setActiveRun(run);
      setRuns(prev => ({ ...prev, [sim.id]: run }));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const choose = async (idx: number) => {
    if (!activeRun || stepLoading) return;
    setStepLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("simulation-step", {
        body: { action: "step", sessionRunId: activeRun.id, chosenIndex: idx },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const updated = (data as any).run as Run;
      setActiveRun(updated);
      setRuns(prev => ({ ...prev, [updated.simulation_id]: updated }));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setStepLoading(false);
    }
  };

  const restart = async (sim: Simulation) => {
    if (!confirm("Iniciar nova tentativa? A anterior será mantida no histórico.")) return;
    setLoading(true);
    try {
      await supabase.from("simulation_sessions").delete().eq("id", runs[sim.id].id);
      setRuns(prev => { const n = { ...prev }; delete n[sim.id]; return n; });
      await startSim(sim);
    } finally {
      setLoading(false);
    }
  };

  // === Playing view ===
  if (activeSim && activeRun) {
    const scenario = activeSim.scenario || {};
    const history = activeRun.history || [];
    const isFinal = activeRun.status === "completed";
    const current = history.length === 0
      ? { narrative: scenario.initial_situation, options: scenario.initial_options || [] }
      : { narrative: history[history.length - 1].narrative, options: history[history.length - 1].options || [] };

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold">{activeSim.title}</h2>
            <Button variant="ghost" size="sm" onClick={() => { setActiveSim(null); setActiveRun(null); load(); }}>
              Voltar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground italic mb-3">{scenario.setting}</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Progresso:</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (history.length / activeSim.max_steps) * 100)}%` }} />
            </div>
            <span className="text-muted-foreground">{history.length}/{activeSim.max_steps}</span>
          </div>
        </div>

        {history.length > 0 && history[history.length - 1].feedback_on_previous && !isFinal && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Consequência</p>
            <p className="text-sm text-foreground">{history[history.length - 1].feedback_on_previous}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={history.length}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            {isFinal ? (
              <div>
                <CheckCircle2 className="w-10 h-10 text-level-easy mb-3" />
                <h3 className="font-display text-2xl font-bold mb-2">Simulação concluída!</h3>
                <p className="text-sm text-foreground mb-4">{current.narrative}</p>
                {activeRun.ai_score != null && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-5 h-5 text-primary" />
                      <span className="font-display text-2xl font-bold text-primary">{activeRun.ai_score.toFixed(1)}/10</span>
                    </div>
                    {activeRun.ai_feedback && (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{activeRun.ai_feedback}</p>
                    )}
                  </div>
                )}
                <Button onClick={() => { setActiveSim(null); setActiveRun(null); load(); }}>Voltar à lista</Button>
              </div>
            ) : (
              <>
                <p className="text-base text-foreground mb-5 whitespace-pre-wrap">{current.narrative}</p>
                <div className="space-y-2">
                  {current.options.map((opt: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => choose(i)}
                      disabled={stepLoading}
                      className="w-full text-left p-4 rounded-lg border-2 border-border bg-secondary hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-wait"
                    >
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {stepLoading && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> A IA está processando sua decisão...
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // === List view ===
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold mb-1">Simulações Interativas</h2>
        <p className="text-sm text-muted-foreground">Cenários adaptativos com decisões e feedback imediato pela IA.</p>
      </div>

      {sims.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
          <Sparkles className="w-8 h-8 mx-auto mb-2" />
          <p>Nenhuma simulação disponível ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sims.map((s) => {
            const run = runs[s.id];
            const completed = run?.status === "completed";
            return (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-display font-semibold text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.learning_objectives}</p>
                    <p className="text-xs text-muted-foreground mt-2">{s.max_steps} decisões</p>
                    {completed && run.ai_score != null && (
                      <div className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                        <Award className="w-4 h-4" /> Nota: {(run.teacher_score ?? run.ai_score).toFixed(1)}/10
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {completed ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setActiveSim(s); setActiveRun(run); }}>
                          Ver resultado
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => restart(s)} disabled={loading}>
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refazer
                        </Button>
                      </>
                    ) : run ? (
                      <Button size="sm" onClick={() => { setActiveSim(s); setActiveRun(run); }} disabled={loading}>
                        Continuar <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => startSim(s)} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Iniciar <ChevronRight className="w-4 h-4 ml-1" /></>}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
