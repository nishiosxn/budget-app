#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RUNNER_TEMP:?}" "${SB_STACK_STATUS:?}"
test "${GITHUB_ACTIONS:-}" = true
test "$(jq -er .DB_URL "$SB_STACK_STATUS")" = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
# Use the server's own PostgreSQL client version. No remote connection or secret.
mapfile -t candidates < <(docker ps --format '{{.Names}} {{.Ports}}' | awk '/^supabase_db_/ && /:54322->5432\/tcp/ {print $1}')
test "${#candidates[@]}" = 1
container="${candidates[0]}"
pg(){ docker exec -i -e PGPASSWORD=postgres "$container" "$@"; }
source_db=postgres
restore_db=smart_budget_restore_drill
tmp="$(mktemp -d "$RUNNER_TEMP/sb-backup-drill.XXXXXX")"
created=false
cleanup(){
 if "$created"; then pg dropdb -h 127.0.0.1 -U postgres --if-exists "$restore_db" >/dev/null || true; fi
 rm -rf -- "$tmp"
}
trap cleanup EXIT
psql_source(){ pg psql -h 127.0.0.1 -U postgres -d "$source_db" -X -v ON_ERROR_STOP=1 "$@"; }
psql_restore(){ pg psql -h 127.0.0.1 -U postgres -d "$restore_db" -X -v ON_ERROR_STOP=1 "$@"; }
# psql on the runner resolves relative \ir migration paths.
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 -f scripts/connected-test/backup-fixture.sql
psql_source -At -f - < scripts/connected-test/backup-fingerprint.sql > "$tmp/source.txt"
age-keygen -o "$tmp/identity.agekey" 2>/dev/null
recipient="$(age-keygen -y "$tmp/identity.agekey")"
pg pg_dump -h 127.0.0.1 -U postgres -d "$source_db" -Fc \
 --schema=public --schema=private --schema=smart_assistant_private \
 --schema=smart_budget_backups --schema=incident_backup_20261116 \
 --no-publications --no-subscriptions | age -r "$recipient" -o "$tmp/fixture.dump.age"
test -s "$tmp/fixture.dump.age"
pg createdb -h 127.0.0.1 -U postgres -T template0 "$restore_db"
created=true
# Application-schema drill: synthetic auth identities reconstituted separately.
# Not a full Supabase Auth/Storage disaster recovery or a production credential export.
psql_restore <<'SQL'
create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid
$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
SQL
psql_source -At -c "select format('insert into auth.users(id,email) values (%L,%L);',id,email) from auth.users order by id" | psql_restore >/dev/null
# Fresh database: no destructive --clean phase. Even --if-exists cannot
# drop a policy on an absent table. Require an empty application target.
test "$(psql_restore -At -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','smart_assistant_private','smart_budget_backups','incident_backup_20261116') and c.relkind in ('r','p','v','m','S')")" = 0
# A dump may explicitly include CREATE SCHEMA public; remove only the empty
# template schema if the archive declares it, never use CASCADE.
age -d -i "$tmp/identity.agekey" "$tmp/fixture.dump.age" | pg pg_restore --list > "$tmp/archive-list.txt"
if grep -Eq '^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public ' "$tmp/archive-list.txt"; then
 psql_restore -c 'drop schema public' >/dev/null
fi
# Decrypt directly into pg_restore; no plaintext dump is saved.
age -d -i "$tmp/identity.agekey" "$tmp/fixture.dump.age" |
 pg pg_restore -h 127.0.0.1 -U postgres -d "$restore_db" --exit-on-error --single-transaction
psql_restore -At -f - < scripts/connected-test/backup-fingerprint.sql > "$tmp/restored.txt"
if ! cmp -s "$tmp/source.txt" "$tmp/restored.txt"; then
 echo "Restored application data or schema fingerprint differs (synthetic fixture only)"
 diff -u "$tmp/source.txt" "$tmp/restored.txt" | head -80 || true
 exit 1
fi
psql_restore -f - < scripts/connected-test/backup-verify.sql
printf '%s\n' "Encrypted restore drill verified: app tables, constraints, policies, triggers, receipt replay and isolation."
