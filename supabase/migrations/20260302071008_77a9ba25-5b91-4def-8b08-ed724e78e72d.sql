
-- Public review links table
CREATE TABLE public.public_review_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at timestamp with time zone,
  allow_approval boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Public review comments table (no auth required)
CREATE TABLE public.public_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_link_id uuid NOT NULL REFERENCES public.public_review_links(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL DEFAULT 'Anonymous',
  content text NOT NULL,
  timestamp_seconds numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_review_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_review_comments ENABLE ROW LEVEL SECURITY;

-- RLS for review links: only authenticated users who belong to the project's agency
CREATE POLICY "Users can view review links for their deliverables"
  ON public.public_review_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      JOIN public.projects p ON p.id = d.project_id
      WHERE d.id = public_review_links.deliverable_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR p.client_id = auth.uid()
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

CREATE POLICY "Admins and editors can create review links"
  ON public.public_review_links FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.deliverables d
      JOIN public.projects p ON p.id = d.project_id
      WHERE d.id = public_review_links.deliverable_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

CREATE POLICY "Admins and editors can update review links"
  ON public.public_review_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      JOIN public.projects p ON p.id = d.project_id
      WHERE d.id = public_review_links.deliverable_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

CREATE POLICY "Admins and editors can delete review links"
  ON public.public_review_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      JOIN public.projects p ON p.id = d.project_id
      WHERE d.id = public_review_links.deliverable_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

-- RLS for review comments: authenticated users can view comments on their deliverables
CREATE POLICY "Users can view public review comments for their deliverables"
  ON public.public_review_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.public_review_links prl
      JOIN public.deliverables d ON d.id = prl.deliverable_id
      JOIN public.projects p ON p.id = d.project_id
      WHERE prl.id = public_review_comments.review_link_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR p.client_id = auth.uid()
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_review_comments;

-- Trigger for updated_at on review links
CREATE TRIGGER update_public_review_links_updated_at
  BEFORE UPDATE ON public.public_review_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
