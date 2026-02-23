
-- Fix 1: Restrict storage DELETE to room owner teachers only
DROP POLICY IF EXISTS "Authenticated users can delete materials" ON storage.objects;

CREATE POLICY "Teachers can delete own room materials"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'materials' AND
  EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.teacher_id = auth.uid()
    AND (storage.foldername(name))[1] = r.id::text
  )
);

-- Fix 2: Restrict storage INSERT (upload) to room owner teachers only
DROP POLICY IF EXISTS "Authenticated users can upload materials" ON storage.objects;

CREATE POLICY "Teachers can upload to own rooms"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'materials' AND
  EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.teacher_id = auth.uid()
    AND (storage.foldername(name))[1] = r.id::text
  )
);
