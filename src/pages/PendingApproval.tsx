import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Mail, ShieldX } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";

const PendingApproval = () => {
  const navigate = useNavigate();
  const { user, loading, isApproved, approvalStatus } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    if (!loading && user && isApproved) {
      navigate("/dashboard");
    }
  }, [loading, user, isApproved, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isRejected = approvalStatus === "rejected";

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <motion.div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
            isRejected ? "bg-destructive/10" : "bg-accent/10"
          }`}
          animate={isRejected ? {} : { scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {isRejected ? (
            <ShieldX className="w-8 h-8 text-destructive" />
          ) : (
            <Clock className="w-8 h-8 text-accent" />
          )}
        </motion.div>

        {isRejected ? (
          <>
            <h1 className="font-display text-2xl font-bold text-foreground mb-3">
              Acesso Negado
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Seu cadastro foi analisado e <strong className="text-destructive">não foi aprovado</strong> pelo administrador.
            </p>
            <p className="text-muted-foreground text-sm mb-8">
              Se você acredita que isso foi um engano, entre em contato com o administrador:
            </p>
          </>
        ) : (
          <>
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
          </>
        )}

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
