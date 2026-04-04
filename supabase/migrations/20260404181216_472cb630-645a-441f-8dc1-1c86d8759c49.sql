
CREATE OR REPLACE FUNCTION public.auto_move_to_quality_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only for deliverable file types (not assets)
  IF NEW.file_type = 'deliverable' THEN
    UPDATE public.projects
    SET status = 'quality_check', updated_at = now()
    WHERE id = NEW.project_id
      AND status IN ('in_progress', 'review');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_move_to_quality_check
AFTER INSERT ON public.deliverables
FOR EACH ROW
EXECUTE FUNCTION public.auto_move_to_quality_check();
