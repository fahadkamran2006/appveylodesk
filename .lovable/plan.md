
## Goal
Introduce a `free` tier (`$0/mo`) with airtight, server-enforced limits and visible Veylodesk attribution. Paid plans remain untouched.

## Free plan limits
- **1 client** (role=client in agency)
- **1 active project** at a time — "active" = status NOT IN (`done`, `cancelled`, `proposal`, `request`). Applied identically in DB helper, `CreateProjectModal`, `RequestVideoModal`, and any other creation entry point.
- **2 GB storage** (2,147,483,648 bytes)
- **Unlimited editors**
- **No custom branding / white-label** — `BrandingContext` returns Veylodesk defaults regardless of agency overrides
- **"Powered by Veylodesk"** badge on invoice PDFs + invoice view, public review pages, client portal sidebar, drive share pages

## Database migration (single file)

1. **Add `'free'` value** to plan tier enum / check constraint.
2. **Default-safe column changes on `agencies`**:
   - `ALTER COLUMN plan_tier SET DEFAULT 'free'`
   - `ALTER COLUMN plan_tier SET NOT NULL`
   - `ALTER COLUMN max_clients SET DEFAULT 1`
   - `ALTER COLUMN storage_limit_bytes SET DEFAULT 2147483648`
   - Backfill any existing NULL `plan_tier` → `'free'`.
   - This guarantees: even if frontend signup crashes mid-flow, the row inserts with `plan_tier='free'` automatically.
3. **Helper `public.get_active_project_count(_agency_id uuid)`** — returns count where `agency_id = _agency_id AND status NOT IN ('done','cancelled','proposal','request')`. SECURITY DEFINER, stable.
4. **Helper `public.check_active_project_limit(_agency_id uuid)`** — returns boolean; for `plan_tier='free'`: active count < 1; for paid plans: always true.
5. **Update `check_client_limit`** to remain authoritative (already counts role=client; with `max_clients=1` default on free, this just works).
6. **Update `check_storage_limit`** — already correct, but is the **server-side** enforcement we'll wire into uploads (see below).
7. **Hard server-side enforcement triggers** (defense in depth — frontend bypass cannot defeat these):
   - `BEFORE INSERT ON public.projects`: if status NOT IN ('done','cancelled','proposal','request') AND `check_active_project_limit(agency_id)` is false → RAISE EXCEPTION `'FREE_PLAN_PROJECT_LIMIT'`.
   - `BEFORE UPDATE ON public.projects` (when status transitions INTO an active state): same check.
   - `BEFORE INSERT ON public.user_roles` for `role='client'`: if `check_client_limit(agency_id)` false → RAISE EXCEPTION `'FREE_PLAN_CLIENT_LIMIT'`.
   - `BEFORE INSERT ON public.deliverables` and `public.drive_files`: if `check_storage_limit(agency_id, file_size)` false → RAISE EXCEPTION `'FREE_PLAN_STORAGE_LIMIT'`.
8. **Edge function enforcement** — `presigned-upload`, `drive-upload`, `drive-share-upload`, `deliverables-ops` all call `check_storage_limit` server-side and reject 413 before issuing TUS/presigned URLs. This is the real hard wall (triggers are the safety net).
9. **Update `public-review` SQL/function payload** to return `is_free_plan boolean` derived directly from `agencies.plan_tier = 'free'` — included in the JSON the edge function returns. Unauthenticated viewers get the badge state in one round trip.

## Enforcement UX (hard block + informative upgrade modal)

`<UpgradeRequiredModal limitType="client"|"project"|"storage"|"branding" />`:
- Title names the exact limit hit (e.g. "You've reached your client limit").
- Shows current usage ("1 of 1 clients used").
- Shows **next plan name, monthly price, and the specific unlocked limit** (e.g. "Upgrade to **Starter — $49/mo** to add up to **10 clients** and get **200 GB** storage").
- Bullets the other Starter perks (custom branding, unlimited active projects).
- Primary CTA: "Upgrade to Starter" → opens Paddle overlay via existing `openPaddleCheckout`.
- Secondary: "See all plans" → `/admin/settings/subscription`.

