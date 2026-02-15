
-- 1. Change column default for email_enabled to false
ALTER TABLE public.notification_preferences ALTER COLUMN email_enabled SET DEFAULT false;

-- 2. Update the is_email_notification_enabled function to default to false
CREATE OR REPLACE FUNCTION public.is_email_notification_enabled(_user_id uuid, _agency_id uuid, _type notification_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT email_enabled FROM notification_preferences 
     WHERE user_id = _user_id AND agency_id = _agency_id AND notification_type = _type),
    false
  );
$function$;
