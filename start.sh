#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$project_dir/.env" ]] || { echo 'Missing .env; copy .env.example and configure it.' >&2; exit 1; }
[[ -d "$project_dir/backend/node_modules" && -d "$project_dir/frontend/node_modules" ]] || { echo 'Dependencies missing; run scripts/bootstrap.sh.' >&2; exit 1; }
set -a; source "$project_dir/.env"; set +a
: "${DATABASE_URL:?DATABASE_URL is required}"; : "${JWT_SECRET:?JWT_SECRET is required}"
[[ ${#JWT_SECRET} -ge 32 ]] || { echo 'JWT_SECRET must contain at least 32 characters.' >&2; exit 1; }
(cd "$project_dir/backend" && npm start) & backend_pid=$!
(cd "$project_dir/frontend" && npm run dev -- --port "${FRONTEND_PORT:-3400}") & frontend_pid=$!
cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"
