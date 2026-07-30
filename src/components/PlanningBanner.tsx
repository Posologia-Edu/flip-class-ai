import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Lightbulb, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PipelineItem {
  id: string;
  title: string;
  status: string;
  priority: string;
}

const PlanningBanner = () => {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("system_updates")
      .select("id, title, status, priority")
      .in("status", ["planned", "in_progress"])
      .order("priority", { ascending: true })
      .limit(5)
      .then(({ data }) => {
        if (data && data.length > 0) setItems(data);
      });
  }, [isAdmin]);

  if (!isAdmin || items.length === 0 || dismissed) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 relative">
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-6 w-6 text-muted-foreground"
        onClick={() => setDismissed(true)}
      >
        <X className="w-4 h-4" />
      </Button>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Lightbulb className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">
            Pipeline de Desenvolvimento — {items.length} {items.length === 1 ? "item pendente" : "itens pendentes"}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {items.map(item => (
              <span
                key={item.id}
                className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  item.status === "in_progress"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-blue-500/10 text-blue-600"
                }`}
              >
                {item.title}
              </span>
            ))}
          </div>
          <Button
            variant="link"
            size="sm"
            className="px-0 mt-1 h-auto text-primary"
            onClick={() => navigate("/admin")}
          >
            Ver pipeline completo <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanningBanner;
