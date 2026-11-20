#!/usr/bin/env bash
# Local dev only: (re)create the Vault secrets the notify trigger needs.
# `supabase db reset` wipes them, so run this after every reset.
#
# - notify_url:    where the trigger POSTs (the local notify Edge Function)
# - notify_secret: a fresh random shared secret. The same value is written to
#                  supabase/functions/.env as NOTIFY_SECRET (gitignored), which
#                  `supabase functions serve` loads, so the function accepts it.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1 || true)
[ -n "$DB_CONTAINER" ] || { echo "Supabase database container not found - is 'npx supabase start' running?" >&2; exit 1; }

SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")

docker exec -i "$DB_CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 -v secret="$SECRET" <<'SQL'
delete from vault.secrets where name in ('notify_url', 'notify_secret', 'service_role_key');
select vault.create_secret('http://kong:8000/functions/v1/notify', 'notify_url');
select vault.create_secret(:'secret', 'notify_secret');
SQL

ENV_FILE=supabase/functions/.env
touch "$ENV_FILE"
grep -v '^NOTIFY_SECRET=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
echo "NOTIFY_SECRET=$SECRET" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"

echo "Vault secrets notify_url and notify_secret set; NOTIFY_SECRET written to $ENV_FILE."
echo "Restart 'npx supabase functions serve notify' if it is running, so it picks up the new secret."
