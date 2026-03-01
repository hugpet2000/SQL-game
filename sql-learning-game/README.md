# SQL Learning Game (Java)

A developer-style SQL learning game for young tech students (16–25), built in Java.

## What is included

- Campaign with **15 progressive missions**
- Real SQL execution via **H2 embedded DB**
- Deterministic level reset (schema + seed SQL)
- Query evaluator: correctness, timing, score, XP, achievements
- Friendly SQL error feedback
- Optional hints with escalation + advanced-level hint gating/nudges
- Persistent progress (`data/progress.json`)
- Local telemetry capture (`data/telemetry.ndjson`) for attempts/hints/solve times
- Sandbox mode for free experimentation
- Dark-mode web UI (local/offline-first) with focus cues and short per-level explanation snippets

## Tech

- Java 17+
- Javalin (lightweight local web server)
- H2 (embedded SQL engine)
- Jackson (YAML/JSON)

## Run (local default)

```bash
mvn -q exec:java
```

Open: http://localhost:7070

## Hosted mode / runtime config

All runtime settings are environment-driven.

### Network + data paths

- `SQLGAME_HOST` (default: `localhost`)
- `SQLGAME_PORT` (default: `7070`)
- `SQLGAME_DATA_DIR` (default: `data`)
- `SQLGAME_PROGRESS_PATH` (optional override)
- `SQLGAME_LEADERBOARD_PATH` (optional override)
- `SQLGAME_PLAYER_PATH` (optional override)
- `SQLGAME_TELEMETRY_PATH` (optional override)
- `SQLGAME_BACKUP_DIR` (default: `${SQLGAME_DATA_DIR}/backups`)

### Auth guard (optional, recommended when exposed)

Set `SQLGAME_AUTH_MODE`:

- `off` (default) — no auth (local mode behavior)
- `token` — bearer token auth
- `basic` — HTTP basic auth

For token mode:

- `SQLGAME_AUTH_TOKEN=<long-random-secret>`

For basic mode:

- `SQLGAME_AUTH_USERNAME=<user>`
- `SQLGAME_AUTH_PASSWORD=<pass>`

`/api/health` is intentionally left public for uptime checks. Other `/api/*` routes are protected when auth is enabled.

If auth mode is set but the required secret(s) are missing, the server logs a warning and starts with auth disabled. This avoids a crash during misconfigured deploys, but it also means you could accidentally expose the API if you skip secrets.

### Example (hosted with token auth)

```bash
export SQLGAME_HOST=0.0.0.0
export SQLGAME_PORT=7070
export SQLGAME_DATA_DIR=/var/lib/sql-learning-game
export SQLGAME_AUTH_MODE=token
export SQLGAME_AUTH_TOKEN='replace-with-strong-token'

mvn -q exec:java
```

Example authenticated call:

```bash
curl -H "Authorization: Bearer $SQLGAME_AUTH_TOKEN" \
  http://localhost:7070/api/progress
```

## Backup / export progress data

### API endpoint (safe local backup)

Creates a timestamped backup folder and copies current data files.

```bash
curl -X POST \
  -H "Authorization: Bearer $SQLGAME_AUTH_TOKEN" \
  http://localhost:7070/api/admin/backup
```

Response includes backup path and copied-file status.

### API endpoint (read-only export snapshot)

Returns a JSON snapshot of current progress, leaderboard, player profile, and telemetry. Useful for quick backups or admin exports without touching the filesystem.

```bash
curl -H "Authorization: Bearer $SQLGAME_AUTH_TOKEN" \
  http://localhost:7070/api/admin/export
```

The export response includes potentially sensitive data (player IDs, telemetry), so keep auth enabled when exposing this endpoint.

### Offline script

```bash
./scripts/backup-progress.sh [data_dir] [backup_root]
```

Defaults to `data` and `data/backups`.

## Test

### Fast smoke (critical integration checks)

Runs only a lightweight API/gameplay smoke test for quick v1.1 stability checks while iterating v1.2 playtest tweaks.

```bash
mvn -Psmoke test
```

### Full test suite

Runs all unit + integration tests.

```bash
mvn test
```

## Project structure

- `src/main/java/com/plupp/sqlgame/core` — level loading, SQL execution, evaluation
- `src/main/java/com/plupp/sqlgame/store` — progress + leaderboard + telemetry persistence
- `src/main/resources/levels` — data-driven level definitions
- `src/main/resources/static` — frontend UI

## v1.2 learning-quality balancing notes (levels 11–15)

- Retention-first repetition loops were added to prompts: **build → verify → finalize**.
- Hint scaffolding was deepened to 3 short passes (concept, check, near-final shape).
- Win messaging now reinforces the reusable SQL pattern learned in each level.
- Difficulty ramp is intentionally slight and explicit across levels 11→15.
- Scope stayed lightweight: no new missions, content-only adjustments.

## Notes

- Designed to be extensible: add more YAML levels without changing evaluator logic.

## Local telemetry (v1.2 playtest support)

Telemetry is file-based (no external service):

- `level_attempt` when Run is pressed
- `hint_used` when a hint is opened
- `solve_time` when a level is solved (includes `durationMs`)

Where data is stored:

- `data/telemetry.ndjson` (one JSON object per line)

Quick inspection commands:

```bash
# latest 20 telemetry lines
tail -n 20 data/telemetry.ndjson

# only solve times
grep '"type":"solve_time"' data/telemetry.ndjson
```

Optional API view (recent rows):

```bash
curl 'http://localhost:7070/api/telemetry/recent?limit=20'
```
