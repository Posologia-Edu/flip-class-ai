import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Users, Target, BarChart3, Plus, Upload, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationCenter from "@/components/NotificationCenter";
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      navigate("/auth");
      return;
    }
    if (!auth.isApproved) {
      navigate("/pending-approval");
      return;
    }
    fetchRooms();
  }, [auth.loading, auth.user?.id, auth.isApproved]);

  const fetchRooms = async () => {
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
  };

  const totalStudents = Object.values(roomStats).reduce((s, r) => s + r.studentCount, 0);
  const totalCompleted = Object.values(roomStats).reduce((s, r) => s + r.completedCount, 0);
  const overallAvg = (() => {
    const vals = Object.values(roomStats).filter((r) => r.completedCount > 0);
    return vals.length > 0 ? Math.round(vals.reduce((s, r) => s + r.avgScore, 0) / vals.length) : 0;
  })();

  const onboardingSteps = [
    { icon: Plus, title: "Criar Sala", desc: "Crie sua primeira sala de aula com um PIN exclusivo" },
    { icon: Upload, title: "Adicionar Materiais", desc: "Envie PDFs, vídeos ou textos para seus alunos" },
    { icon: Share2, title: "Compartilhar PIN", desc: "Compartilhe o PIN da sala para os alunos acessarem" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Olá, {auth.fullName || "Professor"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Bem-vindo ao seu painel de controle</p>
        </div>
        <NotificationCenter teacherId={auth.user?.id} />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-20">Carregando...</div>
      ) : rooms.length === 0 ? (
        /* Onboarding empty state */
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            Bem-vindo ao FlipClass!
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-10">
            Comece criando sua primeira sala de aula invertida. São apenas 3 passos simples:
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto mb-10">
            {onboardingSteps.map((step, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-display font-semibold text-foreground text-sm mb-1">
                  {i + 1}. {step.title}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <Button size="lg" className="font-semibold" onClick={() => navigate("/dashboard/rooms")}>
            <Plus className="w-4 h-4 mr-2" /> Criar Minha Primeira Sala
          </Button>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
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
              <p className="font-display text-2xl font-bold text-foreground">{totalStudents}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Target className="w-4 h-4" /> Quizzes Completos
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{totalCompleted}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BarChart3 className="w-4 h-4" /> Média Geral
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{overallAvg}</p>
            </div>
          </div>

          {/* Recent rooms */}
          <div>
            <h2 className="font-display text-lg font-semibold mb-4">Salas Recentes</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.slice(0, 6).map((room) => {
                const stats = roomStats[room.id];
                return (
                  <div
                    key={room.id}
                    className="bg-card border border-border rounded-xl p-5 hover:shadow-[var(--shadow-soft)] transition-shadow cursor-pointer group"
                    onClick={() => navigate(`/dashboard/room/${room.id}`)}
                  >
                    <h3 className="font-display font-semibold text-card-foreground group-hover:text-primary transition-colors mb-2">
                      {room.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>PIN: <span className="font-mono font-bold text-foreground">{room.pin_code}</span></span>
                      {stats && (
                        <>
                          <span>{stats.studentCount} alunos</span>
                          {stats.completedCount > 0 && <span>média {stats.avgScore}</span>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
