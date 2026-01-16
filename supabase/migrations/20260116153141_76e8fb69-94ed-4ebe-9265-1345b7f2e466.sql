-- Add completed_at column to track when projects are completed
ALTER TABLE public.projects 
ADD COLUMN completed_at timestamp with time zone;

-- Create a trigger to automatically set completed_at when status changes to 'done'
CREATE OR REPLACE FUNCTION public.set_project_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'done', set completed_at if not already set
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = now();
  -- When status changes from 'done' to something else, clear completed_at
  ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER set_project_completed_at_trigger
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_completed_at();

-- Backfill completed_at for existing done projects using updated_at as approximation
UPDATE public.projects 
SET completed_at = updated_at 
WHERE status = 'done' AND completed_at IS NULL;