-- Fix profiles RLS to properly allow viewing agency members' profiles
-- The issue: profiles.agency_id can be NULL, and we need to match via user_roles table instead

-- Drop the problematic SELECT policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view agency profiles" ON public.profiles;

-- Create a single comprehensive SELECT policy that uses user_roles for agency membership
-- This properly handles the case where agency_id on profiles might be NULL
CREATE POLICY "Authenticated users can view agency member profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Always allow viewing own profile
    id = auth.uid()
    OR
    -- Allow viewing profiles of users in the same agency via user_roles table
    EXISTS (
      SELECT 1 
      FROM public.user_roles ur1
      JOIN public.user_roles ur2 ON ur1.agency_id = ur2.agency_id
      WHERE ur1.user_id = auth.uid()
        AND ur2.user_id = profiles.id
    )
  );