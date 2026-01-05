-- Drop existing problematic policies on projects table
DROP POLICY IF EXISTS "Admins can manage all agency projects" ON public.projects;
DROP POLICY IF EXISTS "Clients can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Editors can update assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Editors can view assigned projects" ON public.projects;

-- Create fixed policies for projects table
-- 1. Admins can manage all agency projects
CREATE POLICY "Admins can manage all agency projects" 
ON public.projects 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_belongs_to_agency(auth.uid(), agency_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_belongs_to_agency(auth.uid(), agency_id)
);

-- 2. Clients can view their own projects
CREATE POLICY "Clients can view their projects" 
ON public.projects 
FOR SELECT 
USING (client_id = auth.uid());

-- 3. Editors can view assigned projects (FIXED: was self-referencing)
CREATE POLICY "Editors can view assigned projects" 
ON public.projects 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.project_editors pe
    WHERE pe.project_id = projects.id 
    AND pe.editor_id = auth.uid()
  )
);

-- 4. Editors can update assigned projects (FIXED: was self-referencing)
CREATE POLICY "Editors can update assigned projects" 
ON public.projects 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.project_editors pe
    WHERE pe.project_id = projects.id 
    AND pe.editor_id = auth.uid()
  )
);

-- Fix profiles policies to allow viewing agency members
DROP POLICY IF EXISTS "Admins can view agency profiles" ON public.profiles;

-- Allow users to view profiles in their agency
CREATE POLICY "Users can view agency profiles" 
ON public.profiles 
FOR SELECT 
USING (
  agency_id = get_user_agency_id(auth.uid())
  OR id = auth.uid()
);