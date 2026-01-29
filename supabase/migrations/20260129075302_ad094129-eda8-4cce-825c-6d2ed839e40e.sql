-- Add subscription-related columns to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'growth', 'scale')),
ADD COLUMN IF NOT EXISTS max_clients INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Create function to check if agency can add more clients
CREATE OR REPLACE FUNCTION public.check_client_limit(_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(DISTINCT user_id) 
    FROM public.user_roles 
    WHERE agency_id = _agency_id AND role = 'client'
  ) < (
    SELECT max_clients FROM public.agencies WHERE id = _agency_id
  );
$$;

-- Update existing agencies to have correct tier defaults based on current subscription_plan
UPDATE public.agencies
SET 
  plan_tier = CASE 
    WHEN subscription_plan = 'scale' THEN 'scale'
    WHEN subscription_plan = 'growth' THEN 'growth'
    ELSE 'starter'
  END,
  max_clients = CASE 
    WHEN subscription_plan = 'scale' THEN 999999
    WHEN subscription_plan = 'growth' THEN 25
    ELSE 5
  END,
  storage_limit_bytes = CASE 
    WHEN subscription_plan = 'scale' THEN 3298534883328  -- 3 TB
    WHEN subscription_plan = 'growth' THEN 1099511627776 -- 1 TB
    ELSE 214748364800  -- 200 GB
  END
WHERE plan_tier IS NULL OR plan_tier = 'starter';