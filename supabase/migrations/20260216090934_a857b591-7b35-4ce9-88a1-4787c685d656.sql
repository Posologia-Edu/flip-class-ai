
-- Create discussion posts table
CREATE TABLE public.discussion_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.discussion_posts(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text,
  author_user_id uuid,
  content text NOT NULL,
  is_teacher boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discussion_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view posts in a room (students access without auth)
CREATE POLICY "Anyone can view discussion posts"
  ON public.discussion_posts FOR SELECT
  USING (true);

-- Anyone can create posts (students are unauthenticated)
CREATE POLICY "Anyone can create discussion posts"
  ON public.discussion_posts FOR INSERT
  WITH CHECK (true);

-- Teachers can delete posts in their rooms
CREATE POLICY "Teachers can delete posts in their rooms"
  ON public.discussion_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = discussion_posts.room_id
        AND rooms.teacher_id = auth.uid()
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_posts;
