
-- Peer review criteria configuration per activity
ALTER TABLE public.activities ADD COLUMN peer_review_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.activities ADD COLUMN peer_review_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Peer review assignments: which student reviews which student's answers
CREATE TABLE public.peer_review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  reviewer_session_id uuid NOT NULL REFERENCES public.student_sessions(id) ON DELETE CASCADE,
  reviewee_session_id uuid NOT NULL REFERENCES public.student_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activity_id, reviewer_session_id, reviewee_session_id)
);

ALTER TABLE public.peer_review_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view assignments" ON public.peer_review_assignments FOR SELECT USING (true);
CREATE POLICY "Teachers can manage assignments" ON public.peer_review_assignments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM activities a JOIN rooms r ON r.id = a.room_id
    WHERE a.id = peer_review_assignments.activity_id AND r.teacher_id = auth.uid()
  )
);
CREATE POLICY "Anyone can insert assignments" ON public.peer_review_assignments FOR INSERT WITH CHECK (true);

-- Peer reviews: the actual evaluations
CREATE TABLE public.peer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.peer_review_assignments(id) ON DELETE CASCADE,
  criteria_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view peer reviews" ON public.peer_reviews FOR SELECT USING (true);
CREATE POLICY "Anyone can insert peer reviews" ON public.peer_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own peer reviews" ON public.peer_reviews FOR UPDATE USING (true);

-- Enable realtime for peer reviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_review_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_reviews;
