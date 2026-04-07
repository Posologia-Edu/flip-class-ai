
ALTER TABLE public.room_group_members DROP CONSTRAINT IF EXISTS room_group_members_session_id_fkey;
ALTER TABLE public.room_group_members DROP CONSTRAINT IF EXISTS room_group_members_group_id_session_id_key;
ALTER TABLE public.room_group_members DROP COLUMN session_id;
ALTER TABLE public.room_group_members ADD COLUMN student_id UUID NOT NULL REFERENCES public.room_students(id) ON DELETE CASCADE;
ALTER TABLE public.room_group_members ADD CONSTRAINT room_group_members_group_id_student_id_key UNIQUE(group_id, student_id);

-- Update RLS policy
DROP POLICY IF EXISTS "Teachers can manage group members" ON public.room_group_members;
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
