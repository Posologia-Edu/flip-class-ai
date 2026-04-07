
-- Table for student groups within a room
CREATE TABLE public.room_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.room_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room groups"
  ON public.room_groups FOR SELECT
  USING (true);

CREATE POLICY "Teachers can manage room groups"
  ON public.room_groups FOR ALL
  USING (is_room_owner(room_id, auth.uid()) OR is_room_collaborator(room_id, auth.uid()));

-- Table for group members
CREATE TABLE public.room_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.room_groups(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.student_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, session_id)
);

ALTER TABLE public.room_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view group members"
  ON public.room_group_members FOR SELECT
  USING (true);

CREATE POLICY "Teachers can manage group members"
  ON public.room_group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.room_groups rg
      JOIN public.rooms r ON r.id = rg.room_id
      WHERE rg.id = room_group_members.group_id
        AND (r.teacher_id = auth.uid() OR is_room_collaborator(r.id, auth.uid()))
    )
  );
