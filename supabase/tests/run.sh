#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres database (with a minimal
# stand-in for the Supabase auth/storage schemas) and runs the SQL tests in
# this folder. Needs a Postgres 15+ server you can connect to as a superuser.
#
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$DIR/../migrations"
DB="${TEST_DB:-corehr_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB" >/dev/null
"${PSQL[@]}" -d "$DB" -f "$DIR/supabase_stub.sql" >/dev/null 2>&1 || "${PSQL[@]}" -d "$DB" -f "$DIR/supabase_stub.sql"

for f in "$MIGRATIONS"/*.sql; do
  # pg_cron / pg_net aren't available outside Supabase; the stub provides no-op versions
  if ! sed -E '/CREATE EXTENSION IF NOT EXISTS (pg_cron|pg_net)/d' "$f" | "${PSQL[@]}" -d "$DB" -f - >/dev/null 2>/tmp/migration_err.txt; then
    echo "Migration failed: $(basename "$f")"
    cat /tmp/migration_err.txt
    exit 1
  fi
done
echo "Applied $(ls "$MIGRATIONS"/*.sql | wc -l) migrations"

status=0
for t in "$DIR"/*.test.sql; do
  echo "Running $(basename "$t")"
  if ! "${PSQL[@]}" -d "$DB" -f "$t"; then
    status=1
  fi
done
exit $status
