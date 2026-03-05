
-- Add new columns to existing ai_usage_log table
ALTER TABLE public.ai_usage_log
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS prompt_type text,
  ADD COLUMN IF NOT EXISTS tokens_input integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric DEFAULT 0;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own ai usage" ON public.ai_usage_log;
DROP POLICY IF EXISTS "Users log own usage" ON public.ai_usage_log;

-- New RLS: service role can insert (service role bypasses RLS, so we allow authenticated insert too for edge functions)
CREATE POLICY "Service role can insert ai usage"
  ON public.ai_usage_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can select all usage logs
CREATE POLICY "Admins can view all ai usage"
  ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Keep users able to see own usage (needed for feature gating)
CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
