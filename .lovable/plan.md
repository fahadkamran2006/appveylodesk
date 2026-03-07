

# Super Admin Dashboard ("God Mode")

## Overview
Build a hidden `/super-admin` route accessible only to `hello@fahadkamran.com`. This dashboard provides platform-wide visibility into all agencies, revenue, storage, and system activity -- completely separate from the normal admin/client/editor dashboards.

## Phase 1: Route Protection and Empty Shell

### 1. Database: Security Definer Function
Create a Postgres function `is_super_admin(uuid)` that checks if a user's email matches the hardcoded super admin email. This function will be used by a new RLS policy (or called from edge functions) to allow cross-tenant reads.

```sql
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
```

### 2. Database: Aggregation View
Create a `admin_agency_stats` view (accessed via a security definer function to bypass per-agency RLS) that joins agencies with user_roles to produce:
- Agency name, plan_tier, subscription_plan, subscription_ends_at
- storage_used_bytes, storage_limit_bytes
- client_count (COUNT of client roles per agency)
- editor_count (COUNT of editor roles per agency)

### 3. Database: System Logs Table
Create a `system_logs` table for tracking platform-wide events:

| Column | Type |
|--------|------|
| id | uuid (PK) |
| event_type | text (signup, subscription_change, webhook_failure, cancellation) |
| message | text |
| metadata | jsonb |
| created_at | timestamptz |

RLS: SELECT only for super admin (using `is_super_admin`). INSERT via security definer triggers/functions only.

### 4. Edge Function: `super-admin-stats`
A single edge function that:
- Verifies the caller is `hello@fahadkamran.com` using the JWT
- Uses the service role key to query across all agencies
- Returns: total agencies, total MRR (calculated from plan tiers), total storage, agency leaderboard, top storage users, recent system logs

### 5. Frontend: Route Guard Component
Create `SuperAdminGuard.tsx`:
- Checks `user.email === 'hello@fahadkamran.com'`
- If not, redirects to `/` or shows 404
- Wraps the super admin page

### 6. Frontend: Super Admin Page
Create `src/pages/super-admin/SuperAdminDashboard.tsx` with:

**Layout**: Full-width with its own minimal sidebar (Overview, Agencies, Revenue, Storage, System Health tabs -- implemented as in-page tabs initially, expandable to separate routes later).

**Top Cards ("Big Numbers")**:
- Total MRR (calculated: Starter count x $29 + Growth count x $79 + Scale count x $149)
- Total Agencies
- Total Storage Used (formatted in TB)
- Active vs Churned agencies

**Agency Leaderboard Table** (sortable):
- Agency Name | Plan | Status | Revenue | Client Count | Editor Count | Storage Used

**Storage Monitor**:
- Bar chart or progress bars showing top agencies by storage usage %
- Red highlight for agencies above 90%

**Recent System Events** feed:
- Pulls from the `system_logs` table
- Shows: new signups, subscription changes, webhook failures

### 7. App.tsx Route
Add the route before the catch-all:
```
<Route path="/super-admin" element={<SuperAdminGuard><SuperAdminDashboard /></SuperAdminGuard>} />
```

## File Changes Summary

| Action | File |
|--------|------|
| Create | `src/pages/super-admin/SuperAdminDashboard.tsx` |
| Create | `src/components/super-admin/SuperAdminGuard.tsx` |
| Create | `src/components/super-admin/SuperAdminSidebar.tsx` |
| Create | `src/hooks/useSuperAdminStats.tsx` |
| Create | `supabase/functions/super-admin-stats/index.ts` |
| Migration | `is_super_admin` function, `system_logs` table, RLS policies |
| Edit | `src/App.tsx` (add route) |

## Security Notes
- The super admin email is checked server-side in the edge function using the JWT -- not just client-side
- All cross-tenant data access goes through the edge function using the service role key, so normal RLS still protects data for regular users
- The `system_logs` table uses strict RLS (super admin read only)
- The client-side guard is just UX -- the real protection is the edge function rejecting non-super-admin callers

