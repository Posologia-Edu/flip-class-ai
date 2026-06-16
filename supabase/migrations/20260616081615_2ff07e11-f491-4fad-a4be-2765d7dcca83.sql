
-- 1. STUDENT TWINS (Digital Twin Pedagógico)
CREATE TABLE public.student_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  student_name TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  cognitive_style TEXT,
  style_confidence NUMERIC(3,2) DEFAULT 0,
  memory_decay JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, student_email)
);
CREATE INDEX idx_student_twins_room ON public.student_twins(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_twins TO authenticated;
GRANT ALL ON public.student_twins TO service_role;
ALTER TABLE public.student_twins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room owners/collaborators read twins"
  ON public.student_twins FOR SELECT TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()) OR public.is_room_collaborator(room_id, auth.uid()));

CREATE POLICY "Room owners manage twins"
  ON public.student_twins FOR ALL TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()))
  WITH CHECK (public.is_room_owner(room_id, auth.uid()));

-- 2. SOCRATIC SESSIONS (Debate Socrático)
CREATE TABLE public.socratic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  student_name TEXT,
  topic TEXT NOT NULL,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  rubric JSONB,
  final_grade NUMERIC(4,2),
  feedback_md TEXT,
  duration_sec INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_socratic_room ON public.socratic_sessions(room_id);
CREATE INDEX idx_socratic_email ON public.socratic_sessions(student_email);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.socratic_sessions TO authenticated;
GRANT ALL ON public.socratic_sessions TO service_role;
ALTER TABLE public.socratic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room owners/collab read socratic"
  ON public.socratic_sessions FOR SELECT TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()) OR public.is_room_collaborator(room_id, auth.uid()));

CREATE POLICY "Room owners manage socratic"
  ON public.socratic_sessions FOR ALL TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()))
  WITH CHECK (public.is_room_owner(room_id, auth.uid()));

-- 3. OSCE EXAMS
CREATE TABLE public.osce_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  stations JSONB NOT NULL DEFAULT '[]'::jsonb,
  passing_score NUMERIC(4,2) NOT NULL DEFAULT 6,
  unlock_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_osce_room ON public.osce_exams(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osce_exams TO authenticated;
GRANT ALL ON public.osce_exams TO service_role;
ALTER TABLE public.osce_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room owners/collab read osce"
  ON public.osce_exams FOR SELECT TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()) OR public.is_room_collaborator(room_id, auth.uid()));

CREATE POLICY "Room owners manage osce"
  ON public.osce_exams FOR ALL TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()))
  WITH CHECK (public.is_room_owner(room_id, auth.uid()));

-- 4. OSCE ATTEMPTS
CREATE TABLE public.osce_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.osce_exams(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  student_name TEXT,
  station_responses JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_score NUMERIC(4,2),
  passed BOOLEAN,
  certificate_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_osce_attempts_exam ON public.osce_attempts(exam_id);
CREATE INDEX idx_osce_attempts_email ON public.osce_attempts(student_email);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osce_attempts TO authenticated;
GRANT ALL ON public.osce_attempts TO service_role;
ALTER TABLE public.osce_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room owners/collab read attempts"
  ON public.osce_attempts FOR SELECT TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()) OR public.is_room_collaborator(room_id, auth.uid()));

CREATE POLICY "Room owners manage attempts"
  ON public.osce_attempts FOR ALL TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()))
  WITH CHECK (public.is_room_owner(room_id, auth.uid()));

-- Updated at triggers
CREATE TRIGGER trg_student_twins_updated BEFORE UPDATE ON public.student_twins
  FOR EACH ROW EXECUTE FUNCTION public.update_teacher_feedback_updated_at();
CREATE TRIGGER trg_osce_exams_updated BEFORE UPDATE ON public.osce_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_teacher_feedback_updated_at();
