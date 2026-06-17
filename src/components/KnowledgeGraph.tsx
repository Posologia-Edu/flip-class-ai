import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Network, Loader2, RefreshCw, Sparkles, AlertTriangle, BookOpen, HelpCircle, Brain } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface KnowledgeGraphProps {
  roomId: string;
  studentEmail?: string;
  isOwner?: boolean;
}

interface Node {
  id: string;
  label: string;
  kind: "material" | "topic" | "question" | "concept";
  summary?: string | null;
  ref_meta?: any;
}
interface Edge { source_id: string; target_id: string; weight: number; kind: string; }

interface Pos { x: number; y: number; vx: number; vy: number; }

const WIDTH = 800;
const HEIGHT = 560;

function colorFor(kind: string, mastery?: number) {
  if (kind === "topic" || kind === "question") {
    if (mastery == null) return "#94a3b8"; // slate-400 neutral
    if (mastery >= 0.7) return "#22c55e"; // green
    if (mastery >= 0.4) return "#f59e0b"; // amber
    return "#ef4444"; // red
  }
  if (kind === "material") return "#6366f1"; // indigo
  return "#94a3b8";
}

export default function KnowledgeGraph({ roomId, studentEmail, isOwner }: KnowledgeGraphProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [gaps, setGaps] = useState<any[]>([]);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [selected, setSelected] = useState<Node | null>(null);
  const [microContent, setMicroContent] = useState<string>("");
  const [microLoading, setMicroLoading] = useState(false);
  const [filterKind, setFilterKind] = useState<"all" | "topic" | "material" | "question">("all");
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number | null>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("knowledge-graph", {
      body: { roomId, studentEmail },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setNodes(data?.nodes || []);
    setEdges(data?.edges || []);
    setMastery(data?.mastery || {});
    setGaps(data?.gaps || []);
    setLoading(false);
  }, [roomId, studentEmail, toast]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // Simple force-directed layout
  useEffect(() => {
    if (!nodes.length) return;
    const pos: Record<string, Pos> = {};
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const r = Math.min(WIDTH, HEIGHT) / 3;
      pos[n.id] = {
        x: WIDTH / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
        y: HEIGHT / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
      };
    });

    let iter = 0;
    const maxIter = 250;
    const step = () => {
      iter++;
      const k = 90; // ideal spring length
      // Repulsion
      const ids = Object.keys(pos);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos[ids[i]], b = pos[ids[j]];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = 4000 / d2;
          const fx = (dx / Math.sqrt(d2)) * f;
          const fy = (dy / Math.sqrt(d2)) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      // Attraction along edges
      for (const e of edges) {
        const a = pos[e.source_id], b = pos[e.target_id];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = ((d - k) / d) * 0.08 * (0.5 + (e.weight || 0.5));
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
      // Damping + apply
      for (const id of ids) {
        const p = pos[id];
        p.vx *= 0.78; p.vy *= 0.78;
        p.x += p.vx; p.y += p.vy;
        // Center gravity
        p.x += (WIDTH / 2 - p.x) * 0.005;
        p.y += (HEIGHT / 2 - p.y) * 0.005;
        // Bounds
        p.x = Math.max(30, Math.min(WIDTH - 30, p.x));
        p.y = Math.max(30, Math.min(HEIGHT - 30, p.y));
      }
      if (iter < maxIter) animRef.current = requestAnimationFrame(step);
      setPositions({ ...pos });
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [nodes, edges]);

  const buildGraph = async () => {
    setBuilding(true);
    const { data, error } = await supabase.functions.invoke("knowledge-graph-build", {
      body: { roomId },
    });
    setBuilding(false);
    if (error || data?.error) {
      toast({ title: "Erro ao gerar grafo", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Grafo gerado!", description: `${data.topics} tópicos, ${data.edges} conexões.` });
    fetchGraph();
  };

  const openNode = async (n: Node) => {
    setSelected(n);
    setMicroContent("");
    setMicroLoading(true);
    const { data, error } = await supabase.functions.invoke("knowledge-graph-micro", {
      body: { nodeId: n.id },
    });
    setMicroLoading(false);
    if (error || data?.error) {
      setMicroContent(`Erro ao gerar conteúdo: ${error?.message || data?.error}`);
      return;
    }
    setMicroContent(data?.content || "");
  };

  const visibleNodes = nodes.filter((n) => filterKind === "all" || n.kind === filterKind);
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleIds.has(e.source_id) && visibleIds.has(e.target_id));

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" /> Rede de Conhecimento da Disciplina
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Verde = domínio · Âmbar = parcial · Vermelho = fraco · Cinza = sem dados ainda
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchGraph} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          {isOwner && (
            <Button size="sm" onClick={buildGraph} disabled={building}>
              {building ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              {nodes.length ? "Regerar grafo" : "Gerar grafo (IA)"}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {([
          { k: "all", label: "Todos", icon: Network },
          { k: "topic", label: "Tópicos", icon: Brain },
          { k: "material", label: "Materiais", icon: BookOpen },
          { k: "question", label: "Questões", icon: HelpCircle },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setFilterKind(k as any)}
            className={`px-3 py-1 text-xs rounded-full inline-flex items-center gap-1 border ${
              filterKind === k ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:bg-secondary/80"
            }`}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando rede (pode levar até 1 min na primeira vez)...
        </div>
      ) : nodes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Network className="w-8 h-8 mx-auto mb-2" />
          <p>Nenhum grafo construído ainda.</p>
          <p className="text-xs mt-1">A rede precisa de materiais e questões na sala. Clique em "Atualizar" para tentar gerar novamente.</p>
        </div>
      ) : (
        <div className="bg-secondary rounded-lg overflow-hidden border border-border">
          <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ maxHeight: 600 }}>
            {visibleEdges.map((e, i) => {
              const a = positions[e.source_id]; const b = positions[e.target_id];
              if (!a || !b) return null;
              return (
                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="hsl(var(--border))" strokeOpacity={0.4 + (e.weight || 0.5) * 0.4}
                  strokeWidth={1 + (e.weight || 0.5)} />
              );
            })}
            {visibleNodes.map((n) => {
              const p = positions[n.id]; if (!p) return null;
              const m = mastery[n.id];
              const fill = colorFor(n.kind, m);
              const r = n.kind === "topic" ? 18 : n.kind === "material" ? 12 : 8;
              return (
                <g key={n.id} transform={`translate(${p.x}, ${p.y})`} className="cursor-pointer" onClick={() => openNode(n)}>
                  <circle r={r} fill={fill} stroke="white" strokeWidth={2} className="hover:opacity-80" />
                  <text y={r + 12} textAnchor="middle" fontSize={10} fill="hsl(var(--foreground))" style={{ pointerEvents: "none" }}>
                    {n.label.length > 24 ? n.label.slice(0, 22) + "…" : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {isOwner && gaps.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 bg-destructive/5 border border-destructive/20 rounded-lg p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="w-4 h-4" /> Lacunas estruturais detectadas
          </h3>
          <ul className="space-y-1 text-sm">
            {gaps.slice(0, 8).map((g: any) => (
              <li key={g.node_id} className="flex justify-between">
                <span>{g.label}</span>
                <span className="text-muted-foreground text-xs">domínio médio {(g.mastery * 100).toFixed(0)}% · {g.sample_size} amostras</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> {selected?.label}
            </DialogTitle>
          </DialogHeader>
          {selected?.summary && (
            <p className="text-sm text-muted-foreground italic">{selected.summary}</p>
          )}
          {microLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Gerando micro-conteúdo...
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none mt-2">
              <ReactMarkdown>{microContent}</ReactMarkdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
