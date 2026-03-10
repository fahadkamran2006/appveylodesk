
CREATE TABLE public.agency_work_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  late_threshold_hour integer NOT NULL DEFAULT 10,
  late_threshold_minute integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agency_id)
);

-- RLS
ALTER TABLE public.agency_work_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their agency work schedule"
ON public.agency_work_schedule
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Agency members can view work schedule"
ON public.agency_work_schedule
FOR SELECT
TO authenticated
USING (user_belongs_to_agency(auth.uid(), agency_id));

-- Updated at trigger
CREATE TRIGGER update_agency_work_schedule_updated_at
  BEFORE UPDATE ON public.agency_work_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
