
-- Create question_bank table for reusable activities
CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  quiz_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- Teachers can view their own saved questions
CREATE POLICY "Teachers can view own question bank"
ON public.question_bank
FOR SELECT
USING (auth.uid() = teacher_id);

-- Teachers can insert their own questions
CREATE POLICY "Teachers can insert own questions"
ON public.question_bank
FOR INSERT
WITH CHECK (auth.uid() = teacher_id);

-- Teachers can update their own questions
CREATE POLICY "Teachers can update own questions"
ON public.question_bank
FOR UPDATE
USING (auth.uid() = teacher_id);

-- Teachers can delete their own questions
CREATE POLICY "Teachers can delete own questions"
ON public.question_bank
FOR DELETE
USING (auth.uid() = teacher_id);

-- Trigger for updated_at
CREATE TRIGGER update_question_bank_updated_at
BEFORE UPDATE ON public.question_bank
FOR EACH ROW
EXECUTE FUNCTION public.update_teacher_feedback_updated_at();
