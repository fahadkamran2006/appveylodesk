
-- 1. Webhook endpoints table
CREATE TABLE public.webhook_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  events TEXT[] NOT NULL DEFAULT ARRAY['deliverable_uploaded','review_requested','invoice_paid'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own agency webhooks"
ON public.webhook_endpoints FOR ALL
TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()));

CREATE TRIGGER trg_webhook_endpoints_updated
BEFORE UPDATE ON public.webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper: dispatch webhook event via pg_net
CREATE OR REPLACE FUNCTION public.dispatch_webhook_event(_agency_id uuid, _event text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ep RECORD;
  _body jsonb;
BEGIN
  FOR _ep IN
    SELECT * FROM public.webhook_endpoints
    WHERE agency_id = _agency_id AND is_active = true AND _event = ANY(events)
  LOOP
    _body := jsonb_build_object(
      'event', _event,
      'agency_id', _agency_id,
      'created_at', now(),
      'data', _payload
    );
    PERFORM net.http_post(
      url := _ep.url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'X-Veylodesk-Event', _event,
        'X-Veylodesk-Secret', _ep.secret
      ),
      body := _body
    );
  END LOOP;
END;
$$;

-- 3. Trigger: notify on deliverable upload + webhook dispatch
CREATE OR REPLACE FUNCTION public.notify_deliverable_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
  _editor RECORD;
  _uploader_name TEXT;
BEGIN
  IF NEW.file_type IS DISTINCT FROM 'deliverable' THEN
    RETURN NEW;
  END IF;

  SELECT p.*, a.id AS aid FROM projects p JOIN agencies a ON a.id=p.agency_id
    INTO _project WHERE p.id = NEW.project_id;
  IF _project IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name,email) INTO _uploader_name FROM profiles WHERE id = NEW.uploaded_by;

  -- Notify client
  IF _project.client_id IS NOT NULL THEN
    PERFORM create_notification(
      _project.client_id, _project.agency_id, 'deliverable_uploaded'::notification_type,
      'New Deliverable Uploaded',
      COALESCE(_uploader_name,'Editor') || ' uploaded "' || NEW.file_name || '" to ' || _project.title,
      '/client/projects',
      jsonb_build_object('project_id', _project.id, 'deliverable_id', NEW.id)
    );
  END IF;

  -- Notify editors assigned to project (skip uploader)
  FOR _editor IN SELECT editor_id FROM project_editors WHERE project_id = _project.id AND editor_id <> COALESCE(NEW.uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    PERFORM create_notification(
      _editor.editor_id, _project.agency_id, 'deliverable_uploaded'::notification_type,
      'New Deliverable Uploaded',
      COALESCE(_uploader_name,'Someone') || ' uploaded "' || NEW.file_name || '"',
      '/editor/projects',
      jsonb_build_object('project_id', _project.id, 'deliverable_id', NEW.id)
    );
  END LOOP;

  -- Dispatch webhook
  PERFORM dispatch_webhook_event(_project.agency_id, 'deliverable_uploaded', jsonb_build_object(
    'deliverable_id', NEW.id,
    'project_id', _project.id,
    'project_title', _project.title,
    'file_name', NEW.file_name,
    'file_size', NEW.file_size,
    'uploaded_by', NEW.uploaded_by
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deliverable_uploaded ON public.deliverables;
CREATE TRIGGER trg_notify_deliverable_uploaded
AFTER INSERT ON public.deliverables
FOR EACH ROW EXECUTE FUNCTION public.notify_deliverable_uploaded();

-- 4. Trigger: dispatch webhook on review requested (status -> review)
CREATE OR REPLACE FUNCTION public.dispatch_review_requested_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'review' AND OLD.status IS DISTINCT FROM 'review' THEN
    PERFORM dispatch_webhook_event(NEW.agency_id, 'review_requested', jsonb_build_object(
      'project_id', NEW.id,
      'project_title', NEW.title,
      'client_id', NEW.client_id,
      'previous_status', OLD.status
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_review_requested ON public.projects;
CREATE TRIGGER trg_dispatch_review_requested
AFTER UPDATE OF status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.dispatch_review_requested_webhook();

-- 5. Trigger: dispatch webhook on invoice paid
CREATE OR REPLACE FUNCTION public.dispatch_invoice_paid_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    PERFORM dispatch_webhook_event(NEW.agency_id, 'invoice_paid', jsonb_build_object(
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'amount', NEW.amount,
      'currency', NEW.currency,
      'client_id', NEW.client_id,
      'project_id', NEW.project_id,
      'paid_at', NEW.paid_at
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_invoice_paid ON public.invoices;
CREATE TRIGGER trg_dispatch_invoice_paid
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.dispatch_invoice_paid_webhook();

-- 6. Auto-send email when a notification is inserted and user has email enabled
CREATE OR REPLACE FUNCTION public.auto_send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
BEGIN
  SELECT COALESCE(email_enabled, false) INTO _enabled
  FROM notification_preferences
  WHERE user_id = NEW.user_id AND agency_id = NEW.agency_id AND notification_type = NEW.type;

  IF NOT COALESCE(_enabled, false) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://bwfnxidpifugpklczfyo.supabase.co/functions/v1/send-notification-email',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'agency_id', NEW.agency_id,
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'link', NEW.link,
      'metadata', NEW.metadata
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_send_notification_email ON public.notifications;
CREATE TRIGGER trg_auto_send_notification_email
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.auto_send_notification_email();
