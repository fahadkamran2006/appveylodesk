-- Fix warn-level finding: prevent unauthenticated (anon) reads of agency data
-- by scoping SELECT policies to authenticated role and explicitly denying anon.

BEGIN;

-- Replace existing SELECT policy with an authenticated-only version
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
CREATE POLICY "Users can view their agency"
ON public.agencies
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR user_belongs_to_agency(auth.uid(), id)
  )
);

-- Explicitly deny anonymous reads (defense-in-depth)
DROP POLICY IF EXISTS "Deny anonymous agency access" ON public.agencies;
CREATE POLICY "Deny anonymous agency access"
ON public.agencies
AS PERMISSIVE
FOR SELECT
TO anon
USING (false);

COMMIT;