import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, Users, BookOpen, Target } from "lucide-react";
import CrossRoomAnalytics from "@/components/CrossRoomAnalytics";
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;

interface RoomAnalytics {
  roomId: string;
  title: string;
  studentCount: number;
  completedCount: number;
  avgScore: number;
  completionRate: number;
}

const AnalyticsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState<RoomAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    const [roomsRes, sessionsRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false }),
      supabase.from("student_sessions").select("room_id, score, completed_at"),
    ]);

    const roomsList = roomsRes.data || [];
    const allSessions = sessionsRes.data || [];
    const result: RoomAnalytics[] = [];

    for (const room of roomsList) {
      const sessions = allSessions.filter(s => s.room_id === room.id);
      const completed = sessions.filter(s => s.completed_at);
      const studentCount = sessions.length;
      result.push({
        roomId: room.id,
        title: room.title,
        studentCount,
        completedCount: completed.length,
        avgScore: completed.length > 0
          ? Math.round(completed.reduce((s, c) => s + (c.score || 0), 0) / completed.length)
          : 0,
        completionRate: studentCount > 0 ? Math.round((completed.length / studentCount) * 100) : 0,
      });
    }
    setAnalytics(result);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user) fetchAnalytics();
  }, [authLoading, user?.id, fetchAnalytics]);

  const totalStudents = analytics.reduce((s, r) => s + r.studentCount, 0);
  const totalCompleted = analytics.reduce((s, r) => s + r.completedCount, 0);
  const overallAvg = analytics.filter((r) => r.completedCount > 0).length > 0
    ? Math.round(analytics.filter((r) => r.completedCount > 0).reduce((s, r) => s + r.avgScore, 0) / analytics.filter((r) => r.completedCount > 0).length)
    : 0;

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Análises
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral do desempenho das suas salas</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <BookOpen className="w-4 h-4" /> Salas
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{analytics.length}</p>
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

      {analytics.length >= 2 ? (
        <CrossRoomAnalytics data={analytics} />
      ) : analytics.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">Sem dados ainda</h3>
          <p className="text-muted-foreground">Crie salas e receba alunos para ver as análises.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-muted-foreground text-center">
            Crie mais salas para ver o comparativo entre elas.
          </p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
