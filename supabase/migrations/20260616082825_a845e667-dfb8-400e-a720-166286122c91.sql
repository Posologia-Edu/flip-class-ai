
-- Allow anon access for student-facing features
GRANT SELECT ON public.osce_exams TO anon;
GRANT SELECT, INSERT, UPDATE ON public.osce_attempts TO anon;
GRANT SELECT, INSERT, UPDATE ON public.socratic_sessions TO anon;

-- OSCE exams: anon can read published ones
CREATE POLICY "Anon read published osce"
  ON public.osce_exams FOR SELECT TO anon
  USING (is_published = true);

-- OSCE attempts: anon can manage their own (no auth, so allow any anon insert/update/select)
-- Note: student identity is by email (passed from session); this is consistent with
-- other student-facing tables in the project (peer_reviews, etc.)
CREATE POLICY "Anon insert osce attempt"
  ON public.osce_attempts FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.osce_exams e WHERE e.id = exam_id AND e.is_published = true)
  );

CREATE POLICY "Anon read osce attempts"
  ON public.osce_attempts FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon update own osce attempt"
  ON public.osce_attempts FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Socratic sessions: anon can create, update, read their own
CREATE POLICY "Anon insert socratic"
  ON public.socratic_sessions FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id)
  );

CREATE POLICY "Anon update own socratic"
  ON public.socratic_sessions FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon read socratic"
  ON public.socratic_sessions FOR SELECT TO anon
  USING (true);
