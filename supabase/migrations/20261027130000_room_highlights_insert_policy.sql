-- Permite ao dono da sala copiar os highlights de outra sala ao importar/duplicar.
-- (A geração por IA continua sendo feita pela edge function com service role.)
CREATE POLICY "Room owners can insert highlights" ON public.room_highlights FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_highlights.room_id AND rooms.teacher_id = auth.uid())
  );
