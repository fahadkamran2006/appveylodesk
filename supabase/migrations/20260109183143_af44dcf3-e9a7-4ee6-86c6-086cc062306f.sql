-- Add subscription plan and storage tracking to agencies
ALTER TABLE public.agencies
ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'pro')),
ADD COLUMN storage_limit_bytes BIGINT NOT NULL DEFAULT 214748364800, -- 200GB in bytes
ADD COLUMN storage_used_bytes BIGINT NOT NULL DEFAULT 0;

-- Create table for timestamped video comments
CREATE TABLE public.deliverable_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deliverable_id UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  timestamp_seconds NUMERIC NOT NULL, -- The exact timestamp in seconds
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on deliverable_comments
ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for deliverable_comments
-- Users can view comments on deliverables they have access to
CREATE POLICY "Users can view comments on accessible deliverables"
ON public.deliverable_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = deliverable_comments.deliverable_id
    AND (
      p.client_id = auth.uid()
      OR (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
    )
  )
);

-- Users can create comments on deliverables they have access to
CREATE POLICY "Users can create comments on accessible deliverables"
ON public.deliverable_comments FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = deliverable_comments.deliverable_id
    AND (
      p.client_id = auth.uid()
      OR (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
    )
  )
);

-- Editors and admins can update comments (mark as resolved)
CREATE POLICY "Editors and admins can update comments"
ON public.deliverable_comments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = deliverable_comments.deliverable_id
    AND (
      (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
    )
  )
);

-- Create storage bucket for deliverables
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deliverables',
  'deliverables',
  false,
  5368709120, -- 5GB max file size
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska', 
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/zip', 'application/x-zip-compressed',
        'audio/mpeg', 'audio/wav', 'audio/aac']
);

-- Storage policies for deliverables bucket
-- Admins can manage all files in their agency's projects
CREATE POLICY "Admins can manage deliverable files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.file_url LIKE '%' || name
    AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
)
WITH CHECK (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin')
);

-- Editors can upload/delete files in their assigned projects
CREATE POLICY "Editors can manage files in assigned projects"
ON storage.objects FOR ALL
USING (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.project_editors pe
    JOIN public.projects p ON p.id = pe.project_id
    WHERE pe.editor_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
)
WITH CHECK (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.project_editors pe
    JOIN public.projects p ON p.id = pe.project_id
    WHERE pe.editor_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- Clients can view files and upload assets in their projects
CREATE POLICY "Clients can view and upload in their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.client_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Clients can upload assets in their projects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.client_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- Function to update agency storage when deliverables change
CREATE OR REPLACE FUNCTION public.update_agency_storage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agency_id UUID;
  _file_size BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get agency_id from the project
    SELECT p.agency_id INTO _agency_id
    FROM public.projects p
    WHERE p.id = NEW.project_id;
    
    -- Add file size to agency storage
    UPDATE public.agencies
    SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.file_size, 0)
    WHERE id = _agency_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Get agency_id from the project
    SELECT p.agency_id INTO _agency_id
    FROM public.projects p
    WHERE p.id = OLD.project_id;
    
    -- Subtract file size from agency storage
    UPDATE public.agencies
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.file_size, 0))
    WHERE id = _agency_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Trigger to update storage on deliverable changes
CREATE TRIGGER update_storage_on_deliverable_change
AFTER INSERT OR DELETE ON public.deliverables
FOR EACH ROW
EXECUTE FUNCTION public.update_agency_storage();

-- Function to check storage limit before upload
CREATE OR REPLACE FUNCTION public.check_storage_limit(_agency_id UUID, _file_size BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (storage_used_bytes + _file_size) <= storage_limit_bytes
  FROM public.agencies
  WHERE id = _agency_id;
$$;

-- Add trigger to update updated_at on deliverable_comments
CREATE TRIGGER update_deliverable_comments_updated_at
BEFORE UPDATE ON public.deliverable_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();