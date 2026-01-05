-- Invitations table for inviting clients/editors without creating placeholder auth users
CREATE TABLE IF NOT EXISTS public.agency_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  role public.app_role NOT NULL,
  invited_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE NULL,
  accepted_by UUID NULL
);

ALTER TABLE public.agency_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage invitations within their agency
DROP POLICY IF EXISTS "Admins can view invitations in their agency" ON public.agency_invitations;
CREATE POLICY "Admins can view invitations in their agency"
ON public.agency_invitations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can create invitations in their agency" ON public.agency_invitations;
CREATE POLICY "Admins can create invitations in their agency"
ON public.agency_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
  AND invited_by = auth.uid()
);

DROP POLICY IF EXISTS "Admins can update invitations in their agency" ON public.agency_invitations;
CREATE POLICY "Admins can update invitations in their agency"
ON public.agency_invitations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete invitations in their agency" ON public.agency_invitations;
CREATE POLICY "Admins can delete invitations in their agency"
ON public.agency_invitations
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
);

-- Accept invitation: assigns agency + role to the currently authenticated user.
-- Uses SECURITY DEFINER to avoid fragile client-side role writes.
CREATE OR REPLACE FUNCTION public.accept_agency_invitation(_token uuid)
RETURNS TABLE (agency_id uuid, role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  agency_id := inv.agency_id;
  role := inv.role;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_agency_invitation(uuid) TO authenticated;

-- Tighten role self-assignment policy (prevents joining arbitrary agencies)
DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;
CREATE POLICY "Users can assign themselves as agency admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'admin'
  AND EXISTS (
    SELECT 1
    FROM public.agencies a
    WHERE a.id = agency_id
      AND a.created_by = auth.uid()
  )
);
