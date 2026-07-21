#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$project_dir/.env"; set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
if [[ "${APPLY_DESTRUCTIVE_LEGACY_BASELINE:-}" == yes && "${NODE_ENV:-development}" != production ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$project_dir/backend/schema.sql"
else
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT 1 FROM users LIMIT 0" >/dev/null
fi
for migration in "$project_dir"/backend/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"; done
