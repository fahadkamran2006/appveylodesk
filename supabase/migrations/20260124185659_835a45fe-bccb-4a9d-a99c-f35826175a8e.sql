-- Allow authenticated users to view user_roles of members in the same agency
-- This is required for the profiles RLS policy JOIN to work for Clients/Editors
CREATE POLICY "Users can view roles of agency members"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT ur.agency_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);