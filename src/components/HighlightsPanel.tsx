import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, Sparkles, RefreshCw } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

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
      const list: Highlight[] = data.highlights || [];
      setHighlights(list);
      setRevealed(new Set());
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
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="w-4 h-4 mr-1" /> Highlights
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Highlights dos materiais</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Faça cada pergunta para a turma e, depois que responderem, clique no card para revelar a resposta.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : highlights.length ? <RefreshCw className="w-4 h-4 mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
              {loading ? "Lendo materiais..." : highlights.length ? "Gerar novamente" : "Gerar highlights"}
            </Button>
            {highlights.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRevealed(allRevealed ? new Set() : new Set(highlights.map((_, i) => i)))}
              >
                {allRevealed ? <><EyeOff className="w-4 h-4 mr-1" /> Ocultar respostas</> : <><Eye className="w-4 h-4 mr-1" /> Revelar todas</>}
              </Button>
            )}
          </div>

          {highlights.length > 0 && (
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
                      isRevealed ? "bg-primary/5 border-primary/40" : "bg-card border-border hover:border-primary/40"
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
