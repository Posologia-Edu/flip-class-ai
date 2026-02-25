
CREATE TABLE public.ai_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(provider)
);

ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage AI API keys"
  ON public.ai_api_keys
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can read AI API keys"
  ON public.ai_api_keys
  FOR SELECT
  USING (true);
