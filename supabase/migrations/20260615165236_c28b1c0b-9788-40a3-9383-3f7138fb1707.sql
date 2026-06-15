
DROP POLICY IF EXISTS "Users can view agency projects" ON public.projects;

CREATE POLICY "Non-clients can view agency projects"
ON public.projects
FOR SELECT
USING (
  agency_id = public.get_user_agency_id(auth.uid())
  AND NOT public.has_role(auth.uid(), 'client'::app_role)
);

CREATE POLICY "Clients can view their own projects"
ON public.projects
FOR SELECT
USING (
  client_id = auth.uid()
  AND public.has_role(auth.uid(), 'client'::app_role)
);
