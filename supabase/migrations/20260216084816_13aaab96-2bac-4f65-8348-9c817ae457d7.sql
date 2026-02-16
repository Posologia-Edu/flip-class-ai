
-- Create teacher_feedback table
CREATE TABLE public.teacher_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.student_sessions(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  feedback_text text,
  grade smallint CHECK (grade >= 0 AND grade <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, question_key)
);

-- Enable RLS
ALTER TABLE public.teacher_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can read feedback (students need to see their own)
CREATE POLICY "Anyone can view feedback"
ON public.teacher_feedback
FOR SELECT
USING (true);

-- Only the teacher who owns the room can insert feedback
CREATE POLICY "Teachers can insert feedback"
ON public.teacher_feedback
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.student_sessions ss
    JOIN public.rooms r ON r.id = ss.room_id
    WHERE ss.id = session_id AND r.teacher_id = auth.uid()
  )
);

-- Only the teacher who owns the room can update feedback
CREATE POLICY "Teachers can update feedback"
ON public.teacher_feedback
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.student_sessions ss
    JOIN public.rooms r ON r.id = ss.room_id
    WHERE ss.id = session_id AND r.teacher_id = auth.uid()
  )
);

-- Only the teacher who owns the room can delete feedback
CREATE POLICY "Teachers can delete feedback"
ON public.teacher_feedback
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.student_sessions ss
    JOIN public.rooms r ON r.id = ss.room_id
    WHERE ss.id = session_id AND r.teacher_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_teacher_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_teacher_feedback_updated_at
BEFORE UPDATE ON public.teacher_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_teacher_feedback_updated_at();
