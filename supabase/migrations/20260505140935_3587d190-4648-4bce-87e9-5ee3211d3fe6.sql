DROP POLICY IF EXISTS "Super admins can read leads" ON public.lead_magnet_subscribers;

CREATE POLICY "Super admins can read leads"
ON public.lead_magnet_subscribers
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));