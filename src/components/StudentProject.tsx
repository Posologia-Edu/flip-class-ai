import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, Clock, Play, Loader2, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Milestone { title: string; description: string }
interface ProgressItem { id: string; group_id: string; milestone_index: number; status: string; notes: string }

interface Props { roomId: string; sessionId: string }

export default function StudentProject({ roomId, sessionId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [myRole, setMyRole] = useState("");
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  const fetchData = useCallback(async () => {
    // Find group membership for this session
    const { data: membership } = await supabase
      .from("project_members")
      .select("*, project_groups(*)")
      .eq("session_id", sessionId);

    if (!membership || membership.length === 0) {
      setLoading(false);
      return;
    }

    // Find the membership that belongs to a project in this room
    let foundMembership = null;
    for (const m of membership) {
      const grp = m.project_groups as any;
      if (grp) {
        const { data: proj } = await supabase
          .from("collaborative_projects")
          .select("*")
          .eq("id", grp.project_id)
          .eq("room_id", roomId)
          .maybeSingle();
        if (proj) {
          foundMembership = m;
          const parsedMilestones = (Array.isArray(proj.milestones) ? proj.milestones : []) as Milestone[];
          setProject({
            ...proj,
            roles: Array.isArray(proj.roles) ? proj.roles : [],
            resources: Array.isArray(proj.resources) ? proj.resources : [],
            milestones: parsedMilestones,
          });
          setMilestones(parsedMilestones);
          setGroup(grp);
          setMyRole(m.assigned_role);
          break;
        }
      }
    }

    if (!foundMembership) {
      setLoading(false);
      return;
    }

    const grp = foundMembership.project_groups as any;

    // Get group members
    const { data: grpMembers } = await supabase.from("project_members").select("*").eq("group_id", grp.id);
    if (grpMembers) {
      // Enrich with student names from student_sessions
      const enriched = [];
      for (const gm of grpMembers) {
        const { data: sess } = await supabase
          .from("student_sessions")
          .select("student_name")
          .eq("id", gm.session_id)
          .maybeSingle();
        enriched.push({ ...gm, student_name: sess?.student_name || "Aluno" });
      }
      setMembers(enriched);
    }

    // Get progress
    const { data: prog } = await supabase.from("project_progress").select("*").eq("group_id", grp.id).order("milestone_index");
    if (prog) setProgress(prog);

    setLoading(false);
  }, [roomId, sessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime for progress updates
  useEffect(() => {
    if (!group) return;
    const channel = supabase
      .channel(`project_progress_${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_progress", filter: `group_id=eq.${group.id}` }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group, fetchData]);

  const updateStatus = async (milestoneIndex: number, newStatus: string) => {
    const existing = progress.find(p => p.milestone_index === milestoneIndex);
    if (existing) {
      await supabase.from("project_progress").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("project_progress").insert({ group_id: group.id, milestone_index: milestoneIndex, status: newStatus });
    }
    fetchData();
  };

  const saveNotes = async (milestoneIndex: number) => {
    const existing = progress.find(p => p.milestone_index === milestoneIndex);
    const notes = editingNotes[milestoneIndex] ?? "";
    if (existing) {
      await supabase.from("project_progress").update({ notes, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("project_progress").insert({ group_id: group.id, milestone_index: milestoneIndex, status: "pending", notes });
    }
    toast({ title: "Notas salvas!" });
    setEditingNotes(prev => { const n = { ...prev }; delete n[milestoneIndex]; return n; });
    fetchData();
  };

  const doneCount = progress.filter(p => p.status === "done").length;
  const total = milestones.length || 1;
  const percent = Math.round((doneCount / total) * 100);

  const statusBtn = (mi: number, current: string) => {
    const next = current === "pending" ? "in_progress" : current === "in_progress" ? "done" : "pending";
    const labels: Record<string, string> = { pending: "Iniciar", in_progress: "Concluir", done: "Reabrir" };
    return (
      <Button size="sm" variant="outline" onClick={() => updateStatus(mi, next)} className="text-xs">
        {labels[current] || "Iniciar"}
      </Button>
    );
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!project) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum projeto atribuído a você nesta sala.</p>
        <p className="text-xs mt-1">O professor precisa criar e distribuir os projetos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            {project.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{project.description}</p>
          <div>
            <p className="text-xs font-medium mb-2">Progresso geral</p>
            <Progress value={percent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{percent}% concluído</p>
          </div>
        </CardContent>
      </Card>

      {/* My Role & Group */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> {group?.group_name || "Meu Grupo"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium mb-1">Seu papel:</p>
            <Badge>{myRole || "Membro"}</Badge>
          </div>
          <div>
            <p className="text-xs font-medium mb-1">Membros:</p>
            <div className="flex flex-wrap gap-1">
              {members.map(m => (
                <Badge key={m.id} variant={m.session_id === sessionId ? "default" : "outline"} className="text-xs">
                  {m.student_name} ({m.assigned_role})
                </Badge>
              ))}
            </div>
          </div>
          {project.resources?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Recursos sugeridos:</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {project.resources.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Etapas do Projeto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {milestones.map((ms, mi) => {
            const prog = progress.find(p => p.milestone_index === mi);
            const status = prog?.status || "pending";
            const isEditing = mi in editingNotes;
            return (
              <div key={mi} className={`rounded-lg border p-3 space-y-2 ${status === "done" ? "bg-green-500/5 border-green-500/20" : status === "in_progress" ? "bg-yellow-500/5 border-yellow-500/20" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status === "done" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : status === "in_progress" ? <Play className="w-4 h-4 text-yellow-500" /> : <Clock className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-medium text-sm">{mi + 1}. {ms.title}</span>
                  </div>
                  {statusBtn(mi, status)}
                </div>
                <p className="text-xs text-muted-foreground pl-6">{ms.description}</p>
                {prog?.notes && !isEditing && (
                  <div className="pl-6">
                    <p className="text-xs bg-secondary rounded p-2">{prog.notes}</p>
                    <Button size="sm" variant="ghost" className="text-xs mt-1" onClick={() => setEditingNotes(prev => ({ ...prev, [mi]: prog.notes }))}>Editar notas</Button>
                  </div>
                )}
                {isEditing && (
                  <div className="pl-6 space-y-2">
                    <Textarea value={editingNotes[mi]} onChange={e => setEditingNotes(prev => ({ ...prev, [mi]: e.target.value }))} placeholder="Adicione notas sobre esta etapa..." rows={2} className="text-xs" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveNotes(mi)} className="text-xs">Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNotes(prev => { const n = { ...prev }; delete n[mi]; return n; })} className="text-xs">Cancelar</Button>
                    </div>
                  </div>
                )}
                {!prog?.notes && !isEditing && (
                  <Button size="sm" variant="ghost" className="text-xs ml-6" onClick={() => setEditingNotes(prev => ({ ...prev, [mi]: "" }))}>+ Adicionar notas</Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
