import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Users, Clock, Trash2, Eye, BarChart3, Lock, CalendarClock, Users2, Download, FileText, ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;

interface RoomStats {
  roomId: string;
  studentCount: number;
  avgScore: number;
  completedCount: number;
}

const isRoomExpired = (room: Room): boolean => {
  const expireAt = (room as any).expire_at;
  const lastActivity = (room as any).last_student_activity_at;
  const now = new Date();

  // Check explicit expiration
  if (expireAt && new Date(expireAt) <= now) return true;

  // Check idle expiration (no students for 1 week)
  if (lastActivity) {
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (new Date(lastActivity) <= oneWeekAgo) return true;
  }

  return false;
};

const RoomsList = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [collabRooms, setCollabRooms] = useState<Room[]>([]);
  const [roomStats, setRoomStats] = useState<Record<string, RoomStats>>({});
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newExpireAt, setNewExpireAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importFromRoomId, setImportFromRoomId] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();
  const { canCreateRoom, getRoomLimit, effectivePlan } = useFeatureGate();

  const generatePin = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const fetchRooms = useCallback(async () => {
    if (!auth.user) return;
    const [roomsRes, sessionsRes, enrolledRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("teacher_id", auth.user.id).order("created_at", { ascending: false }),
      supabase.from("student_sessions").select("room_id, score, completed_at"),
      supabase.from("room_students").select("room_id"),
    ]);
    
    if (roomsRes.error) {
      console.error("Error fetching rooms:", roomsRes.error);
    }
    
    const roomsList = roomsRes.data || [];
    setRooms(roomsList);

    // Fetch collaborated rooms separately to avoid breaking main query
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
        roomId: roomId,
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
    if (!auth.loading && auth.user && auth.isApproved) fetchRooms();
  }, [auth.loading, auth.user?.id, auth.isApproved, fetchRooms]);

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
    };
    if (newExpireAt) {
      insertData.expire_at = new Date(newExpireAt).toISOString();
    }
    // If no expire_at, the DB default (now + 7 days) applies
    const { data: newRoom, error } = await supabase.from("rooms").insert(insertData).select().single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Import students from selected room if chosen
      if (importFromRoomId && importFromRoomId !== "none" && newRoom) {
        const { data: students } = await supabase
          .from("room_students")
          .select("student_email, student_name")
          .eq("room_id", importFromRoomId);
        if (students && students.length > 0) {
          const toInsert = students.map(s => ({
            room_id: newRoom.id,
            student_email: s.student_email,
            student_name: s.student_name,
          }));
          await supabase.from("room_students").insert(toInsert);
          toast({ title: "Sala criada!", description: `${students.length} aluno(s) importado(s) da sala anterior.` });
        } else {
          toast({ title: "Sala criada!", description: "Nenhum aluno encontrado na sala selecionada para importar." });
        }
      } else {
        toast({ title: "Sala criada!" });
      }
      setNewTitle("");
      setNewExpireAt("");
      setImportFromRoomId("");
      setDialogOpen(false);
      fetchRooms();
    }
    setCreating(false);
  };

  const deleteRoom = async (id: string) => {
    await supabase.from("rooms").delete().eq("id", id);
    fetchRooms();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  const roomLimit = getRoomLimit();
  const atLimit = roomLimit !== -1 && rooms.length >= roomLimit;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Minhas Salas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas salas de aula invertida
            {roomLimit !== -1 && (
              <span className="ml-2 text-xs">({rooms.length}/{roomLimit} salas)</span>
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
              <div className="space-y-2">
                <Label>Data de expiração (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={newExpireAt}
                  onChange={(e) => setNewExpireAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Se não definida, a sala expira em 1 semana. Salas ociosas (sem alunos por 1 semana) também expiram automaticamente.</p>
              </div>
              {rooms.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Importar alunos de outra sala (opcional)</Label>
                <Select value={importFromRoomId} onValueChange={setImportFromRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma — começar vazia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma — começar vazia</SelectItem>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title} ({roomStats[r.id]?.studentCount || 0} alunos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Importa a lista de alunos (email e nome) de uma sala existente.</p>
              </div>
              )}
              <Button onClick={createRoom} disabled={creating || !newTitle.trim()} className="w-full font-semibold">
                {creating ? "Criando..." : "Criar Sala"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
          <Button size="sm" variant="outline" onClick={() => navigate("/pricing")}>
            Ver Planos
          </Button>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">Nenhuma sala criada</h3>
          <p className="text-muted-foreground">Crie sua primeira sala de aula invertida.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const stats = roomStats[room.id];
            const expired = isRoomExpired(room);
            return (
              <div
                key={room.id}
                className={`border rounded-xl p-6 hover:shadow-[var(--shadow-soft)] transition-shadow cursor-pointer group ${
                  expired
                    ? "bg-destructive/5 border-destructive/30"
                    : "bg-card border-border"
                }`}
                onClick={() => navigate(`/dashboard/room/${room.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display font-semibold text-lg text-card-foreground group-hover:text-primary transition-colors">
                    {room.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      expired
                        ? "bg-destructive/10 text-destructive"
                        : "bg-level-easy/10 text-level-easy"
                    }`}>
                      {expired ? "Expirada" : "Ativa"}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {stats.studentCount} alunos
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {stats.completedCount} completos
                    </span>
                    {stats.completedCount > 0 && (
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> média {stats.avgScore}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {stats.studentCount} alunos
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {stats.completedCount} completos
                      </span>
                      {stats.completedCount > 0 && (
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" /> média {stats.avgScore}
                        </span>
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