
-- 1. is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'hello@fahadkamran.com'
  );
$$;

-- 2. get_admin_agency_stats: security definer function to bypass RLS
CREATE OR REPLACE FUNCTION public.get_admin_agency_stats()
RETURNS TABLE(
  agency_id uuid,
  agency_name text,
  plan_tier text,
  subscription_plan text,
  subscription_ends_at timestamptz,
  storage_used_bytes bigint,
  storage_limit_bytes bigint,
  created_at timestamptz,
  client_count bigint,
  editor_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    a.id AS agency_id,
    a.name AS agency_name,
    a.plan_tier,
    a.subscription_plan,
    a.subscription_ends_at,
    a.storage_used_bytes,
    a.storage_limit_bytes,
    a.created_at,
    COUNT(DISTINCT CASE WHEN ur.role = 'client' THEN ur.user_id END) AS client_count,
    COUNT(DISTINCT CASE WHEN ur.role = 'editor' THEN ur.user_id END) AS editor_count
  FROM public.agencies a
  LEFT JOIN public.user_roles ur ON ur.agency_id = a.id
  GROUP BY a.id, a.name, a.plan_tier, a.subscription_plan, a.subscription_ends_at,
           a.storage_used_bytes, a.storage_limit_bytes, a.created_at;
$$;

-- 3. system_logs table
CREATE TABLE public.system_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Only super admin can read
CREATE POLICY "Super admin can read system logs"
ON public.system_logs
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- No direct inserts from clients - only via security definer functions
-- Create a helper to insert system logs from triggers/functions
CREATE OR REPLACE FUNCTION public.insert_system_log(
  _event_type text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.system_logs (event_type, message, metadata)
  VALUES (_event_type, _message, _metadata);
END;
$$;
