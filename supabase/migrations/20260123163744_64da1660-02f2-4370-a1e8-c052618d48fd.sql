-- Create function to recalculate agency storage from actual deliverables
CREATE OR REPLACE FUNCTION public.recalculate_agency_storage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.agencies a
  SET storage_used_bytes = COALESCE(
    (SELECT SUM(COALESCE(d.file_size, 0))
     FROM public.deliverables d
     JOIN public.projects p ON p.id = d.project_id
     WHERE p.agency_id = a.id),
    0
  );
END;
$$;

-- Run it immediately to fix the current mismatch
SELECT public.recalculate_agency_storage();