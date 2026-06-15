
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS is_longitudinal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_chapters integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS baseline_state jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.simulation_sessions
  ADD COLUMN IF NOT EXISTS chapter integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS patient_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS chapters_history jsonb NOT NULL DEFAULT '[]'::jsonb;
