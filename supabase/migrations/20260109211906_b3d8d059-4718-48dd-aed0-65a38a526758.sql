
-- Add proposal status to project_status enum
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'proposal';

-- Add cancellation_requested status
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Create cancellation_requests table for client cancellation requests
CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on cancellation_requests
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for cancellation_requests
CREATE POLICY "Admins can manage all cancellation requests"
ON public.cancellation_requests
FOR ALL
USING (has_role(auth.uid(), 'admin') AND EXISTS (
  SELECT 1 FROM projects p WHERE p.id = cancellation_requests.project_id AND p.agency_id = get_user_agency_id(auth.uid())
));

CREATE POLICY "Clients can view and create their own cancellation requests"
ON public.cancellation_requests
FOR SELECT
USING (requested_by = auth.uid());

CREATE POLICY "Clients can create cancellation requests for their projects"
ON public.cancellation_requests
FOR INSERT
WITH CHECK (
  requested_by = auth.uid() AND
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.client_id = auth.uid())
);

-- Add budget column to projects if not exists (for pricing)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget NUMERIC DEFAULT NULL;

-- Add editor_rate column to projects for admin cost tracking
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS editor_rate NUMERIC DEFAULT NULL;

-- Allow admins to delete projects
CREATE POLICY "Admins can delete agency projects"
ON public.projects
FOR DELETE
USING (has_role(auth.uid(), 'admin') AND agency_id = get_user_agency_id(auth.uid()));

-- Allow editors to view their assigned projects (not just select from project_editors)
CREATE POLICY "Editors can view assigned projects"
ON public.projects
FOR SELECT
USING (is_project_editor(auth.uid(), id));

-- Update trigger for cancellation_requests
CREATE TRIGGER update_cancellation_requests_updated_at
BEFORE UPDATE ON public.cancellation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
