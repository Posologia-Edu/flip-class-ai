import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Users, Sparkles, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import FloatingAuth from "@/components/FloatingAuth";

const Index = () => {
  const [pin, setPin] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [step, setStep] = useState<"pin" | "info">("pin");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePinSubmit = async () => {
    if (pin.length !== 6) {
      toast({ title: "PIN inválido", description: "O PIN deve ter 6 dígitos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("rooms").select("id").eq("pin_code", pin).maybeSingle();
    setLoading(false);
    if (error || !data) {
      toast({ title: "Sala não encontrada", description: "Verifique o PIN e tente novamente.", variant: "destructive" });
      return;
    }
    setStep("info");
  };

  const handleInfoSubmit = async () => {
    if (!studentName.trim()) {
      toast({ title: "Nome obrigatório", description: "Digite seu nome para continuar.", variant: "destructive" });
      return;
    }
    if (!studentEmail.trim() || !studentEmail.includes("@")) {
      toast({ title: "Email obrigatório", description: "Digite um email válido para continuar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data: room } = await supabase.from("rooms").select("id").eq("pin_code", pin).maybeSingle();
    if (!room) { setLoading(false); return; }

    const { data: session, error } = await supabase.from("student_sessions").insert({
      room_id: room.id,
      student_name: studentName.trim(),
      student_email: studentEmail.trim().toLowerCase(),
    }).select("id").single();
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível entrar na sala.", variant: "destructive" });
      return;
    }
    navigate(`/room/${room.id}/student/${session.id}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">FlipClass</span>
        </div>
        <FloatingAuth />
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-5xl w-full grid md:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Sala de Aula Invertida com IA
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight mb-4">
              Aprenda no seu ritmo, prove seu{" "}
              <span className="text-gradient-primary">conhecimento</span>
            </h1>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Estude os materiais primeiro, depois enfrente atividades geradas por IA que escalam em complexidade. Entre com o PIN da sua sala para começar.
            </p>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Sem cadastro necessário
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                Quiz gerado por IA
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
                  ? "Digite o PIN de 6 dígitos fornecido pelo professor."
                  : "Preencha seus dados para identificar suas respostas."}
              </p>

              {step === "pin" ? (
                <div className="space-y-4">
                  <Input
                    placeholder="000000"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-3xl tracking-[0.5em] font-display font-bold h-16 bg-secondary border-none"
                    maxLength={6}
                    onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                  />
                  <Button
                    className="w-full h-12 text-base font-semibold"
                    onClick={handlePinSubmit}
                    disabled={loading || pin.length !== 6}
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
      </main>

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
