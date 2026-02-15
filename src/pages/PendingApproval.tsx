import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

const PendingApproval = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-accent" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-3">
          Cadastro em Análise
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Seu cadastro foi recebido e está aguardando aprovação do administrador.
          Você receberá um email quando sua conta for aprovada.
        </p>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );
};

export default PendingApproval;
