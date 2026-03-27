import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, BookOpen, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface StudyAssistantProps {
  roomId: string;
  sessionId: string;
}

const QUICK_ACTIONS = [
  { label: "Resuma o material", icon: FileText, prompt: "Faça um resumo completo dos materiais desta sala de aula." },
  { label: "Explique os conceitos", icon: BookOpen, prompt: "Explique os principais conceitos abordados nos materiais desta sala." },
  { label: "Gere exercícios", icon: Sparkles, prompt: "Gere exercícios práticos com base nos materiais desta sala para eu praticar." },
];

export default function StudyAssistant({ roomId, sessionId }: StudyAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("study-assistant", {
        body: {
          room_id: roomId,
          session_id: sessionId,
          message: text.trim(),
          conversation_history: updatedMessages.slice(-10), // Last 10 messages for context
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data?.response || "Desculpe, não consegui gerar uma resposta.",
      };
      setMessages([...updatedMessages, assistantMessage]);
    } catch (err: any) {
      console.error("Study assistant error:", err);
      const errorMsg = err?.message?.includes("RATE_LIMIT")
        ? "Limite de requisições atingido. Aguarde um momento."
        : err?.message?.includes("USAGE_LIMIT")
        ? "Limite de interações com o assistente atingido neste mês."
        : "Erro ao comunicar com o assistente. Tente novamente.";
      toast({ title: "Erro", description: errorMsg, variant: "destructive" });
      setMessages(updatedMessages); // Remove loading state but keep user msg
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] max-h-[600px]">
      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold mb-2">Assistente de Estudo IA</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Tire dúvidas sobre os materiais, peça resumos ou gere exercícios práticos.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(action.prompt)}
                  className="gap-2"
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border pt-4 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre os materiais..."
          rows={1}
          className="resize-none min-h-[40px] max-h-[100px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
        />
        <Button
          size="icon"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
