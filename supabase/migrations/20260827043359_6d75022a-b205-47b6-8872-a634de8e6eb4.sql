-- Add owner fallback policy to agency_invitations so agency creators can manage invitations
-- even if the user_roles row is missing or mismatched.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_invitations TO authenticated;
GRANT ALL ON public.agency_invitations TO service_role;

DROP POLICY IF EXISTS "Agency creators can manage invitations" ON public.agency_invitations;
CREATE POLICY "Agency creators can manage invitations"
ON public.agency_invitations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.agencies a
    WHERE a.id = agency_id
      AND a.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.agencies a
    WHERE a.id = agency_id
      AND a.created_by = auth.uid()
  )
  AND invited_by = auth.uid()
);