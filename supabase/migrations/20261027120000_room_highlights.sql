-- Highlights (cards de pergunta/resposta) gerados pela IA a partir dos materiais da sala.
-- Um conjunto por sala; visível apenas para o professor e colaboradores (alunos não veem as respostas).
CREATE TABLE public.room_highlights (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers and collaborators can view highlights" ON public.room_highlights FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = room_highlights.room_id AND rooms.teacher_id = auth.uid())
    OR public.is_room_collaborator(room_id, auth.uid())
  );

-- Escrita apenas pela edge function generate-highlights (service role, que ignora RLS).
