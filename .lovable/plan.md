
# Veylodesk Subscription System: Complete Implementation

## Overview

This plan consolidates all pricing rules, database schema updates, enforcement logic, branding, and payment integration into a single definitive specification for Veylodesk.

---

## Part 1: The Three Tiers (Strict Rules)

All plans use a **Client-Limit Model** with **Unlimited Team Members/Editors**.

| Plan | Monthly | Yearly (17% off) | Storage | Clients | Branding |
|------|---------|------------------|---------|---------|----------|
| **Starter** | $29/mo | $290/yr ($24.17/mo) | 200 GB | 5 Active | Veylodesk Default |
| **Growth** | $79/mo | $790/yr ($65.83/mo) | 1 TB | 25 Active | White-Label |
| **Scale** | $149/mo | $1,490/yr ($124.17/mo) | 3 TB | Unlimited | White-Label + Priority Support |

---

## Part 2: Database Schema Changes

### Modify `agencies` Table

Add new columns to support tier enforcement and white-label branding:

```text
ALTER TABLE agencies ADD COLUMN:
  - plan_tier TEXT NOT NULL DEFAULT 'starter' 
      CHECK (plan_tier IN ('starter', 'growth', 'scale'))
  - max_clients INTEGER NOT NULL DEFAULT 5
  - branding JSONB DEFAULT NULL
  - billing_interval TEXT DEFAULT 'monthly' 
      CHECK (billing_interval IN ('monthly', 'yearly'))
  - lemon_squeezy_customer_id TEXT
  - subscription_ends_at TIMESTAMPTZ
```

**Branding JSONB Structure:**
```json
{
  "logo_url": "https://...",
  "primary_color": "#6366f1",
  "agency_name": "My Agency"
}
```

**Tier Defaults:**
- Starter: `max_clients = 5`, `storage_limit_bytes = 214748364800` (200 GB)
- Growth: `max_clients = 25`, `storage_limit_bytes = 1099511627776` (1 TB)
- Scale: `max_clients = 999999`, `storage_limit_bytes = 3298534883328` (3 TB)

---

## Part 3: Enforcement Logic

### 3.1 Storage Limit Check (Already Exists)
The `check_storage_limit` function already blocks uploads when `used_storage + new_file > storage_limit`.

### 3.2 Client Limit Check (New)
Create a database function to enforce client limits:

