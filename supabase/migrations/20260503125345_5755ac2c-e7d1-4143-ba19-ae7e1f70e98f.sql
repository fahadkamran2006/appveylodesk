CREATE TABLE public.subscription_cancellation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason_code TEXT NOT NULL,
  reason_label TEXT NOT NULL,
  detail TEXT,
  subscription_ends_at TIMESTAMPTZ,
  plan_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_cancellation_logs_agency ON public.subscription_cancellation_logs(agency_id, created_at DESC);

ALTER TABLE public.subscription_cancellation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their agency cancellation logs"
ON public.subscription_cancellation_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()));

CREATE POLICY "Admins can insert cancellation logs for their agency"
ON public.subscription_cancellation_logs
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND agency_id = get_user_agency_id(auth.uid())
  AND user_id = auth.uid()
);

CREATE POLICY "Super admin can view all cancellation logs"
ON public.subscription_cancellation_logs
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));