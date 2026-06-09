
ALTER TABLE public.agency_invitations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Extend accept_agency_invitation to create staff_members row when role='staff'
CREATE OR REPLACE FUNCTION public.accept_agency_invitation(_token uuid)
 RETURNS TABLE(out_agency_id uuid, out_role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv RECORD;
  jwt_email TEXT;
  _mc_id UUID;
  _staff_role_id UUID;
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

  INSERT INTO public.profiles (id, email, full_name, agency_id, onboarding_completed)
  VALUES (auth.uid(), jwt_email, inv.full_name, inv.agency_id, false)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        agency_id = EXCLUDED.agency_id,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (auth.uid(), inv.agency_id, inv.role)
  ON CONFLICT (user_id, agency_id) DO UPDATE
    SET role = EXCLUDED.role;

  UPDATE public.agency_invitations
  SET accepted_at = now(),
      accepted_by = auth.uid()
  WHERE id = inv.id;

  -- Managed client transfer (existing logic)
  SELECT id INTO _mc_id FROM public.managed_clients WHERE invitation_id = inv.id;
  IF _mc_id IS NOT NULL THEN
    UPDATE public.project_containers
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.projects
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.invoices
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.managed_clients
      SET activated_at = now(),
          converted_profile_id = auth.uid(),
          updated_at = now()
      WHERE id = _mc_id;
  END IF;

  -- Staff member creation
  IF inv.role = 'staff'::app_role THEN
    _staff_role_id := NULLIF(inv.metadata ->> 'staff_role_id', '')::uuid;
    INSERT INTO public.staff_members (user_id, agency_id, staff_role_id, permission_overrides, created_by)
    VALUES (auth.uid(), inv.agency_id, _staff_role_id, COALESCE(inv.metadata -> 'overrides', '{}'::jsonb), inv.invited_by)
    ON CONFLICT (user_id, agency_id) DO UPDATE
      SET staff_role_id = EXCLUDED.staff_role_id,
          permission_overrides = EXCLUDED.permission_overrides,
          updated_at = now();
  END IF;

  out_agency_id := inv.agency_id;
  out_role := inv.role;
  RETURN NEXT;
END;
$function$;
