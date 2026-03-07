-- 1. Update is_super_admin to support both emails
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email IN ('hello@fahadkamran.com', 'm.fahadkamran0001@gmail.com')
  );
$$;

-- 2. Create agency_restrictions table for warnings/timeouts
CREATE TABLE IF NOT EXISTS public.agency_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  restriction_type text NOT NULL,
  message text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage restrictions"
ON public.agency_restrictions
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Agency members can view their restrictions"
ON public.agency_restrictions
FOR SELECT
TO authenticated
USING (user_belongs_to_agency(auth.uid(), agency_id) AND is_active = true);

-- 3. Create marketing_emails_log table
CREATE TABLE IF NOT EXISTS public.marketing_emails_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.marketing_emails_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view marketing email logs"
ON public.marketing_emails_log
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()))