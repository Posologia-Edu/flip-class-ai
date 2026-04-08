
ALTER TABLE public.student_sessions 
  ADD COLUMN group_id UUID REFERENCES public.room_groups(id) ON DELETE SET NULL,
  ADD COLUMN is_group_leader BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_student_sessions_group_id ON public.student_sessions(group_id) WHERE group_id IS NOT NULL;
