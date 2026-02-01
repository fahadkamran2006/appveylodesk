-- Create enum for notification types
CREATE TYPE public.notification_type AS ENUM (
  'task_assignment',
  'new_message',
  'invoice_sent',
  'invoice_paid',
  'proposal_created',
  'proposal_approved',
  'project_status_change',
  'editor_assigned',
  'deliverable_uploaded',
  'comment_added'
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, agency_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_agency_id ON public.notifications(agency_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notification_preferences_user_agency ON public.notification_preferences(user_id, agency_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (user_id = auth.uid());

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view their own preferences"
ON public.notification_preferences FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
ON public.notification_preferences FOR UPDATE
USING (user_id = auth.uid());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to insert notification (used by triggers)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _agency_id UUID,
  _type notification_type,
  _title TEXT,
  _message TEXT,
  _link TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notification_id UUID;
  _in_app_enabled BOOLEAN;
BEGIN
  -- Check if user has in-app notifications enabled for this type
  SELECT COALESCE(
    (SELECT in_app_enabled FROM notification_preferences 
     WHERE user_id = _user_id AND agency_id = _agency_id AND notification_type = _type),
    true
  ) INTO _in_app_enabled;

  IF _in_app_enabled THEN
    INSERT INTO notifications (user_id, agency_id, type, title, message, link, metadata)
    VALUES (_user_id, _agency_id, _type, _title, _message, _link, _metadata)
    RETURNING id INTO _notification_id;
  END IF;

  RETURN _notification_id;
END;
$$;

-- Create function to check if email notification is enabled
CREATE OR REPLACE FUNCTION public.is_email_notification_enabled(
  _user_id UUID,
  _agency_id UUID,
  _type notification_type
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT email_enabled FROM notification_preferences 
     WHERE user_id = _user_id AND agency_id = _agency_id AND notification_type = _type),
    true
  );
$$;

-- Create trigger function for project editor assignment
CREATE OR REPLACE FUNCTION public.notify_editor_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
  _editor_name TEXT;
BEGIN
  -- Get project details
  SELECT p.*, a.name as agency_name 
  INTO _project
  FROM projects p
  JOIN agencies a ON a.id = p.agency_id
  WHERE p.id = NEW.project_id;

  -- Create notification for the editor
  PERFORM create_notification(
    NEW.editor_id,
    _project.agency_id,
    'editor_assigned',
    'New Project Assignment',
    'You have been assigned to project: ' || _project.title,
    '/editor/projects',
    jsonb_build_object('project_id', NEW.project_id, 'project_title', _project.title)
  );

  RETURN NEW;
END;
$$;

-- Create trigger for editor assignment
CREATE TRIGGER on_editor_assigned
AFTER INSERT ON public.project_editors
FOR EACH ROW
EXECUTE FUNCTION notify_editor_assignment();

-- Create trigger function for project status changes
CREATE OR REPLACE FUNCTION public.notify_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _participant RECORD;
  _status_text TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  _status_text := CASE NEW.status
    WHEN 'backlog' THEN 'Backlog'
    WHEN 'in_progress' THEN 'In Progress'
    WHEN 'review' THEN 'Review'
    WHEN 'done' THEN 'Completed'
    WHEN 'proposal' THEN 'Proposal'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE NEW.status::TEXT
  END;

  -- Notify client if assigned
  IF NEW.client_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.client_id,
      NEW.agency_id,
      'project_status_change',
      'Project Status Updated',
      'Project "' || NEW.title || '" is now ' || _status_text,
      '/client/projects',
      jsonb_build_object('project_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  -- Notify assigned editors
  FOR _participant IN 
    SELECT editor_id FROM project_editors WHERE project_id = NEW.id
  LOOP
    PERFORM create_notification(
      _participant.editor_id,
      NEW.agency_id,
      'project_status_change',
      'Project Status Updated',
      'Project "' || NEW.title || '" is now ' || _status_text,
      '/editor/projects',
      jsonb_build_object('project_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for project status changes
CREATE TRIGGER on_project_status_change
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION notify_project_status_change();

-- Create trigger function for new proposals
CREATE OR REPLACE FUNCTION public.notify_new_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin RECORD;
  _client_name TEXT;
BEGIN
  -- Only trigger for new proposals
  IF NEW.status != 'proposal' THEN
    RETURN NEW;
  END IF;

  -- Get client name
  SELECT COALESCE(full_name, email) INTO _client_name
  FROM profiles WHERE id = NEW.client_id;

  -- Notify all admins in the agency
  FOR _admin IN 
    SELECT user_id FROM user_roles WHERE agency_id = NEW.agency_id AND role = 'admin'
  LOOP
    PERFORM create_notification(
      _admin.user_id,
      NEW.agency_id,
      'proposal_created',
      'New Project Proposal',
      COALESCE(_client_name, 'A client') || ' submitted a proposal: ' || NEW.title,
      '/admin/projects',
      jsonb_build_object('project_id', NEW.id, 'client_id', NEW.client_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for new proposals
CREATE TRIGGER on_new_proposal
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION notify_new_proposal();

-- Create trigger function for invoice status changes
CREATE OR REPLACE FUNCTION public.notify_invoice_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
  _admin RECORD;
BEGIN
  -- Get project details
  SELECT * INTO _project FROM projects WHERE id = NEW.project_id;

  -- Notify client when invoice is sent (created)
  IF TG_OP = 'INSERT' THEN
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

  -- Notify admins when invoice is paid
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
$$;

-- Create triggers for invoices
CREATE TRIGGER on_invoice_created
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION notify_invoice_change();

CREATE TRIGGER on_invoice_updated
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION notify_invoice_change();

-- Create trigger function for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel RECORD;
  _sender_name TEXT;
  _participant RECORD;
  _link TEXT;
  _user_role app_role;
BEGIN
  -- Get channel details
  SELECT c.*, p.title as project_title
  INTO _channel
  FROM channels c
  LEFT JOIN projects p ON p.id = c.project_id
  WHERE c.id = NEW.channel_id;

  -- Get sender name
  SELECT COALESCE(full_name, email) INTO _sender_name
  FROM profiles WHERE id = NEW.sender_id;

  -- Notify all other participants in the channel
  FOR _participant IN 
    SELECT cp.user_id, ur.role
    FROM channel_participants cp
    JOIN user_roles ur ON ur.user_id = cp.user_id AND ur.agency_id = _channel.agency_id
    WHERE cp.channel_id = NEW.channel_id AND cp.user_id != NEW.sender_id
  LOOP
    -- Determine the correct link based on user role
    _link := CASE _participant.role
      WHEN 'admin' THEN '/admin/messages'
      WHEN 'client' THEN '/client/messages'
      WHEN 'editor' THEN '/editor/messages'
      ELSE '/messages'
    END;

    PERFORM create_notification(
      _participant.user_id,
      _channel.agency_id,
      'new_message',
      'New Message',
      COALESCE(_sender_name, 'Someone') || ': ' || LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
      _link,
      jsonb_build_object('channel_id', NEW.channel_id, 'message_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for new messages
CREATE TRIGGER on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();

-- Create trigger for updated_at on notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();