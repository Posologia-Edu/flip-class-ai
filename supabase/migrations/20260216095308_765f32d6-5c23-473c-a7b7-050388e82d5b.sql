
-- Notifications table for in-app notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.student_sessions(id) ON DELETE CASCADE,
  teacher_id uuid,
  type text NOT NULL, -- 'material_added', 'activity_unlocked', 'deadline_approaching', 'peer_review_received', 'feedback_received'
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Students can view their own notifications (by session_id)
CREATE POLICY "Anyone can view notifications by session"
ON public.notifications
FOR SELECT
USING (true);

-- Anyone can insert notifications (triggered by system/edge functions)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Anyone can update notifications (mark as read)
CREATE POLICY "Anyone can update notifications"
ON public.notifications
FOR UPDATE
USING (true);

-- Teachers can delete notifications for their rooms
CREATE POLICY "Teachers can delete notifications"
ON public.notifications
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM rooms WHERE rooms.id = notifications.room_id AND rooms.teacher_id = auth.uid()
));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- DB function to auto-create notifications when a material is added
CREATE OR REPLACE FUNCTION public.notify_material_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create notifications for all students in this room
  INSERT INTO public.notifications (room_id, session_id, type, title, message)
  SELECT 
    NEW.room_id,
    ss.id,
    'material_added',
    'Novo material disponível',
    'O material "' || COALESCE(NEW.title, 'Sem título') || '" foi adicionado à sala.'
  FROM public.student_sessions ss
  WHERE ss.room_id = NEW.room_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_material_added
AFTER INSERT ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.notify_material_added();

-- DB function to notify when activity is unlocked (when unlock_at is updated)
CREATE OR REPLACE FUNCTION public.notify_activity_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when unlock_at changes and new value is in the past or now
  IF (OLD.unlock_at IS DISTINCT FROM NEW.unlock_at) AND (NEW.unlock_at IS NOT NULL AND NEW.unlock_at <= now()) THEN
    INSERT INTO public.notifications (room_id, session_id, type, title, message)
    SELECT 
      NEW.id,
      ss.id,
      'activity_unlocked',
      'Atividade desbloqueada!',
      'A atividade da sala "' || NEW.title || '" foi liberada. Acesse agora!'
    FROM public.student_sessions ss
    WHERE ss.room_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_room_unlock
AFTER UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.notify_activity_unlock();
