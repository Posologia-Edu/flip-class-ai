
-- Profiles table for teachers
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  pin_code TEXT NOT NULL UNIQUE,
  unlock_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own rooms" ON public.rooms FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "Anyone can view room by pin" ON public.rooms FOR SELECT USING (true);

-- Materials table
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video', 'file')),
  title TEXT NOT NULL DEFAULT '',
  url TEXT,
  thumbnail_url TEXT,
  content_text_for_ai TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage materials" ON public.materials FOR ALL
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = materials.room_id AND rooms.teacher_id = auth.uid()));
CREATE POLICY "Anyone can view materials" ON public.materials FOR SELECT USING (true);

-- Activities table (AI-generated quizzes)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
  quiz_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage activities" ON public.activities FOR ALL
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = activities.room_id AND rooms.teacher_id = auth.uid()));
CREATE POLICY "Anyone can view activities" ON public.activities FOR SELECT USING (true);

-- Student sessions
CREATE TABLE public.student_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  answers JSONB DEFAULT '{}',
  score INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create student session" ON public.student_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update student session" ON public.student_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can view student sessions" ON public.student_sessions FOR SELECT USING (true);
