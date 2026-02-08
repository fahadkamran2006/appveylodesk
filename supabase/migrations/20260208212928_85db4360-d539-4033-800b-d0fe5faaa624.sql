-- Add RLS policy for admins to delete profiles of users in their agency
CREATE POLICY "Admins can delete profiles in their agency"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND id != auth.uid()
  AND (
    -- Check if the target user belongs to the same agency as the admin
    EXISTS (
      SELECT 1 FROM public.user_roles ur_admin
      JOIN public.user_roles ur_target ON ur_target.agency_id = ur_admin.agency_id
      WHERE ur_admin.user_id = auth.uid()
        AND ur_admin.role = 'admin'
        AND ur_target.user_id = profiles.id
    )
  )
);