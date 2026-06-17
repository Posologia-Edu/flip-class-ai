
-- Knowledge Graph nodes
CREATE TABLE public.knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('material','topic','question','concept')),
  label TEXT NOT NULL,
  ref_id UUID,
  ref_meta JSONB DEFAULT '{}'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_knowledge_nodes_room ON public.knowledge_nodes(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_nodes TO authenticated;
GRANT ALL ON public.knowledge_nodes TO service_role;
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room owners/collabs read nodes" ON public.knowledge_nodes FOR SELECT TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()) OR public.is_room_collaborator(room_id, auth.uid()));
CREATE POLICY "Room owners manage nodes" ON public.knowledge_nodes FOR ALL TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()))
  WITH CHECK (public.is_room_owner(room_id, auth.uid()));

-- Knowledge Graph edges
CREATE TABLE public.knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  weight NUMERIC NOT NULL DEFAULT 1,
  kind TEXT NOT NULL DEFAULT 'related',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_knowledge_edges_room ON public.knowledge_edges(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_edges TO authenticated;
GRANT ALL ON public.knowledge_edges TO service_role;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room owners/collabs read edges" ON public.knowledge_edges FOR SELECT TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()) OR public.is_room_collaborator(room_id, auth.uid()));
CREATE POLICY "Room owners manage edges" ON public.knowledge_edges FOR ALL TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()))
  WITH CHECK (public.is_room_owner(room_id, auth.uid()));

-- Peer review quality (AI mediator analysis per review draft)
CREATE TABLE public.peer_review_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID,
  assignment_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  reviewer_session_id UUID,
  reviewer_email TEXT,
  feedback_quality INTEGER NOT NULL DEFAULT 0,
  bias_score INTEGER NOT NULL DEFAULT 0,
  detected_biases JSONB DEFAULT '[]'::jsonb,
  suggested_rewrite TEXT,
  ai_rationale TEXT,
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prq_room ON public.peer_review_quality(room_id);
CREATE INDEX idx_prq_reviewer ON public.peer_review_quality(reviewer_session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peer_review_quality TO authenticated;
GRANT ALL ON public.peer_review_quality TO service_role;
ALTER TABLE public.peer_review_quality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room owners read prq" ON public.peer_review_quality FOR SELECT TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()) OR public.is_room_collaborator(room_id, auth.uid()));
CREATE POLICY "Room owners manage prq" ON public.peer_review_quality FOR ALL TO authenticated
  USING (public.is_room_owner(room_id, auth.uid()))
  WITH CHECK (public.is_room_owner(room_id, auth.uid()));

CREATE TRIGGER trg_prq_updated_at BEFORE UPDATE ON public.peer_review_quality
  FOR EACH ROW EXECUTE FUNCTION public.update_teacher_feedback_updated_at();
