CREATE POLICY "Admins can update profiles in their agency"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM user_roles ur_admin
    JOIN user_roles ur_target ON ur_target.agency_id = ur_admin.agency_id
    WHERE ur_admin.user_id = auth.uid()
    AND ur_admin.role = 'admin'::app_role
    AND ur_target.user_id = profiles.id
  )
);