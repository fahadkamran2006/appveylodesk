CREATE OR REPLACE FUNCTION public.notify_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
  _admin RECORD;
  _label text;
BEGIN
  SELECT * INTO _project FROM projects WHERE id = NEW.project_id;
  _label := COALESCE(_project.title, 'your account');

  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL AND NEW.status <> 'draft' THEN
    PERFORM create_notification(
      NEW.client_id,
      NEW.agency_id,
      'invoice_sent',
      'New Invoice',
      'You have received a new invoice for $' || COALESCE(NEW.amount, 0)::TEXT || ' for: ' || _label,
      '/client/invoices',
      jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status <> 'paid' AND NEW.status = 'paid' THEN
    FOR _admin IN
      SELECT user_id FROM user_roles WHERE agency_id = NEW.agency_id AND role = 'admin'
    LOOP
      PERFORM create_notification(
        _admin.user_id,
        NEW.agency_id,
        'invoice_paid',
        'Invoice Paid',
        'Invoice for $' || COALESCE(NEW.amount, 0)::TEXT || ' has been marked as paid',
        '/admin/invoices',
        jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount, 'client_id', NEW.client_id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;