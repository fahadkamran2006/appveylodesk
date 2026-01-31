-- Fix outdated subscription_plan constraint to allow current tiers
ALTER TABLE public.agencies
DROP CONSTRAINT IF EXISTS agencies_subscription_plan_check;

ALTER TABLE public.agencies
ADD CONSTRAINT agencies_subscription_plan_check
CHECK (
  subscription_plan = ANY (ARRAY['starter'::text, 'growth'::text, 'scale'::text, 'pro'::text])
);
