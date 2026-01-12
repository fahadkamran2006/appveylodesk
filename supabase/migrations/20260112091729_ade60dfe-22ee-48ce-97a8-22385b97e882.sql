-- Fix the auto_archive_project_channel trigger function to remove invalid 'delivered' enum value
-- The project_status enum only has: 'backlog', 'in_progress', 'review', 'done', 'proposal', 'cancelled'
-- 'delivered' is NOT a valid value and causes errors when the trigger fires

CREATE OR REPLACE FUNCTION public.auto_archive_project_channel()
RETURNS TRIGGER AS $$
BEGIN
  -- When project status changes to done, archive the channel
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    UPDATE public.channels
    SET is_archived = true, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  
  -- When project status changes FROM done to something else, unarchive
  IF NEW.status != 'done' AND OLD.status = 'done' THEN
    UPDATE public.channels
    SET is_archived = false, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;