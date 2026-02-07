-- Drop the existing trigger that creates channels on every project insert
DROP TRIGGER IF EXISTS trigger_create_project_channel ON public.projects;

-- Create a new function that creates channel when project is approved (status changes from proposal)
CREATE OR REPLACE FUNCTION public.create_channel_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _channel_id UUID;
  _admin_id UUID;
BEGIN
  -- Only create channel when moving FROM proposal to another status
  IF OLD.status = 'proposal' AND NEW.status != 'proposal' THEN
    -- Check if channel already exists
    SELECT id INTO _channel_id
    FROM public.channels
    WHERE project_id = NEW.id AND type = 'project'
    LIMIT 1;
    
    IF _channel_id IS NULL THEN
      -- Create channel for this project
      INSERT INTO public.channels (agency_id, type, project_id, name)
      VALUES (NEW.agency_id, 'project', NEW.id, NEW.title)
      RETURNING id INTO _channel_id;
    END IF;

    -- Add admin (agency creator or first admin)
    SELECT ur.user_id INTO _admin_id
    FROM public.user_roles ur
    WHERE ur.agency_id = NEW.agency_id AND ur.role = 'admin'
    LIMIT 1;

    IF _admin_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, _admin_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Add client if assigned
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, NEW.client_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for channel creation on approval
CREATE TRIGGER trigger_create_channel_on_approval
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_channel_on_approval();

-- Update the existing create_project_channel trigger function to only fire for non-proposal projects
-- This handles when admin creates a project directly (not from a proposal)
CREATE OR REPLACE FUNCTION public.create_project_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _channel_id UUID;
  _admin_id UUID;
BEGIN
  -- Only create channel for new projects that are NOT proposals
  IF NEW.status != 'proposal' THEN
    -- Create channel for this project
    INSERT INTO public.channels (agency_id, type, project_id, name)
    VALUES (NEW.agency_id, 'project', NEW.id, NEW.title)
    RETURNING id INTO _channel_id;

    -- Add admin (agency creator or first admin)
    SELECT ur.user_id INTO _admin_id
    FROM public.user_roles ur
    WHERE ur.agency_id = NEW.agency_id AND ur.role = 'admin'
    LIMIT 1;

    IF _admin_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, _admin_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Add client if assigned
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, NEW.client_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the insert trigger for new projects
CREATE TRIGGER trigger_create_project_channel
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_project_channel();