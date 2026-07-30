-- 1. ai_api_keys: remove permissive read policy (service role bypasses RLS)
DROP POLICY IF EXISTS "Service role can read AI API keys" ON public.ai_api_keys;

-- 2. osce_attempts: remove anon access (handled via student-session edge function)
DROP POLICY IF EXISTS "Anon read osce attempts" ON public.osce_attempts;
DROP POLICY IF EXISTS "Anon update own osce attempt" ON public.osce_attempts;
DROP POLICY IF EXISTS "Anon insert osce attempt" ON public.osce_attempts;

-- 3. socratic_sessions: remove anon access
DROP POLICY IF EXISTS "Anon read socratic" ON public.socratic_sessions;
DROP POLICY IF EXISTS "Anon update own socratic" ON public.socratic_sessions;
DROP POLICY IF EXISTS "Anon insert socratic" ON public.socratic_sessions;

-- 4. simulation_sessions: remove public read/write
DROP POLICY IF EXISTS "Anyone can view simulation sessions" ON public.simulation_sessions;
DROP POLICY IF EXISTS "Anyone can update simulation session" ON public.simulation_sessions;
DROP POLICY IF EXISTS "Anyone can insert simulation session" ON public.simulation_sessions;
DROP POLICY IF EXISTS "Teachers manage simulation sessions" ON public.simulation_sessions;
CREATE POLICY "Teachers manage simulation sessions"
ON public.simulation_sessions FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.simulations s
  JOIN public.rooms r ON r.id = s.room_id
  WHERE s.id = simulation_sessions.simulation_id
    AND (r.teacher_id = auth.uid() OR public.is_room_collaborator(r.id, auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.simulations s
  JOIN public.rooms r ON r.id = s.room_id
  WHERE s.id = simulation_sessions.simulation_id
    AND (r.teacher_id = auth.uid() OR public.is_room_collaborator(r.id, auth.uid()))
));

-- 5. teacher_feedback: remove public read; restrict teacher policies to authenticated
DROP POLICY IF EXISTS "Anyone can view feedback" ON public.teacher_feedback;
DROP POLICY IF EXISTS "Teachers can insert feedback" ON public.teacher_feedback;
DROP POLICY IF EXISTS "Teachers can update feedback" ON public.teacher_feedback;
DROP POLICY IF EXISTS "Teachers can delete feedback" ON public.teacher_feedback;

CREATE POLICY "Teachers can view own feedback"
ON public.teacher_feedback FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_sessions ss
  JOIN public.rooms r ON r.id = ss.room_id
  WHERE ss.id = teacher_feedback.session_id AND r.teacher_id = auth.uid()
));

CREATE POLICY "Teachers can insert feedback"
ON public.teacher_feedback FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.student_sessions ss
  JOIN public.rooms r ON r.id = ss.room_id
  WHERE ss.id = teacher_feedback.session_id AND r.teacher_id = auth.uid()
));

CREATE POLICY "Teachers can update feedback"
ON public.teacher_feedback FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_sessions ss
  JOIN public.rooms r ON r.id = ss.room_id
  WHERE ss.id = teacher_feedback.session_id AND r.teacher_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.student_sessions ss
  JOIN public.rooms r ON r.id = ss.room_id
  WHERE ss.id = teacher_feedback.session_id AND r.teacher_id = auth.uid()
));

CREATE POLICY "Teachers can delete feedback"
ON public.teacher_feedback FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_sessions ss
  JOIN public.rooms r ON r.id = ss.room_id
  WHERE ss.id = teacher_feedback.session_id AND r.teacher_id = auth.uid()
));

-- 6. Storage: remove anonymous object listing/reading policies
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view materials files" ON storage.objects;

-- 7. Fix mutable search_path on remaining SECURITY DEFINER functions
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;

-- 8. Revoke client execute rights on privileged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_activity_unlock() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_material_added() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_room_last_activity() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_room_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_room_collaborator(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;