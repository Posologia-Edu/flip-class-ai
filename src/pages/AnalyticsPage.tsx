import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, Users, BookOpen, Target, TrendingUp, Clock, Eye, ChevronDown, ChevronUp } from "lucide-react";
import CrossRoomAnalytics from "@/components/CrossRoomAnalytics";
import AnalyticsReport from "@/components/AnalyticsReport";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, PieChart, Pie } from "recharts";
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

const COLORS = [
  "hsl(174, 62%, 38%)",
  "hsl(27, 96%, 61%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(220, 70%, 55%)",
  "hsl(280, 60%, 55%)",
];

const AnalyticsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState<RoomAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);

  // Per-room detail data
  const [roomSessions, setRoomSessions] = useState<any[]>([]);
  const [roomActivityLogs, setRoomActivityLogs] = useState<any[]>([]);
  const [roomMaterials, setRoomMaterials] = useState<any[]>([]);
  const [roomActivities, setRoomActivities] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Global trends
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [allActivityLogs, setAllActivityLogs] = useState<any[]>([]);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    const [roomsRes, sessionsRes, activityRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false }),
      supabase.from("student_sessions").select("*"),
      supabase.from("student_activity_logs").select("*"),
    ]);

    const roomsList = roomsRes.data || [];
    const sessions = sessionsRes.data || [];
    const actLogs = activityRes.data || [];

    setAllSessions(sessions);
    setAllActivityLogs(actLogs);

    const result: RoomAnalytics[] = [];
    for (const room of roomsList) {
      const roomSess = sessions.filter(s => s.room_id === room.id);
      const completed = roomSess.filter(s => s.completed_at);
      const studentCount = roomSess.length;
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

  const toggleRoomDetail = async (roomId: string) => {
    if (expandedRoom === roomId) {
      setExpandedRoom(null);
      return;
    }
    setExpandedRoom(roomId);
    setLoadingDetail(true);

    const [sessRes, logsRes, matsRes, actsRes] = await Promise.all([
      supabase.from("student_sessions").select("*").eq("room_id", roomId),
      supabase.from("student_activity_logs").select("*").eq("room_id", roomId),
      supabase.from("materials").select("*").eq("room_id", roomId),
      supabase.from("activities").select("*").eq("room_id", roomId),
    ]);

    setRoomSessions(sessRes.data || []);
    setRoomActivityLogs(logsRes.data || []);
    setRoomMaterials(matsRes.data || []);
    setRoomActivities(actsRes.data || []);
    setLoadingDetail(false);
  };

  // Global metrics
  const totalStudents = analytics.reduce((s, r) => s + r.studentCount, 0);
  const totalCompleted = analytics.reduce((s, r) => s + r.completedCount, 0);
  const completedRooms = analytics.filter((r) => r.completedCount > 0);
  const overallAvg = completedRooms.length > 0
    ? Math.round(completedRooms.reduce((s, r) => s + r.avgScore, 0) / completedRooms.length)
    : 0;
  const overallCompletionRate = totalStudents > 0 ? Math.round((totalCompleted / totalStudents) * 100) : 0;

  // Engagement over time (last 14 days)
  const engagementTrend = (() => {
    const days: Record<string, { sessions: number; completions: number }> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { sessions: 0, completions: 0 };
    }
    for (const s of allSessions) {
      const key = s.created_at?.slice(0, 10);
      if (days[key]) days[key].sessions++;
      if (s.completed_at) {
        const ck = s.completed_at.slice(0, 10);
        if (days[ck]) days[ck].completions++;
      }
    }
    return Object.entries(days).map(([date, v]) => ({
      date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      "Novos Alunos": v.sessions,
      "Conclusões": v.completions,
    }));
  })();

  // Question-level analysis for expanded room
  const questionAnalysis = (() => {
    if (!expandedRoom || roomActivities.length === 0) return [];
    const activity = roomActivities[0];
    const quizData = activity?.quiz_data as any;
    if (!quizData?.questions) return [];

    return (quizData.questions as any[]).map((q: any, idx: number) => {
      const key = `q${idx}`;
      let correct = 0;
      let total = 0;
      for (const session of roomSessions) {
        const answers = session.answers as any;
        if (answers && answers[key] !== undefined) {
          total++;
          if (answers[key] === q.correct || answers[key] === q.correctAnswer) correct++;
        }
      }
      const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
      return {
        question: (q.question || q.text || `Questão ${idx + 1}`).substring(0, 50),
        fullQuestion: q.question || q.text || `Questão ${idx + 1}`,
        acertos: rate,
        total,
        correct,
      };
    });
  })();

  // Average time on platform per student
  const avgTimePerStudent = (() => {
    if (allActivityLogs.length === 0 || allSessions.length === 0) return 0;
    const totalSeconds = allActivityLogs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
    const uniqueStudents = new Set(allActivityLogs.map(l => l.session_id)).size;
    return uniqueStudents > 0 ? Math.round(totalSeconds / uniqueStudents / 60) : 0;
  })();

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
            <Target className="w-4 h-4" /> Concluídos
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{totalCompleted}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp className="w-4 h-4" /> Taxa Geral
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{overallCompletionRate}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="w-4 h-4" /> Tempo Médio
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{avgTimePerStudent} min</p>
        </div>
      </div>

      {/* Engagement Trend */}
      {allSessions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-8">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Tendência de Engajamento (últimos 14 dias)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={engagementTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }} />
              <Line type="monotone" dataKey="Novos Alunos" stroke="hsl(174, 62%, 38%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Conclusões" stroke="hsl(27, 96%, 61%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cross-Room Analytics */}
      {analytics.length >= 2 && <CrossRoomAnalytics data={analytics} />}

      {/* Per-Room Detail */}
      {analytics.length > 0 ? (
        <div className="space-y-3 mb-8">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" /> Detalhamento por Sala
          </h2>
          {analytics.map((room) => (
            <div key={room.roomId} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggleRoomDetail(room.roomId)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{room.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {room.studentCount} alunos · {room.completedCount} concluídos · Média: {room.avgScore}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    room.completionRate >= 70 ? "bg-green-500/10 text-green-600" :
                    room.completionRate >= 40 ? "bg-yellow-500/10 text-yellow-600" :
                    "bg-red-500/10 text-red-500"
                  }`}>
                    {room.completionRate}%
                  </span>
                  {expandedRoom === room.roomId ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {expandedRoom === room.roomId && (
                <div className="border-t border-border p-4">
                  {loadingDetail ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Carregando detalhes...</p>
                  ) : (
                    <div className="space-y-6">
                      {/* Question-level analysis */}
                      {questionAnalysis.length > 0 && (
                        <div>
                          <h4 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4 text-accent" /> Desempenho por Questão (% acerto)
                          </h4>
                          <ResponsiveContainer width="100%" height={Math.max(180, questionAnalysis.length * 35)}>
                            <BarChart data={questionAnalysis} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                              <YAxis type="category" dataKey="question" tick={{ fontSize: 10 }} width={150} />
                              <Tooltip
                                contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }}
                                formatter={(value: number, name: string, props: any) => [
                                  `${value}% (${props.payload.correct}/${props.payload.total})`,
                                  "Taxa de acerto"
                                ]}
                                labelFormatter={(label) => {
                                  const item = questionAnalysis.find(q => q.question === label);
                                  return item?.fullQuestion || label;
                                }}
                              />
                              <Bar dataKey="acertos" radius={[0, 4, 4, 0]}>
                                {questionAnalysis.map((q, i) => (
                                  <Cell key={i} fill={q.acertos >= 70 ? "hsl(142, 71%, 45%)" : q.acertos >= 40 ? "hsl(38, 92%, 50%)" : "hsl(0, 72%, 51%)"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          {questionAnalysis.filter(q => q.acertos < 50).length > 0 && (
                            <div className="mt-3 bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                              <p className="text-xs font-semibold text-destructive mb-1">⚠️ Questões com baixo aproveitamento (&lt;50%):</p>
                              {questionAnalysis.filter(q => q.acertos < 50).map((q, i) => (
                                <p key={i} className="text-xs text-muted-foreground">• {q.fullQuestion} — {q.acertos}% de acerto</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* AnalyticsReport with sessions/logs/materials */}
                      <AnalyticsReport
                        sessions={roomSessions}
                        activityLogs={roomActivityLogs}
                        materials={roomMaterials}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">Sem dados ainda</h3>
          <p className="text-muted-foreground">Crie salas e receba alunos para ver as análises.</p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
