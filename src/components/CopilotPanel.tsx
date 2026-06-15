import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Bot, Loader2, Send, Sparkles, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface Props {
  roomId: string;
  roomTitle?: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const SUGGESTED = [
  "Quem está em risco nesta sala?",
  "Quais conceitos os alunos mais erram?",
  "Sugira 3 questões objetivas para revisar o material principal.",
  "Escreva um e-mail acolhedor para os alunos que ainda não acessaram.",
];

export default function CopilotPanel({ roomId, roomTitle }: Props) {
  const { toast } = useToast();
  const storageKey = `copilot:${roomId}`;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, storageKey]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const newMsgs: Msg[] = [...messages, { role: "user", content, ts: Date.now() }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("teacher-copilot", {
        body: { roomId, messages: newMsgs.map(m => ({ role: m.role, content: m.content })) },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setMessages(m => [...m, { role: "assistant", content: (data as any).message || "(sem resposta)", ts: Date.now() }]);
    } catch (e: any) {
      toast({ title: "Erro do Copilot", description: e.message, variant: "destructive" });
      setMessages(m => [...m, { role: "assistant", content: `❌ ${e.message}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (!confirm("Limpar toda a conversa com o Copilot desta sala?")) return;
    setMessages([]);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 group inline-flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        title="Copilot Pedagógico"
      >
        <Bot className="w-5 h-5" />
        <span className="font-semibold text-sm hidden sm:inline">Copilot IA</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2 font-display">
              <Bot className="w-5 h-5 text-primary" /> Copilot Pedagógico
              <span className="ml-auto flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={clearChat} title="Limpar conversa" className="h-8 w-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setOpen(false)} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </span>
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              IA com contexto real da sala {roomTitle ? `"${roomTitle}"` : ""}: alunos, notas, atividades, materiais.
            </p>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="text-center py-6">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">Pergunte sobre a turma, gere questões, peça resumos ou ideias de intervenção.</p>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Sugestões</p>
                <div className="grid gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left p-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`${m.role === "user" ? "max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2" : "max-w-full"}`}>
                  {m.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-code:text-primary">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> O Copilot está analisando os dados da sala...
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunte algo sobre a turma..."
              rows={2}
              className="resize-none text-sm"
              disabled={loading}
            />
            <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
