
-- 1. collaborative_projects
CREATE TABLE public.collaborative_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collaborative_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage projects" ON public.collaborative_projects
  FOR ALL TO public
  USING (is_room_owner(room_id, auth.uid()) OR is_room_collaborator(room_id, auth.uid()));

CREATE POLICY "Anyone can view projects" ON public.collaborative_projects
  FOR SELECT TO public USING (true);

-- 2. project_groups
CREATE TABLE public.project_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.collaborative_projects(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage groups" ON public.project_groups
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.collaborative_projects cp
    JOIN public.rooms r ON r.id = cp.room_id
    WHERE cp.id = project_groups.project_id
      AND (r.teacher_id = auth.uid() OR is_room_collaborator(r.id, auth.uid()))
  ));

CREATE POLICY "Anyone can view groups" ON public.project_groups
  FOR SELECT TO public USING (true);

-- 3. project_members
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.project_groups(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.student_sessions(id) ON DELETE CASCADE,
  assigned_role text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage members" ON public.project_members
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.project_groups pg
    JOIN public.collaborative_projects cp ON cp.id = pg.project_id
    JOIN public.rooms r ON r.id = cp.room_id
    WHERE pg.id = project_members.group_id
      AND (r.teacher_id = auth.uid() OR is_room_collaborator(r.id, auth.uid()))
  ));

CREATE POLICY "Anyone can view members" ON public.project_members
  FOR SELECT TO public USING (true);

-- 4. project_progress
CREATE TABLE public.project_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.project_groups(id) ON DELETE CASCADE,
  milestone_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage progress" ON public.project_progress
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.project_groups pg
    JOIN public.collaborative_projects cp ON cp.id = pg.project_id
    JOIN public.rooms r ON r.id = cp.room_id
    WHERE pg.id = project_progress.group_id
      AND (r.teacher_id = auth.uid() OR is_room_collaborator(r.id, auth.uid()))
  ));

CREATE POLICY "Anyone can view progress" ON public.project_progress
  FOR SELECT TO public USING (true);

CREATE POLICY "Students can update own group progress" ON public.project_progress
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.student_sessions ss ON ss.id = pm.session_id
    WHERE pm.group_id = project_progress.group_id
  ));

CREATE POLICY "Students can insert progress" ON public.project_progress
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.group_id = project_progress.group_id
  ));

-- Enable realtime for project_progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_progress;
