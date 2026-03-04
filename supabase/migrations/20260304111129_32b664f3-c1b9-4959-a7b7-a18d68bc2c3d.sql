
-- Fix 1: ai_usage_log INSERT policy - restrict to own user_id
DROP POLICY IF EXISTS "Service can insert ai usage" ON public.ai_usage_log;
CREATE POLICY "Users log own usage" ON public.ai_usage_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Fix 2: Make materials bucket private
UPDATE storage.buckets SET public = false WHERE id = 'materials';

-- Add SELECT policy for teachers on storage.objects for materials
CREATE POLICY "Teachers can read own room materials"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'materials' AND
  EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.teacher_id = auth.uid()
    AND (storage.foldername(name))[1] = r.id::text
  )
);

-- Create logos bucket (public) for institution logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;

-- Logos bucket policies
CREATE POLICY "Anyone can view logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
