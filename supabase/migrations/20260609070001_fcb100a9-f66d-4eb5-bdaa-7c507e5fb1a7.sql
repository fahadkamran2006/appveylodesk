
-- Allow project_containers to belong to a managed client
ALTER TABLE public.project_containers
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS managed_client_id uuid REFERENCES public.managed_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_containers_managed_client_id
  ON public.project_containers(managed_client_id);

-- Exactly one of client_id / managed_client_id must be set
ALTER TABLE public.project_containers
  DROP CONSTRAINT IF EXISTS project_containers_client_xor_chk;
ALTER TABLE public.project_containers
  ADD CONSTRAINT project_containers_client_xor_chk
  CHECK ((client_id IS NOT NULL)::int + (managed_client_id IS NOT NULL)::int = 1);

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_client_xor_chk;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_client_xor_chk
  CHECK (
    client_id IS NOT NULL
    OR managed_client_id IS NOT NULL
    OR status = 'proposal'
  );

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_client_xor_chk;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_client_xor_chk
  CHECK ((client_id IS NOT NULL)::int + (managed_client_id IS NOT NULL)::int = 1);

-- Extend accept_agency_invitation to also migrate project_containers
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

  out_agency_id := inv.agency_id;
  out_role := inv.role;
  RETURN NEXT;
END;
$function$;
