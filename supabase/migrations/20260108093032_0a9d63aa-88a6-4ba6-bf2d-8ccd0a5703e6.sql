-- Allow anyone to read an invitation by its ID (for join pages)
CREATE POLICY "Anyone can view invitation by id for verification"
ON public.agency_invitations
FOR SELECT
USING (true);