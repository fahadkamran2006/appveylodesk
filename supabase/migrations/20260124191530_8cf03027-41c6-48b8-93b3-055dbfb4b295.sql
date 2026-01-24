-- Fix infinite recursion in user_roles RLS by removing self-referencing policy
-- and switching profiles access to a SECURITY DEFINER helper.

-- 1) Remove the recursive policy (it queries public.user_roles inside a policy on public.user_roles)
DROP POLICY IF EXISTS "Users can view roles of agency members" ON public.user_roles;

-- 2) Create helper to safely check if two users share an agency (bypasses RLS)
CREATE OR REPLACE FUNCTION public.users_share_agency(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles a
    JOIN public.user_roles b ON b.agency_id = a.agency_id
    WHERE a.user_id = _user_a
      AND b.user_id = _user_b
  );
$$;

-- 3) Replace profiles SELECT policy to use the helper (no JOINs that depend on user_roles SELECT visibility)
DROP POLICY IF EXISTS "Authenticated users can view agency member profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view agency member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (id = auth.uid())
  OR public.users_share_agency(auth.uid(), id)
);