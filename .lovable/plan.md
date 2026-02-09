
## Goal
Fix Google/Apple OAuth on the published domain where it currently lands on your app’s 404 page at a URL like:
`https://veylodesk.com/--oauth/initiate?...`

## What’s actually happening (root cause)
Your OAuth flow is *starting* by navigating to an “OAuth broker initiate” path (`/~oauth/initiate` or ` /--oauth/initiate`). On the published app, that path is being served by your SPA (React Router), so it hits the catch-all `*` route and shows your in-app 404 page.

This is why it “works in the Lovable preview window” but fails on the published domain:
- In preview, the flow typically runs in an iframe/popup mode and may avoid the same navigation handling.
- On the published domain, the navigation to the broker path is treated like a normal SPA route.

## Implementation approach (robust fix)
Instead of relying on the published domain to serve the broker route correctly, we’ll add a tiny “proxy route” inside the React app:

When the app is opened at:
- `/~oauth/initiate?...` OR
- `/--oauth/initiate?...`

…it will immediately redirect the browser to the hosted OAuth broker origin:
- `https://oauth.lovable.app/~oauth/initiate?...` (preserving the full query string)

This keeps your existing login/signup code unchanged and avoids any brittle server rewrites.

## Changes to make

### 1) Add an OAuth initiate proxy page
Create a new page:
- `src/pages/auth/OAuthInitiateProxy.tsx`

Behavior:
- On mount (`useEffect`), read `window.location.search`
- Redirect with `window.location.replace()` to:
  - `https://oauth.lovable.app/~oauth/initiate` + the existing query string
- Show a centered loading spinner + “Redirecting…” while the redirect happens

Key detail:
- Preserve the query string exactly (includes `provider`, `redirect_uri`, `state`, and sometimes `response_mode=web_message`).

### 2) Register routes in `App.tsx`
Add these routes BEFORE the `*` catch-all:
- `<Route path="/~oauth/initiate" element={<OAuthInitiateProxy />} />`
- `<Route path="/--oauth/initiate" element={<OAuthInitiateProxy />} />`

(We add both because your screenshot shows `--oauth`, but the auth library’s documented default is `~oauth`. Supporting both makes the fix resilient.)

### 3) (Optional but recommended) Prevent future PWA/service-worker interference
If the PWA service worker is contributing to “app shell” being served on broker URLs, we’ll also update `vite.config.ts` Workbox settings to ensure these broker paths are not treated as normal SPA navigations (denylist them from navigation fallback).  
This step is optional if the proxy route fix works by itself, but it reduces future edge cases.

## How we’ll verify (end-to-end)
1. Publish the frontend changes.
2. On `https://veylodesk.com`, click “Continue with Google”.
   - It should briefly show “Redirecting…”
   - Then you should see the OAuth flow continue (no 404 page)
   - After completion, you should land on `/auth/callback` and be logged in.
3. Repeat with Apple.
4. If you still see old behavior, do a hard refresh and/or clear site data for `veylodesk.com` (published sites can keep older service worker caches).

## Notes / Why this is safe
- We are not changing authentication tokens, database logic, or your callback route.
- We are only ensuring the “start OAuth” step doesn’t get trapped by React Router on the published domain.
- This solution works even if the hosting platform doesn’t special-case the broker path on custom domains.

## Files involved
- New: `src/pages/auth/OAuthInitiateProxy.tsx`
- Edit: `src/App.tsx` (add 2 routes)
- Optional edit: `vite.config.ts` (Workbox navigation fallback denylist)
