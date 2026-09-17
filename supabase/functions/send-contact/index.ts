import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  sender_name: z.string().trim().min(1).max(100).optional(),
  sender_email: z.string().trim().email().max(255).optional(),
});

const requests = new Map<string, number[]>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { subject, message, sender_name, sender_email } = parsed.data;

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const cutoff = Date.now() - 60 * 60 * 1000;
    const recent = (requests.get(clientIp) || []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= 5) {
      return new Response(JSON.stringify({ error: "Muitas mensagens. Tente novamente mais tarde." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    requests.set(clientIp, [...recent, Date.now()]);

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

    const result = await sendTemplateEmail("contact-message", "sergio.araujo@ufrn.br", {
      templateData: { senderName: fromName, senderEmail: fromEmail, subject, message },
      idempotencyKey: `contact-${crypto.randomUUID()}`,
      replyTo: fromEmail,
    });

    return new Response(JSON.stringify({ success: result.sent, reason: result.sent ? undefined : result.reason }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
