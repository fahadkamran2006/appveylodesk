-- Fix error-level finding: restrict profiles table access to authenticated users only
-- This prevents unauthenticated access to sensitive user data (email, full_name, avatar_url)

BEGIN;

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view agency profiles" ON public.profiles;

-- Recreate with explicit authenticated role requirement
CREATE POLICY "Users can view their own profile"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

CREATE POLICY "Users can view agency profiles"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (agency_id = get_user_agency_id(auth.uid()) OR id = auth.uid())
);

-- Add explicit deny policy for anonymous users (defense-in-depth)
DROP POLICY IF EXISTS "Deny anonymous profile access" ON public.profiles;
CREATE POLICY "Deny anonymous profile access"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO anon
USING (false);

COMMIT;