
-- Add columns
ALTER TABLE public.deliverables
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN linked_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Update RLS: split the old SELECT policy into role-specific ones
DROP POLICY IF EXISTS "Users can view deliverables on their projects" ON public.deliverables;

CREATE POLICY "Admins and editors can view all deliverables"
ON public.deliverables FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id
    AND (
      (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR EXISTS (SELECT 1 FROM project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
    )
  )
);

CREATE POLICY "Clients can view deliverables except quality_check"
ON public.deliverables FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id
    AND p.client_id = auth.uid()
    AND p.status != 'quality_check'
  )
);

-- Admin UPDATE policy for lock/unlock
CREATE POLICY "Admins can update deliverables"
ON public.deliverables FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id
    AND has_role(auth.uid(), 'admin'::app_role)
    AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

-- Admin DELETE policy
CREATE POLICY "Admins can delete deliverables"
ON public.deliverables FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id
    AND has_role(auth.uid(), 'admin'::app_role)
    AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

-- Auto-unlock trigger
CREATE OR REPLACE FUNCTION public.auto_unlock_deliverables_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    UPDATE public.deliverables
    SET is_locked = false
    WHERE linked_invoice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_unlock_on_payment
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_unlock_deliverables_on_payment();
