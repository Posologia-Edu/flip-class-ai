import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Highlight {
  question: string;
  answer: string;
  material: string;
}

interface Props {
  roomId: string;
}

export default function HighlightsPanel({ roomId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("room_highlights")
      .select("highlights")
      .eq("room_id", roomId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setHighlights((data.highlights as unknown as Highlight[]) || []);
      });
    return () => { cancelled = true; };
  }, [roomId]);

  const generate = async () => {
    if (highlights.length > 0 && !window.confirm("Gerar novamente vai substituir os highlights atuais. Continuar?")) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-highlights", { body: { roomId } });
      if (error) {
        let msg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* keep default */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setHighlights(data.highlights || []);
      setRevealed(new Set());
      setCollapsed(false);
      if (data.skipped?.length) {
        toast({
          title: "Alguns materiais ficaram de fora",
          description: `Sem texto para a IA: ${data.skipped.join(", ")}`,
        });
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar highlights", description: e.message || "Tente novamente.", variant: "destructive" });
    }
    setLoading(false);
  };

  const toggle = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  const allRevealed = highlights.length > 0 && revealed.size === highlights.length;

  return (
    <section className="bg-card rounded-xl border border-border p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Highlights para a aula
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {highlights.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setRevealed(allRevealed ? new Set() : new Set(highlights.map((_, i) => i)))}>
                {allRevealed ? <><EyeOff className="w-4 h-4 mr-1" /> Ocultar respostas</> : <><Eye className="w-4 h-4 mr-1" /> Revelar todas</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expandir" : "Recolher"}>
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
            </>
          )}
          <Button size="sm" variant={highlights.length ? "outline" : "default"} onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : highlights.length ? <RefreshCw className="w-4 h-4 mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {loading ? "Lendo materiais..." : highlights.length ? "Gerar novamente" : "Gerar highlights"}
          </Button>
        </div>
      </div>

      {highlights.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-2">
          A IA lê os materiais da sala e cria cards de pergunta e resposta com os pontos principais, para você checar o que os alunos estudaram antes da atividade.
        </p>
      ) : !collapsed && (
        <>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Faça cada pergunta para a turma e, depois que responderem, clique no card para revelar a resposta.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {highlights.map((h, i) => {
              const isRevealed = revealed.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={isRevealed}
                  className={`text-left rounded-xl border p-4 transition-colors flex flex-col gap-2 ${
                    isRevealed ? "bg-primary/5 border-primary/40" : "bg-background border-border hover:border-primary/40"
                  }`}
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {i + 1}{h.material ? ` · ${h.material}` : ""}
                  </span>
                  <span className="font-medium text-card-foreground">{h.question}</span>
                  {isRevealed ? (
                    <span className="text-sm text-foreground border-t border-border pt-2">{h.answer}</span>
                  ) : (
                    <span className="text-xs text-primary inline-flex items-center gap-1 mt-auto">
                      <Eye className="w-3 h-3" /> Clique para revelar a resposta
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
