import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Rocket, Lightbulb, CheckCircle2, Trash2, Sparkles, Loader2 } from "lucide-react";

interface SystemUpdate {
  id: string;
  title: string;
  description: string;
  type: "update" | "idea";
  status: "done" | "in_progress" | "planned";
  priority: "low" | "medium" | "high";
  version: string | null;
  created_at: string;
  implemented_at: string | null;
}

const priorityConfig = {
  low: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  medium: { label: "Média", color: "bg-amber-500/10 text-amber-600" },
  high: { label: "Alta", color: "bg-red-500/10 text-red-600" },
};

type FormStatus = "done" | "in_progress" | "planned";
type FormPriority = "low" | "medium" | "high";
interface FormState { title: string; description: string; type: "update" | "idea"; status: FormStatus; priority: FormPriority; version: string; }
const emptyForm: FormState = { title: "", description: "", type: "idea", status: "planned", priority: "medium", version: "" };

const UpdatesPipeline = () => {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const fetchUpdates = useCallback(async () => {
    const { data } = await supabase
      .from("system_updates")
      .select("*")
      .order("created_at", { ascending: false });
    setUpdates((data as SystemUpdate[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      status: form.status,
      priority: form.priority,
      version: form.version.trim() || null,
      implemented_at: form.status === "done" ? new Date().toISOString() : null,
    };

    const { error } = editingId
      ? await supabase.from("system_updates").update(payload).eq("id", editingId)
      : await supabase.from("system_updates").insert(payload);

    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: editingId ? "Atualizado!" : "Registrado!" }); setDialogOpen(false); fetchUpdates(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("system_updates").delete().eq("id", id);
    toast({ title: "Removido!" });
    fetchUpdates();
  };

  const handleConclude = async (u: SystemUpdate) => {
    const { error } = await supabase.from("system_updates").update({
      status: "done",
      type: "update",
      implemented_at: new Date().toISOString(),
    }).eq("id", u.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Atualização concluída e adicionada ao changelog!" }); fetchUpdates(); }
  };

  const handleGenerateRoadmap = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-roadmap");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Roadmap gerado!", description: `${data?.count || 0} novas sugestões adicionadas.` });
      fetchUpdates();
    } catch (err: any) {
      toast({ title: "Erro ao gerar roadmap", description: err.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const changelog = updates.filter(u => u.status === "done");
  const roadmap = updates.filter(u => u.status !== "done");

  // Check if we should show generate button (no roadmap items or last generated > 30 days ago)
  const lastRoadmapDate = roadmap.length > 0
    ? new Date(Math.max(...roadmap.map(u => new Date(u.created_at).getTime())))
    : null;
  const daysSinceLastRoadmap = lastRoadmapDate
    ? (Date.now() - lastRoadmapDate.getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const canGenerate = roadmap.length === 0 || daysSinceLastRoadmap >= 30;

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const borderColor = (priority: string) => {
    if (priority === "high") return "border-l-red-500";
    if (priority === "medium") return "border-l-amber-500";
    return "border-l-muted-foreground/30";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" /> Pipeline de Atualizações
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Histórico de funcionalidades e planejamento futuro do sistema.</p>
        </div>
        <Button onClick={handleGenerateRoadmap} disabled={generating} size="sm">
          {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {generating ? "Analisando sistema..." : "Sugestão por IA"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="roadmap">
        <TabsList>
          <TabsTrigger value="changelog" className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Changelog ({changelog.length})
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-1.5">
            <Lightbulb className="w-4 h-4" /> Roadmap ({roadmap.length})
          </TabsTrigger>
        </TabsList>

        {/* Roadmap Tab */}
        <TabsContent value="roadmap" className="mt-4 space-y-4">

          {roadmap.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma ideia no roadmap ainda.</p>
              <p className="text-xs mt-1">Clique em "Gerar sugestões com IA" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {roadmap.map(u => {
                const pc = priorityConfig[u.priority] || priorityConfig.medium;
                return (
                  <div key={u.id} className={`bg-card border border-border rounded-xl px-5 py-4 border-l-4 ${borderColor(u.priority)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Sparkles className="w-4 h-4 text-primary shrink-0" />
                          <p className="font-medium text-sm">{u.title}</p>
                          <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                        </div>
                        {u.description && <p className="text-xs text-muted-foreground mt-1.5 ml-6">{u.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleConclude(u)}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover item?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Changelog Tab */}
        <TabsContent value="changelog" className="mt-4">
          {changelog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma atualização registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {changelog.map(u => (
                <div key={u.id} className="bg-card border border-border rounded-xl px-5 py-4 border-l-4 border-l-green-500">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <p className="font-medium text-sm">{u.title}</p>
                        {u.version && <Badge variant="outline" className="text-[10px]">v{u.version}</Badge>}
                      </div>
                      {u.description && <p className="text-xs text-muted-foreground mt-1.5 ml-6">{u.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1.5 ml-6">
                        {new Date(u.implemented_at || u.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover registro?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Nova"} Entrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Sistema de transcrição automática" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva a funcionalidade..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={form.type} onValueChange={(v: any) => setForm(f => ({ ...f, type: v, status: v === "update" ? "done" : "planned" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">Atualização (Changelog)</SelectItem>
                    <SelectItem value="idea">Ideia (Roadmap)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={form.priority} onValueChange={(v: any) => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "update" && (
              <div>
                <label className="text-sm font-medium">Versão (opcional)</label>
                <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="Ex: 1.2.0" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UpdatesPipeline;
