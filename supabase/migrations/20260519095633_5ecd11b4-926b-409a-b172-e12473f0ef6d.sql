
-- Simulations: branching AI-generated scenarios per room
CREATE TABLE public.simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  learning_objectives text DEFAULT '',
  material_ids uuid[] DEFAULT '{}',
  scenario jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_steps integer NOT NULL DEFAULT 6,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published simulations" ON public.simulations
FOR SELECT USING (
  is_published = true
  OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = simulations.room_id AND r.teacher_id = auth.uid())
  OR public.is_room_collaborator(room_id, auth.uid())
);

CREATE POLICY "Teachers manage simulations" ON public.simulations
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = simulations.room_id AND r.teacher_id = auth.uid())
  OR public.is_room_collaborator(room_id, auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = simulations.room_id AND r.teacher_id = auth.uid())
  OR public.is_room_collaborator(room_id, auth.uid())
);

CREATE TRIGGER update_simulations_updated_at
  BEFORE UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.update_teacher_feedback_updated_at();

-- Per-student simulation runs
CREATE TABLE public.simulation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL,
  student_session_id uuid NOT NULL,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  ai_score numeric,
  ai_feedback text,
  teacher_score numeric,
  teacher_feedback text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.simulation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view simulation sessions" ON public.simulation_sessions
FOR SELECT USING (true);

CREATE POLICY "Anyone can insert simulation session" ON public.simulation_sessions
FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update simulation session" ON public.simulation_sessions
FOR UPDATE USING (true);

CREATE POLICY "Teachers manage simulation sessions" ON public.simulation_sessions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.simulations s
    JOIN public.rooms r ON r.id = s.room_id
    WHERE s.id = simulation_sessions.simulation_id
      AND (r.teacher_id = auth.uid() OR public.is_room_collaborator(r.id, auth.uid()))
  )
);

CREATE TRIGGER update_simulation_sessions_updated_at
  BEFORE UPDATE ON public.simulation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_teacher_feedback_updated_at();

CREATE INDEX idx_simulations_room ON public.simulations(room_id);
CREATE INDEX idx_sim_sessions_sim ON public.simulation_sessions(simulation_id);
CREATE INDEX idx_sim_sessions_student ON public.simulation_sessions(student_session_id);
