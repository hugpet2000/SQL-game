#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${1:-data}"
BACKUP_ROOT="${2:-${DATA_DIR}/backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${STAMP}"

mkdir -p "$DEST"

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" ]]; then
    cp "$src" "$dst"
    echo "Copied $src -> $dst"
  else
    echo "Skipped missing file: $src"
  fi
}

copy_if_exists "${DATA_DIR}/progress.json" "${DEST}/progress.json"
copy_if_exists "${DATA_DIR}/leaderboard.json" "${DEST}/leaderboard.json"
copy_if_exists "${DATA_DIR}/player.json" "${DEST}/player.json"
copy_if_exists "${DATA_DIR}/telemetry.ndjson" "${DEST}/telemetry.ndjson"

echo "Backup complete: ${DEST}"