Triggered from: `CreateProjectModal`, `RequestVideoModal` (project limit), `InviteUserModal` + `AddManualClientModal` (client limit), `UploadContext` and any upload entry (storage limit), `BrandingSettings` page (branding lock).

When a backend trigger fires, surface the exception message via toast and open the matching modal.

## Frontend changes

- **`useSubscription`**: treat `planTier='free'` as `isActive=true`; expose `isFree`, `nextPaidPlan` ('starter'), `nextPaidPrice` (49).
- **`useAgencyLimits`**: add `activeProjectCount`, `canCreateProject()`, expose `isFree`.
- **`SubscriptionGuard`**: allow `free` through.
- **`BrandingContext`**: if `isFree`, force-return Veylodesk defaults.
- **`Pricing.tsx` + `landing/PricingSection.tsx`**: add Free — $0 card listing the 3 limits + "Powered by Veylodesk" disclaimer.
- **`Signup.tsx` / `Onboarding.tsx`**: rely on DB default; do not set `plan_tier` explicitly unless user picks a paid plan.
- **`SubscriptionSettings.tsx`**: render Free as current plan with Upgrade CTA; hide cancel.

## Dashboard usage indicator (new)

`<FreePlanUsageWidget>` component — visible only when `isFree`:
- Three compact rows with progress bars: clients (`x of 1`), active projects (`x of 1`), storage (`x.x GB of 2 GB`).
- Each row turns amber when at 100%; row label is clickable → opens the matching upgrade modal.
- Placed at the **top of the admin dashboard** (above stat cards) and as a **collapsed card in `CollapsibleSidebar`** for persistent visibility on every page.
- Subtle styling (muted card, not aggressive).

## "Powered by Veylodesk" placement

`<PoweredByVeylodesk variant="compact|footer|pdf" />`, rendered when the relevant agency is on free:
- `src/lib/generateInvoicePDF.ts` — appended footer line.
- `src/pages/invoices/InvoiceDetail.tsx` — footer.
- `src/pages/review/PublicReview.tsx` — footer; visibility from `is_free_plan` in the edge payload.
- `src/components/client/ClientSidebar.tsx` — small bottom badge.
- `src/pages/share/SharePage.tsx` — footer; `is_free_plan` returned from `drive-share-resolve`.

## Files to add / edit

**New:**
- `src/components/UpgradeRequiredModal.tsx`
- `src/components/PoweredByVeylodesk.tsx`
- `src/components/FreePlanUsageWidget.tsx`
- `supabase/migrations/<timestamp>_add_free_plan.sql`

**Edit:** `useSubscription.tsx`, `useAgencyLimits.tsx`, `SubscriptionGuard.tsx`, `BrandingContext.tsx`, `Pricing.tsx`, `landing/PricingSection.tsx`, `Signup.tsx`, `Onboarding.tsx`, `SubscriptionSettings.tsx`, `CreateProjectModal.tsx`, `RequestVideoModal.tsx`, `InviteUserModal.tsx`, `AddManualClientModal.tsx`, `UploadContext.tsx`, `BrandingSettings.tsx`, `CollapsibleSidebar.tsx`, `admin/Dashboard.tsx`, `generateInvoicePDF.ts`, `InvoiceDetail.tsx`, `PublicReview.tsx`, `ClientSidebar.tsx`, `SharePage.tsx`, edge functions: `public-review`, `drive-share-resolve`, `presigned-upload`, `drive-upload`, `drive-share-upload`, `deliverables-ops`.

## Out of scope
- No changes to paid Starter/Growth/Scale pricing or limits.
- No "trial" wording (per existing rule).
- Existing agencies keep their current `plan_tier`; only NULL rows are backfilled to free.
