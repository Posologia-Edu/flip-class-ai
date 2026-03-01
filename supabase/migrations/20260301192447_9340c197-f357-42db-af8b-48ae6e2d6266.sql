-- Add visibility controls for student-facing content
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS title text;

-- Backfill activity titles from linked material when possible
UPDATE public.activities a
SET title = COALESCE(a.title, m.title, 'Atividade')
FROM public.materials m
WHERE a.material_id = m.id
  AND (a.title IS NULL OR btrim(a.title) = '');

UPDATE public.activities
SET title = 'Atividade manual'
WHERE title IS NULL OR btrim(title) = '';

-- Only published materials/activities are visible to non-teacher student flows
DROP POLICY IF EXISTS "Anyone can view materials" ON public.materials;
CREATE POLICY "Anyone can view materials"
ON public.materials
FOR SELECT
USING (is_published = true);

DROP POLICY IF EXISTS "Anyone can view activities" ON public.activities;
CREATE POLICY "Anyone can view activities"
ON public.activities
FOR SELECT
USING (is_published = true);