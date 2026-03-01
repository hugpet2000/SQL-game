#!/usr/bin/env bash
set -euo pipefail

# Quick launcher for stakeholder testing on a hosted box.
# Uses .env.hosted if present, otherwise sensible defaults.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env.hosted ]]; then
  # shellcheck disable=SC1091
  source .env.hosted
fi

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-7070}"

echo "[sql-learning-game] Starting on ${HOST}:${PORT}"
echo "[sql-learning-game] Tip: open http://<server-ip>:${PORT}"

exec mvn -q exec:java
