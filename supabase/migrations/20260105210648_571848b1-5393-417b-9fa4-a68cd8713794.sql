-- Allow admins to insert profiles for invited users in their agency
CREATE POLICY "Admins can insert profiles in their agency"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  AND agency_id = public.get_user_agency_id(auth.uid())
);