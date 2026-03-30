
-- Create disciplines table
CREATE TABLE public.disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#0d9488',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;

-- Teachers can manage own disciplines
CREATE POLICY "Teachers can manage own disciplines"
  ON public.disciplines FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Add discipline_id to rooms (nullable for backward compatibility)
ALTER TABLE public.rooms ADD COLUMN discipline_id uuid REFERENCES public.disciplines(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_rooms_discipline_id ON public.rooms(discipline_id);
CREATE INDEX idx_disciplines_teacher_id ON public.disciplines(teacher_id);
