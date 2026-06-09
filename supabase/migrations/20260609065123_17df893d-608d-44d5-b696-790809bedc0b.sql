
-- 1. Managed clients table
CREATE TABLE public.managed_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  phone TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  invitation_id UUID REFERENCES public.agency_invitations(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  converted_profile_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX managed_clients_agency_email_uniq
  ON public.managed_clients (agency_id, lower(email))
  WHERE converted_profile_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.managed_clients TO authenticated;
GRANT ALL ON public.managed_clients TO service_role;

ALTER TABLE public.managed_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage their agency's managed clients"
  ON public.managed_clients
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()));

CREATE TRIGGER update_managed_clients_updated_at
  BEFORE UPDATE ON public.managed_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Optional managed_client_id on projects and invoices
ALTER TABLE public.projects
  ADD COLUMN managed_client_id UUID REFERENCES public.managed_clients(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN managed_client_id UUID REFERENCES public.managed_clients(id) ON DELETE SET NULL;

-- Allow invoices to have either a real client OR a managed client (relax NOT NULL)
ALTER TABLE public.invoices ALTER COLUMN client_id DROP NOT NULL;

-- 3. RPC for admins to activate a managed client (creates invitation)
CREATE OR REPLACE FUNCTION public.activate_managed_client(_managed_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mc RECORD;
  _agency_id UUID;
  _invite_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _mc FROM public.managed_clients WHERE id = _managed_id;
  IF _mc IS NULL THEN
    RAISE EXCEPTION 'Managed client not found';
  END IF;

  _agency_id := get_user_agency_id(auth.uid());
  IF NOT has_role(auth.uid(), 'admin'::app_role) OR _mc.agency_id <> _agency_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _mc.activated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Client already activated';
  END IF;

  -- Reuse pending invitation if already created
  IF _mc.invitation_id IS NOT NULL THEN
    RETURN _mc.invitation_id;
  END IF;

  INSERT INTO public.agency_invitations (agency_id, email, full_name, role, invited_by)
  VALUES (_mc.agency_id, lower(_mc.email), _mc.full_name, 'client'::app_role, auth.uid())
  RETURNING id INTO _invite_id;

  UPDATE public.managed_clients
  SET invitation_id = _invite_id, updated_at = now()
  WHERE id = _managed_id;

  RETURN _invite_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_managed_client(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_managed_client(UUID) TO authenticated;

-- 4. Extend accept_agency_invitation to migrate managed-client work
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

  -- If this invitation came from a managed_client, migrate work to the new auth user
  SELECT id INTO _mc_id FROM public.managed_clients WHERE invitation_id = inv.id;
  IF _mc_id IS NOT NULL THEN
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
