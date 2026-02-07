-- Add 'paid' and 'archived' values to project_status enum
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'archived';

-- Create a function to notify users when video is approved or revision requested
CREATE OR REPLACE FUNCTION public.notify_video_approval()
RETURNS TRIGGER AS $$
DECLARE
  _agency_id UUID;
  _project_title TEXT;
  _client_name TEXT;
  _editor_id UUID;
  _admin_id UUID;
BEGIN
  -- Only trigger on status changes to 'done' (approved) or 'in_progress' (revision)
  IF OLD.status = 'review' AND (NEW.status = 'done' OR NEW.status = 'in_progress') THEN
    -- Get project details
    _agency_id := NEW.agency_id;
    _project_title := NEW.title;
    
    -- Get client name
    SELECT full_name INTO _client_name
    FROM public.profiles
    WHERE id = NEW.client_id;
    
    -- Get assigned editor
    SELECT editor_id INTO _editor_id
    FROM public.project_editors
    WHERE project_id = NEW.id
    LIMIT 1;
    
    -- Get admin (first admin in agency)
    SELECT user_id INTO _admin_id
    FROM public.user_roles
    WHERE agency_id = _agency_id AND role = 'admin'
    LIMIT 1;
    
    IF NEW.status = 'done' THEN
      -- Video was approved - notify admin
      IF _admin_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _agency_id,
          '/admin/projects',
          format('%s approved "%s"', COALESCE(_client_name, 'Client'), _project_title),
          NULL,
          'Video Approved',
          'project_status_change',
          _admin_id
        );
      END IF;
      
      -- Notify editor if assigned
      IF _editor_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _agency_id,
          '/editor/projects',
          format('"%s" has been approved by the client', _project_title),
          NULL,
          'Video Approved',
          'project_status_change',
          _editor_id
        );
      END IF;
    ELSIF NEW.status = 'in_progress' THEN
      -- Revision requested - notify admin
      IF _admin_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _agency_id,
          '/admin/projects',
          format('%s requested revision for "%s"', COALESCE(_client_name, 'Client'), _project_title),
          NULL,
          'Revision Requested',
          'project_status_change',
          _admin_id
        );
      END IF;
      
      -- Notify editor if assigned
      IF _editor_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _agency_id,
          '/editor/projects',
          format('Revision requested for "%s"', _project_title),
          NULL,
          'Revision Requested',
          'project_status_change',
          _editor_id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for video approval notifications
DROP TRIGGER IF EXISTS trigger_video_approval_notification ON public.projects;
CREATE TRIGGER trigger_video_approval_notification
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_video_approval();

-- Update RLS policy for projects to allow clients to update status from review to done or in_progress
DROP POLICY IF EXISTS "Clients can approve their review videos" ON public.projects;
CREATE POLICY "Clients can approve their review videos"
  ON public.projects
  FOR UPDATE
  USING (
    auth.uid() = client_id 
    AND status = 'review'
  )
  WITH CHECK (
    auth.uid() = client_id 
    AND (status = 'done' OR status = 'in_progress')
  );