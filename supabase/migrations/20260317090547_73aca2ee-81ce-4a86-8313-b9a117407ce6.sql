CREATE OR REPLACE FUNCTION public.is_room_owner(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rooms
    WHERE id = _room_id
      AND teacher_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_collaborator(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_collaborators
    WHERE room_id = _room_id
      AND teacher_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Collaborators can view collaborated rooms" ON public.rooms;
CREATE POLICY "Collaborators can view collaborated rooms"
ON public.rooms
FOR SELECT
TO authenticated
USING (public.is_room_collaborator(id, auth.uid()));

DROP POLICY IF EXISTS "Room owner can manage collaborators" ON public.room_collaborators;
CREATE POLICY "Room owner can view collaborators"
ON public.room_collaborators
FOR SELECT
TO authenticated
USING (public.is_room_owner(room_id, auth.uid()));

CREATE POLICY "Room owner can insert collaborators"
ON public.room_collaborators
FOR INSERT
TO authenticated
WITH CHECK (public.is_room_owner(room_id, auth.uid()));

CREATE POLICY "Room owner can update collaborators"
ON public.room_collaborators
FOR UPDATE
TO authenticated
USING (public.is_room_owner(room_id, auth.uid()))
WITH CHECK (public.is_room_owner(room_id, auth.uid()));

CREATE POLICY "Room owner can delete collaborators"
ON public.room_collaborators
FOR DELETE
TO authenticated
USING (public.is_room_owner(room_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can view collaborated materials" ON public.materials;
CREATE POLICY "Collaborators can view collaborated materials"
ON public.materials
FOR SELECT
TO authenticated
USING (public.is_room_collaborator(room_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can view collaborated activities" ON public.activities;
CREATE POLICY "Collaborators can view collaborated activities"
ON public.activities
FOR SELECT
TO authenticated
USING (public.is_room_collaborator(room_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can view collaborated sessions" ON public.student_sessions;
CREATE POLICY "Collaborators can view collaborated sessions"
ON public.student_sessions
FOR SELECT
TO authenticated
USING (public.is_room_collaborator(room_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can view collaborated activity logs" ON public.student_activity_logs;
CREATE POLICY "Collaborators can view collaborated activity logs"
ON public.student_activity_logs
FOR SELECT
TO authenticated
USING (public.is_room_collaborator(room_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can view collaborated feedback" ON public.teacher_feedback;
CREATE POLICY "Collaborators can view collaborated feedback"
ON public.teacher_feedback
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_sessions ss
    WHERE ss.id = teacher_feedback.session_id
      AND public.is_room_collaborator(ss.room_id, auth.uid())
  )
);