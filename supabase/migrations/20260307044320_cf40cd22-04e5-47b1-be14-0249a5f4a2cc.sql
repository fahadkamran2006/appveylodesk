
ALTER TABLE public.deliverable_comments ADD COLUMN parent_id UUID REFERENCES public.deliverable_comments(id) ON DELETE CASCADE DEFAULT NULL;
CREATE INDEX idx_deliverable_comments_parent_id ON public.deliverable_comments(parent_id);
