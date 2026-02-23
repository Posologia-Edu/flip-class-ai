
-- =============================================
-- Fix: student_sessions SELECT (PUBLIC_DATA_EXPOSURE + EXPOSED_SENSITIVE_DATA)
-- =============================================
DROP POLICY IF EXISTS "Anyone can view student sessions" ON public.student_sessions;

-- Teachers can view sessions in their own rooms
CREATE POLICY "Teachers can view room sessions"
ON public.student_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = student_sessions.room_id
      AND rooms.teacher_id = auth.uid()
  )
);

-- =============================================
-- Fix: student_sessions UPDATE (MISSING_RLS_PROTECTION)
-- =============================================
DROP POLICY IF EXISTS "Anyone can update student session" ON public.student_sessions;

-- Teachers can update sessions in their own rooms
CREATE POLICY "Teachers can update room sessions"
ON public.student_sessions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = student_sessions.room_id
      AND rooms.teacher_id = auth.uid()
  )
);

-- =============================================
-- Fix: student_activity_logs SELECT (PUBLIC_USER_DATA)
-- =============================================
DROP POLICY IF EXISTS "Anyone can view activity logs" ON public.student_activity_logs;

-- Teachers can view activity logs in their own rooms
CREATE POLICY "Teachers can view room activity logs"
ON public.student_activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = student_activity_logs.room_id
      AND rooms.teacher_id = auth.uid()
  )
);
