#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
[[ "${CONFIRM_DEMO_SEED:-}" == 'yes' ]] || { echo 'Set CONFIRM_DEMO_SEED=yes to seed a disposable database.' >&2; exit 2; }
[[ "${NODE_ENV:-development}" != 'production' ]] || { echo 'Refusing to seed production.' >&2; exit 2; }
(cd "$project_dir/backend" && node seed.js)
