#!/usr/bin/env bash
# Apply migrations to a scratch database and run the pgTAP suite.
#
# The RLS tests are the point of this script. A minor-safety rule that isn't tested
# isn't a rule, so these run in CI and a failure blocks the branch.
set -euo pipefail

DB="${HITS_TEST_DB:-hits_test}"
export PGHOST="${PGHOST:-/var/tmp}" PGPORT="${PGPORT:-5433}" PGUSER="${PGUSER:-postgres}"

psql -q -c "drop database if exists ${DB};" >/dev/null
psql -q -c "create database ${DB};"

psql -q -d "${DB}" -v ON_ERROR_STOP=1 -c \
  'create extension postgis; create extension pgtap; create extension "uuid-ossp"; create extension citext;' >/dev/null

psql -q -d "${DB}" -v ON_ERROR_STOP=1 -f supabase/tests/helpers/00_local_shim.sql >/dev/null

for f in supabase/migrations/*.sql; do
  printf '  migrate  %s\n' "$(basename "$f")"
  psql -q -d "${DB}" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

psql -q -d "${DB}" -v ON_ERROR_STOP=1 -f supabase/tests/helpers/10_fixtures.sql >/dev/null
echo

total=0
failed=0
for t in supabase/tests/*.sql; do
  printf '=== %s\n' "$(basename "$t")"
  # pgTAP writes its TAP stream through psql's result columns; pull out just the
  # assertion lines so a failure is visible and scriptable.
  out="$(psql -d "${DB}" -v ON_ERROR_STOP=1 -X -q -t -A -f "$t" 2>&1 || true)"
  while IFS= read -r line; do
    case "$line" in
      "ok "[0-9]*|"not ok "[0-9]*) printf '  %s\n' "$line"; total=$((total+1)) ;;
    esac
    case "$line" in "not ok "[0-9]*) failed=$((failed+1)) ;; esac
  done <<< "$out"
  # psql prefixes errors with file and line AND a space -- "psql:t.sql:65: ERROR:" -- so
  # both ^ERROR and :ERROR miss every one of them, and a test that died mid-file was
  # reported only as a short plan with no word of what actually went wrong.
  err='^psql:[^ ]*:[0-9]+: (ERROR|FATAL|PANIC):|^(ERROR|FATAL|PANIC):'
  if grep -qE "$err" <<< "$out"; then
    printf '  !! psql error:\n'; grep -E "$err" <<< "$out" | head -5 | sed 's/^/     /'
    failed=$((failed+1))
  fi
  # A plan(n) that never reached n is a failure too, however quiet.
  planned="$(grep -oE '^1\.\.[0-9]+' <<< "$out" | head -1 | cut -d. -f3)"
  ran="$(grep -cE '^(not )?ok [0-9]+' <<< "$out" || true)"
  if [ -n "$planned" ] && [ "$ran" -lt "$planned" ]; then
    printf '  !! ran %s of %s planned assertions\n' "$ran" "$planned"
    failed=$((failed+1))
  fi
done

echo
if [ "$failed" -gt 0 ]; then
  echo "FAILED: ${failed} of ${total} assertions"
  exit 1
fi
echo "PASSED: ${total} assertions"
