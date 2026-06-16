ALTER TABLE public.osce_attempts
  ADD COLUMN IF NOT EXISTS teacher_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teacher_feedback text,
  ADD COLUMN IF NOT EXISTS teacher_score numeric,
  ADD COLUMN IF NOT EXISTS teacher_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS teacher_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_to_student boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_score numeric;