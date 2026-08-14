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

## Step 4 — Move the data (already exported)

`supabase/export/data.sql` is generated and in the repo. It contains every row of
all 49 public tables **plus** `auth.users` and `auth.identities`, in
dependency-safe order, wrapped in a transaction with
`session_replication_role = replica` so foreign keys and triggers don't fight the
load. Every statement is `ON CONFLICT DO NOTHING`, so it is safe to re-run.

Deliberately skipped (throwaway logs, ~640 rows): `notifications`, `system_logs`,
`lead_magnet_email_events`. Say the word if you want them too.

Load it after the schema:

```bash
psql "postgresql://postgres:<password>@db.<your-ref>.supabase.co:5432/postgres" -f supabase/export/data.sql
```

### One-command import (schema + data)

Instead of running the two `psql` commands by hand:

```bash
chmod +x supabase/export/import.sh
./supabase/export/import.sh "postgresql://postgres:<password>@db.<your-ref>.supabase.co:5432/postgres"
```

It verifies the connection, applies `schema.sql`, then loads `data.sql`, and
prints the remaining checklist (buckets, functions, secrets, Google auth, env vars).
Use the **direct** connection URI on port 5432 (Project Settings → Database →
Connection string → URI), not the pooler.


## Step 5 — Users come with it

`auth.users` (including `encrypted_password`) and `auth.identities` (the Google
links) are inside `data.sql`, and IDs are preserved — so `public.profiles.id`
still lines up and everyone keeps their existing password. You only need to
re-create the **Google provider credentials** in the new project
(Authentication → Providers → Google) and add your redirect URLs; the per-user
Google links are already restored.


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
