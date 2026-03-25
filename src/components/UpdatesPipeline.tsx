import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Rocket, Lightbulb, Clock, CheckCircle2, Trash2, Edit, ArrowUpCircle } from "lucide-react";

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

const statusConfig = {
  done: { label: "Concluído", icon: CheckCircle2, color: "bg-green-500/10 text-green-600" },
  in_progress: { label: "Em andamento", icon: Clock, color: "bg-amber-500/10 text-amber-600" },
  planned: { label: "Planejado", icon: Lightbulb, color: "bg-blue-500/10 text-blue-600" },
};

const priorityConfig = {
  low: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  medium: { label: "Média", color: "bg-amber-500/10 text-amber-600" },
  high: { label: "Alta", color: "bg-red-500/10 text-red-600" },
};

type FormType = "update" | "idea";
type FormStatus = "done" | "in_progress" | "planned";
type FormPriority = "low" | "medium" | "high";
interface FormState { title: string; description: string; type: FormType; status: FormStatus; priority: FormPriority; version: string; }
const emptyForm: FormState = { title: "", description: "", type: "update", status: "done", priority: "medium", version: "" };

const UpdatesPipeline = () => {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "update" | "idea">("all");
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

  const openNew = (type: "update" | "idea") => {
    setEditingId(null);
    setForm({ ...emptyForm, type, status: type === "idea" ? "planned" : "done" });
    setDialogOpen(true);
  };

  const openEdit = (u: SystemUpdate) => {
    setEditingId(u.id);
    setForm({ title: u.title, description: u.description, type: u.type, status: u.status, priority: u.priority, version: u.version || "" });
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

  const filtered = updates.filter(u => filter === "all" || u.type === filter);
  const doneUpdates = filtered.filter(u => u.status === "done");
  const pipeline = filtered.filter(u => u.status !== "done");

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => openNew("update")} size="sm">
          <Rocket className="w-4 h-4 mr-1" /> Registrar Atualização
        </Button>
        <Button onClick={() => openNew("idea")} size="sm" variant="outline">
          <Lightbulb className="w-4 h-4 mr-1" /> Nova Ideia
        </Button>
        <div className="ml-auto">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="update">Atualizações</SelectItem>
              <SelectItem value="idea">Ideias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pipeline / Future Ideas */}
      {pipeline.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-primary" /> Pipeline de Desenvolvimento ({pipeline.length})
          </h3>
          <div className="space-y-3">
            {pipeline.map(u => {
              const sc = statusConfig[u.status];
              const pc = priorityConfig[u.priority];
              return (
                <div key={u.id} className="flex items-start gap-3 bg-secondary/40 rounded-lg px-4 py-3">
                  <sc.icon className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{u.title}</p>
                      <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                      <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                    </div>
                    {u.description && <p className="text-xs text-muted-foreground mt-1">{u.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(u)}><Edit className="w-3.5 h-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
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
              );
            })}
          </div>
        </div>
      )}

      {/* Done / Changelog */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" /> Histórico de Atualizações ({doneUpdates.length})
        </h3>
        {doneUpdates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atualização registrada ainda.</p>
        ) : (
          <div className="relative border-l-2 border-border ml-3 space-y-4">
            {doneUpdates.map(u => (
              <div key={u.id} className="pl-6 relative">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{u.title}</p>
                      {u.version && <Badge variant="outline" className="text-[10px]">v{u.version}</Badge>}
                    </div>
                    {u.description && <p className="text-xs text-muted-foreground mt-1">{u.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(u.implemented_at || u.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(u)}><Edit className="w-3.5 h-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Novo"} {form.type === "idea" ? "Ideia" : "Atualização"}</DialogTitle>
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
                <label className="text-sm font-medium">Status</label>
                <Select value={form.status} onValueChange={(v: any) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="done">Concluído</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="planned">Planejado</SelectItem>
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
            <div>
              <label className="text-sm font-medium">Versão (opcional)</label>
              <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="Ex: 1.2.0" />
            </div>
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
