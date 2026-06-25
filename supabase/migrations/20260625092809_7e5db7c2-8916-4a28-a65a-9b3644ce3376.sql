CREATE TABLE IF NOT EXISTS public.employee_compensation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  monthly_salary NUMERIC,
  accumulated_bonus NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_compensation TO authenticated;
GRANT ALL ON public.employee_compensation TO service_role;

ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own compensation"
  ON public.employee_compensation FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view team compensation"
  ON public.employee_compensation FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  );

CREATE POLICY "Admins can insert team compensation"
  ON public.employee_compensation FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  );

CREATE POLICY "Admins can update team compensation"
  ON public.employee_compensation FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  );

CREATE POLICY "Admins can delete team compensation"
  ON public.employee_compensation FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  );

CREATE TRIGGER update_employee_compensation_updated_at
  BEFORE UPDATE ON public.employee_compensation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();