import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Eye, Users, TrendingUp, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts";

interface PageViewRow {
  path: string;
  session_id: string;
  created_at: string;
}

const FUNNEL_STEPS = [
  { path: "/", label: "Landing" },
  { path: "/funcionalidades", label: "Funcionalidades" },
  { path: "/planos", label: "Planos" },
  { path: "/auth", label: "Cadastro/Login" },
];

const COLORS = [
  "hsl(174, 62%, 38%)",
  "hsl(27, 96%, 61%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(220, 70%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 72%, 51%)",
  "hsl(200, 70%, 50%)",
];

export default function VisitorAnalytics() {
  const [views, setViews] = useState<PageViewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchViews = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data, error } = await supabase
      .from("page_views")
      .select("path, session_id, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    if (!error) setViews(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando analytics de visitantes...</p>;

  const totalViews = views.length;
  const uniqueVisitors = new Set(views.map(v => v.session_id)).size;

  // Pages ranking
  const pageCounts: Record<string, number> = {};
  for (const v of views) {
    pageCounts[v.path] = (pageCounts[v.path] || 0) + 1;
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Daily views (last 30 days)
  const dailyMap: Record<string, { views: number; visitors: Set<string> }> = {};
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { views: 0, visitors: new Set() };
  }
  for (const v of views) {
    const key = v.created_at.slice(0, 10);
    if (dailyMap[key]) {
      dailyMap[key].views++;
      dailyMap[key].visitors.add(v.session_id);
    }
  }
  const dailyData = Object.entries(dailyMap).map(([date, d]) => ({
    date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    "Page Views": d.views,
    "Visitantes": d.visitors.size,
  }));

  // Funnel
  const funnelSessions: Record<string, Set<string>> = {};
  for (const step of FUNNEL_STEPS) funnelSessions[step.path] = new Set();
  for (const v of views) {
    if (funnelSessions[v.path]) funnelSessions[v.path].add(v.session_id);
  }
  const funnelData = FUNNEL_STEPS.map((step, i) => {
    const count = funnelSessions[step.path].size;
    const prev = i === 0 ? count : funnelSessions[FUNNEL_STEPS[i - 1].path].size;
    const rate = prev > 0 ? Math.round((count / prev) * 100) : 0;
    return { label: step.label, visitantes: count, rate: i === 0 ? 100 : rate };
  });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Eye className="w-4 h-4" /> Page Views (30d)
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{totalViews}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Users className="w-4 h-4" /> Visitantes Únicos
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{uniqueVisitors}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp className="w-4 h-4" /> Páginas/Visitante
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {uniqueVisitors > 0 ? (totalViews / uniqueVisitors).toFixed(1) : "0"}
          </p>
        </div>
      </div>

      {/* Daily trend */}
      {totalViews > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Visitas por Dia (últimos 30 dias)
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }} />
              <Line type="monotone" dataKey="Page Views" stroke="hsl(174, 62%, 38%)" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="Visitantes" stroke="hsl(27, 96%, 61%)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conversion funnel */}
      {funnelData.some(f => f.visitantes > 0) && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Funil de Conversão
          </h4>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {funnelData.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="text-center">
                  <div
                    className="rounded-xl px-4 py-3 border border-border min-w-[100px]"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${COLORS[i % COLORS.length]} 10%, transparent)`,
                      borderColor: `color-mix(in srgb, ${COLORS[i % COLORS.length]} 30%, transparent)`,
                    }}
                  >
                    <p className="text-xs text-muted-foreground">{step.label}</p>
                    <p className="font-display text-xl font-bold text-foreground">{step.visitantes}</p>
                  </div>
                  {i > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{step.rate}% do anterior</p>
                  )}
                </div>
                {i < funnelData.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top pages */}
      {topPages.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" /> Páginas Mais Visitadas
          </h4>
          <ResponsiveContainer width="100%" height={Math.max(200, topPages.length * 35)}>
            <BarChart data={topPages} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="path" tick={{ fontSize: 10 }} width={160} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,13%,91%)", fontSize: 12 }} />
              <Bar dataKey="count" name="Visualizações" radius={[0, 4, 4, 0]}>
                {topPages.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {totalViews === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">Sem dados ainda</h3>
          <p className="text-muted-foreground text-sm">
            Os dados aparecerão quando visitantes aceitarem cookies analíticos e navegarem pelo site.
          </p>
        </div>
      )}
    </div>
  );
}
