
-- 1) Restrict client invoice updates to payment_proof_url only via trigger
CREATE OR REPLACE FUNCTION public.restrict_client_invoice_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only apply the restriction to non-admin actors updating their own invoice as a client.
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS DISTINCT FROM auth.uid() THEN
    -- Not the client on this row; let other policies decide (or fail).
    RETURN NEW;
  END IF;

  -- Client is only allowed to modify payment_proof_url. Any other change is rejected.
  IF (NEW.status               IS DISTINCT FROM OLD.status)
    OR (NEW.amount             IS DISTINCT FROM OLD.amount)
    OR (NEW.currency           IS DISTINCT FROM OLD.currency)
    OR (NEW.paid_at            IS DISTINCT FROM OLD.paid_at)
    OR (NEW.invoice_number     IS DISTINCT FROM OLD.invoice_number)
    OR (NEW.agency_id          IS DISTINCT FROM OLD.agency_id)
    OR (NEW.client_id          IS DISTINCT FROM OLD.client_id)
    OR (NEW.managed_client_id  IS DISTINCT FROM OLD.managed_client_id)
    OR (NEW.project_id         IS DISTINCT FROM OLD.project_id)
    OR (NEW.due_date           IS DISTINCT FROM OLD.due_date)
    OR (NEW.issued_at          IS DISTINCT FROM OLD.issued_at)
    OR (NEW.notes              IS DISTINCT FROM OLD.notes)
    OR (NEW.description        IS DISTINCT FROM OLD.description)
    OR (NEW.created_at         IS DISTINCT FROM OLD.created_at)
    OR (NEW.id                 IS DISTINCT FROM OLD.id)
  THEN
    RAISE EXCEPTION 'Clients may only update the payment_proof_url on their invoices'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_client_invoice_updates ON public.invoices;
CREATE TRIGGER trg_restrict_client_invoice_updates
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_client_invoice_updates();

-- 2) Exclude clients from broad drive_files SELECT policy
DROP POLICY IF EXISTS "Agency members view drive files" ON public.drive_files;
CREATE POLICY "Agency members view drive files"
  ON public.drive_files
  FOR SELECT
  USING (
    user_belongs_to_agency(auth.uid(), agency_id)
    AND NOT has_role(auth.uid(), 'client'::app_role)
    AND (
      deleted_at IS NULL
      OR uploaded_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );
