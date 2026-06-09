# Custom Staff Roles & Permissions

Add a new `staff` seat type alongside admin/client/editor. Admins define reusable **role templates** (Manager, Accountant, HR, etc.) with a permission set, assign one per staff member, and can override individual permissions. Some permissions are global (finance/HR/workspace); clients & projects also support **per-record assignment scoping** so a manager can be limited to "their" clients.

## 1. Permission catalog

Each permission is a string key, grouped by area. Stored as a JSONB map `{ key: true/false }`.

**Operations**
- `clients.view`, `clients.create`, `clients.invite`, `clients.edit`, `clients.delete`
- `projects.view`, `projects.create`, `projects.edit`, `projects.assign_editor`, `projects.change_status`, `projects.delete`
- `team.view`, `team.invite`, `team.edit`, `team.remove`
- `messaging.dm_clients`, `messaging.dm_team`, `messaging.project_channels`

**Finance**
- `invoices.view`, `invoices.create`, `invoices.send`, `invoices.mark_paid`
- `payments.view_methods`, `payments.manage_methods`
- `payroll.view`, `payroll.pay`, `payroll.bonuses`, `payroll.balances`

**HR**
- `attendance.view`, `attendance.report`
- `leave.view`, `leave.approve`
- `performance.view`

**Workspace**
- `storage.view`, `storage.upload`, `storage.delete`
- `branding.manage`, `settings.manage`, `billing.manage` (last two strongly recommended admin-only, but toggleable)

For each permission, an additional implicit modifier `scope = 'all' | 'assigned'` applies **only** to `clients.*` and `projects.*` (where assignment exists).

## 2. Database schema

**New tables**
- `staff_roles` — `id, agency_id, name, description, permissions jsonb, scope_clients ('all'|'assigned'), scope_projects ('all'|'assigned'), is_system bool, created_by`. Seeded with three system templates per agency on first staff invite: Manager, Accountant, HR Coordinator.
- `staff_members` — `id, user_id, agency_id, staff_role_id, permission_overrides jsonb (sparse map), created_by`. One row per staff seat. Unique `(user_id, agency_id)`.
- `staff_client_assignments` — `staff_user_id, client_user_id (nullable), managed_client_id (nullable), agency_id`. XOR on the two client refs.
- `staff_project_assignments` — `staff_user_id, project_id, agency_id`.

**Enum change** — add `'staff'` to `app_role`.

**Helpers (SECURITY DEFINER)**
- `get_staff_permissions(_user_id) → jsonb` — merges role template + overrides.
- `staff_has_permission(_user_id, _key text) → bool`.
- `staff_client_visible(_staff_user_id, _client_user_id, _managed_client_id) → bool` — true if scope='all' OR assignment exists.
- `staff_project_visible(_staff_user_id, _project_id) → bool` — same pattern.

**RLS rewrites** — for every table the staff role can read (clients/profiles, managed_clients, projects, project_containers, invoices, invoice_line_items, deliverables, project_editors, payroll_payments, editor_balances, leave_requests, daily_logs, drive_files/folders, channels): add policies that allow rows when the user is `staff` AND the relevant `staff_has_permission` returns true AND, for scoped tables, the visibility helper returns true. Write policies gated on the matching `.create`/`.edit`/`.delete` permission.

**Seat counting** — `check_client_limit` and editor seat count stay unchanged. Staff seats don't count toward any limit yet (separate `staff` seat type, unlimited).

## 3. Frontend

**New admin pages**
- `Settings → Roles & Permissions` (admin only):
  - List staff_roles with edit/delete (system roles are non-deletable but editable).
  - Role editor: name, description, grouped permission checkboxes (Operations / Finance / HR / Workspace), two scope toggles (clients: all vs assigned; projects: all vs assigned).
- `Team` page: add a **"Invite Staff"** button next to "Invite Editor". Modal collects name, email, role template, then optional per-permission overrides (collapsed advanced section). Sends invite via existing `send-invite-email` with role=`staff` + metadata.
- On each staff member's row: "Edit permissions" (overrides), "Manage assignments" (pick clients/projects they own when scope='assigned').

**Permission hook**
- `usePermissions()` — returns `{ can(key), scope(area), assignedClientIds, assignedProjectIds, loading }`. Wraps a single query against `get_staff_permissions` + assignments. Admins always return `can=true`. Clients/editors keep current behavior.
- `<PermissionGuard permission="invoices.create">` wrapper for buttons/sections.

**Sidebar & routing**
- New `StaffSidebar` derived from current admin sidebar, but each nav item is gated by the relevant `*.view` permission (Clients, Projects, Invoices, Payroll, Attendance, Leave, Storage, Messages, Performance).
- Add `role='staff'` branch in `DashboardLayout`, `useAuth.redirectByRole`, and route guards. Staff land at `/staff/dashboard` (a simple landing showing the areas they can access).
- Reuse existing admin pages where possible: pages read `usePermissions` and hide actions / filter lists accordingly. No duplicate pages.

**Action gating examples**
- `Clients.tsx`: hide "Invite Client" / "Add Manually" unless `clients.invite`/`clients.create`; filter list by `assignedClientIds` if scope='assigned'.
- `Projects.tsx`: hide create/assign/status controls per permission; filter by `assignedProjectIds` if scoped.
- `Invoices.tsx`, `Payroll.tsx`, `LeaveManagement.tsx`, `AttendanceReport.tsx`, `StoragePage.tsx`, `BrandingSettings.tsx`, `Billing.tsx` all wrap their primary actions in `PermissionGuard`.

**Messaging**
- DM rules in `get_or_create_dm_channel` extended: staff can DM clients only if `messaging.dm_clients`; can DM editors/admins only if `messaging.dm_team`. Project channels auto-include staff who are assigned to that project (or all staff with `projects.view` + scope='all').

## 4. Invitation flow

- `agency_invitations` already supports any `app_role`. Extend the join page to recognize `staff`, create a `staff_members` row using `invitation.metadata.staff_role_id` and `permission_overrides`, then route to `/staff/dashboard`.

## 5. Out of scope (this phase)

- No per-permission scoping on finance/HR/storage records (action-gated only).
- No audit log of permission changes (can be added later).
- No bulk-assign UI for clients/projects (single-record assignment via existing pickers).
- No mobile-specific staff nav re-design — reuse `MobileBottomNav` with permission gating.

## Technical details

```text
permission resolution
─────────────────────
final[key] = overrides[key] ?? template.permissions[key] ?? false
scope[area] = overrides.__scope_<area> ?? template.scope_<area> ?? 'all'

visibility (client/project rows)
────────────────────────────────
visible = scope='all'
       OR exists(staff_*_assignments where staff_user_id=auth.uid() and ref=row)
```

Files touched (high level):
- New migration: enum extension, 4 tables + GRANTs + RLS, helper functions, policy rewrites on ~15 tables.
- New: `src/hooks/usePermissions.tsx`, `src/components/PermissionGuard.tsx`, `src/components/StaffSidebar.tsx`, `src/pages/staff/Dashboard.tsx`, `src/pages/settings/RolesPermissions.tsx`, `src/components/staff/RoleEditorModal.tsx`, `src/components/staff/InviteStaffModal.tsx`, `src/components/staff/StaffPermissionOverridesModal.tsx`, `src/components/staff/StaffAssignmentsModal.tsx`.
- Edited: `useAuth.tsx` (staff routing), `DashboardLayout.tsx`, `App.tsx` routes, `Team.tsx`, `Clients.tsx`, `Projects.tsx`, `Invoices.tsx`, `Payroll.tsx`, `LeaveManagement.tsx`, `AttendanceReport.tsx`, `EditorPerformance.tsx`, `StoragePage.tsx`, `DrivePage.tsx`, `BrandingSettings.tsx`, `Billing.tsx`, `Settings.tsx` (add Roles tab), `JoinTeam.tsx`, edge functions `send-invite-email` and `send-invoice-email` (no change needed if invitation metadata flows through).

I'll deliver this in two builds: **(a) schema + Roles UI + Invite Staff + staff sidebar/routing**, then **(b) per-page permission gating + assignment scoping across all listed pages**. Confirm and I'll start with (a).