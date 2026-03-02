
-- Add expire_at column with default 1 week from creation
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS expire_at timestamp with time zone DEFAULT (now() + interval '7 days');

-- Add last_student_activity_at to track idle rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS last_student_activity_at timestamp with time zone DEFAULT now();

-- Update existing rooms to have expire_at set
UPDATE public.rooms SET expire_at = created_at + interval '7 days' WHERE expire_at IS NULL;
UPDATE public.rooms SET last_student_activity_at = created_at WHERE last_student_activity_at IS NULL;

-- Create a function to update last_student_activity_at when a student session is created
CREATE OR REPLACE FUNCTION public.update_room_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.rooms SET last_student_activity_at = now() WHERE id = NEW.room_id;
  RETURN NEW;
END;
$function$;

-- Create trigger on student_sessions
DROP TRIGGER IF EXISTS on_student_session_created ON public.student_sessions;
CREATE TRIGGER on_student_session_created
  AFTER INSERT ON public.student_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_last_activity();
