import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Users, Sparkles, ArrowRight, FileText, Brain,
  BarChart3, Shield, MessageSquare, ClipboardCheck, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import FloatingAuth from "@/components/FloatingAuth";

const features = [
  {
    icon: <Brain className="w-5 h-5" />,
    title: "Quizzes gerados por IA",
    desc: "Atividades com múltiplos níveis de dificuldade criadas automaticamente a partir do material.",
  },
  {
    icon: <ClipboardCheck className="w-5 h-5" />,
    title: "Correção com IA",
    desc: "Respostas dissertativas avaliadas por inteligência artificial com feedback detalhado.",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Analytics em tempo real",
    desc: "Acompanhe engajamento, desempenho por questão e identifique alunos em risco.",
  },
  {
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Fórum de Discussão",
    desc: "Espaço para dúvidas e debates integrado a cada sala de aula.",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Peer Review",
    desc: "Avaliação entre pares com critérios personalizáveis pelo professor.",
  },
  {
    icon: <Upload className="w-5 h-5" />,
    title: "Materiais diversos",
    desc: "Suporte a vídeos, artigos, PDFs e links — tudo organizado por sala.",
  },
];

const Index = () => {
  const [pin, setPin] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [step, setStep] = useState<"pin" | "info">("pin");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [roomId, setRoomId] = useState("");

  const handlePinSubmit = async () => {
    if (pin.length < 6) {
      toast({ title: "PIN inválido", description: "Digite o PIN fornecido pelo professor.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("rooms").select("id, expire_at, last_student_activity_at").eq("pin_code", pin.toUpperCase()).maybeSingle();
    setLoading(false);
    if (error || !data) {
      toast({ title: "Sala não encontrada", description: "Verifique o PIN e tente novamente.", variant: "destructive" });
      return;
    }
    const now = new Date();
    const isExpiredByDate = data.expire_at && new Date(data.expire_at) < now;
    const isExpiredByIdle = data.last_student_activity_at && 
      (now.getTime() - new Date(data.last_student_activity_at).getTime()) > 7 * 24 * 60 * 60 * 1000;
    if (isExpiredByDate || isExpiredByIdle) {
      toast({ title: "Sala expirada", description: "Esta sala não está mais ativa. Entre em contato com o professor.", variant: "destructive" });
      return;
    }
    setRoomId(data.id);
    setStep("info");
  };

  const handleInfoSubmit = async () => {
    const trimmedName = studentName.trim();
    const trimmedEmail = studentEmail.trim().toLowerCase();
    
    if (!trimmedName || trimmedName.length < 2) {
      toast({ title: "Nome obrigatório", description: "Digite seu nome (mínimo 2 caracteres).", variant: "destructive" });
      return;
    }
    if (trimmedName.length > 100) {
      toast({ title: "Nome muito longo", description: "O nome deve ter no máximo 100 caracteres.", variant: "destructive" });
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Email inválido", description: "Digite um email válido para continuar.", variant: "destructive" });
      return;
    }
    if (trimmedEmail.length > 255) {
      toast({ title: "Email muito longo", description: "O email deve ter no máximo 255 caracteres.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("student-session", {
        body: {
          action: "create_session",
          roomId,
          data: {
            student_name: trimmedName,
            student_email: trimmedEmail,
          },
        },
      });
      setLoading(false);

      if (error || result?.error) {
        toast({ title: "Erro", description: result?.error || "Não foi possível entrar na sala.", variant: "destructive" });
        return;
      }
      // Store session token for authenticated access
      if (result.token) {
        sessionStorage.setItem(`session_token_${result.sessionId}`, result.token);
      }
      navigate(`/room/${roomId}/student/${result.sessionId}`);
    } catch (e) {
      setLoading(false);
      toast({ title: "Erro", description: "Não foi possível entrar na sala.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">FlipClass</span>
        </div>
        <FloatingAuth />
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-12 md:py-0">
        <div className="max-w-5xl w-full grid md:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Sala de Aula Invertida com IA
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight mb-4">
              Ensine melhor.{" "}
              <span className="text-gradient-primary">Avalie com IA.</span>
            </h1>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Crie salas, envie materiais, gere quizzes inteligentes e acompanhe o desempenho dos alunos em tempo real — tudo em uma plataforma completa para a sala de aula invertida.
            </p>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Acesso com PIN + email
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                Geração e correção por IA
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Analytics avançado
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-elevated)] border border-border">
              <h2 className="font-display text-2xl font-bold text-card-foreground mb-2">
                {step === "pin" ? "Entrar na Sala" : "Seus dados"}
              </h2>
              <p className="text-muted-foreground mb-6 text-sm">
                {step === "pin"
                  ? "Digite o PIN fornecido pelo professor."
                  : "Preencha seus dados para identificar suas respostas."}
              </p>

              {step === "pin" ? (
                <div className="space-y-4">
                  <Input
                    placeholder="ABCD1234"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase())}
                    className="text-center text-3xl tracking-[0.3em] font-display font-bold h-16 bg-secondary border-none"
                    maxLength={8}
                    onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                  />
                  <Button
                    className="w-full h-12 text-base font-semibold"
                    onClick={handlePinSubmit}
                    disabled={loading || pin.length < 6}
                  >
                    Entrar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    placeholder="Seu nome completo"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="h-14 text-lg bg-secondary border-none"
                    autoFocus
                  />
                  <Input
                    placeholder="Seu email"
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="h-14 text-lg bg-secondary border-none"
                    onKeyDown={(e) => e.key === "Enter" && handleInfoSubmit()}
                  />
                  <Button
                    className="w-full h-12 text-base font-semibold"
                    onClick={handleInfoSubmit}
                    disabled={loading || !studentName.trim() || !studentEmail.trim()}
                  >
                    Começar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <button
                    onClick={() => setStep("pin")}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Voltar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-card border-t border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
              Tudo o que você precisa para a sala invertida
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Recursos pensados para professores que querem mais engajamento e menos trabalho operacional.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-background rounded-xl border border-border p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {f.icon}
                </div>
                <h3 className="font-display font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Teacher CTA */}
      <section className="py-16 px-6 border-t border-border bg-background">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
            É professor? Comece gratuitamente
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
            Crie sua primeira sala, envie materiais e gere atividades com IA. Planos a partir de R$ 0 com upgrade flexível.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="font-semibold" onClick={() => navigate("/auth")}>
              Criar Conta Grátis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" onClick={() => navigate("/pricing")}>
              Ver Planos
            </Button>
          </div>
        </div>
      </section>

      <footer className="py-6 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Todos os direitos reservados.</span>
          <span>Desenvolvido por <strong className="text-foreground">Sérgio Araújo</strong> e <strong className="text-foreground">Posologia Produções</strong></span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
