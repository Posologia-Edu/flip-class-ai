import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertTriangle, Clock, BookOpen, Users, TrendingUp, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Tables } from "@/integrations/supabase/types";

interface ActivityLog {
  activity_type: string;
  material_id: string | null;
  duration_seconds: number;
  session_id: string;
  created_at: string;
}

type Material = Tables<"materials">;
type Session = Tables<"student_sessions">;

interface AnalyticsReportProps {
  sessions: Session[];
  activityLogs: ActivityLog[];
  materials: Material[];
}

const CHART_COLORS = [
  "hsl(174, 62%, 38%)",
  "hsl(27, 96%, 61%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(220, 70%, 55%)",
  "hsl(280, 60%, 55%)",
];

const AnalyticsReport = ({ sessions, activityLogs, materials }: AnalyticsReportProps) => {
  // --- Average time per material ---
  const timePerMaterial = useMemo(() => {
    return materials.map((mat) => {
      const logs = activityLogs.filter(
        (l) => l.material_id === mat.id && (l.activity_type === "material_view" || l.activity_type === "page_active")
      );
      const totalSeconds = logs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
      const uniqueSessions = new Set(logs.map((l) => l.session_id)).size;
      const avgSeconds = uniqueSessions > 0 ? Math.round(totalSeconds / uniqueSessions) : 0;
      return {
        name: mat.title?.substring(0, 20) || "Sem título",
        fullName: mat.title || "Sem título",
        avgMinutes: +(avgSeconds / 60).toFixed(1),
        totalViews: uniqueSessions,
      };
    });
  }, [materials, activityLogs]);

  // --- Completion rate ---
  const completionData = useMemo(() => {
    const completed = sessions.filter((s) => s.completed_at).length;
    const inProgress = sessions.length - completed;
    return {
      completed,
      inProgress,
      rate: sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0,
      pieData: [
        { name: "Concluído", value: completed },
        { name: "Em andamento", value: inProgress },
      ],
    };
  }, [sessions]);

  // --- At-risk students (didn't view materials or didn't complete) ---
  const atRiskStudents = useMemo(() => {
    return sessions
      .map((session) => {
        const sessionLogs = activityLogs.filter((l) => l.session_id === session.id);
        const viewedMaterials = new Set(
          sessionLogs.filter((l) => l.activity_type === "material_view" && l.material_id).map((l) => l.material_id)
        );
        const totalTime = sessionLogs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
        const materialsViewedCount = viewedMaterials.size;
        const materialsPercent = materials.length > 0 ? Math.round((materialsViewedCount / materials.length) * 100) : 0;

        const risks: string[] = [];
        if (materialsPercent < 50) risks.push("Menos de 50% dos materiais vistos");
        if (!session.completed_at) risks.push("Atividade não concluída");
        if (totalTime < 60) risks.push("Menos de 1 min na plataforma");

        return {
          id: session.id,
          name: session.student_name,
          email: session.student_email || "—",
          materialsPercent,
          completed: !!session.completed_at,
          totalMinutes: +(totalTime / 60).toFixed(1),
          risks,
          isAtRisk: risks.length > 0,
        };
      })
      .sort((a, b) => b.risks.length - a.risks.length);
  }, [sessions, activityLogs, materials]);

  // --- Score distribution ---
  const scoreDistribution = useMemo(() => {
    const completedSessions = sessions.filter((s) => s.completed_at && s.score != null);
    const ranges = [
      { label: "0-2", min: 0, max: 2, count: 0 },
      { label: "3-4", min: 3, max: 4, count: 0 },
      { label: "5-6", min: 5, max: 6, count: 0 },
      { label: "7-8", min: 7, max: 8, count: 0 },
      { label: "9-10", min: 9, max: 10, count: 0 },
    ];
    completedSessions.forEach((s) => {
      const score = s.score || 0;
      const range = ranges.find((r) => score >= r.min && score <= r.max);
      if (range) range.count++;
    });
    return ranges;
  }, [sessions]);

  const atRiskCount = atRiskStudents.filter((s) => s.isAtRisk).length;

  if (sessions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        <TrendingUp className="w-8 h-8 mx-auto mb-2" />
        <p>Nenhum dado disponível para relatórios ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <CheckCircle className="w-5 h-5 text-level-easy mx-auto mb-1" />
          <p className="font-display text-2xl font-bold text-foreground">{completionData.rate}%</p>
          <p className="text-xs text-muted-foreground">Taxa de Conclusão</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="font-display text-2xl font-bold text-foreground">
            {timePerMaterial.length > 0
              ? (timePerMaterial.reduce((s, t) => s + t.avgMinutes, 0) / timePerMaterial.length).toFixed(1)
              : "0"}
            min
          </p>
          <p className="text-xs text-muted-foreground">Tempo Médio/Material</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <BookOpen className="w-5 h-5 text-accent mx-auto mb-1" />
          <p className="font-display text-2xl font-bold text-foreground">{materials.length}</p>
          <p className="text-xs text-muted-foreground">Materiais</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${atRiskCount > 0 ? "text-destructive" : "text-level-easy"}`} />
          <p className="font-display text-2xl font-bold text-foreground">{atRiskCount}</p>
          <p className="text-xs text-muted-foreground">Alunos em Risco</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Time per Material */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Tempo Médio por Material (min)
          </h3>
          {timePerMaterial.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={timePerMaterial} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }}
                  formatter={(value: number) => [`${value} min`, "Tempo médio"]}
                  labelFormatter={(label) => {
                    const item = timePerMaterial.find((t) => t.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Bar dataKey="avgMinutes" fill="hsl(174, 62%, 38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          )}
        </div>

        {/* Completion Rate Pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-level-easy" /> Taxa de Conclusão
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={completionData.pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(0, 0%, 100%)"
              >
                <Cell fill="hsl(142, 71%, 45%)" />
                <Cell fill="hsl(220, 14%, 91%)" />
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 text-xs text-muted-foreground -mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-level-easy" />
              Concluído ({completionData.completed})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-border" />
              Em andamento ({completionData.inProgress})
            </span>
          </div>
        </div>
      </div>

      {/* Score Distribution */}
      {scoreDistribution.some((r) => r.count > 0) && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> Distribuição de Pontuações
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }} />
              <Bar dataKey="count" name="Alunos" radius={[4, 4, 0, 0]}>
                {scoreDistribution.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* At-Risk Students */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${atRiskCount > 0 ? "text-destructive" : "text-level-easy"}`} />
          Alunos em Risco
        </h3>
        {atRiskCount === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            🎉 Nenhum aluno em risco nesta sala!
          </p>
        ) : (
          <div className="space-y-3">
            {atRiskStudents
              .filter((s) => s.isAtRisk)
              .map((student) => (
                <div key={student.id} className="bg-secondary rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm text-foreground">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${student.completed ? "bg-level-easy/10 text-level-easy" : "bg-destructive/10 text-destructive"}`}>
                      {student.completed ? "Concluído" : "Não concluído"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Materiais vistos</p>
                      <Progress value={student.materialsPercent} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-0.5">{student.materialsPercent}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tempo na plataforma</p>
                      <p className="text-sm font-medium text-foreground">{student.totalMinutes} min</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {student.risks.map((risk, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive">
                        <AlertTriangle className="w-3 h-3" /> {risk}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsReport;
