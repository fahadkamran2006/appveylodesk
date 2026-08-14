#!/usr/bin/env bash
# Import the Veylodesk schema + data into YOUR OWN Supabase project.
#
# Usage:
#   chmod +x supabase/export/import.sh
#   ./supabase/export/import.sh "postgresql://postgres:<YOUR-DB-PASSWORD>@db.<YOUR-PROJECT-REF>.supabase.co:5432/postgres"
#
# Get the connection string in your Supabase dashboard:
#   Project Settings -> Database -> Connection string -> URI  (use the direct 5432 one, not the pooler)
#
# Safe to re-run: schema uses plain migrations (run once on a fresh project),
# data.sql is idempotent (ON CONFLICT DO NOTHING).

set -euo pipefail

DB_URL="${1:-}"
if [ -z "$DB_URL" ]; then
  echo "Error: pass your Supabase Postgres connection URI as the first argument." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v psql >/dev/null 2>&1 || { echo "Error: psql is not installed (brew install libpq / apt install postgresql-client)." >&2; exit 1; }

echo "==> 1/3 Checking connection"
psql "$DB_URL" -c "select version();" >/dev/null
echo "    connected."

echo "==> 2/3 Applying schema (supabase/export/schema.sql)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/schema.sql"

echo "==> 3/3 Loading data (supabase/export/data.sql)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/data.sql"

echo
echo "Done. Post-import checklist:"
echo "  - Create storage buckets: avatars, agency-logos, deliverables, drive, invoices (match your app's usage)."
echo "  - Deploy edge functions:  supabase functions deploy --project-ref <YOUR-REF>"
echo "  - Set edge function secrets (Resend, Paddle, Bunny, etc.) in Project Settings -> Edge Functions."
echo "  - Enable the Google auth provider and add your redirect URLs."
echo "  - Swap VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PROJECT_ID in .env."
