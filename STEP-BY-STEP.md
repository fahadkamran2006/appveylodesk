# Getting Veylodesk onto your own Supabase — plain English

No coding knowledge needed. Do the steps in order. Nothing here deletes anything.

---

## Step 3 — Copy the database (no terminal needed)

1. Go to **supabase.com** → sign in → **New project**.
   - Name: `veylodesk`
   - Database password: make one up and **save it somewhere safe**.
   - Region: pick the one closest to your users. Click **Create**. Wait ~2 min.

2. In your new project, click **SQL Editor** in the left sidebar → **New query**.

3. Open the file `supabase/export/schema.sql` from your GitHub repo
   (github.com → your repo → `supabase` → `export` → `schema.sql` → click the
   **Copy raw file** icon at the top-right of the file).

4. Paste it into the SQL Editor box and press **Run** (bottom right).
   - It takes 10–60 seconds. You want to see "Success".
   - If you see a red error, copy the error text and send it to me — I'll fix it.

5. Click **New query** again. Repeat steps 3–4 with the file
   `supabase/export/data.sql`. This one carries all your rows *and* your user
   accounts (everyone keeps their existing password).

Your database is now a full copy. Check it: left sidebar → **Table Editor** →
you should see `projects`, `profiles`, `invoices`, etc. with your real data.

---

## Step 3b — Create the storage buckets

Left sidebar → **Storage** → **New bucket**. Create these five, one at a time.
Tick **Public bucket** for the ones marked public:

| Bucket name    | Public? |
|----------------|---------|
| `avatars`      | yes     |
| `agency-logos` | yes     |
| `deliverables` | no      |
| `drive`        | no      |
| `invoices`     | no      |

(Most of your video files live on Bunny.net already and are not affected.)

---

## Step 4 — Upload the 35 functions (this part needs the terminal, ~10 min)

**Mac:** open the app called **Terminal**.
**Windows:** open **PowerShell**.

Type each line, press Enter, wait for it to finish before the next one.

1. Install the tool (needs Node.js from **nodejs.org** if you don't have it):

```
npm install -g supabase
```

2. Log in (this opens your browser — click Authorize):

```
supabase login
```

3. Go into your downloaded code folder. Download it first: GitHub → your repo →
   green **Code** button → **Download ZIP** → unzip it. Then:

   Mac: type `cd ` (with a space) and **drag the unzipped folder onto the Terminal window**, press Enter.
   Windows: type `cd ` then paste the folder path, press Enter.

4. Connect to your new project. Your "ref" is the code in your Supabase URL —
   `https://supabase.com/dashboard/project/**THIS-PART**`:

```
supabase link --project-ref THIS-PART
```

5. Upload all the functions in one go:

```
supabase functions deploy --no-verify-jwt
```

6. Give the functions their keys: Supabase dashboard → **Project Settings** →
   **Edge Functions** → **Secrets** → add each one you use:
   `RESEND_API_KEY`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`,
   `BUNNY_API_KEY`, `BUNNY_STORAGE_ZONE`, `BUNNY_CDN_URL`,
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
   (Use the same values you already use — they're your own accounts' keys.)

---

## Step 5 — Point the app at the new database (3 small edits)

In Supabase: **Project Settings** → **API**. Copy the **Project URL** and the
**anon public** key.

In your GitHub repo, edit the file called `.env` (click it → pencil icon) so it
reads — replacing the two placeholders:

```
VITE_SUPABASE_URL="https://YOUR-REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR-ANON-PUBLIC-KEY"
VITE_SUPABASE_PROJECT_ID="YOUR-REF"
```

Also edit `supabase/config.toml`, first line, to `project_id = "YOUR-REF"`.

Then in Supabase: **Authentication → Providers → Google** — turn it on and paste
your Google client ID/secret (same ones you use now). And
**Authentication → URL Configuration** — add your website address
(`https://veylodesk.com`) to Site URL and Redirect URLs.

---

## Step 6 — Test, then switch off

Have whoever hosts the app (Vercel/Netlify, or a developer) deploy the repo, and
check: sign in, projects board, upload a file, a review link, an invoice, chat.

Only when all of that works: Lovable editor → **Cloud** tab → **Advanced** →
**Disconnect**. That permanently deletes the old copy, so do it last.
