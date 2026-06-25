CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT agency_id
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY created_at ASC, agency_id ASC
  LIMIT 1
$function$;