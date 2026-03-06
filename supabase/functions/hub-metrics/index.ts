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

  const since = new Date();
  since.setDate(since.getDate() - 30);

  // Run queries in parallel
  const [usersResult, aiLogsResult] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('ai_usage_log')
      .select('tokens_input, tokens_output, estimated_cost_usd')
      .gte('created_at', since.toISOString()),
  ]);

  const totalUsers = usersResult.count || 0;
  const aiLogs = aiLogsResult.data || [];
  const aiRequests = aiLogs.length;
  const aiTokensUsed = aiLogs.reduce((sum: number, l: any) => sum + (l.tokens_input ?? 0) + (l.tokens_output ?? 0), 0);
  const aiCostUsd = aiLogs.reduce((sum: number, l: any) => sum + (Number(l.estimated_cost_usd) ?? 0), 0);

  return new Response(JSON.stringify({
    total_users: totalUsers,
    active_users: 0,
    subscribers: 0,
    ai_requests: aiRequests,
    ai_tokens_used: aiTokensUsed,
    ai_cost_usd: Math.round(aiCostUsd * 10000) / 10000,
    revenue_usd: 0,
    mrr_usd: 0,
    collected_at: new Date().toISOString(),
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
