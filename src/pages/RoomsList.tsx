import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, BookOpen, Users, Clock, Trash2, Eye, BarChart3, Lock,
  CalendarClock, Users2, Download, FileText, ClipboardList,
  FolderOpen, ArrowLeft, Palette, Pencil, Copy, Link,
  MoreVertical,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms"> & { discipline_id?: string | null };

interface RoomStats {
  roomId: string;
  studentCount: number;
  avgScore: number;
  completedCount: number;
}

interface Discipline {
  id: string;
  teacher_id: string;
  title: string;
  color: string;
  created_at: string;
}

const PRESET_COLORS = [
  "#0d9488", "#2563eb", "#7c3aed", "#db2777",
  "#ea580c", "#ca8a04", "#16a34a", "#64748b",
];

const isRoomExpired = (room: Room): boolean => {
  const expireAt = (room as any).expire_at;
  const lastActivity = (room as any).last_student_activity_at;
  const now = new Date();
  if (expireAt && new Date(expireAt) <= now) return true;
  if (lastActivity) {
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (new Date(lastActivity) <= oneWeekAgo) return true;
  }
  return false;
};

const RoomsList = () => {
  const { disciplineId } = useParams<{ disciplineId?: string }>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [collabRooms, setCollabRooms] = useState<Room[]>([]);
  const [roomStats, setRoomStats] = useState<Record<string, RoomStats>>({});
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newExpireAt, setNewExpireAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importFromRoomId, setImportFromRoomId] = useState<string>("");
  const [importStudents, setImportStudents] = useState(true);
  const [importMaterials, setImportMaterials] = useState(false);
  const [importActivities, setImportActivities] = useState(false);

  // Discipline management
  const [discDialogOpen, setDiscDialogOpen] = useState(false);
  const [newDiscTitle, setNewDiscTitle] = useState("");
  const [newDiscColor, setNewDiscColor] = useState(PRESET_COLORS[0]);
  const [editingDisc, setEditingDisc] = useState<Discipline | null>(null);
  const [creatingDisc, setCreatingDisc] = useState(false);
  const [selectedDisciplineForRoom, setSelectedDisciplineForRoom] = useState<string>("");
  const [renamingRoom, setRenamingRoom] = useState<Room | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();
  const { canCreateRoom, getRoomLimit } = useFeatureGate();

  const generatePin = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const fetchDisciplines = useCallback(async () => {
    if (!auth.user) return;
    const { data } = await supabase
      .from("disciplines")
      .select("*")
      .eq("teacher_id", auth.user.id)
      .order("title");
    setDisciplines((data as Discipline[]) || []);
  }, [auth.user?.id]);

  const fetchRooms = useCallback(async () => {
    if (!auth.user) return;
    const [roomsRes, sessionsRes, enrolledRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("teacher_id", auth.user.id).order("created_at", { ascending: false }),
      supabase.from("student_sessions").select("room_id, score, completed_at"),
      supabase.from("room_students").select("room_id"),
    ]);
    if (roomsRes.error) console.error("Error fetching rooms:", roomsRes.error);
    const roomsList = (roomsRes.data || []) as Room[];
    setRooms(roomsList);

    let collabRoomIds: string[] = [];
    try {
      const { data: collabData } = await supabase
        .from("room_collaborators" as any)
        .select("room_id")
        .eq("teacher_id", auth.user.id);
      collabRoomIds = ((collabData as any[]) || []).map((c: any) => c.room_id);
      if (collabRoomIds.length > 0) {
        const { data: cRooms } = await supabase.from("rooms").select("*").in("id", collabRoomIds);
        setCollabRooms((cRooms || []) as Room[]);
      } else {
        setCollabRooms([]);
      }
    } catch (e) {
      console.error("Error fetching collaborations:", e);
      setCollabRooms([]);
    }

    const allSessions = sessionsRes.data || [];
    const allEnrolled = enrolledRes.data || [];
    const allRoomIds = [...roomsList.map(r => r.id), ...collabRoomIds];
    const statsMap: Record<string, RoomStats> = {};
    for (const roomId of allRoomIds) {
      const sessions = allSessions.filter(s => s.room_id === roomId);
      const completed = sessions.filter(s => s.completed_at);
      const enrolledCount = allEnrolled.filter(e => e.room_id === roomId).length;
      statsMap[roomId] = {
        roomId,
        studentCount: Math.max(enrolledCount, sessions.length),
        avgScore: completed.length > 0
          ? Math.round(completed.reduce((s, c) => s + (c.score || 0), 0) / completed.length)
          : 0,
        completedCount: completed.length,
      };
    }
    setRoomStats(statsMap);
    setLoading(false);
  }, [auth.user?.id]);

  useEffect(() => {
    if (!auth.loading && auth.user && auth.isApproved) {
      fetchDisciplines();
      fetchRooms();
    }
  }, [auth.loading, auth.user?.id, auth.isApproved, fetchDisciplines, fetchRooms]);

  // --- Discipline CRUD ---
  const saveDiscipline = async () => {
    if (!newDiscTitle.trim() || !auth.user) return;
    setCreatingDisc(true);
    if (editingDisc) {
      const { error } = await supabase
        .from("disciplines")
        .update({ title: newDiscTitle.trim(), color: newDiscColor } as any)
        .eq("id", editingDisc.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Disciplina atualizada!" });
    } else {
      const { error } = await supabase
        .from("disciplines")
        .insert({ title: newDiscTitle.trim(), color: newDiscColor, teacher_id: auth.user.id } as any);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Disciplina criada!" });
    }
    setNewDiscTitle("");
    setNewDiscColor(PRESET_COLORS[0]);
    setEditingDisc(null);
    setDiscDialogOpen(false);
    setCreatingDisc(false);
    fetchDisciplines();
  };

  const deleteDiscipline = async (id: string) => {
    // Unlink rooms first, then delete
    await (supabase.from("rooms") as any).update({ discipline_id: null }).eq("discipline_id", id);
    await (supabase.from("disciplines") as any).delete().eq("id", id);
    fetchDisciplines();
    fetchRooms();
    toast({ title: "Disciplina excluída" });
  };

  // --- Room CRUD ---
  const createRoom = async () => {
    if (!newTitle.trim() || !auth.user) return;
    if (!canCreateRoom(rooms.length)) {
      const limit = getRoomLimit();
      toast({
        title: "Limite de salas atingido",
        description: `Seu plano permite até ${limit} sala${limit !== 1 ? "s" : ""}. Faça upgrade para criar mais.`,
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    const insertData: any = {
      title: newTitle.trim(),
      pin_code: generatePin(),
      teacher_id: auth.user.id,
      discipline_id: selectedDisciplineForRoom || (disciplineId || null),
    };
    if (newExpireAt) insertData.expire_at = new Date(newExpireAt).toISOString();

    const { data: newRoom, error } = await supabase.from("rooms").insert(insertData).select().single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Import logic
      if (importFromRoomId && importFromRoomId !== "none" && newRoom) {
        const importResults: string[] = [];
        if (importStudents) {
          const { data: students } = await supabase.from("room_students").select("student_email, student_name").eq("room_id", importFromRoomId);
          if (students && students.length > 0) {
            await supabase.from("room_students").insert(students.map(s => ({ room_id: newRoom.id, student_email: s.student_email, student_name: s.student_name })));
            importResults.push(`${students.length} aluno(s)`);
          }
        }
        if (importMaterials) {
          const { data: materials } = await supabase.from("materials").select("title, type, url, thumbnail_url, content_text_for_ai, is_published").eq("room_id", importFromRoomId);
          if (materials && materials.length > 0) {
            await supabase.from("materials").insert(materials.map(m => ({ room_id: newRoom.id, title: m.title, type: m.type, url: m.url, thumbnail_url: m.thumbnail_url, content_text_for_ai: m.content_text_for_ai, is_published: m.is_published })));
            importResults.push(`${materials.length} material(is)`);
          }
        }
        if (importActivities) {
          const { data: activities } = await supabase.from("activities").select("quiz_data, is_published, title, peer_review_enabled, peer_review_criteria").eq("room_id", importFromRoomId);
          if (activities && activities.length > 0) {
            const { data: newMaterials } = await supabase.from("materials").select("id, title").eq("room_id", newRoom.id);
            const newMatMap = new Map((newMaterials || []).map(m => [m.title, m.id]));
            const { data: origActivities } = await supabase.from("activities").select("id, material_id, quiz_data, is_published, title, peer_review_enabled, peer_review_criteria").eq("room_id", importFromRoomId);
            const { data: origMaterials } = await supabase.from("materials").select("id, title").eq("room_id", importFromRoomId);
            const origMatTitleMap = new Map((origMaterials || []).map(m => [m.id, m.title]));
            await supabase.from("activities").insert(
              (origActivities || []).map(a => {
                const origMatTitle = a.material_id ? origMatTitleMap.get(a.material_id) : null;
                const newMatId = origMatTitle ? newMatMap.get(origMatTitle) || null : null;
                return { room_id: newRoom.id, material_id: newMatId, quiz_data: a.quiz_data, is_published: a.is_published, title: a.title, peer_review_enabled: a.peer_review_enabled, peer_review_criteria: a.peer_review_criteria };
              })
            );
            importResults.push(`${activities.length} atividade(s)`);
          }
        }
        if (importResults.length > 0) toast({ title: "Sala criada!", description: `Importado: ${importResults.join(", ")}.` });
        else toast({ title: "Sala criada!", description: "Nenhum item encontrado para importar." });
      } else {
        toast({ title: "Sala criada!" });
      }
      setNewTitle("");
      setNewExpireAt("");
      setImportFromRoomId("");
      setImportStudents(true);
      setImportMaterials(false);
      setImportActivities(false);
      setSelectedDisciplineForRoom("");
      setDialogOpen(false);
      fetchRooms();
    }
    setCreating(false);
  };

  const deleteRoom = async (id: string) => {
    await supabase.from("rooms").delete().eq("id", id);
    fetchRooms();
  };

  const duplicateRoom = async (room: Room) => {
    if (!auth.user) return;
    if (!canCreateRoom(rooms.length)) {
      toast({ title: "Limite de salas atingido", variant: "destructive" });
      return;
    }
    const insertData: any = {
      title: `${room.title} (cópia)`,
      pin_code: generatePin(),
      teacher_id: auth.user.id,
      discipline_id: room.discipline_id || null,
    };
    if ((room as any).expire_at) insertData.expire_at = (room as any).expire_at;
    const { data: newRoom, error } = await supabase.from("rooms").insert(insertData).select().single();
    if (error) {
      toast({ title: "Erro ao duplicar", description: error.message, variant: "destructive" });
      return;
    }
    // Copy materials, activities, students
    const [{ data: mats }, { data: acts }, { data: studs }] = await Promise.all([
      supabase.from("materials").select("title, type, url, thumbnail_url, content_text_for_ai, is_published").eq("room_id", room.id),
      supabase.from("activities").select("material_id, quiz_data, is_published, title, peer_review_enabled, peer_review_criteria").eq("room_id", room.id),
      supabase.from("room_students").select("student_email, student_name").eq("room_id", room.id),
    ]);
    if (studs && studs.length > 0) await supabase.from("room_students").insert(studs.map(s => ({ room_id: newRoom.id, student_email: s.student_email, student_name: s.student_name })));
    if (mats && mats.length > 0) await supabase.from("materials").insert(mats.map(m => ({ room_id: newRoom.id, ...m })));
    if (acts && acts.length > 0) {
      const { data: newMats } = await supabase.from("materials").select("id, title").eq("room_id", newRoom.id);
      const matMap = new Map((newMats || []).map(m => [m.title, m.id]));
      const { data: origMats } = await supabase.from("materials").select("id, title").eq("room_id", room.id);
      const origMap = new Map((origMats || []).map(m => [m.id, m.title]));
      await supabase.from("activities").insert(acts.map(a => {
        const origTitle = a.material_id ? origMap.get(a.material_id) : null;
        const newMatId = origTitle ? matMap.get(origTitle) || null : null;
        return { room_id: newRoom.id, material_id: newMatId, quiz_data: a.quiz_data, is_published: a.is_published, title: a.title, peer_review_enabled: a.peer_review_enabled, peer_review_criteria: a.peer_review_criteria };
      }));
    }
    toast({ title: "Sala duplicada!" });
    fetchRooms();
  };

  const renameRoom = async () => {
    if (!renamingRoom || !renameTitle.trim()) return;
    const { error } = await supabase.from("rooms").update({ title: renameTitle.trim() }).eq("id", renamingRoom.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Sala renomeada!" });
    setRenamingRoom(null);
    setRenameTitle("");
    setRenameDialogOpen(false);
    fetchRooms();
  };

  const linkRoomToDiscipline = async (roomId: string, discId: string) => {
    await (supabase.from("rooms") as any).update({ discipline_id: discId }).eq("id", roomId);
    toast({ title: "Sala vinculada à disciplina!" });
    fetchRooms();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  const roomLimit = getRoomLimit();
  const atLimit = roomLimit !== -1 && rooms.length >= roomLimit;

  // Compute stats per discipline
  const getDisciplineStats = (discId: string) => {
    const discRooms = rooms.filter(r => r.discipline_id === discId);
    const totalStudents = discRooms.reduce((sum, r) => sum + (roomStats[r.id]?.studentCount || 0), 0);
    const activeCount = discRooms.filter(r => !isRoomExpired(r)).length;
    return { roomCount: discRooms.length, totalStudents, activeCount };
  };

  const unlinkedRooms = rooms.filter(r => !r.discipline_id);

  // ===================== DISCIPLINE DETAIL VIEW =====================
  if (disciplineId) {
    const disc = disciplines.find(d => d.id === disciplineId);
    const discRooms = rooms.filter(r => r.discipline_id === disciplineId);

    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate("/dashboard/rooms")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar às disciplinas
            </button>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: disc?.color || "#0d9488" }} />
              {disc?.title || "Disciplina"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {discRooms.length} sala{discRooms.length !== 1 ? "s" : ""} nesta disciplina
              {roomLimit !== -1 && (
                <span className="ml-2 text-xs">({rooms.length}/{roomLimit} salas total)</span>
              )}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-semibold" disabled={atLimit}>
                {atLimit ? <Lock className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {atLimit ? "Limite atingido" : "Nova Sala"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Criar Nova Sala</DialogTitle>
              </DialogHeader>
              {renderCreateRoomForm()}
            </DialogContent>
          </Dialog>
        </div>

        {discRooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">Nenhuma sala nesta disciplina</h3>
            <p className="text-muted-foreground">Crie uma sala de aula invertida para esta disciplina.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discRooms.map(room => renderRoomCard(room))}
          </div>
        )}
      </div>
    );
  }

  // ===================== DISCIPLINES OVERVIEW =====================
  function renderCreateRoomForm() {
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label>Título da sala</Label>
          <Input
            placeholder="Ex: Biologia - Fotossíntese"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
          />
        </div>
        {!disciplineId && disciplines.length > 0 && (
          <div className="space-y-2">
            <Label>Disciplina</Label>
            <Select value={selectedDisciplineForRoom} onValueChange={setSelectedDisciplineForRoom}>
              <SelectTrigger>
                <SelectValue placeholder="Sem disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem disciplina</SelectItem>
                {disciplines.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: d.color }} />
                      {d.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Data de expiração (opcional)</Label>
          <Input type="datetime-local" value={newExpireAt} onChange={(e) => setNewExpireAt(e.target.value)} />
          <p className="text-xs text-muted-foreground">Se não definida, a sala expira em 1 semana.</p>
        </div>
        {rooms.length > 0 && (
          <div className="space-y-3">
            <Label className="flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Importar de outra sala (opcional)</Label>
            <Select value={importFromRoomId} onValueChange={(v) => { setImportFromRoomId(v); if (v === "none") { setImportStudents(true); setImportMaterials(false); setImportActivities(false); } }}>
              <SelectTrigger><SelectValue placeholder="Nenhuma — começar vazia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma — começar vazia</SelectItem>
                {rooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title} ({roomStats[r.id]?.studentCount || 0} alunos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {importFromRoomId && importFromRoomId !== "none" && (
              <div className="space-y-2 pl-1 border-l-2 border-primary/20 ml-1 pl-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Selecione o que deseja importar:</p>
                <div className="flex items-center gap-2">
                  <Checkbox id="import-students" checked={importStudents} onCheckedChange={(v) => setImportStudents(!!v)} />
                  <label htmlFor="import-students" className="text-sm flex items-center gap-1.5 cursor-pointer"><Users className="w-3.5 h-3.5 text-muted-foreground" /> Alunos</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="import-materials" checked={importMaterials} onCheckedChange={(v) => setImportMaterials(!!v)} />
                  <label htmlFor="import-materials" className="text-sm flex items-center gap-1.5 cursor-pointer"><FileText className="w-3.5 h-3.5 text-muted-foreground" /> Materiais</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="import-activities" checked={importActivities} onCheckedChange={(v) => setImportActivities(!!v)} />
                  <label htmlFor="import-activities" className="text-sm flex items-center gap-1.5 cursor-pointer"><ClipboardList className="w-3.5 h-3.5 text-muted-foreground" /> Atividades</label>
                </div>
              </div>
            )}
          </div>
        )}
        <Button onClick={createRoom} disabled={creating || !newTitle.trim()} className="w-full font-semibold">
          {creating ? "Criando..." : "Criar Sala"}
        </Button>
      </div>
    );
  }

  function renderRoomCard(room: Room) {
    const stats = roomStats[room.id];
    const expired = isRoomExpired(room);
    return (
      <div
        key={room.id}
        className={`border rounded-xl p-6 hover:shadow-[var(--shadow-soft)] transition-shadow cursor-pointer group ${
          expired ? "bg-destructive/5 border-destructive/30" : "bg-card border-border"
        }`}
        onClick={() => navigate(`/dashboard/room/${room.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-display font-semibold text-lg text-card-foreground group-hover:text-primary transition-colors pr-2">
            {room.title}
          </h3>
          <div className="flex items-center gap-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              expired ? "bg-destructive/10 text-destructive" : "bg-level-easy/10 text-level-easy"
            }`}>
              {expired ? "Expirada" : "Ativa"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => { setRenamingRoom(room); setRenameTitle(room.title); setRenameDialogOpen(true); }}>
                  <Pencil className="w-4 h-4 mr-2" /> Renomear
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateRoom(room)}>
                  <Copy className="w-4 h-4 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteRoom(room.id)} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            PIN: <span className="font-mono font-bold text-foreground">{room.pin_code}</span>
          </div>
          {room.unlock_at && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(room.unlock_at) > new Date() ? "Bloqueado" : "Liberado"}
            </div>
          )}
        </div>
        {(room as any).expire_at && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <CalendarClock className="w-3.5 h-3.5" />
            Expira: {new Date((room as any).expire_at).toLocaleDateString("pt-BR")}
          </div>
        )}
        {stats && (
          <div className="flex gap-3 text-xs text-muted-foreground border-t border-border pt-3">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {stats.studentCount} alunos</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {stats.completedCount} completos</span>
            {stats.completedCount > 0 && (
              <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> média {stats.avgScore}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Minhas Salas
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize suas salas por disciplina
            {roomLimit !== -1 && (
              <span className="ml-2 text-xs">({rooms.length}/{roomLimit} salas)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={discDialogOpen} onOpenChange={(v) => { setDiscDialogOpen(v); if (!v) { setEditingDisc(null); setNewDiscTitle(""); setNewDiscColor(PRESET_COLORS[0]); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Nova Disciplina
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">{editingDisc ? "Editar Disciplina" : "Nova Disciplina"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nome da disciplina</Label>
                  <Input
                    placeholder="Ex: Biologia, Matemática..."
                    value={newDiscTitle}
                    onChange={(e) => setNewDiscTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveDiscipline()}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> Cor</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${newDiscColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewDiscColor(c)}
                      />
                    ))}
                  </div>
                </div>
                <Button onClick={saveDiscipline} disabled={creatingDisc || !newDiscTitle.trim()} className="w-full font-semibold">
                  {creatingDisc ? "Salvando..." : editingDisc ? "Salvar Alterações" : "Criar Disciplina"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-semibold" disabled={atLimit}>
                {atLimit ? <Lock className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {atLimit ? "Limite atingido" : "Nova Sala"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Criar Nova Sala</DialogTitle>
              </DialogHeader>
              {renderCreateRoomForm()}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {atLimit && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Limite de salas atingido</p>
              <p className="text-xs text-muted-foreground">Faça upgrade do seu plano para criar mais salas.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/pricing")}>Ver Planos</Button>
        </div>
      )}

      {/* Discipline Cards */}
      {disciplines.length === 0 && rooms.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">Nenhuma disciplina criada</h3>
          <p className="text-muted-foreground mb-4">Crie uma disciplina para organizar suas salas de aula invertida.</p>
        </div>
      ) : (
        <>
          {disciplines.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
              {disciplines.map(disc => {
                const stats = getDisciplineStats(disc.id);
                return (
                  <div
                    key={disc.id}
                    className="border border-border rounded-xl p-6 hover:shadow-[var(--shadow-soft)] transition-shadow cursor-pointer group bg-card relative"
                    onClick={() => navigate(`/dashboard/rooms/discipline/${disc.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: disc.color + "20" }}>
                          <FolderOpen className="w-5 h-5" style={{ color: disc.color }} />
                        </div>
                        <h3 className="font-display font-semibold text-lg text-card-foreground group-hover:text-primary transition-colors">
                          {disc.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDisc(disc);
                            setNewDiscTitle(disc.title);
                            setNewDiscColor(disc.color);
                            setDiscDialogOpen(true);
                          }}
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteDiscipline(disc.id); }}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> {stats.roomCount} sala{stats.roomCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {stats.totalStudents} aluno{stats.totalStudents !== 1 ? "s" : ""}
                      </span>
                      {stats.activeCount > 0 && (
                        <span className="flex items-center gap-1 text-level-easy">
                          {stats.activeCount} ativa{stats.activeCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl" style={{ backgroundColor: disc.color }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Unlinked rooms */}
          {unlinkedRooms.length > 0 && (
            <div className="mt-2">
              <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-muted-foreground" />
                Salas sem disciplina
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {unlinkedRooms.map(room => renderRoomCard(room))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Collaborated rooms */}
      {collabRooms.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2 mb-4">
            <Users2 className="w-5 h-5 text-primary" />
            Salas como Colaborador
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collabRooms.map((room) => {
              const stats = roomStats[room.id];
              const expired = isRoomExpired(room);
              return (
                <div
                  key={room.id}
                  className={`border rounded-xl p-6 hover:shadow-[var(--shadow-soft)] transition-shadow cursor-pointer group ${
                    expired ? "bg-destructive/5 border-destructive/30" : "bg-card border-primary/20"
                  }`}
                  onClick={() => navigate(`/dashboard/room/${room.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-display font-semibold text-lg text-card-foreground group-hover:text-primary transition-colors">
                      {room.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                      <Users2 className="w-3 h-3" /> Colaborador
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      PIN: <span className="font-mono font-bold text-foreground">{room.pin_code}</span>
                    </div>
                  </div>
                  {stats && (
                    <div className="flex gap-3 text-xs text-muted-foreground border-t border-border pt-3">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {stats.studentCount} alunos</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {stats.completedCount} completos</span>
                      {stats.completedCount > 0 && (
                        <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> média {stats.avgScore}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsList;
