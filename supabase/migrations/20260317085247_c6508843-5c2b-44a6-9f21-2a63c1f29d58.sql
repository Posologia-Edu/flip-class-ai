
-- Table for room collaborators (invited teachers)
CREATE TABLE public.room_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(room_id, teacher_id)
);

ALTER TABLE public.room_collaborators ENABLE ROW LEVEL SECURITY;

-- Room owner can manage collaborators
CREATE POLICY "Room owner can manage collaborators"
ON public.room_collaborators
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.rooms WHERE rooms.id = room_collaborators.room_id AND rooms.teacher_id = auth.uid()
));

-- Collaborators can view their own assignments
CREATE POLICY "Collaborators can view own assignments"
ON public.room_collaborators
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Allow collaborators to view rooms they collaborate on
CREATE POLICY "Collaborators can view collaborated rooms"
ON public.rooms
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.room_collaborators WHERE room_collaborators.room_id = rooms.id AND room_collaborators.teacher_id = auth.uid()
));

-- Allow collaborators to view materials in collaborated rooms
CREATE POLICY "Collaborators can view collaborated materials"
ON public.materials
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.room_collaborators WHERE room_collaborators.room_id = materials.room_id AND room_collaborators.teacher_id = auth.uid()
));

-- Allow collaborators to view activities in collaborated rooms
CREATE POLICY "Collaborators can view collaborated activities"
ON public.activities
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.room_collaborators WHERE room_collaborators.room_id = activities.room_id AND room_collaborators.teacher_id = auth.uid()
));

-- Allow collaborators to view student sessions in collaborated rooms
CREATE POLICY "Collaborators can view collaborated sessions"
ON public.student_sessions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.room_collaborators WHERE room_collaborators.room_id = student_sessions.room_id AND room_collaborators.teacher_id = auth.uid()
));

-- Allow collaborators to view activity logs in collaborated rooms
CREATE POLICY "Collaborators can view collaborated activity logs"
ON public.student_activity_logs
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.room_collaborators WHERE room_collaborators.room_id = student_activity_logs.room_id AND room_collaborators.teacher_id = auth.uid()
));

-- Allow collaborators to view teacher feedback in collaborated rooms
CREATE POLICY "Collaborators can view collaborated feedback"
ON public.teacher_feedback
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_sessions ss
  JOIN public.room_collaborators rc ON rc.room_id = ss.room_id
  WHERE ss.id = teacher_feedback.session_id AND rc.teacher_id = auth.uid()
));
