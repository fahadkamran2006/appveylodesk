-- Create function to auto-send DM when client submits a proposal
CREATE OR REPLACE FUNCTION public.auto_dm_on_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id UUID;
  _channel_id UUID;
  _client_name TEXT;
  _message_content TEXT;
BEGIN
  -- Only run for new proposals from clients
  IF NEW.status != 'proposal' OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the admin for this agency
  SELECT ur.user_id INTO _admin_id
  FROM public.user_roles ur
  WHERE ur.agency_id = NEW.agency_id 
    AND ur.role = 'admin'
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get client name
  SELECT COALESCE(full_name, email) INTO _client_name
  FROM public.profiles
  WHERE id = NEW.client_id;

  -- Get or create DM channel between client and admin
  -- First check if channel exists
  SELECT c.id INTO _channel_id
  FROM public.channels c
  WHERE c.type = 'dm'
    AND c.agency_id = NEW.agency_id
    AND EXISTS (SELECT 1 FROM public.channel_participants WHERE channel_id = c.id AND user_id = NEW.client_id)
    AND EXISTS (SELECT 1 FROM public.channel_participants WHERE channel_id = c.id AND user_id = _admin_id)
    AND (SELECT COUNT(*) FROM public.channel_participants WHERE channel_id = c.id) = 2
  LIMIT 1;

  -- Create channel if not exists
  IF _channel_id IS NULL THEN
    INSERT INTO public.channels (agency_id, type, name)
    VALUES (NEW.agency_id, 'dm', NULL)
    RETURNING id INTO _channel_id;

    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, NEW.client_id), (_channel_id, _admin_id);
  END IF;

  -- Create the auto-message
  _message_content := '📋 **New Project Proposal**

I''ve submitted a new project proposal: **' || NEW.title || '**

' || COALESCE('Description: ' || NEW.description, '') || '

Please review and let me know the pricing and timeline. Thank you!';

  -- Insert the message from the client
  INSERT INTO public.messages (channel_id, sender_id, content)
  VALUES (_channel_id, NEW.client_id, _message_content);

  RETURN NEW;
END;
$$;

-- Create trigger for auto-DM on proposal creation
DROP TRIGGER IF EXISTS trigger_auto_dm_on_proposal ON public.projects;
CREATE TRIGGER trigger_auto_dm_on_proposal
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_dm_on_proposal();