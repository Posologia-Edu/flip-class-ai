import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUB] ${step}${detailsStr}`);
};

async function stripeGet(path: string, stripeKey: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { "Authorization": `Bearer ${stripeKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { email: user.email });

    // Search customer by email using Stripe REST API directly
    const customers = await stripeGet(`/customers?email=${encodeURIComponent(user.email)}&limit=1`, stripeKey);
    logStep("Customer search", { found: customers.data.length });

    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify({ subscribed: false, product_id: null, subscription_end: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    // Check active and trialing subscriptions
    const [activeSubs, trialingSubs] = await Promise.all([
      stripeGet(`/subscriptions?customer=${customerId}&status=active&limit=1`, stripeKey),
      stripeGet(`/subscriptions?customer=${customerId}&status=trialing&limit=1`, stripeKey),
    ]);

    logStep("Subscriptions", { active: activeSubs.data.length, trialing: trialingSubs.data.length });

    const sub = activeSubs.data[0] || trialingSubs.data[0];

    if (!sub) {
      logStep("No active/trialing subscription");
      return new Response(JSON.stringify({ subscribed: false, product_id: null, subscription_end: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productId = sub.items.data[0].price.product;
    const endRaw = sub.current_period_end;
    let subscriptionEnd: string | null = null;
    if (endRaw) {
      const ts = typeof endRaw === 'number' ? endRaw : parseInt(String(endRaw), 10);
      if (!isNaN(ts) && ts > 0) subscriptionEnd = new Date(ts * 1000).toISOString();
    }
    logStep("Returning subscription", { productId, subscriptionEnd, status: sub.status });

    return new Response(JSON.stringify({
      subscribed: true,
      product_id: productId,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});