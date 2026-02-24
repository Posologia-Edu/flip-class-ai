import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Mail } from "lucide-react";
import { motion } from "framer-motion";

const PendingApproval = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <motion.div
          className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Clock className="w-8 h-8 text-accent" />
        </motion.div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-3">
          Cadastro em Análise
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Seu cadastro foi recebido e está aguardando aprovação do administrador.
          Você receberá um email quando sua conta for aprovada.
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          O processo de aprovação leva até <strong className="text-foreground">24 horas úteis</strong>.
          Caso precise de ajuda, entre em contato com o administrador:
        </p>
        <a
          href="mailto:admin@flipclass.com.br"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-8"
        >
          <Mail className="w-4 h-4" /> admin@flipclass.com.br
        </a>
        <div className="block">
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
