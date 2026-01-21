-- Add reference_links column to projects table for storing external links (Google Drive, reference URLs, etc.)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS reference_links TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.reference_links IS 'JSON array or newline-separated list of external reference links (Google Drive, reference URLs, etc.)';