
-- Trigger: Log when a new agency is created
CREATE OR REPLACE FUNCTION public.log_new_agency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM insert_system_log(
    'new_agency',
    'New agency created: ' || NEW.name || ' (Plan: ' || NEW.plan_tier || ')',
    jsonb_build_object('agency_id', NEW.id, 'plan_tier', NEW.plan_tier, 'created_by', NEW.created_by)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_new_agency
  AFTER INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_new_agency();

-- Trigger: Log when subscription/plan changes
CREATE OR REPLACE FUNCTION public.log_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.plan_tier IS DISTINCT FROM NEW.plan_tier
     OR OLD.subscription_plan IS DISTINCT FROM NEW.subscription_plan
     OR OLD.billing_interval IS DISTINCT FROM NEW.billing_interval THEN
    PERFORM insert_system_log(
      'subscription_change',
      'Agency "' || NEW.name || '" changed plan: ' || OLD.plan_tier || ' → ' || NEW.plan_tier,
      jsonb_build_object(
        'agency_id', NEW.id,
        'old_plan', OLD.plan_tier,
        'new_plan', NEW.plan_tier,
        'old_interval', OLD.billing_interval,
        'new_interval', NEW.billing_interval
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_subscription_change
  AFTER UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_subscription_change();

-- Trigger: Log new user signups (profile creation)
CREATE OR REPLACE FUNCTION public.log_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM insert_system_log(
    'new_signup',
    'New user signed up: ' || COALESCE(NEW.full_name, NEW.email),
    jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_new_user_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_new_user_signup();
