
-- Table for registered students per room (whitelist)
CREATE TABLE public.room_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  student_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, student_email)
);

ALTER TABLE public.room_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage room students"
ON public.room_students FOR ALL
USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_students.room_id AND rooms.teacher_id = auth.uid()));

-- Table for admin invites tracking
CREATE TABLE public.admin_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  activated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invites"
ON public.admin_invites FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
