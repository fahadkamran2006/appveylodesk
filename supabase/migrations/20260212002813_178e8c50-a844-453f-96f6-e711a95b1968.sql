
CREATE OR REPLACE FUNCTION public.notify_video_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _agency_id UUID;
  _project_title TEXT;
  _client_name TEXT;
  _editor_id UUID;
  _admin_id UUID;
BEGIN
  IF OLD.status = 'review' AND (NEW.status = 'done' OR NEW.status = 'in_progress') THEN
    _agency_id := NEW.agency_id;
    _project_title := NEW.title;
    
    SELECT full_name INTO _client_name
    FROM public.profiles
    WHERE id = NEW.client_id;
    
    SELECT editor_id INTO _editor_id
    FROM public.project_editors
    WHERE project_id = NEW.id
    LIMIT 1;
    
    SELECT user_id INTO _admin_id
    FROM public.user_roles
    WHERE agency_id = _agency_id AND role = 'admin'
    LIMIT 1;
    
    IF NEW.status = 'done' THEN
      IF _admin_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _admin_id,
          _agency_id,
          'project_status_change',
          'Video Approved',
          format('%s approved "%s"', COALESCE(_client_name, 'Client'), _project_title),
          '/admin/projects'
        );
      END IF;
      
      IF _editor_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _editor_id,
          _agency_id,
          'project_status_change',
          'Video Approved',
          format('"%s" has been approved by the client', _project_title),
          '/editor/projects'
        );
      END IF;
    ELSIF NEW.status = 'in_progress' THEN
      IF _admin_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _admin_id,
          _agency_id,
          'project_status_change',
          'Revision Requested',
          format('%s requested revision for "%s"', COALESCE(_client_name, 'Client'), _project_title),
          '/admin/projects'
        );
      END IF;
      
      IF _editor_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _editor_id,
          _agency_id,
          'project_status_change',
          'Revision Requested',
          format('Revision requested for "%s"', _project_title),
          '/editor/projects'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
