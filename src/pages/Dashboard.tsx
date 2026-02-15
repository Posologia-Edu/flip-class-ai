import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, LogOut, BookOpen, Users, Clock, Trash2, ShieldCheck, BarChart3, Eye, Target } from "lucide-react";
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

const Dashboard = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStats, setRoomStats] = useState<Record<string, RoomStats>>({});
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      navigate("/auth");
      return;
    }
    if (!auth.loading && auth.user && !auth.isApproved) {
      navigate("/pending-approval");
      return;
    }
    if (!auth.loading && auth.user && auth.isApproved) {
      fetchRooms();
    }
  }, [auth, navigate]);

  const fetchRooms = async () => {
    const { data: roomsData } = await supabase.from("rooms").select("*").order("created_at", { ascending: false });
    const rooms = roomsData || [];
    setRooms(rooms);

    // Fetch stats for all rooms
    if (rooms.length > 0) {
      const roomIds = rooms.map(r => r.id);
      const { data: sessions } = await supabase
        .from("student_sessions")
        .select("room_id, score, completed_at")
        .in("room_id", roomIds);

      const stats: Record<string, RoomStats> = {};
      rooms.forEach(r => {
        const roomSessions = (sessions || []).filter(s => s.room_id === r.id);
        const completed = roomSessions.filter(s => s.completed_at);
        const totalScore = completed.reduce((sum, s) => sum + (s.score || 0), 0);
        stats[r.id] = {
          roomId: r.id,
          studentCount: roomSessions.length,
          avgScore: completed.length > 0 ? Math.round(totalScore / completed.length) : 0,
          completedCount: completed.length,
        };
      });
      setRoomStats(stats);
    }

    setLoading(false);
  };

  const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();

  const createRoom = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    if (!auth.user) return;

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">FlipClass</span>
        </div>
        <div className="flex items-center gap-2">
          {auth.isAdmin && (
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <ShieldCheck className="w-4 h-4 mr-2" /> Admin
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Welcome + Stats Overview */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Olá, {auth.fullName || "Professor"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie suas salas de aula invertida</p>
        </div>

        {/* Quick Stats */}
        {rooms.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BookOpen className="w-4 h-4" /> Salas
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{rooms.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="w-4 h-4" /> Alunos Total
              </div>
              <p className="font-display text-2xl font-bold text-foreground">
                {Object.values(roomStats).reduce((s, r) => s + r.studentCount, 0)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Target className="w-4 h-4" /> Quizzes Completos
              </div>
              <p className="font-display text-2xl font-bold text-foreground">
                {Object.values(roomStats).reduce((s, r) => s + r.completedCount, 0)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BarChart3 className="w-4 h-4" /> Média Geral
              </div>
              <p className="font-display text-2xl font-bold text-foreground">
                {(() => {
                  const vals = Object.values(roomStats).filter(r => r.completedCount > 0);
                  return vals.length > 0
                    ? Math.round(vals.reduce((s, r) => s + r.avgScore, 0) / vals.length)
                    : 0;
                })()}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold">Minhas Salas</h2>
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

        {loading ? (
          <div className="text-center text-muted-foreground py-20">Carregando...</div>
        ) : rooms.length === 0 ? (
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
      </main>
    </div>
  );
};

export default Dashboard;
