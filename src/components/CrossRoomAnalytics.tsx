import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Users, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface RoomComparisonData {
  roomId: string;
  title: string;
  studentCount: number;
  completedCount: number;
  avgScore: number;
  completionRate: number;
}

interface CrossRoomAnalyticsProps {
  data: RoomComparisonData[];
}

const COLORS = [
  "hsl(174, 62%, 38%)",
  "hsl(27, 96%, 61%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(220, 70%, 55%)",
  "hsl(280, 60%, 55%)",
];

const CrossRoomAnalytics = ({ data }: CrossRoomAnalyticsProps) => {
  const chartData = useMemo(
    () =>
      data.map((r) => ({
        name: r.title.length > 15 ? r.title.substring(0, 15) + "…" : r.title,
        fullName: r.title,
        alunos: r.studentCount,
        concluidos: r.completedCount,
        media: r.avgScore,
        taxa: r.completionRate,
      })),
    [data]
  );

  const lowCompletionRooms = data.filter((r) => r.studentCount > 0 && r.completionRate < 50);

  if (data.length < 2) return null;

  return (
    <div className="space-y-6 mb-8">
      <h2 className="font-display text-xl font-semibold flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Comparação entre Salas
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Completion rate comparison */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-level-easy" /> Taxa de Conclusão por Sala (%)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }}
                labelFormatter={(label) => chartData.find((c) => c.name === label)?.fullName || label}
              />
              <Bar dataKey="taxa" name="Conclusão %" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average score comparison */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> Média de Pontuação por Sala
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }}
                labelFormatter={(label) => chartData.find((c) => c.name === label)?.fullName || label}
              />
              <Bar dataKey="media" name="Média" fill="hsl(27, 96%, 61%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Low completion warning */}
      {lowCompletionRooms.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
          <h3 className="font-display text-sm font-semibold mb-2 flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" /> Salas com baixa conclusão (&lt;50%)
          </h3>
          <div className="space-y-2">
            {lowCompletionRooms.map((r) => (
              <div key={r.roomId} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{r.title}</span>
                <span className="text-muted-foreground">
                  {r.completionRate}% ({r.completedCount}/{r.studentCount} alunos)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossRoomAnalytics;
