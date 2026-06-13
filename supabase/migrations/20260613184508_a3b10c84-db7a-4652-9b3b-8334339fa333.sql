UPDATE public.agencies SET plan_tier = 'free' WHERE plan_tier IS NULL OR plan_tier = '';
UPDATE public.agencies SET subscription_plan = 'free' WHERE subscription_plan IS NULL OR subscription_plan = '';
UPDATE public.agencies SET max_clients = COALESCE(max_clients, 1), storage_limit_bytes = COALESCE(storage_limit_bytes, 2147483648) WHERE plan_tier = 'free';