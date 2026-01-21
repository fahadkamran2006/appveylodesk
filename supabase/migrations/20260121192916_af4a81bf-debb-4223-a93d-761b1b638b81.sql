-- Add file_type column to deliverables table
ALTER TABLE public.deliverables 
ADD COLUMN file_type text NOT NULL DEFAULT 'deliverable';

-- Add check constraint for valid file types
ALTER TABLE public.deliverables 
ADD CONSTRAINT deliverables_file_type_check 
CHECK (file_type IN ('asset', 'deliverable'));

-- Create RLS policy allowing clients to upload assets to their projects
CREATE POLICY "Clients can upload assets to their projects"
ON public.deliverables
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id 
    AND p.client_id = auth.uid()
  )
);

-- Create index for faster file_type filtering
CREATE INDEX idx_deliverables_file_type ON public.deliverables(file_type);