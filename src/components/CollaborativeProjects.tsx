import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, Users, CheckCircle2, Clock, Play, Trash2, Plus, Shuffle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Milestone { title: string; description: string }
interface ProjectIdea { title: string; description: string; roles: string[]; resources: string[]; milestones: Milestone[] }
interface ProjectGroup { id: string; project_id: string; group_name: string; members: { id: string; session_id: string; assigned_role: string; student_name: string }[]; progress: { milestone_index: number; status: string; notes: string }[] }
interface SavedProject { id: string; room_id: string; title: string; description: string; roles: string[]; resources: string[]; milestones: Milestone[]; created_at: string }

interface Props { roomId: string; sessions: { id: string; student_name: string }[] }

export default function CollaborativeProjects({ roomId, sessions }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [groups, setGroups] = useState<Record<string, ProjectGroup[]>>({});
  const [loading, setLoading] = useState(true);
  const [showGroupDialog, setShowGroupDialog] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  const fetchProjects = useCallback(async () => {
    const { data: projs } = await supabase.from("collaborative_projects").select("*").eq("room_id", roomId).order("created_at", { ascending: false });
    if (projs) {
      const parsed = projs.map((p: any) => ({
        ...p,
        roles: Array.isArray(p.roles) ? p.roles : [],
        resources: Array.isArray(p.resources) ? p.resources : [],
        milestones: Array.isArray(p.milestones) ? p.milestones : [],
      }));
      setProjects(parsed);

      // Fetch groups for each project
      const grpMap: Record<string, ProjectGroup[]> = {};
      for (const proj of parsed) {
        const { data: grps } = await supabase.from("project_groups").select("*").eq("project_id", proj.id);
        if (grps) {
          const fullGroups: ProjectGroup[] = [];
          for (const g of grps) {
            const { data: members } = await supabase.from("project_members").select("*").eq("group_id", g.id);
            const { data: progress } = await supabase.from("project_progress").select("*").eq("group_id", g.id);
            const enrichedMembers = (members || []).map((m: any) => {
              const session = sessions.find(s => s.id === m.session_id);
              return { ...m, student_name: session?.student_name || "Aluno" };
            });
            fullGroups.push({ ...g, members: enrichedMembers, progress: progress || [] });
          }
          grpMap[proj.id] = fullGroups;
        }
      }
      setGroups(grpMap);
    }
    setLoading(false);
  }, [roomId, sessions]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const generateIdeas = async () => {
    setGenerating(true);
    setIdeas([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-project", { body: { room_id: roomId } });
      if (error) throw error;
      setIdeas(data.projects || []);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao gerar projetos", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const saveProject = async (idea: ProjectIdea) => {
    const { error } = await supabase.from("collaborative_projects").insert({
      room_id: roomId,
      title: idea.title,
      description: idea.description,
      roles: idea.roles as any,
      resources: idea.resources as any,
      milestones: idea.milestones as any,
    });
    if (error) {
      toast({ title: "Erro", description: "Falha ao salvar projeto", variant: "destructive" });
      return;
    }
    toast({ title: "Projeto salvo!" });
    setIdeas(prev => prev.filter(i => i.title !== idea.title));
    fetchProjects();
  };

  const deleteProject = async (id: string) => {
    await supabase.from("collaborative_projects").delete().eq("id", id);
    fetchProjects();
  };

  const createGroup = async (projectId: string) => {
    if (!newGroupName.trim()) return;
    await supabase.from("project_groups").insert({ project_id: projectId, group_name: newGroupName.trim() });
    setNewGroupName("");
    fetchProjects();
  };

  const autoDistribute = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const existingGroups = groups[projectId] || [];
    if (existingGroups.length === 0) {
      toast({ title: "Crie grupos primeiro", variant: "destructive" });
      return;
    }
    // Get assigned session IDs
    const assigned = new Set(existingGroups.flatMap(g => g.members.map(m => m.session_id)));
    const unassigned = sessions.filter(s => !assigned.has(s.id));
    if (unassigned.length === 0) {
      toast({ title: "Todos os alunos já foram distribuídos" });
      return;
    }
    // Round-robin distribute
    const roles = project.roles.length > 0 ? project.roles : ["Membro"];
    for (let i = 0; i < unassigned.length; i++) {
      const groupIdx = i % existingGroups.length;
      const roleIdx = i % roles.length;
      await supabase.from("project_members").insert({
        group_id: existingGroups[groupIdx].id,
        session_id: unassigned[i].id,
        assigned_role: roles[roleIdx],
      });
    }
    // Initialize progress for groups that don't have it
    for (const g of existingGroups) {
      if (g.progress.length === 0) {
        for (let mi = 0; mi < project.milestones.length; mi++) {
          await supabase.from("project_progress").insert({
            group_id: g.id,
            milestone_index: mi,
            status: "pending",
          });
        }
      }
    }
    toast({ title: `${unassigned.length} alunos distribuídos!` });
    fetchProjects();
  };

  const getProgressPercent = (projectId: string) => {
    const grps = groups[projectId] || [];
    if (grps.length === 0) return 0;
    const project = projects.find(p => p.id === projectId);
    const totalMilestones = (project?.milestones.length || 1) * grps.length;
    const done = grps.reduce((acc, g) => acc + g.progress.filter(p => p.status === "done").length, 0);
    return Math.round((done / totalMilestones) * 100);
  };

  const statusIcon = (status: string) => {
    if (status === "done") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === "in_progress") return <Play className="w-4 h-4 text-yellow-500" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Generate Ideas */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Projetos Colaborativos
        </h3>
        <Button onClick={generateIdeas} disabled={generating} size="sm">
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Gerar Ideias por IA
        </Button>
      </div>

      {/* AI Ideas */}
      {ideas.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Selecione um projeto para salvar:</p>
          {ideas.map((idea, idx) => (
            <Card key={idx} className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  {idea.title}
                  <Button size="sm" onClick={() => saveProject(idea)}>Salvar</Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{idea.description}</p>
                <div>
                  <p className="font-medium mb-1">Papéis:</p>
                  <div className="flex flex-wrap gap-1">{idea.roles.map((r, i) => <Badge key={i} variant="secondary">{r}</Badge>)}</div>
                </div>
                <div>
                  <p className="font-medium mb-1">Etapas:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    {idea.milestones.map((m, i) => <li key={i}><span className="font-medium text-foreground">{m.title}</span> — {m.description}</li>)}
                  </ol>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Saved Projects */}
      {projects.map(project => (
        <Card key={project.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{project.title}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{getProgressPercent(project.id)}% concluído</Badge>
                <Button size="icon" variant="ghost" onClick={() => deleteProject(project.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{project.description}</p>
            <Progress value={getProgressPercent(project.id)} className="h-2" />

            {/* Groups */}
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Grupos ({(groups[project.id] || []).length})</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowGroupDialog(project.id)}><Plus className="w-3 h-3 mr-1" /> Grupo</Button>
                <Button size="sm" variant="outline" onClick={() => autoDistribute(project.id)}><Shuffle className="w-3 h-3 mr-1" /> Distribuir</Button>
              </div>
            </div>

            {(groups[project.id] || []).map(group => (
              <div key={group.id} className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <p className="font-medium text-sm">{group.group_name}</p>
                <div className="flex flex-wrap gap-1">
                  {group.members.map(m => (
                    <Badge key={m.id} variant="outline" className="text-xs">{m.student_name} ({m.assigned_role})</Badge>
                  ))}
                  {group.members.length === 0 && <span className="text-xs text-muted-foreground">Sem membros</span>}
                </div>
                {/* Milestones progress */}
                <div className="space-y-1">
                  {project.milestones.map((ms, mi) => {
                    const prog = group.progress.find(p => p.milestone_index === mi);
                    return (
                      <div key={mi} className="flex items-center gap-2 text-xs">
                        {statusIcon(prog?.status || "pending")}
                        <span className="flex-1">{ms.title}</span>
                        <Badge variant="outline" className="text-[10px]">{prog?.status === "done" ? "Concluído" : prog?.status === "in_progress" ? "Em andamento" : "Pendente"}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {projects.length === 0 && ideas.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum projeto colaborativo ainda.</p>
          <p className="text-xs mt-1">Clique em "Gerar Ideias por IA" para começar.</p>
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={!!showGroupDialog} onOpenChange={() => setShowGroupDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do grupo (ex: Grupo Alpha)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
            <Button onClick={() => { if (showGroupDialog) createGroup(showGroupDialog); setShowGroupDialog(null); }} className="w-full">Criar Grupo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
