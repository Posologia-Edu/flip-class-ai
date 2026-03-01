import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { PLANS } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Lock, Crown, Loader2, Gift, ArrowRight, AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function MyAccount() {
  const { user, fullName } = useAuth();
  const { effectivePlan, isAdminGranted, subscriptionEnd, loading: gateLoading } = useFeatureGate();
  const { toast } = useToast();
  const navigate = useNavigate();

  const plan = PLANS[effectivePlan];

  const [newName, setNewName] = useState(fullName || "");
  useEffect(() => { if (fullName) setNewName(fullName); }, [fullName]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSavingName(true);
    const { error: authError } = await supabase.auth.updateUser({ data: { full_name: newName.trim() } });
    if (!authError && user) {
      await supabase.from("profiles").update({ full_name: newName.trim() }).eq("user_id", user.id);
    }
    if (authError) { toast({ title: "Erro ao atualizar nome", description: authError.message, variant: "destructive" }); }
    else { toast({ title: "Nome atualizado com sucesso!" }); }
    setSavingName(false);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) { toast({ title: "Erro ao atualizar email", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Email de confirmação enviado", description: "Verifique sua nova caixa de entrada." }); setNewEmail(""); }
    setSavingEmail(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast({ title: "As senhas não coincidem", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" }); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast({ title: "Erro ao atualizar senha", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Senha atualizada com sucesso!" }); setNewPassword(""); setConfirmPassword(""); }
    setSavingPassword(false);
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast({ title: "Erro ao abrir portal de assinatura", variant: "destructive" });
    }
  };

  const subscribed = effectivePlan !== "free" && !isAdminGranted;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Minha Conta</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas informações pessoais e assinatura</p>
      </div>

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-primary" />
            Plano Ativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gateLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold">{plan.name}</span>
                  {plan.price > 0 && !isAdminGranted && (
                    <span className="text-muted-foreground ml-2">
                      R$ {plan.price.toFixed(2).replace(".", ",")}/mês
                    </span>
                  )}
                  {isAdminGranted ? (
                    <Badge variant="default" className="ml-3 bg-primary/90">
                      <Gift className="w-3 h-3 mr-1" /> Concedido pelo Administrador
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-3">
                      {subscribed ? "Ativo" : "Gratuito"}
                    </Badge>
                  )}
                </div>
              </div>

              {subscriptionEnd && !isAdminGranted && (
                <p className="text-sm text-muted-foreground">
                  Renovação em: {new Date(subscriptionEnd).toLocaleDateString("pt-BR")}
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>
                  <ArrowRight className="w-4 h-4 mr-1" /> {subscribed ? "Alterar Plano" : "Ver Planos"}
                </Button>
                {subscribed && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                        <AlertTriangle className="w-4 h-4 mr-1" /> Cancelar Assinatura
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Você será redirecionado para o portal de pagamento onde poderá cancelar sua assinatura. 
                          O acesso premium continuará ativo até o final do período atual.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleManageSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Ir para Portal
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {subscribed && (
                  <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                    Gerenciar Pagamento
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5 text-primary" /> Nome</CardTitle>
          <CardDescription>Como você será identificado no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateName} className="flex gap-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Seu nome completo" className="flex-1" />
            <Button type="submit" disabled={savingName || !newName.trim()}>
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Mail className="h-5 w-5 text-primary" /> Email</CardTitle>
          <CardDescription>Email atual: <strong>{user?.email}</strong></CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateEmail} className="flex gap-3">
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Novo email" className="flex-1" />
            <Button type="submit" disabled={savingEmail || !newEmail.trim()}>
              {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Alterar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Lock className="h-5 w-5 text-primary" /> Senha</CardTitle>
          <CardDescription>Altere sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha" minLength={6} required />
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar nova senha" minLength={6} required />
            <Button type="submit" disabled={savingPassword || !newPassword}>
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
