import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Lock } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY or SIGNED_IN event from the magic link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Also check if we already have a session (user clicked the link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({ title: "Erro ao definir senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha definida com sucesso!" });
      navigate("/dashboard");
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Verificando link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Defina sua senha
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crie uma senha para acessar sua conta no FlipClass
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-8 shadow-[var(--shadow-elevated)] border border-border space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
            {loading ? "Salvando..." : "Definir Senha"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
