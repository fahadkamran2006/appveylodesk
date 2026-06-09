
## Goal

Let admins create client profiles directly (no invite required), use them like real clients (projects, invoices, notes), email invoices to them, and later click **Give Dashboard Access** to convert them into a real account via the existing invite flow.

## Why a new table

`profiles.id` is a foreign key to `auth.users`, so we can't put a manual client there until they sign up. We'll add a separate `managed_clients` table for unactivated client records, and let `projects`/`invoices` reference either a real client profile **or** a managed client.

## Database changes

1. **New table `managed_clients`** with: `agency_id`, `email`, `full_name`, `company`, `phone`, `notes`, `created_by`, `activated_at`, `invitation_id` (link to the `agency_invitations` row once activation is triggered), `converted_profile_id` (set after the client accepts).
   - RLS: admins of the same agency can do everything; service_role full access.
   - Unique `(agency_id, lower(email))` so duplicates inside an agency are blocked.
   - **Does NOT count** toward `agencies.max_clients`. The existing `check_client_limit` keeps counting only real `user_roles` rows.

2. **Add nullable `managed_client_id` columns** to:
   - `projects` (alongside existing `client_id`)
   - `invoices` (alongside existing `client_id`)
   - Add a CHECK that exactly one of `client_id` / `managed_client_id` is set.

3. **Conversion function `activate_managed_client(_managed_id)`** (SECURITY DEFINER, admin-only): creates a normal `agency_invitations` row, stores its id on the managed client, returns the invitation id. The frontend then calls the existing `send-invite-email` edge function.

4. **Trigger on `accept_agency_invitation`** (extend the existing function): if the accepted invitation matches a `managed_clients.invitation_id`, rewrite `projects.client_id` and `invoices.client_id` from `managed_client_id` to the new auth user id, clear the `managed_client_id` columns, set `converted_profile_id`, and mark `activated_at`.

## Frontend changes

### Admin → Clients page (`src/pages/admin/Clients.tsx`)
- Add a second primary button **"Add Client Manually"** next to the existing **Invite Client**.
- Fetch and render managed clients in the same grid as real clients, with a small **"No dashboard access"** badge and a **Give Dashboard Access** button on the card.
- Manual clients are NOT blocked by `canAddClient` (no plan-limit check).

### New `AddManualClientModal.tsx`
- Fields: Name, Email, Company, Phone, Notes (zod-validated, length-capped).
- Inserts into `managed_clients`.

### New `ActivateClientModal.tsx`
- Confirmation dialog before sending the invite. Shows the email it will go to, lets admin edit it if needed, and warns the manual client will be converted on acceptance.
- Calls `activate_managed_client` RPC, then `supabase.functions.invoke('send-invite-email', …)` using the returned invitation id (same flow as `InviteUserModal`).
- Enforces `canAddClient` here (activation = real client = counts toward limit).

### Project + invoice flows
- `CreateProjectModal` / `CreateInvoiceModal`: the client picker lists both real clients and managed clients (managed ones shown with a "Manual" tag). Selected value writes to `client_id` or `managed_client_id` accordingly.
- `ProjectCard`, `PersonDetailSheet`, invoice list, etc. resolve the display name from whichever column is set.
- `send-invoice-email` edge function: accept `managed_client_id` and look the email/name up from `managed_clients` so admins can email invoices to manual clients regardless of activation state.

### Hidden-from-client side
- Manual clients can't log in, so client-side dashboards are unaffected. After activation + acceptance, projects/invoices already point at the new profile id, so the client sees their full history immediately.

## Out of scope

- No notifications/messages/channels are created for managed clients (those depend on a real user id). They start working the moment the client accepts the invite.
- No bulk import — single-record modal only.

## Files touched

- New migration: `managed_clients` table + columns on `projects`/`invoices` + `activate_managed_client` RPC + extension of `accept_agency_invitation`.
- New: `src/components/clients/AddManualClientModal.tsx`, `src/components/clients/ActivateClientModal.tsx`.
- Edited: `src/pages/admin/Clients.tsx`, `src/components/PersonCard.tsx` (badge + activate button), `src/components/projects/CreateProjectModal.tsx`, `src/components/invoices/CreateInvoiceModal.tsx`, project/invoice display components that show client name, and `supabase/functions/send-invoice-email/index.ts`.