```sql
CREATE FUNCTION public.check_client_limit(_agency_id UUID)
RETURNS BOOLEAN AS $$
  SELECT (
    SELECT COUNT(DISTINCT user_id) 
    FROM user_roles 
    WHERE agency_id = _agency_id AND role = 'client'
  ) < (
    SELECT max_clients FROM agencies WHERE id = _agency_id
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

Use this in the invitation flow:
- Before sending a client invitation, check `check_client_limit(agency_id)`
- If false, show toast: "Client limit reached. Upgrade to Growth or Scale for more."

### 3.3 Branding Logic (Frontend)
- If `plan_tier = 'growth'` OR `plan_tier = 'scale'`:
  - Check `agencies.branding` JSONB
  - If `branding.logo_url` exists, use it in Sidebar and Client Login
  - Otherwise, fall back to Veylodesk logo
- If `plan_tier = 'starter'`: Always show Veylodesk branding

---

## Part 4: Files to Modify

### Frontend Files

| File | Changes |
|------|---------|
| `src/pages/Pricing.tsx` | Add Monthly/Yearly toggle, update pricing display, yearly default |
| `src/components/landing/PricingSection.tsx` | Same toggle + pricing updates for landing page |
| `src/components/CollapsibleSidebar.tsx` | Fetch agency branding, conditionally show custom logo |
| `src/pages/auth/Login.tsx` | Support white-label login page (custom logo) |
| `src/pages/admin/Clients.tsx` | Check client limit before inviting |
| `src/pages/settings/Settings.tsx` | Add Branding settings section for Growth/Scale admins |

### Backend/Database

| Item | Changes |
|------|---------|
| Database Migration | Add `plan_tier`, `max_clients`, `branding`, `billing_interval`, `lemon_squeezy_customer_id`, `subscription_ends_at` columns |
| New DB Function | `check_client_limit(_agency_id)` |
| Edge Function | Create `lemon-webhook` to handle Lemon Squeezy subscription events |

---

## Part 5: Pricing Page UI Updates

### Monthly/Yearly Toggle

```text
Layout:
┌─────────────────────────────────────────┐
│     [Monthly]  ◉────────○  [Yearly]     │
│              Save 17%                   │
│           2 Months Free!                │
└─────────────────────────────────────────┘
```

### Price Display Logic

When **Yearly** is selected (default):
- Show: "$24/mo billed yearly" with strikethrough on monthly price
- Small text: "Pay $290/year"

When **Monthly** is selected:
- Show: "$29/mo"

### Plan Cards Update

**Starter:**
- Monthly: $29/mo | Yearly: $290/yr ($24/mo)
- Features: Unlimited Team Members, 5 Clients, 200GB, Standard Support

**Growth (Most Popular):**
- Monthly: $79/mo | Yearly: $790/yr ($66/mo)
- Features: Unlimited Team Members, 25 Clients, 1TB, White-Label

**Scale:**
- Monthly: $149/mo | Yearly: $1,490/yr ($124/mo)
- Features: Unlimited Team Members, Unlimited Clients, 3TB, White-Label, Priority Support

---

## Part 6: Lemon Squeezy Integration

### New Edge Function: `lemon-webhook`

Handles these webhook events from Lemon Squeezy:

| Event | Action |
|-------|--------|
| `subscription_created` | Set `plan_tier`, `max_clients`, `storage_limit_bytes`, `billing_interval`, `subscription_ends_at` |
| `subscription_updated` | Update tier if changed (upgrade/downgrade) |
| `subscription_cancelled` | Mark `subscription_ends_at`, optionally downgrade to starter after period |
| `subscription_payment_success` | Extend `subscription_ends_at` |

### Tier Mapping from Product IDs

```javascript
const PRODUCT_MAP = {
  'starter_monthly': { tier: 'starter', max_clients: 5, storage_gb: 200 },
  'starter_yearly': { tier: 'starter', max_clients: 5, storage_gb: 200 },
  'growth_monthly': { tier: 'growth', max_clients: 25, storage_gb: 1000 },
  'growth_yearly': { tier: 'growth', max_clients: 25, storage_gb: 1000 },
  'scale_monthly': { tier: 'scale', max_clients: 999999, storage_gb: 3000 },
  'scale_yearly': { tier: 'scale', max_clients: 999999, storage_gb: 3000 },
  'storage_addon_1tb': { addon_storage_gb: 1000 }, // Add to existing limit
};
```

### Required Secrets
- `LEMON_SQUEEZY_API_KEY` - For API calls
- `LEMON_SQUEEZY_WEBHOOK_SECRET` - To verify webhook signatures

---

## Part 7: Branding Settings (Admin Only)

Add a new section in Settings for Growth/Scale admins:

```text
┌─────────────────────────────────────────┐
│ 🎨 Branding (Growth/Scale Only)         │
├─────────────────────────────────────────┤
│ Agency Logo: [Upload Button]            │
│ Primary Color: [Color Picker] #6366f1   │
│ Agency Name: [Text Input]               │
│                                         │
│ Preview: Shows how sidebar/login looks  │
│                                         │
│ [Save Branding]                         │
└─────────────────────────────────────────┘
```

---

## Part 8: Implementation Sequence

### Phase 1: Database & Backend
1. Create database migration for new agency columns
2. Create `check_client_limit` function
3. Create `lemon-webhook` edge function
4. Add Lemon Squeezy secrets

### Phase 2: Pricing UI
5. Update `Pricing.tsx` with Monthly/Yearly toggle
6. Update `PricingSection.tsx` (landing page version)
7. Default to yearly billing

### Phase 3: Enforcement
8. Add client limit check to invitation flow
9. Ensure storage limit already enforced (verified)

### Phase 4: Branding
10. Add branding settings section for admins
11. Update `CollapsibleSidebar.tsx` to use custom branding
12. Update login page for white-label

---

## Summary of Changes

**Database:**
- Add 6 new columns to `agencies` table
- Create `check_client_limit` function

**Edge Functions:**
- Create `lemon-webhook` for payment handling

**Frontend (6 files):**
- `Pricing.tsx` - Monthly/Yearly toggle
- `PricingSection.tsx` - Same updates for landing
- `CollapsibleSidebar.tsx` - Custom branding support
- `Login.tsx` - White-label support
- `admin/Clients.tsx` - Client limit enforcement
- `settings/Settings.tsx` - Branding configuration

**Secrets:**
- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_WEBHOOK_SECRET`
