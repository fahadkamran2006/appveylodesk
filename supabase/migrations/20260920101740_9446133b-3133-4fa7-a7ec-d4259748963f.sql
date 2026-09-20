-- Drop the older duplicate trigger/function (superseded by restrict_client_invoice_updates)
DROP TRIGGER IF EXISTS enforce_client_invoice_update_columns_trg ON public.invoices;
DROP FUNCTION IF EXISTS public.enforce_client_invoice_update_columns();

-- Recreate restrict_client_invoice_updates without references to non-existent columns
CREATE OR REPLACE FUNCTION public.restrict_client_invoice_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Client is only allowed to modify payment_proof_url. Any other change is rejected.
  IF (NEW.status               IS DISTINCT FROM OLD.status)
    OR (NEW.amount             IS DISTINCT FROM OLD.amount)
    OR (NEW.subtotal           IS DISTINCT FROM OLD.subtotal)
    OR (NEW.tax_rate           IS DISTINCT FROM OLD.tax_rate)
    OR (NEW.tax_amount         IS DISTINCT FROM OLD.tax_amount)
    OR (NEW.paid_at            IS DISTINCT FROM OLD.paid_at)
    OR (NEW.invoice_number     IS DISTINCT FROM OLD.invoice_number)
    OR (NEW.agency_id          IS DISTINCT FROM OLD.agency_id)
    OR (NEW.client_id          IS DISTINCT FROM OLD.client_id)
    OR (NEW.managed_client_id  IS DISTINCT FROM OLD.managed_client_id)
    OR (NEW.project_id         IS DISTINCT FROM OLD.project_id)
    OR (NEW.container_id       IS DISTINCT FROM OLD.container_id)
    OR (NEW.payment_method_id  IS DISTINCT FROM OLD.payment_method_id)
    OR (NEW.payment_link       IS DISTINCT FROM OLD.payment_link)
    OR (NEW.pdf_url            IS DISTINCT FROM OLD.pdf_url)
    OR (NEW.due_date           IS DISTINCT FROM OLD.due_date)
    OR (NEW.notes              IS DISTINCT FROM OLD.notes)
    OR (NEW.created_at         IS DISTINCT FROM OLD.created_at)
    OR (NEW.id                 IS DISTINCT FROM OLD.id)
  THEN
    RAISE EXCEPTION 'Clients may only update the payment_proof_url on their invoices'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;