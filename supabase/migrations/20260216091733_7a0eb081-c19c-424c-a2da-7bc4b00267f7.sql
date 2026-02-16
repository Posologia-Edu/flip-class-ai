
-- Create storage bucket for materials
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true);

-- Allow anyone to view materials files
CREATE POLICY "Anyone can view materials files"
ON storage.objects FOR SELECT
USING (bucket_id = 'materials');

-- Allow authenticated users to upload materials
CREATE POLICY "Authenticated users can upload materials"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'materials' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their materials
CREATE POLICY "Authenticated users can delete materials"
ON storage.objects FOR DELETE
USING (bucket_id = 'materials' AND auth.role() = 'authenticated');
