
-- Enable realtime for teacher_feedback and ai_usage_log tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_usage_log;
