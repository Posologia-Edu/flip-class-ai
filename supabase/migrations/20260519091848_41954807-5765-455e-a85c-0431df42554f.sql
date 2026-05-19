
-- Tighten notifications RLS: remove permissive USING(true) policies
DROP POLICY IF EXISTS "Anyone can view notifications by session" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can update notifications" ON public.notifications;

-- Teachers see notifications for rooms they own (or where teacher_id matches)
CREATE POLICY "Teachers view their notifications"
ON public.notifications
FOR SELECT
USING (
  (teacher_id IS NOT NULL AND teacher_id = auth.uid())
  OR public.is_room_owner(room_id, auth.uid())
  OR public.is_room_collaborator(room_id, auth.uid())
);

-- Students (anon) can view notifications scoped to a student session.
-- Session IDs are unguessable UUIDs held as bearer tokens by the student app.
CREATE POLICY "Students view notifications for a session"
ON public.notifications
FOR SELECT
TO anon
USING (
  session_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.student_sessions s WHERE s.id = notifications.session_id)
);

-- Teachers can mark their own notifications as read
CREATE POLICY "Teachers update their notifications"
ON public.notifications
FOR UPDATE
USING (
  (teacher_id IS NOT NULL AND teacher_id = auth.uid())
  OR public.is_room_owner(room_id, auth.uid())
  OR public.is_room_collaborator(room_id, auth.uid())
);

-- Students (anon) can mark their session's notifications as read
CREATE POLICY "Students update notifications for a session"
ON public.notifications
FOR UPDATE
TO anon
USING (
  session_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.student_sessions s WHERE s.id = notifications.session_id)
);
