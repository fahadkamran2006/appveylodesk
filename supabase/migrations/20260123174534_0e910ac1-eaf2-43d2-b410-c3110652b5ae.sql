-- Drop and recreate the recalculate_agency_storage function with proper WHERE clause
CREATE OR REPLACE FUNCTION public.recalculate_agency_storage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agency_record RECORD;
  calculated_bytes BIGINT;
BEGIN
  -- Loop through each agency and update its storage
  FOR agency_record IN SELECT id FROM agencies LOOP
    -- Calculate total storage used by this agency's projects
    SELECT COALESCE(SUM(d.file_size), 0) INTO calculated_bytes
    FROM deliverables d
    JOIN projects p ON p.id = d.project_id
    WHERE p.agency_id = agency_record.id;
    
    -- Update the agency with the calculated value
    UPDATE agencies
    SET storage_used_bytes = calculated_bytes,
        updated_at = now()
    WHERE id = agency_record.id;
  END LOOP;
END;
$$;