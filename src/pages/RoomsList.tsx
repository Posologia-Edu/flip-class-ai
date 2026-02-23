import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Users, Clock, Trash2, Eye, BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;

interface RoomStats {
  roomId: string;
  studentCount: number;
  avgScore: number;
  completedCount: number;
}

const RoomsList = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStats, setRoomStats] = useState<Record<string, RoomStats>>({});
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();

  const generatePin = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const fetchRooms = useCallback(async () => {
    if (!auth.user) return;
    const [roomsRes, sessionsRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("teacher_id", auth.user.id).order("created_at", { ascending: false }),
      supabase.from("student_sessions").select("room_id, score, completed_at"),
    ]);
    const roomsList = roomsRes.data || [];
    setRooms(roomsList);

    const allSessions = sessionsRes.data || [];
    const statsMap: Record<string, RoomStats> = {};
    for (const room of roomsList) {
      const sessions = allSessions.filter(s => s.room_id === room.id);
      const completed = sessions.filter(s => s.completed_at);
      statsMap[room.id] = {
        roomId: room.id,
        studentCount: sessions.length,
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
    setCreating(true);
    const { error } = await supabase.from("rooms").insert({
      title: newTitle.trim(),
      pin_code: generatePin(),
      teacher_id: auth.user.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewTitle("");
      setDialogOpen(false);
      fetchRooms();
      toast({ title: "Sala criada!" });
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Minhas Salas
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie suas salas de aula invertida</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-semibold">
              <Plus className="w-4 h-4 mr-2" /> Nova Sala
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
              <Button onClick={createRoom} disabled={creating || !newTitle.trim()} className="w-full font-semibold">
                {creating ? "Criando..." : "Criar Sala"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
            return (
              <div
                key={room.id}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-[var(--shadow-soft)] transition-shadow cursor-pointer group"
                onClick={() => navigate(`/dashboard/room/${room.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-display font-semibold text-lg text-card-foreground group-hover:text-primary transition-colors">
                    {room.title}
                  </h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
    </div>
  );
};

export default RoomsList;
