import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Trash2, Loader2, Shuffle, UserPlus, X } from "lucide-react";

interface Props {
  roomId: string;
}

interface Student {
  id: string;
  student_name: string | null;
  student_email: string;
}

interface RoomGroup {
  id: string;
  group_name: string;
  members: { id: string; student_id: string; student_name: string; student_email: string }[];
}

export default function StudentGroups({ roomId }: Props) {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<RoomGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMembersDialog, setShowAddMembersDialog] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [groupCount, setGroupCount] = useState("2");

  const fetchData = useCallback(async () => {
    // Fetch enrolled students from room_students
    const { data: roomStudents } = await supabase
      .from("room_students")
      .select("id, student_name, student_email")
      .eq("room_id", roomId)
      .order("student_name");

    setStudents(roomStudents || []);

    // Fetch groups
    const { data: grps } = await supabase
      .from("room_groups")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at");

    if (grps) {
      const fullGroups: RoomGroup[] = [];
      for (const g of grps) {
        const { data: members } = await supabase
          .from("room_group_members")
          .select("*")
          .eq("group_id", g.id);

        const enriched = (members || []).map((m: any) => {
          const student = (roomStudents || []).find((s) => s.id === m.student_id);
          return {
            id: m.id,
            student_id: m.student_id,
            student_name: student?.student_name || student?.student_email || "Aluno",
            student_email: student?.student_email || "",
          };
        });
        fullGroups.push({ id: g.id, group_name: g.group_name, members: enriched });
      }
      setGroups(fullGroups);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    const { error } = await supabase.from("room_groups").insert({ room_id: roomId, group_name: newGroupName.trim() });
    if (error) {
      toast({ title: "Erro ao criar grupo", variant: "destructive" });
      return;
    }
    toast({ title: "Grupo criado!" });
    setNewGroupName("");
    setShowCreateDialog(false);
    fetchData();
  };

  const deleteGroup = async (groupId: string) => {
    await supabase.from("room_groups").delete().eq("id", groupId);
    fetchData();
  };

  const removeMember = async (memberId: string) => {
    await supabase.from("room_group_members").delete().eq("id", memberId);
    fetchData();
  };

  const addMembers = async (groupId: string) => {
    if (selectedStudents.length === 0) return;
    const inserts = selectedStudents.map((student_id) => ({ group_id: groupId, student_id }));
    const { error } = await supabase.from("room_group_members").insert(inserts);
    if (error) {
      toast({ title: "Erro ao adicionar membros", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${selectedStudents.length} aluno(s) adicionado(s)!` });
    setSelectedStudents([]);
    setShowAddMembersDialog(null);
    fetchData();
  };

  const autoDistribute = async () => {
    const count = parseInt(groupCount);
    if (isNaN(count) || count < 2) {
      toast({ title: "Informe pelo menos 2 grupos", variant: "destructive" });
      return;
    }
    if (students.length === 0) {
      toast({ title: "Nenhum aluno cadastrado na sala", variant: "destructive" });
      return;
    }

    // Delete existing groups
    for (const g of groups) {
      await supabase.from("room_groups").delete().eq("id", g.id);
    }

    // Create groups
    const groupIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const { data } = await supabase
        .from("room_groups")
        .insert({ room_id: roomId, group_name: `Grupo ${i + 1}` })
        .select("id")
        .single();
      if (data) groupIds.push(data.id);
    }

    // Shuffle students and round-robin assign
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      const groupIdx = i % groupIds.length;
      await supabase.from("room_group_members").insert({
        group_id: groupIds[groupIdx],
        student_id: shuffled[i].id,
      });
    }

    toast({ title: `${shuffled.length} alunos distribuídos em ${count} grupos!` });
    fetchData();
  };

  const getAvailableStudents = (_groupId: string) => {
    // Students already in ANY group are excluded (each student can only be in one group)
    const assignedAnywhere = new Set(groups.flatMap((g) => g.members.map((m) => m.student_id)));
    return students.filter((s) => !assignedAnywhere.has(s.id));
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Grupos de Alunos
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Grupo
        </Button>
      </div>

      {students.length > 0 && (
        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3">
          <Shuffle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Distribuir automaticamente em</span>
          <Input
            type="number"
            min="2"
            max="20"
            value={groupCount}
            onChange={(e) => setGroupCount(e.target.value)}
            className="w-16 h-8 text-center"
          />
          <span className="text-sm text-muted-foreground">grupos</span>
          <Button size="sm" variant="outline" onClick={autoDistribute}>Distribuir</Button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum grupo criado ainda.</p>
          <p className="text-xs mt-1">
            {students.length === 0
              ? "Cadastre alunos na sala primeiro (aba Alunos)."
              : "Crie grupos manualmente ou distribua automaticamente."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{group.group_name}</p>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedStudents([]); setShowAddMembersDialog(group.id); }}>
                      <UserPlus className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteGroup(group.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.members.map((m) => (
                    <Badge key={m.id} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                      {m.student_name}
                      <button onClick={() => removeMember(m.id)} className="hover:text-destructive ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {group.members.length === 0 && <span className="text-xs text-muted-foreground">Sem membros</span>}
                </div>
                <p className="text-xs text-muted-foreground">{group.members.length} membro(s)</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome do grupo (ex: Grupo Alpha)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
            />
            <Button onClick={createGroup} className="w-full" disabled={!newGroupName.trim()}>Criar Grupo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={!!showAddMembersDialog} onOpenChange={() => setShowAddMembersDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Alunos</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {showAddMembersDialog && getAvailableStudents(showAddMembersDialog).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {students.length === 0 ? "Nenhum aluno cadastrado na sala." : "Todos os alunos já estão neste grupo."}
              </p>
            ) : (
              showAddMembersDialog && getAvailableStudents(showAddMembersDialog).map((s) => (
                <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer">
                  <Checkbox
                    checked={selectedStudents.includes(s.id)}
                    onCheckedChange={(checked) => {
                      setSelectedStudents((prev) =>
                        checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                      );
                    }}
                  />
                  <div>
                    <span className="text-sm">{s.student_name || s.student_email}</span>
                    {s.student_name && <span className="text-xs text-muted-foreground ml-2">{s.student_email}</span>}
                  </div>
                </label>
              ))
            )}
          </div>
          {selectedStudents.length > 0 && (
            <Button onClick={() => showAddMembersDialog && addMembers(showAddMembersDialog)} className="w-full">
              Adicionar {selectedStudents.length} aluno(s)
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
