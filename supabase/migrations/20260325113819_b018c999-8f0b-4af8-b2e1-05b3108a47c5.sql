
CREATE TABLE public.system_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL DEFAULT 'update' CHECK (type IN ('update', 'idea')),
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'in_progress', 'planned')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  version text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  implemented_at timestamp with time zone,
  created_by uuid
);

ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all updates"
  ON public.system_updates FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view done updates"
  ON public.system_updates FOR SELECT
  TO authenticated
  USING (status = 'done');
