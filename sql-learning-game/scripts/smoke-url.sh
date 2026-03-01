#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <base-url>"
  echo "Example: $0 https://sqlgame.example.com"
  exit 1
fi

BASE_URL="${BASE_URL%/}"

echo "== Smoke check: $BASE_URL =="

echo "[1/4] Health"
curl -fsS "$BASE_URL/api/health" >/dev/null

echo "[2/4] Levels list"
curl -fsS "$BASE_URL/api/levels" >/dev/null

echo "[3/4] Progress"
curl -fsS "$BASE_URL/api/progress" >/dev/null

echo "[4/4] Frontend"
curl -fsS "$BASE_URL/" >/dev/null

echo "✅ Smoke checks passed for $BASE_URL"
