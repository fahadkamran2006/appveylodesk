DROP POLICY IF EXISTS "Users can view their channels" ON public.channels;
CREATE POLICY "Users can view their channels"
ON public.channels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channel_participants cp
    WHERE cp.channel_id = channels.id AND cp.user_id = auth.uid()
  )
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.user_belongs_to_agency(auth.uid(), agency_id)
  )
);