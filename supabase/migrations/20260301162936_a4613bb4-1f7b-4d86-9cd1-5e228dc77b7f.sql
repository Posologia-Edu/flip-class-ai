
-- Table to track AI usage per user per month
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  usage_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role inserts (edge functions)
CREATE POLICY "Service can insert ai usage"
  ON public.ai_usage_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add granted_plan column to admin_invites
ALTER TABLE public.admin_invites ADD COLUMN granted_plan TEXT DEFAULT 'institutional';
