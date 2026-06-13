
-- Restrict what clients can update on their own invoices.
-- Without column-level RLS, we use a BEFORE UPDATE trigger that rejects
-- changes to financial / status fields when the updater is the client
-- (i.e. not an admin/staff of the invoice's agency).

CREATE OR REPLACE FUNCTION public.enforce_client_invoice_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_privileged boolean := false;
BEGIN
  -- Service role / no auth context: allow (server-side flows)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins, managers, editors, and staff in the invoice's agency can update freely.
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.agency_id = NEW.agency_id
      AND ur.role IN ('admin','manager','editor','staff')
  ) INTO _is_privileged;

  IF _is_privileged THEN
    RETURN NEW;
  END IF;

  -- Otherwise treat as the client: only payment_proof_url (and updated_at) may change.
  IF NEW.status            IS DISTINCT FROM OLD.status            OR
     NEW.amount            IS DISTINCT FROM OLD.amount            OR
     NEW.subtotal          IS DISTINCT FROM OLD.subtotal          OR
     NEW.tax_rate          IS DISTINCT FROM OLD.tax_rate          OR
     NEW.tax_amount        IS DISTINCT FROM OLD.tax_amount        OR
     NEW.paid_at           IS DISTINCT FROM OLD.paid_at           OR
     NEW.due_date          IS DISTINCT FROM OLD.due_date          OR
     NEW.invoice_number    IS DISTINCT FROM OLD.invoice_number    OR
     NEW.payment_method_id IS DISTINCT FROM OLD.payment_method_id OR
     NEW.payment_link      IS DISTINCT FROM OLD.payment_link      OR
     NEW.notes             IS DISTINCT FROM OLD.notes             OR
     NEW.project_id        IS DISTINCT FROM OLD.project_id        OR
     NEW.container_id      IS DISTINCT FROM OLD.container_id      OR
     NEW.client_id         IS DISTINCT FROM OLD.client_id         OR
     NEW.agency_id         IS DISTINCT FROM OLD.agency_id         OR
     NEW.created_at        IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_UPDATE_FORBIDDEN: clients can only upload payment proof'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_client_invoice_update_scope_trg ON public.invoices;
CREATE TRIGGER enforce_client_invoice_update_scope_trg
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_invoice_update_scope();
