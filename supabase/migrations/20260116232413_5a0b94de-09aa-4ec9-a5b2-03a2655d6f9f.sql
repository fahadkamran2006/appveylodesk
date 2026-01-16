-- Allow clients to create project proposals (with status 'proposal')
CREATE POLICY "Clients can create project proposals"
ON public.projects
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id = auth.uid()
  AND status = 'proposal'::project_status
);