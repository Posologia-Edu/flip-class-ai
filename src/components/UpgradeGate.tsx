import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeGateProps {
  children: React.ReactNode;
  allowed: boolean;
  featureName: string;
  planRequired?: string;
}

export default function UpgradeGate({ children, allowed, featureName, planRequired = "Professor" }: UpgradeGateProps) {
  const navigate = useNavigate();

  if (allowed) return <>{children}</>;

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none opacity-50">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
        <div className="text-center p-8 max-w-md">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            {featureName}
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            Este recurso está disponível a partir do plano <strong>{planRequired}</strong>. Faça upgrade para desbloquear.
          </p>
          <Button onClick={() => navigate("/pricing")} className="font-semibold">
            Fazer Upgrade <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
