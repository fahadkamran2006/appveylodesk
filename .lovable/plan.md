
# Fix OAuth 404 Error on Published App

## Problem Identified
The OAuth sign-in/sign-up is failing on your published custom domain (`veylodesk.com`) with a 404 error because of two issues:

1. **Code Issue**: The `Signup.tsx` file still uses `redirect_uri: window.location.origin` instead of the correct `/auth/callback` path (Login.tsx was fixed but Signup.tsx was missed)

2. **Configuration Issue**: Your custom domain `veylodesk.com` needs to be added to the allowed redirect URLs in the authentication settings

## Why It Works in Preview
The preview URL (`id-preview--20bad592-ee9a-41fd-8ceb-1db3cf54c871.lovable.app`) is automatically configured as a valid redirect URL. Your custom domain is not.

---

## Implementation Plan

### Step 1: Fix Signup.tsx OAuth Redirect URLs
Update both Google and Apple OAuth buttons to use the callback path:

**File**: `src/pages/auth/Signup.tsx`

- **Line 179**: Change `redirect_uri: window.location.origin` to `redirect_uri: \`${window.location.origin}/auth/callback\``
- **Line 221**: Same change for Apple sign-in

### Step 2: Configure Custom Domain in Auth Settings
You need to add your custom domain to the allowed redirect URLs in your backend authentication settings:

- Add `https://veylodesk.com` as an allowed redirect URL
- Add `https://veylodesk.com/auth/callback` as an allowed redirect URL

I'll provide a button to open the Cloud Dashboard where you can update these settings.

---

## Technical Details

### Current Code (Signup.tsx - Line 178-180)
```typescript
const { error } = await lovable.auth.signInWithOAuth('google', {
  redirect_uri: window.location.origin,  // ❌ Missing /auth/callback
});
```

### Fixed Code
```typescript
const { error } = await lovable.auth.signInWithOAuth('google', {
  redirect_uri: `${window.location.origin}/auth/callback`,  // ✅ Correct
});
```

---

## Files to Modify
| File | Change |
|------|--------|
| `src/pages/auth/Signup.tsx` | Update Google OAuth redirect_uri (line 179) |
| `src/pages/auth/Signup.tsx` | Update Apple OAuth redirect_uri (line 221) |

## Configuration Required
After code changes, you must add your custom domain to the authentication settings in the Cloud Dashboard.
