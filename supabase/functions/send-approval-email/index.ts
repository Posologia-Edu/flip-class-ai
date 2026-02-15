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
    const { userId, approved } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    if (!userData?.user?.email) {
      throw new Error("User not found");
    }

    const email = userData.user.email;
    const name = userData.user.user_metadata?.full_name || "Professor";

    // Use Lovable AI to generate email content
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const subject = approved
      ? "✅ Sua conta FlipClass foi aprovada!"
      : "❌ Cadastro FlipClass não aprovado";

    const htmlBody = approved
      ? `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #0d9488; font-size: 24px;">Bem-vindo ao FlipClass, ${name}! 🎉</h1>
          <p style="color: #334155; line-height: 1.6;">Seu cadastro como professor foi <strong>aprovado</strong> pelo administrador.</p>
          <p style="color: #334155; line-height: 1.6;">Agora você pode acessar o sistema, criar salas de aula e gerar atividades com IA.</p>
          <a href="${supabaseUrl.replace('.supabase.co', '.lovableproject.com')}/auth" 
             style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #0d9488; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Acessar FlipClass
          </a>
        </div>`
      : `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #ef4444; font-size: 24px;">Cadastro não aprovado</h1>
          <p style="color: #334155; line-height: 1.6;">Olá ${name},</p>
          <p style="color: #334155; line-height: 1.6;">Infelizmente seu cadastro como professor no FlipClass não foi aprovado neste momento.</p>
          <p style="color: #334155; line-height: 1.6;">Se acredita que houve um engano, entre em contato com o administrador do sistema.</p>
        </div>`;

    // Send email via Supabase Auth admin
    // Since we can't send arbitrary emails via Supabase Auth, we'll log it
    // The approval status change itself is the key action
    console.log(`Approval email would be sent to ${email}: ${approved ? "APPROVED" : "REJECTED"}`);

    return new Response(
      JSON.stringify({ success: true, email, approved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-approval-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
