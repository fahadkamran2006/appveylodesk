
-- ============ Free plan support ============

-- 1) Allow 'free' on plan_tier check constraints
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_plan_tier_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY['free'::text,'starter'::text,'growth'::text,'scale'::text]));

ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_subscription_plan_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_subscription_plan_check
  CHECK (subscription_plan = ANY (ARRAY['free'::text,'starter'::text,'growth'::text,'scale'::text,'pro'::text]));

-- 2) Safe defaults so a partial signup lands on 'free'
ALTER TABLE public.agencies ALTER COLUMN plan_tier SET DEFAULT 'free';
ALTER TABLE public.agencies ALTER COLUMN subscription_plan SET DEFAULT 'free';
ALTER TABLE public.agencies ALTER COLUMN max_clients SET DEFAULT 1;
ALTER TABLE public.agencies ALTER COLUMN storage_limit_bytes SET DEFAULT 2147483648;

-- 3) Active project count helper (excludes done/cancelled/proposal/request)
CREATE OR REPLACE FUNCTION public.get_active_project_count(_agency_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.projects
  WHERE agency_id = _agency_id
    AND status NOT IN ('done','cancelled','proposal','request');
$$;

-- 4) Active project limit check
CREATE OR REPLACE FUNCTION public.check_active_project_limit(_agency_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tier text; _count integer;
BEGIN
  SELECT plan_tier INTO _tier FROM public.agencies WHERE id = _agency_id;
  IF _tier IS DISTINCT FROM 'free' THEN RETURN true; END IF;
  SELECT public.get_active_project_count(_agency_id) INTO _count;
  RETURN _count < 1;
END;
$$;

-- 5) Trigger: enforce free-plan project cap (INSERT)
CREATE OR REPLACE FUNCTION public.enforce_free_project_limit_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tier text;
BEGIN
  IF NEW.status IN ('done','cancelled','proposal','request') THEN RETURN NEW; END IF;
  SELECT plan_tier INTO _tier FROM public.agencies WHERE id = NEW.agency_id;
  IF _tier = 'free' AND public.get_active_project_count(NEW.agency_id) >= 1 THEN
    RAISE EXCEPTION 'FREE_PLAN_PROJECT_LIMIT' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_project_limit_insert ON public.projects;
CREATE TRIGGER trg_enforce_free_project_limit_insert
BEFORE INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_project_limit_insert();

-- 6) Trigger: enforce free-plan project cap when status transitions INTO active
CREATE OR REPLACE FUNCTION public.enforce_free_project_limit_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tier text;
BEGIN
  IF NEW.status NOT IN ('done','cancelled','proposal','request')
     AND OLD.status IN ('done','cancelled','proposal','request') THEN
    SELECT plan_tier INTO _tier FROM public.agencies WHERE id = NEW.agency_id;
    IF _tier = 'free' AND public.get_active_project_count(NEW.agency_id) >= 1 THEN
      RAISE EXCEPTION 'FREE_PLAN_PROJECT_LIMIT' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_project_limit_update ON public.projects;
CREATE TRIGGER trg_enforce_free_project_limit_update
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_project_limit_update();

-- 7) Trigger: enforce client cap (uses existing check_client_limit which compares to max_clients)
CREATE OR REPLACE FUNCTION public.enforce_client_limit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'client'::app_role THEN
    IF NOT public.check_client_limit(NEW.agency_id) THEN
      RAISE EXCEPTION 'CLIENT_LIMIT_REACHED' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_client_limit ON public.user_roles;
CREATE TRIGGER trg_enforce_client_limit
BEFORE INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_client_limit_trigger();

-- 8) Trigger: enforce storage limit on deliverables
CREATE OR REPLACE FUNCTION public.enforce_storage_limit_deliverables()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _agency_id uuid;
BEGIN
  IF NEW.file_size IS NULL OR NEW.file_size = 0 THEN RETURN NEW; END IF;
  SELECT p.agency_id INTO _agency_id FROM public.projects p WHERE p.id = NEW.project_id;
  IF _agency_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.check_storage_limit(_agency_id, NEW.file_size) THEN
    RAISE EXCEPTION 'STORAGE_LIMIT_REACHED' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_storage_limit_deliverables ON public.deliverables;
CREATE TRIGGER trg_enforce_storage_limit_deliverables
BEFORE INSERT ON public.deliverables
FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_limit_deliverables();

-- 9) Trigger: enforce storage limit on drive_files
CREATE OR REPLACE FUNCTION public.enforce_storage_limit_drive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.file_size IS NULL OR NEW.file_size = 0 THEN RETURN NEW; END IF;
  IF NEW.agency_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.check_storage_limit(NEW.agency_id, NEW.file_size) THEN
    RAISE EXCEPTION 'STORAGE_LIMIT_REACHED' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_storage_limit_drive ON public.drive_files;
CREATE TRIGGER trg_enforce_storage_limit_drive
BEFORE INSERT ON public.drive_files
FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_limit_drive();
