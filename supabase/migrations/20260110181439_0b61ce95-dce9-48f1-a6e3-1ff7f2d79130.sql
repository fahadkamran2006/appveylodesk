-- Drop existing functions that may have different signatures
DROP FUNCTION IF EXISTS public.create_project_channel(uuid, uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_project_channel(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_project_channel(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_project_channel(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_project_channel(uuid);

-- Function to create project chat with all participants
CREATE OR REPLACE FUNCTION public.create_project_channel(
  _project_id uuid,
  _agency_id uuid,
  _admin_id uuid,
  _client_id uuid DEFAULT NULL,
  _editor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
BEGIN
  -- Check if project channel already exists
  SELECT id INTO _channel_id
  FROM public.channels
  WHERE project_id = _project_id AND type = 'project'
  LIMIT 1;
  
  -- Return existing channel if found
  IF _channel_id IS NOT NULL THEN
    RETURN _channel_id;
  END IF;
  
  -- Create new project channel
  INSERT INTO public.channels (type, agency_id, project_id, name)
  VALUES ('project', _agency_id, _project_id, NULL)
  RETURNING id INTO _channel_id;
  
  -- Add admin as participant
  INSERT INTO public.channel_participants (channel_id, user_id)
  VALUES (_channel_id, _admin_id);
  
  -- Add client if provided
  IF _client_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _client_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Add editor if provided
  IF _editor_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _editor_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN _channel_id;
END;
$$;

-- Function to add participant to project channel (for when editors are assigned later)
CREATE OR REPLACE FUNCTION public.add_project_channel_participant(
  _project_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
BEGIN
  -- Get project channel
  SELECT id INTO _channel_id
  FROM public.channels
  WHERE project_id = _project_id AND type = 'project'
  LIMIT 1;
  
  -- If channel exists, add participant
  IF _channel_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Trigger function to auto-archive project channel when project status is done/delivered
CREATE OR REPLACE FUNCTION public.auto_archive_project_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When project status changes to done or delivered, archive the channel
  IF NEW.status IN ('done', 'delivered') AND OLD.status NOT IN ('done', 'delivered') THEN
    UPDATE public.channels
    SET is_archived = true, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  
  -- When project status changes FROM done/delivered to something else, unarchive
  IF NEW.status NOT IN ('done', 'delivered') AND OLD.status IN ('done', 'delivered') THEN
    UPDATE public.channels
    SET is_archived = false, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-archiving
DROP TRIGGER IF EXISTS trigger_auto_archive_project_channel ON public.projects;
CREATE TRIGGER trigger_auto_archive_project_channel
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_project_channel();

-- Trigger function to add editor to project channel when assigned
CREATE OR REPLACE FUNCTION public.auto_add_editor_to_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add editor to project channel
  PERFORM public.add_project_channel_participant(NEW.project_id, NEW.editor_id);
  RETURN NEW;
END;
$$;

-- Create trigger for auto-adding editors to project channels
DROP TRIGGER IF EXISTS trigger_add_editor_to_channel ON public.project_editors;
CREATE TRIGGER trigger_add_editor_to_channel
  AFTER INSERT ON public.project_editors
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_editor_to_channel();

-- Add unique constraint on channel_participants to prevent duplicates (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channel_participants_unique_user_channel'
  ) THEN
    ALTER TABLE public.channel_participants 
      ADD CONSTRAINT channel_participants_unique_user_channel 
      UNIQUE (channel_id, user_id);
  END IF;
END $$;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.create_project_channel(uuid, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_channel_participant(uuid, uuid) TO authenticated;