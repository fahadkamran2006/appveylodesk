CREATE POLICY "Clients can create video requests"
ON public.projects
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role)
  AND client_id = auth.uid()
  AND status = 'request'::project_status
);