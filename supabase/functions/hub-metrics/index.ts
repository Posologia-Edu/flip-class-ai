const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  const expectedKey = Deno.env.get('HUB_METRICS_KEY');
  
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

  return new Response(JSON.stringify({
    total_users: totalUsers || 0,
    active_users: 0,
    subscribers: 0,
    ai_requests: 0,
    ai_tokens_used: 0,
    ai_cost_usd: 0,
    revenue_usd: 0,
    mrr_usd: 0,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
