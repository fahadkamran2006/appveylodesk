
-- 1. Add container_id column to channels table
ALTER TABLE public.channels ADD COLUMN container_id UUID REFERENCES public.project_containers(id) ON DELETE CASCADE;

-- 2. Drop ALL per-video channel creation triggers (they cause duplicates + wrong level)
DROP TRIGGER IF EXISTS trigger_create_project_channel ON public.projects;
DROP TRIGGER IF EXISTS on_project_created_create_channel ON public.projects;
DROP TRIGGER IF EXISTS trigger_create_channel_on_approval ON public.projects;

-- 3. Drop duplicate editor-to-channel triggers  
DROP TRIGGER IF EXISTS trigger_add_editor_to_channel ON public.project_editors;
DROP TRIGGER IF EXISTS on_editor_assigned_add_to_channel ON public.project_editors;

-- 4. Drop archive triggers (containers don't have status)
DROP TRIGGER IF EXISTS on_project_status_change_archive_channel ON public.projects;
DROP TRIGGER IF EXISTS trigger_auto_archive_project_channel ON public.projects;

-- 5. Create function to create channel when a project container is created
CREATE OR REPLACE FUNCTION public.create_container_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _channel_id UUID;
  _admin_id UUID;
BEGIN
  -- Create channel for this container
  INSERT INTO public.channels (agency_id, type, container_id, name)
  VALUES (NEW.agency_id, 'project', NEW.id, NEW.title)
  RETURNING id INTO _channel_id;

  -- Add admin (first admin in agency)
  SELECT ur.user_id INTO _admin_id
  FROM public.user_roles ur
  WHERE ur.agency_id = NEW.agency_id AND ur.role = 'admin'
  LIMIT 1;

  IF _admin_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _admin_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Add client
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, NEW.client_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_container_channel
AFTER INSERT ON public.project_containers
FOR EACH ROW EXECUTE FUNCTION public.create_container_channel();

-- 6. Create function to add editor to container channel when assigned to a video
CREATE OR REPLACE FUNCTION public.add_editor_to_container_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _container_id UUID;
  _channel_id UUID;
BEGIN
  -- Get container_id from the project (video)
  SELECT container_id INTO _container_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF _container_id IS NOT NULL THEN
    -- Find the container's channel
    SELECT id INTO _channel_id
    FROM public.channels
    WHERE container_id = _container_id AND type = 'project'
    LIMIT 1;

    IF _channel_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, NEW.editor_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_add_editor_to_container_channel
AFTER INSERT ON public.project_editors
FOR EACH ROW EXECUTE FUNCTION public.add_editor_to_container_channel();

-- 7. Clean up existing duplicate/per-video channels
-- Delete all per-video project channels (they'll be recreated at container level)
DELETE FROM public.channels WHERE type = 'project' AND project_id IS NOT NULL;
