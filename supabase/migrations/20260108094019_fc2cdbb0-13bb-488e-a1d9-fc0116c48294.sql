-- Drop and recreate to fix ambiguous column reference
DROP FUNCTION IF EXISTS public.accept_agency_invitation(uuid);

CREATE FUNCTION public.accept_agency_invitation(_token uuid)
 RETURNS TABLE(out_agency_id uuid, out_role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv RECORD;
  jwt_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF jwt_email = '' THEN
    RAISE EXCEPTION 'Email missing from session';
  END IF;

  SELECT * INTO inv
  FROM public.agency_invitations i
  WHERE i.id = _token
  LIMIT 1;

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;

  IF lower(inv.email) <> jwt_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address';
  END IF;

  -- Ensure profile exists and is linked to this agency
  INSERT INTO public.profiles (id, email, full_name, agency_id, onboarding_completed)
  VALUES (auth.uid(), jwt_email, inv.full_name, inv.agency_id, false)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        agency_id = EXCLUDED.agency_id,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  -- Assign role for this agency
  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (auth.uid(), inv.agency_id, inv.role)
  ON CONFLICT (user_id, agency_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation accepted
  UPDATE public.agency_invitations
  SET accepted_at = now(),
      accepted_by = auth.uid()
  WHERE id = inv.id;

  out_agency_id := inv.agency_id;
  out_role := inv.role;
  RETURN NEXT;
END;
$function$;