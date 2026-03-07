
-- Allow admins/editors to delete deliverable comments
CREATE POLICY "Admins and editors can delete comments"
ON public.deliverable_comments
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid()) OR
  EXISTS (
    SELECT 1
    FROM deliverables d
    JOIN projects p ON p.id = d.project_id
    WHERE d.id = deliverable_comments.deliverable_id
    AND (
      (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR is_project_editor(auth.uid(), p.id)
    )
  )
);

-- Allow admins/editors to update public_review_comments (for resolving)
CREATE POLICY "Admins and editors can update public review comments"
ON public.public_review_comments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public_review_links prl
    JOIN deliverables d ON d.id = prl.deliverable_id
    JOIN projects p ON p.id = d.project_id
    WHERE prl.id = public_review_comments.review_link_id
    AND (
      (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR is_project_editor(auth.uid(), p.id)
    )
  )
);

-- Add is_resolved and resolved columns to public_review_comments
ALTER TABLE public.public_review_comments
ADD COLUMN IF NOT EXISTS is_resolved boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS resolved_by uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resolved_at timestamptz DEFAULT NULL;
