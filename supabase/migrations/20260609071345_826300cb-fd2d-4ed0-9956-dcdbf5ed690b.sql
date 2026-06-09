
-- 1. Extend app_role enum with 'staff'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. staff_roles: reusable permission templates per agency
CREATE TABLE public.staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope_clients TEXT NOT NULL DEFAULT 'all' CHECK (scope_clients IN ('all','assigned')),
  scope_projects TEXT NOT NULL DEFAULT 'all' CHECK (scope_projects IN ('all','assigned')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_roles TO authenticated;
GRANT ALL ON public.staff_roles TO service_role;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view staff roles"
  ON public.staff_roles FOR SELECT TO authenticated
  USING (public.user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Admins manage staff roles"
  ON public.staff_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

CREATE TRIGGER staff_roles_updated_at
  BEFORE UPDATE ON public.staff_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. staff_members: links a user to a role template with overrides
CREATE TABLE public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  staff_role_id UUID REFERENCES public.staff_roles(id) ON DELETE SET NULL,
  permission_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, agency_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own record"
  ON public.staff_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all staff members"
  ON public.staff_members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Admins manage staff members"
  ON public.staff_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

CREATE TRIGGER staff_members_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. staff_client_assignments
CREATE TABLE public.staff_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_user_id UUID,
  managed_client_id UUID REFERENCES public.managed_clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((client_user_id IS NOT NULL AND managed_client_id IS NULL) OR (client_user_id IS NULL AND managed_client_id IS NOT NULL))
);
CREATE UNIQUE INDEX staff_client_assignments_real_uniq
  ON public.staff_client_assignments (staff_user_id, client_user_id)
  WHERE client_user_id IS NOT NULL;
CREATE UNIQUE INDEX staff_client_assignments_managed_uniq
  ON public.staff_client_assignments (staff_user_id, managed_client_id)
  WHERE managed_client_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_client_assignments TO authenticated;
GRANT ALL ON public.staff_client_assignments TO service_role;
ALTER TABLE public.staff_client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own client assignments"
  ON public.staff_client_assignments FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

CREATE POLICY "Admins manage staff client assignments"
  ON public.staff_client_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

-- 5. staff_project_assignments
CREATE TABLE public.staff_project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_project_assignments TO authenticated;
GRANT ALL ON public.staff_project_assignments TO service_role;
ALTER TABLE public.staff_project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own project assignments"
  ON public.staff_project_assignments FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

CREATE POLICY "Admins manage staff project assignments"
  ON public.staff_project_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.get_staff_permissions(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sm RECORD;
  _role RECORD;
  _result JSONB;
BEGIN
  SELECT * INTO _sm FROM public.staff_members WHERE user_id = _user_id LIMIT 1;
  IF _sm IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT * INTO _role FROM public.staff_roles WHERE id = _sm.staff_role_id;

  _result := COALESCE(_role.permissions, '{}'::jsonb) || COALESCE(_sm.permission_overrides, '{}'::jsonb);
  _result := _result
    || jsonb_build_object('__scope_clients', COALESCE(_role.scope_clients, 'all'))
    || jsonb_build_object('__scope_projects', COALESCE(_role.scope_projects, 'all'))
    || jsonb_build_object('__agency_id', _sm.agency_id);
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_has_permission(_user_id UUID, _key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.get_staff_permissions(_user_id) ->> _key)::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.staff_client_visible(_staff_user_id UUID, _client_user_id UUID, _managed_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((public.get_staff_permissions(_staff_user_id) ->> '__scope_clients'), 'all') = 'all'
    OR EXISTS (
      SELECT 1 FROM public.staff_client_assignments
      WHERE staff_user_id = _staff_user_id
        AND (
          (_client_user_id IS NOT NULL AND client_user_id = _client_user_id)
          OR (_managed_client_id IS NOT NULL AND managed_client_id = _managed_client_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.staff_project_visible(_staff_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((public.get_staff_permissions(_staff_user_id) ->> '__scope_projects'), 'all') = 'all'
    OR EXISTS (
      SELECT 1 FROM public.staff_project_assignments
      WHERE staff_user_id = _staff_user_id AND project_id = _project_id
    );
$$;

-- 7. Seed system role templates for existing agencies
INSERT INTO public.staff_roles (agency_id, name, description, permissions, scope_clients, scope_projects, is_system)
SELECT a.id, 'Manager', 'Manages clients, projects, and team',
  jsonb_build_object(
    'clients.view', true, 'clients.create', true, 'clients.invite', true, 'clients.edit', true,
    'projects.view', true, 'projects.create', true, 'projects.edit', true, 'projects.assign_editor', true, 'projects.change_status', true,
    'team.view', true,
    'messaging.dm_clients', true, 'messaging.dm_team', true, 'messaging.project_channels', true,
    'storage.view', true, 'storage.upload', true
  ),
  'all', 'all', true
FROM public.agencies a
ON CONFLICT (agency_id, name) DO NOTHING;

INSERT INTO public.staff_roles (agency_id, name, description, permissions, scope_clients, scope_projects, is_system)
SELECT a.id, 'Accountant', 'Manages invoices, payments, and payroll',
  jsonb_build_object(
    'clients.view', true,
    'invoices.view', true, 'invoices.create', true, 'invoices.send', true, 'invoices.mark_paid', true,
    'payments.view_methods', true, 'payments.manage_methods', true,
    'payroll.view', true, 'payroll.pay', true, 'payroll.bonuses', true, 'payroll.balances', true,
    'messaging.dm_team', true
  ),
  'all', 'all', true
FROM public.agencies a
ON CONFLICT (agency_id, name) DO NOTHING;

INSERT INTO public.staff_roles (agency_id, name, description, permissions, scope_clients, scope_projects, is_system)
SELECT a.id, 'HR Coordinator', 'Manages attendance, leave, and performance',
  jsonb_build_object(
    'team.view', true,
    'attendance.view', true, 'attendance.report', true,
    'leave.view', true, 'leave.approve', true,
    'performance.view', true,
    'messaging.dm_team', true
  ),
  'all', 'all', true
FROM public.agencies a
ON CONFLICT (agency_id, name) DO NOTHING;
