# Moving Veylodesk to your own Supabase project

Everything in this app is standard Supabase — Postgres, RLS, Edge Functions, Auth,
Storage. Nothing is locked to Lovable. This guide takes the whole backend out.

## What is portable (all of it)

| Piece | Where it lives | Portable? |
|---|---|---|
| Frontend (React/Vite) | `src/` | Yes — plain Vite app |
| Database schema, RLS, triggers, functions | `supabase/migrations/` (109 files) + `supabase/export/schema.sql` | Yes |
| Edge functions (35) | `supabase/functions/` | Yes |
| Function config (`verify_jwt`) | `supabase/config.toml` | Yes |
| Data rows (~1,200 total) | current database | Exportable (see step 4) |
| Auth users (passwords, OAuth links) | `auth.users` | Exportable, needs care (step 5) |
| Media files | Bunny.net (already external) + a little in Supabase Storage | Bunny is untouched |
| Secrets (Paddle, Resend, Bunny keys) | function env | You re-enter them once |

## Step 1 — Get the code onto GitHub

Lovable editor → **+** in the chat box → **GitHub → Connect project → Create Repository**.
From then on any developer can clone, run `npm i && npm run dev`, and work normally.

## Step 2 — Create your own Supabase project

1. supabase.com → New project (pick a region close to your users, save the DB password).
2. Install the CLI: `npm i -g supabase`
3. `supabase login` then `supabase link --project-ref <your-new-ref>`

## Step 3 — Apply the schema

Option A (recommended, keeps history):

```bash
supabase db push          # replays supabase/migrations in order
```

Option B (one shot): open the SQL editor in your new project and paste
`supabase/export/schema.sql` (it is every migration concatenated, in order).

Then deploy the functions:

```bash
supabase functions deploy --no-verify-jwt
```

and set the secrets they need (Paddle, Resend, Bunny, VAPID) in
Project Settings → Edge Functions → Secrets.

## Step 4 — Move the data

Row counts are tiny (largest table is `notifications` at ~581 rows; total ~1.2k),
so a plain SQL insert dump is enough. Ask me in chat:

> "dump my data as SQL for the new Supabase project"

and I will generate `supabase/export/data.sql` with INSERT statements in
dependency-safe order (agencies → profiles → user_roles → clients → containers →
projects → deliverables → invoices → channels → messages → the rest).
Tell me if you want to skip throwaway tables (`notifications`, `system_logs`,
`lead_magnet_email_events`) — most people do.

Load it with:

```bash
psql "postgresql://postgres:<password>@db.<your-ref>.supabase.co:5432/postgres" -f supabase/export/data.sql
```

## Step 5 — Move the users

`public.profiles.id` points at `auth.users.id`, so user IDs must be preserved.
Two ways:

- **Keep passwords:** insert the `auth.users` rows (id, email, `encrypted_password`,
  `email_confirmed_at`, metadata) into the new project before loading `data.sql`.
  I can include this block in the dump on request.
- **Clean start:** create users fresh with the same IDs via the Admin API and have
  everyone use "forgot password" once. Google sign-in has to be re-configured in
  the new project either way (Authentication → Providers → Google, plus your
  redirect URLs).

## Step 6 — Point the app at the new backend

Only three values change — no code rewrite:

```
VITE_SUPABASE_URL="https://<your-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your new anon key>"
VITE_SUPABASE_PROJECT_ID="<your-ref>"
```

Also in the repo:
- `supabase/config.toml` → set `project_id` to your ref.
- `src/integrations/lovable/index.ts` is the only Lovable-specific file (it wraps
  Google OAuth). Replace its usage with
  `supabase.auth.signInWithOAuth({ provider: 'google' })` and delete the file plus
  the `@lovable.dev/cloud-auth-js` dependency.
- Add the redirect URLs of your host (Vercel/Netlify/your server) to
  Authentication → URL Configuration.

## Step 7 — Verify, then cut over

Run the app locally against the new project and check: sign-in, project kanban,
deliverable upload, review links, invoices, messaging realtime, Paddle webhook
(point the Paddle webhook URL at the new function URL).

Only after all of that works should Cloud be turned off.

> **Warning:** disconnecting Lovable Cloud (Cloud tab → Advanced → Disconnect,
> workspace admin only) is irreversible and permanently deletes the database,
> storage and functions on the Lovable side. Do it last, and only once your own
> Supabase project is serving real traffic.
