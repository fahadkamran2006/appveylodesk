-- Create project_containers table for the middle tier (Client > Container > Video)
CREATE TABLE public.project_containers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add container_id to projects table FIRST (before RLS policies reference it)
ALTER TABLE public.projects 
ADD COLUMN container_id UUID;

-- Enable RLS
ALTER TABLE public.project_containers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_containers
CREATE POLICY "Admins can manage agency project containers"
ON public.project_containers
FOR ALL
USING (
  has_role(auth.uid(), 'admin') 
  AND agency_id = get_user_agency_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin') 
  AND agency_id = get_user_agency_id(auth.uid())
);

CREATE POLICY "Clients can view their project containers"
ON public.project_containers
FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Editors can view containers for assigned projects"
ON public.project_containers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.project_editors pe ON pe.project_id = p.id
    WHERE p.container_id = project_containers.id
    AND pe.editor_id = auth.uid()
  )
);

-- Add foreign key constraint after column exists
ALTER TABLE public.projects 
ADD CONSTRAINT fk_projects_container 
FOREIGN KEY (container_id) REFERENCES public.project_containers(id) ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX idx_projects_container_id ON public.projects(container_id);
CREATE INDEX idx_project_containers_client_id ON public.project_containers(client_id);
CREATE INDEX idx_project_containers_agency_id ON public.project_containers(agency_id);

-- Trigger for updated_at
CREATE TRIGGER update_project_containers_updated_at
BEFORE UPDATE ON public.project_containers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if container belongs to agency
CREATE OR REPLACE FUNCTION public.container_belongs_to_agency(_container_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_containers pc
    WHERE pc.id = _container_id
      AND pc.agency_id = _agency_id
  )
$$;