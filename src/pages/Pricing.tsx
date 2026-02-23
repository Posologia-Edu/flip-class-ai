import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Building2, GraduationCap, ArrowLeft, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, type PlanKey } from "@/lib/subscription";
import { toast } from "@/hooks/use-toast";

const planFeatures: Record<PlanKey, string[]> = {
  free: [
    "1 sala ativa",
    "Até 30 alunos por sala",
    "3 gerações de quiz por IA/mês",
    "5 correções por IA/mês",
    "Links e vídeos do YouTube",
    "Fórum básico",
  ],
  professor: [
    "5 salas ativas",
    "Até 60 alunos por sala",
    "30 gerações de quiz por IA/mês",
    "100 correções por IA/mês",
    "Upload de arquivos (PDF, DOCX, PPTX)",
    "Analytics completo",
    "Revisão por pares",
    "Banco de questões pessoal",
    "Calendário de salas",
    "Suporte por email",
  ],
  institutional: [
    "Salas ilimitadas",
    "Alunos ilimitados",
    "IA ilimitada (gerações e correções)",
    "Todos os tipos de material",
    "Analytics cruzado entre salas",
    "Exportação de relatórios",
    "Painel multi-professores",
    "White-label básico",
    "Suporte prioritário",
  ],
};

const planIcons: Record<PlanKey, React.ReactNode> = {
  free: <GraduationCap className="h-6 w-6" />,
  professor: <Sparkles className="h-6 w-6" />,
  institutional: <Building2 className="h-6 w-6" />,
};

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { planKey: currentPlan, loading: subLoading } = useSubscription(user?.id);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleCheckout = async (planKey: PlanKey) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const plan = PLANS[planKey];
    if (!plan.price_id) return;

    setCheckoutLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: plan.price_id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast({ title: "Erro ao iniciar checkout", variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast({ title: "Erro ao abrir portal", variant: "destructive" });
    }
  };

  return (
    <div className="bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold font-heading mb-4">
            Escolha o plano ideal para você
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Comece gratuitamente e evolua conforme suas necessidades. Todos os planos incluem 14 dias de teste grátis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {(Object.keys(PLANS) as PlanKey[]).map((key) => {
            const plan = PLANS[key];
            const isPopular = key === "professor";
            const isCurrent = currentPlan === key;

            return (
              <Card
                key={key}
                className={`relative flex flex-col ${
                  isPopular
                    ? "border-primary shadow-lg scale-105 ring-2 ring-primary/20"
                    : "border-border"
                }`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Mais Popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-3 right-4 bg-accent text-accent-foreground">
                    <Crown className="h-3 w-3 mr-1" /> Seu Plano
                  </Badge>
                )}

                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-3 p-3 rounded-full bg-primary/10 text-primary w-fit">
                    {planIcons[key]}
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>
                    {plan.price === 0 ? (
                      <span className="text-3xl font-bold text-foreground">Grátis</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-foreground">
                          R$ {plan.price.toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-muted-foreground">/mês</span>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {planFeatures[key].map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {isCurrent ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleManage}
                      disabled={key === "free"}
                    >
                      {key === "free" ? "Plano Atual" : "Gerenciar Assinatura"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={isPopular ? "default" : "outline"}
                      onClick={() => handleCheckout(key)}
                      disabled={checkoutLoading !== null || subLoading || key === "free"}
                    >
                      {checkoutLoading === key ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {key === "free" ? "Plano Atual" : "Assinar Agora"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
