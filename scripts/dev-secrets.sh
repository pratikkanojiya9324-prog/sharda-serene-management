#!/usr/bin/env bash
# Local dev only: (re)create the Vault secrets the notify trigger needs.
# `supabase db reset` wipes them, so run this after every reset.
set -euo pipefail
cd "$(dirname "$0")/.."

KEY=$(npx supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')
[ -n "$KEY" ] || { echo "Could not read SERVICE_ROLE_KEY - is 'npx supabase start' running?" >&2; exit 1; }

DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
[ -n "$DB_CONTAINER" ] || { echo "Supabase database container not found" >&2; exit 1; }

docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -v key="$KEY" <<'SQL'
delete from vault.secrets where name in ('notify_url', 'service_role_key');
select vault.create_secret('http://kong:8000/functions/v1/notify', 'notify_url');
select vault.create_secret(:'key', 'service_role_key');
SQL
echo "Vault secrets notify_url and service_role_key set."
