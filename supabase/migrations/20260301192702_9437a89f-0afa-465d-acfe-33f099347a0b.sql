-- Fix RLS: teachers must see ALL materials/activities (including unpublished)
DROP POLICY IF EXISTS "Anyone can view materials" ON public.materials;
CREATE POLICY "Anyone can view materials"
ON public.materials
FOR SELECT
USING (
  is_published = true
  OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = materials.room_id AND rooms.teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can view activities" ON public.activities;
CREATE POLICY "Anyone can view activities"
ON public.activities
FOR SELECT
USING (
  is_published = true
  OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = activities.room_id AND rooms.teacher_id = auth.uid())
);