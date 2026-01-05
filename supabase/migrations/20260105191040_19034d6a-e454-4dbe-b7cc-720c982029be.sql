-- Drop the existing restrictive INSERT policy on agencies
DROP POLICY IF EXISTS "Authenticated users can create agencies" ON public.agencies;

-- Create a PERMISSIVE INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create agencies"
ON public.agencies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix the SELECT policy - drop restrictive and make permissive
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;

CREATE POLICY "Users can view their agency"
ON public.agencies
FOR SELECT
TO authenticated
USING (user_belongs_to_agency(auth.uid(), id));

-- Fix the UPDATE policy as well
DROP POLICY IF EXISTS "Admins can update their agency" ON public.agencies;

CREATE POLICY "Admins can update their agency"
ON public.agencies
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), id))
WITH CHECK (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), id));