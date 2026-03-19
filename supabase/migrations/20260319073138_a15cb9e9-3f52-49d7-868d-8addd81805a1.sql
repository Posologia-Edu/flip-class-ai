CREATE POLICY "Collaborators can view room students"
ON public.room_students
FOR SELECT
TO authenticated
USING (is_room_collaborator(room_id, auth.uid()));