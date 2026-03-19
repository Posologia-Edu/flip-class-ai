import { useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertTriangle, Clock, BookOpen, Users, TrendingUp, CheckCircle, Download, FileText, UserX, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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

interface EnrolledStudent {
  student_email: string;
  student_name: string | null;
}

interface AnalyticsReportProps {
  sessions: Session[];
  activityLogs: ActivityLog[];
  materials: Material[];
  showExport?: boolean;
  roomTitle?: string;
  enrolledStudents?: EnrolledStudent[];
  activitiesLocked?: boolean;
}

const CHART_COLORS = [
  "hsl(174, 62%, 38%)",
  "hsl(27, 96%, 61%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(220, 70%, 55%)",
  "hsl(280, 60%, 55%)",
];

const AnalyticsReport = ({ sessions, activityLogs, materials, showExport = false, roomTitle = "Sala", enrolledStudents = [], activitiesLocked = false }: AnalyticsReportProps) => {
  // --- Average time per material ---
  const timePerMaterial = useMemo(() => {
    const logsBySession = new Map<string, ActivityLog[]>();

    for (const log of activityLogs) {
      const bucket = logsBySession.get(log.session_id) || [];
      bucket.push(log);
      logsBySession.set(log.session_id, bucket);
    }

    const totalsByMaterial = new Map<string, { totalSeconds: number; sessionIds: Set<string> }>();

    materials.forEach((material) => {
      totalsByMaterial.set(material.id, { totalSeconds: 0, sessionIds: new Set<string>() });
    });

    logsBySession.forEach((sessionLogs, sessionId) => {
      const orderedLogs = [...sessionLogs].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      let lastMaterialId: string | null = null;

      for (const log of orderedLogs) {
        if (log.material_id) {
          lastMaterialId = log.material_id;
        }

        if (log.activity_type !== "page_active") {
          continue;
        }

        const attributedMaterialId = log.material_id || lastMaterialId;
        if (!attributedMaterialId || !totalsByMaterial.has(attributedMaterialId)) {
          continue;
        }

        const materialStats = totalsByMaterial.get(attributedMaterialId)!;
        materialStats.totalSeconds += log.duration_seconds || 0;
        materialStats.sessionIds.add(sessionId);
      }
    });

    return materials.map((mat) => {
      const stats = totalsByMaterial.get(mat.id) || { totalSeconds: 0, sessionIds: new Set<string>() };
      const uniqueSessions = stats.sessionIds.size;
      const avgSeconds = uniqueSessions > 0 ? Math.round(stats.totalSeconds / uniqueSessions) : 0;

      return {
        name: mat.title?.substring(0, 20) || "Sem título",
        fullName: mat.title || "Sem título",
        avgMinutes: +(avgSeconds / 60).toFixed(1),
        totalViews: uniqueSessions,
      };
    });
  }, [materials, activityLogs]);

  // --- Accesses per material (unique sessions that opened/viewed each material) ---
  const accessesPerMaterial = useMemo(() => {
    return materials.map((mat) => {
      const sessionIds = new Set<string>();
      let markedViewed = 0;

      for (const log of activityLogs) {
        if (log.material_id !== mat.id) continue;
        if (["material_open", "material_access", "material_view", "page_active"].includes(log.activity_type)) {
          sessionIds.add(log.session_id);
        }
        if (log.activity_type === "material_view") {
          markedViewed++;
        }
      }

      return {
        name: mat.title?.substring(0, 20) || "Sem título",
        fullName: mat.title || "Sem título",
        acessos: sessionIds.size,
        marcadosVisto: markedViewed,
      };
    });
  }, [materials, activityLogs]);

  // Build a unified list of all students (enrolled + sessions)
  const allStudents = useMemo(() => {
    const map = new Map<string, { email: string; name: string; session: Session | null }>();

    // Add enrolled students first
    for (const es of enrolledStudents) {
      const key = es.student_email.toLowerCase();
      map.set(key, { email: es.student_email, name: es.student_name || es.student_email, session: null });
    }

    // Overlay with session data
    for (const s of sessions) {
      const email = (s.student_email || "").toLowerCase();
      const key = email || s.id; // fallback to session id if no email
      const existing = email ? map.get(email) : undefined;
      map.set(key, {
        email: s.student_email || "—",
        name: s.student_name || existing?.name || "—",
        session: s,
      });
    }

    return Array.from(map.values());
  }, [sessions, enrolledStudents]);

  const totalStudentCount = allStudents.length;

  // --- Completion rate (based on all students) ---
  const completionData = useMemo(() => {
    const completed = allStudents.filter((s) => s.session?.completed_at).length;
    const inProgress = totalStudentCount - completed;
    return {
      completed,
      inProgress,
      rate: totalStudentCount > 0 ? Math.round((completed / totalStudentCount) * 100) : 0,
      pieData: [
        { name: "Concluído", value: completed },
        { name: "Em andamento / Não acessou", value: inProgress },
      ],
    };
  }, [allStudents, totalStudentCount]);

  // --- At-risk students ---
  const studentAnalysis = useMemo(() => {
    return allStudents
      .map((student) => {
        const session = student.session;
        const hasAccessed = !!session;

        if (!hasAccessed) {
          return {
            id: student.email,
            name: student.name,
            email: student.email,
            materialsPercent: 0,
            completed: false,
            totalMinutes: 0,
            risks: ["Nunca acessou a sala"],
            isAtRisk: true,
            hasAccessed: false,
          };
        }

        const sessionLogs = activityLogs.filter((l) => l.session_id === session.id);
        const viewedMaterials = new Set(
          sessionLogs
            .filter((l) => ["material_view", "material_access"].includes(l.activity_type) && l.material_id)
            .map((l) => l.material_id)
        );
        const totalTime = sessionLogs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
        const materialsViewedCount = viewedMaterials.size;
        const materialsPercent = materials.length > 0 ? Math.round((materialsViewedCount / materials.length) * 100) : 0;

        const risks: string[] = [];
        if (materialsPercent < 50) risks.push("Menos de 50% dos materiais vistos");
        // Only flag incomplete activity if activities are NOT locked
        if (!session.completed_at && !activitiesLocked) risks.push("Atividade não concluída");
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
          hasAccessed: true,
        };
      })
      .sort((a, b) => b.risks.length - a.risks.length);
  }, [allStudents, activityLogs, materials, activitiesLocked]);

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

  const atRiskStudents = studentAnalysis.filter((s) => s.isAtRisk);
  const notAtRiskStudents = studentAnalysis.filter((s) => !s.isAtRisk);
  const atRiskCount = atRiskStudents.length;

  const exportCSV = useCallback(() => {
    const headers = ["Nome", "Email", "Acessou", "Concluído", "Nota", "Tempo (min)", "Materiais Vistos (%)", "Em Risco", "Riscos"];
    const rows = studentAnalysis.map((s) => [
      s.name, s.email, s.hasAccessed ? "Sim" : "Não", s.completed ? "Sim" : "Não",
      s.hasAccessed ? (sessions.find(ss => ss.id === s.id)?.score ?? "—") : "—",
      s.totalMinutes, s.materialsPercent, s.isAtRisk ? "Sim" : "Não",
      s.risks.join("; ")
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${roomTitle.replace(/\s+/g, "-")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [studentAnalysis, sessions, roomTitle]);

  const exportPDF = useCallback(() => {
    window.print();
  }, []);

  if (totalStudentCount === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        <TrendingUp className="w-8 h-8 mx-auto mb-2" />
        <p>Nenhum dado disponível para relatórios ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4" id="analytics-report-print">
      {/* Export Buttons */}
      {showExport && (
        <div className="flex gap-2 justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileText className="w-4 h-4 mr-1" /> Exportar PDF
          </Button>
        </div>
      )}

      {/* Activities locked notice */}
      {activitiesLocked && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-2 text-sm text-primary">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>As atividades desta sala ainda estão bloqueadas. O status de conclusão não é considerado como risco.</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="font-display text-2xl font-bold text-foreground">{totalStudentCount}</p>
          <p className="text-xs text-muted-foreground">Alunos Cadastrados</p>
        </div>
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

        {/* Accesses per Material */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" /> Acessos por Material
          </h3>
          {accessesPerMaterial.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={accessesPerMaterial} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === "acessos" ? "Alunos que acessaram" : "Marcados como visto",
                  ]}
                  labelFormatter={(label) => {
                    const item = accessesPerMaterial.find((t) => t.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Bar dataKey="acessos" name="acessos" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="marcadosVisto" name="marcadosVisto" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          )}
        </div>

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
              Pendente ({completionData.inProgress})
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

      {/* Students NOT at risk */}
      {notAtRiskStudents.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-level-easy" />
            Alunos sem Risco ({notAtRiskStudents.length})
          </h3>
          <div className="space-y-2">
            {notAtRiskStudents.map((student) => (
              <div key={student.id} className="bg-secondary rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-foreground">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.email}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Materiais: {student.materialsPercent}%</span>
                  <span>{student.totalMinutes} min</span>
                  <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-level-easy/10 text-level-easy">
                    {student.completed ? "Concluído" : "Em andamento"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-Risk Students */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${atRiskCount > 0 ? "text-destructive" : "text-level-easy"}`} />
          Alunos em Risco ({atRiskCount})
        </h3>
        {atRiskCount === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            🎉 Nenhum aluno em risco nesta sala!
          </p>
        ) : (
          <div className="space-y-3">
            {atRiskStudents.map((student) => (
              <div key={student.id} className="bg-secondary rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm text-foreground">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    !student.hasAccessed
                      ? "bg-muted text-muted-foreground"
                      : student.completed
                        ? "bg-level-easy/10 text-level-easy"
                        : "bg-destructive/10 text-destructive"
                  }`}>
                    {!student.hasAccessed ? "Não acessou" : student.completed ? "Concluído" : "Não concluído"}
                  </span>
                </div>
                {student.hasAccessed && (
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
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {student.risks.map((risk, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive">
                      {!student.hasAccessed ? <UserX className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {risk}
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
