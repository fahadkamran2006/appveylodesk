
CREATE OR REPLACE FUNCTION public.notify_invoice_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _project RECORD;
  _admin RECORD;
BEGIN
  SELECT * INTO _project FROM projects WHERE id = NEW.project_id;

  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.client_id,
      NEW.agency_id,
      'invoice_sent',
      'New Invoice',
      'You have received a new invoice for $' || NEW.amount::TEXT || ' for project: ' || _project.title,
      '/client/invoices',
      jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status != 'paid' AND NEW.status = 'paid' THEN
    FOR _admin IN
      SELECT user_id FROM user_roles WHERE agency_id = NEW.agency_id AND role = 'admin'
    LOOP
      PERFORM create_notification(
        _admin.user_id,
        NEW.agency_id,
        'invoice_paid',
        'Invoice Paid',
        'Invoice for $' || NEW.amount::TEXT || ' has been marked as paid',
        '/admin/invoices',
        jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount, 'client_id', NEW.client_id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
