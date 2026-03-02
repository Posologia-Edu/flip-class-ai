import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U1yOTsueyuc6SQ": "professor",
  "prod_U1yOWsVEIi6joe": "institutional",
};

async function stripeGet(path: string, stripeKey: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Basic ${btoa(stripeKey + ":")}` },
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    // Verify admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Not authorized");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    // Fetch active + trialing subscriptions from Stripe
    const activeSubs = await stripeGet("/subscriptions?status=active&limit=100&expand[]=data.customer", stripeKey);
    const trialSubs = await stripeGet("/subscriptions?status=trialing&limit=100&expand[]=data.customer", stripeKey);

    const allSubs = [...(activeSubs.data || []), ...(trialSubs.data || [])];

    // Get invite emails to exclude them
    const { data: invites } = await supabaseClient
      .from("admin_invites")
      .select("email");
    const inviteEmails = new Set((invites || []).map((i: any) => i.email?.toLowerCase()));

    const subscribers: any[] = [];

    for (const sub of allSubs) {
      const customer = sub.customer;
      const email = typeof customer === "string" ? null : customer?.email;
      if (!email) continue;
      // Exclude invited users
      if (inviteEmails.has(email.toLowerCase())) continue;

      const productId = sub.items?.data?.[0]?.price?.product;
      const planKey = PRODUCT_TO_PLAN[productId] || "unknown";
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      const created = new Date(sub.created * 1000).toISOString();

      // Get profile info
      const { data: authUsers } = await supabaseClient.auth.admin.listUsers({ perPage: 1, page: 1 });
      let fullName: string | null = null;
      let lastSignIn: string | null = null;

      // Find user by email in auth
      const { data: userList } = await supabaseClient.auth.admin.listUsers();
      const authUser = (userList?.users || []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (authUser) {
        lastSignIn = authUser.last_sign_in_at || null;
        // Get profile name
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("full_name")
          .eq("user_id", authUser.id)
          .maybeSingle();
        fullName = profile?.full_name || null;

        // Get room count
        const { count: roomCount } = await supabaseClient
          .from("rooms")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", authUser.id);

        subscribers.push({
          email,
          full_name: fullName,
          plan: planKey,
          status: sub.status,
          period_end: periodEnd,
          subscribed_at: created,
          last_sign_in: lastSignIn,
          room_count: roomCount || 0,
        });
      } else {
        subscribers.push({
          email,
          full_name: null,
          plan: planKey,
          status: sub.status,
          period_end: periodEnd,
          subscribed_at: created,
          last_sign_in: null,
          room_count: 0,
        });
      }
    }

    return new Response(JSON.stringify({ subscribers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
