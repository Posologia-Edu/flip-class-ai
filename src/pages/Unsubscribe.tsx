import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, CheckCircle, AlertCircle } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
    const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then(r => r.json())
      .then(d => {
        if (d.valid === false && d.reason === "already_unsubscribed") setStatus("already");
        else if (d.valid) setStatus("valid");
        else setStatus("invalid");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch { setStatus("error"); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center space-y-4">
        {status === "loading" && <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />}
        {status === "valid" && (
          <>
            <MailX className="w-12 h-12 mx-auto text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Cancelar inscrição</h1>
            <p className="text-muted-foreground text-sm">Tem certeza que deseja parar de receber e-mails de notificação?</p>
            <Button onClick={handleUnsubscribe} disabled={processing} className="w-full">
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar cancelamento
            </Button>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <h1 className="text-xl font-semibold text-foreground">Inscrição cancelada</h1>
            <p className="text-muted-foreground text-sm">Você não receberá mais e-mails de notificação.</p>
          </>
        )}
        {status === "already" && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Já cancelado</h1>
            <p className="text-muted-foreground text-sm">Sua inscrição já foi cancelada anteriormente.</p>
          </>
        )}
        {(status === "invalid" || status === "error") && (
          <>
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold text-foreground">Link inválido</h1>
            <p className="text-muted-foreground text-sm">Este link de cancelamento é inválido ou expirou.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
