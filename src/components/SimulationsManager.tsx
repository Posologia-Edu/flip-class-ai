import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, Trash2, ChevronDown, ChevronUp, Users, Award, MessageSquare, Save, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Material { id: string; title: string; type: string; }
interface Simulation {
  id: string;
  title: string;
  description: string;
  learning_objectives: string;
  material_ids: string[];
  scenario: any;
  max_steps: number;
  is_published: boolean;
  is_longitudinal: boolean;
  total_chapters: number;
  created_at: string;
}
interface SimSession {
  id: string;
  simulation_id: string;
  student_session_id: string;
  status: string;
  history: any[];
  ai_score: number | null;
  ai_feedback: string | null;
  teacher_score: number | null;
  teacher_feedback: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Props {
  roomId: string;
  materials: Material[];
  isOwner: boolean;
}

export default function SimulationsManager({ roomId, materials, isOwner }: Props) {
  const { toast } = useToast();
  const [sims, setSims] = useState<Simulation[]>([]);
  const [sessions, setSessions] = useState<SimSession[]>([]);
  const [students, setStudents] = useState<Record<string, { student_name: string; student_email: string | null }>>({});
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    learning_objectives: "",
    material_ids: [] as string[],
    max_steps: 6,
    is_longitudinal: false,
    total_chapters: 3,
  });
  const [editing, setEditing] = useState<Record<string, { score: string; feedback: string }>>({});

  const load = useCallback(async () => {
    const { data: s } = await supabase
      .from("simulations")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    setSims((s as any) || []);
    if (s && s.length > 0) {
      const ids = s.map((x: any) => x.id);
      const { data: runs } = await supabase
        .from("simulation_sessions")
        .select("*")
        .in("simulation_id", ids)
        .order("created_at", { ascending: false });
      setSessions((runs as any) || []);
      const studentIds = Array.from(new Set((runs || []).map((r: any) => r.student_session_id)));
      if (studentIds.length > 0) {
        const { data: ss } = await supabase
          .from("student_sessions")
          .select("id, student_name, student_email")
          .in("id", studentIds);
        const map: Record<string, any> = {};
        (ss || []).forEach((x: any) => { map[x.id] = x; });
        setStudents(map);
      }
    }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  const toggleMaterial = (id: string) => {
    setForm(f => ({
      ...f,
      material_ids: f.material_ids.includes(id)
        ? f.material_ids.filter(x => x !== id)
        : [...f.material_ids, id],
    }));
  };

  const handleCreate = async () => {
    if (!form.learning_objectives.trim()) {
      toast({ title: "Defina o objetivo de aprendizagem", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-simulation", {
        body: {
          roomId,
          materialIds: form.material_ids,
          title: form.title || undefined,
          description: form.description,
          learningObjectives: form.learning_objectives,
          maxSteps: form.max_steps,
          isLongitudinal: form.is_longitudinal,
          totalChapters: form.total_chapters,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: form.is_longitudinal ? "Caso longitudinal criado!" : "Simulação criada!" });
      setOpen(false);
      setForm({ title: "", description: "", learning_objectives: "", material_ids: [], max_steps: 6, is_longitudinal: false, total_chapters: 3 });
      load();
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (s: Simulation) => {
    await supabase.from("simulations").update({ is_published: !s.is_published }).eq("id", s.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta simulação e todas as sessões dos alunos?")) return;
    await supabase.from("simulation_sessions").delete().eq("simulation_id", id);
    await supabase.from("simulations").delete().eq("id", id);
    load();
  };

  const saveTeacherReview = async (run: SimSession) => {
    const ed = editing[run.id];
    if (!ed) return;
    const score = ed.score === "" ? null : parseFloat(ed.score.replace(",", "."));
    await supabase.from("simulation_sessions").update({
      teacher_score: score,
      teacher_feedback: ed.feedback || null,
    }).eq("id", run.id);
    toast({ title: "Revisão salva" });
    load();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Simulações Interativas</h2>
          <p className="text-xs text-muted-foreground">Cenários adaptativos gerados por IA com base nos materiais</p>
        </div>
        {isOwner && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Wand2 className="w-4 h-4 mr-1" /> Nova Simulação
          </Button>
        )}
      </div>

      {sims.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
          <Sparkles className="w-8 h-8 mx-auto mb-2" />
          <p>Nenhuma simulação criada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sims.map((s) => {
            const runs = sessions.filter(r => r.simulation_id === s.id);
            const completed = runs.filter(r => r.status === "completed");
            const isExp = expanded === s.id;
            return (
              <div key={s.id} className={`bg-card border rounded-xl overflow-hidden ${s.is_published ? "border-border" : "border-dashed border-muted-foreground/30 opacity-70"}`}>
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(isExp ? null : s.id)}>
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground flex items-center gap-2">
                      {s.title}
                      {s.is_longitudinal && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                          LONGITUDINAL · {s.total_chapters} cap.
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")} • {s.max_steps} passos/cap. •
                      {" "}{completed.length}/{runs.length} concluídas
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => togglePublish(s)}>
                        {s.is_published ? "Ocultar" : "Publicar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {isExp ? <ChevronUp className="w-5 h-5 text-muted-foreground ml-2" /> : <ChevronDown className="w-5 h-5 text-muted-foreground ml-2" />}
                </div>
                {isExp && (
                  <div className="border-t border-border p-4 space-y-4">
                    <div className="bg-secondary rounded-lg p-3">
                      <p className="text-xs font-semibold text-primary mb-1">Objetivo</p>
                      <p className="text-sm text-foreground">{s.learning_objectives}</p>
                      <p className="text-xs font-semibold text-primary mt-3 mb-1">Cenário</p>
                      <p className="text-sm text-foreground italic">{s.scenario?.setting}</p>
                    </div>

                    <div>
                      <p className="font-semibold text-sm mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Sessões dos Alunos</p>
                      {runs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum aluno iniciou ainda.</p>
                      ) : (
                        <div className="space-y-3">
                          {runs.map((r) => {
                            const stu = students[r.student_session_id];
                            const ed = editing[r.id] || { score: r.teacher_score?.toString() ?? r.ai_score?.toString() ?? "", feedback: r.teacher_feedback ?? r.ai_feedback ?? "" };
                            return (
                              <div key={r.id} className="border border-border rounded-lg p-3 bg-background">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="font-medium text-sm">{stu?.student_name || "Aluno"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {r.status === "completed" ? `Concluído em ${new Date(r.completed_at!).toLocaleString("pt-BR")}` : "Em andamento..."}
                                    </p>
                                  </div>
                                  {r.ai_score != null && (
                                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                                      <Award className="w-4 h-4" /> IA: {r.ai_score.toFixed(1)}
                                    </span>
                                  )}
                                </div>

                                {r.history.length > 0 && (
                                  <details className="text-xs mb-2">
                                    <summary className="cursor-pointer text-muted-foreground">Ver decisões ({r.history.length})</summary>
                                    <div className="mt-2 space-y-2 pl-2 border-l-2 border-border">
                                      {r.history.map((h, i) => (
                                        <div key={i}>
                                          <p><strong>Passo {i + 1}:</strong> {h.chosen?.label} <span className={`px-1.5 py-0.5 rounded text-[10px] ${h.chosen?.quality === "good" ? "bg-level-easy/10 text-level-easy" : h.chosen?.quality === "bad" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{h.chosen?.quality}</span></p>
                                          <p className="text-muted-foreground italic">{h.feedback_on_previous}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}

                                {r.ai_feedback && (
                                  <div className="bg-primary/5 border border-primary/20 rounded p-2 text-xs mb-2">
                                    <p className="font-semibold text-primary mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Feedback da IA</p>
                                    <p className="text-foreground whitespace-pre-wrap">{r.ai_feedback}</p>
                                  </div>
                                )}

                                {r.status === "completed" && isOwner && (
                                  <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-start mt-2">
                                    <Input
                                      type="text"
                                      placeholder="Nota"
                                      value={ed.score}
                                      onChange={(e) => setEditing(p => ({ ...p, [r.id]: { ...ed, score: e.target.value } }))}
                                      className="h-9"
                                    />
                                    <Textarea
                                      placeholder="Ajuste o feedback (opcional)"
                                      value={ed.feedback}
                                      onChange={(e) => setEditing(p => ({ ...p, [r.id]: { ...ed, feedback: e.target.value } }))}
                                      rows={2}
                                      className="text-xs"
                                    />
                                    <Button size="sm" onClick={() => saveTeacherReview(r)}>
                                      <Save className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Wand2 className="w-5 h-5" /> Nova Simulação Interativa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título (opcional)</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Atendimento ao paciente diabético" />
            </div>
            <div>
              <Label>Objetivo de aprendizagem *</Label>
              <Textarea
                value={form.learning_objectives}
                onChange={(e) => setForm({ ...form, learning_objectives: e.target.value })}
                placeholder="O que o aluno deve aprender ao concluir esta simulação?"
                rows={3}
              />
            </div>
            <div>
              <Label>Descrição/contexto adicional (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes que ajudem a IA a criar o cenário"
                rows={2}
              />
            </div>
            <div>
              <Label>Passos (decisões) por capítulo</Label>
              <Input
                type="number"
                min={3}
                max={12}
                value={form.max_steps}
                onChange={(e) => setForm({ ...form, max_steps: Math.max(3, Math.min(12, parseInt(e.target.value) || 6)) })}
              />
            </div>
            <div className="border border-border rounded-lg p-3 bg-secondary/30 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_longitudinal}
                  onChange={(e) => setForm({ ...form, is_longitudinal: e.target.checked })}
                />
                <span className="text-sm font-medium">Caso longitudinal (paciente virtual persistente)</span>
              </label>
              <p className="text-xs text-muted-foreground -mt-2 pl-6">
                O paciente evolui em múltiplos capítulos. Decisões do aluno num capítulo afetam o estado clínico nos seguintes.
              </p>
              {form.is_longitudinal && (
                <div className="pl-6">
                  <Label className="text-xs">Número de capítulos</Label>
                  <Input
                    type="number"
                    min={2}
                    max={8}
                    value={form.total_chapters}
                    onChange={(e) => setForm({ ...form, total_chapters: Math.max(2, Math.min(8, parseInt(e.target.value) || 3)) })}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Materiais da sala (selecione os que devem fundamentar o cenário)</Label>
              {materials.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum material disponível. A simulação será gerada apenas com base no objetivo.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-2 space-y-1 mt-1">
                  {materials.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-secondary rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={form.material_ids.includes(m.id)}
                        onChange={() => toggleMaterial(m.id)}
                      />
                      <span className="flex-1">{m.title}</span>
                      <span className="text-xs text-muted-foreground">{m.type}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4 mr-1" /> Gerar com IA</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
