
-- Trigger to ensure clients can only modify payment_proof_url on their invoices
CREATE OR REPLACE FUNCTION public.enforce_client_invoice_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for non-admins editing their own invoice as the client
  IF auth.uid() IS NOT NULL
     AND NEW.client_id = auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.managed_client_id IS DISTINCT FROM OLD.managed_client_id
       OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.linked_invoice_id IS DISTINCT FROM OLD.linked_invoice_id THEN
      RAISE EXCEPTION 'Clients can only update the payment proof on their invoices';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_client_invoice_update_columns_trg ON public.invoices;
CREATE TRIGGER enforce_client_invoice_update_columns_trg
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_client_invoice_update_columns();

-- Tighten the client update policy with an explicit WITH CHECK
DROP POLICY IF EXISTS "Clients can update invoice payment proof" ON public.invoices;
CREATE POLICY "Clients can update invoice payment proof"
ON public.invoices
FOR UPDATE
TO authenticated
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());
