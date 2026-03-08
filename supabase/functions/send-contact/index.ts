import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, message, sender_name, sender_email } = await req.json();
    if (!subject || !message) throw new Error("Assunto e mensagem são obrigatórios");

    let fromEmail: string | undefined;
    let fromName: string | undefined;

    // Try to get authenticated user first
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          fromEmail = user.email;
          fromName = user.user_metadata?.full_name || user.email;
        }
      } catch {
        // Not authenticated, continue with sender fields
      }
    }

    // If not authenticated, require sender_name and sender_email
    if (!fromEmail) {
      if (!sender_email || !sender_name) {
        throw new Error("Nome e email são obrigatórios para visitantes");
      }
      fromEmail = sender_email;
      fromName = sender_name;
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("Chave de e-mail não configurada");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FlipClass Contato <noreply@tbl.posologia.app>",
        to: ["sergio.araujo@ufrn.br"],
        subject: `[FlipClass Contato] ${subject}`,
        reply_to: fromEmail,
        html: `
          <h2>Nova mensagem de contato - FlipClass</h2>
          <p><strong>De:</strong> ${fromName} (${fromEmail})</p>
          <p><strong>Assunto:</strong> ${subject}</p>
          <hr/>
          <p>${message.replace(/\n/g, "<br/>")}</p>
        `,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Falha ao enviar e-mail: ${errBody}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
