#!/usr/bin/env bash
# Concatenate all incremental migrations into one SQL file for a one-shot PROD
# bootstrap on an *empty* database. Source of truth remains supabase/migrations/*.sql;
# re-run this script whenever migrations change, then apply the output to PROD.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
DEFAULT_OUT="$ROOT/supabase/scripts/generated/prod_baseline.sql"
OUT="${1:-$DEFAULT_OUT}"

mkdir -p "$(dirname "$OUT")"

{
  echo "-- ============================================================================="
  echo "-- cleanScheduler — PROD baseline (concatenated migrations)"
  echo "-- Generated (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "-- Generator: supabase/scripts/build-prod-baseline.sh"
  echo "-- Source dir: supabase/migrations/*.sql (sorted)"
  echo "--"
  echo "-- USE ON: empty Postgres only (new Supabase project with no app schema yet)."
  echo "-- DO NOT run on DEV/PROD that already applied these migrations — duplicates will fail."
  echo "-- Ongoing deploys: prefer supabase migration up / db push against migration history."
  echo "--"
  echo "-- Apply:"
  echo "--   psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f $(basename "$OUT")"
  echo "-- Supabase Dashboard → SQL Editor works for moderate sizes; huge files may need psql."
  echo "-- ============================================================================="

  shopt -s nullglob
  files=("$MIGRATIONS"/*.sql)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No .sql files in $MIGRATIONS" >&2
    exit 1
  fi
  IFS=$'\n' sorted=($(printf '%s\n' "${files[@]}" | LC_ALL=C sort))
  for f in "${sorted[@]}"; do
    echo ""
    echo "-- ----------------------------------------------------------------------------"
    echo "-- FILE: $(basename "$f")"
    echo "-- ----------------------------------------------------------------------------"
    cat "$f"
  done
} >"$OUT"

echo "Wrote $OUT ($(wc -l <"$OUT" | tr -d ' ') lines)"
