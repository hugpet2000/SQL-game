# TaskBridgeApp (Sprint 0 Scaffold)

Defaults applied:
- **Bridge:** Node.js + Express REST API
- **Desktop UI:** Electron + React (Vite)
- **Transport:** REST polling (2s)
- **Security:** localhost bind, optional bearer token toggle
- **Pagination:** `limit` + `offset` (default limit=100)

Sprint 1 wiring:
- `/api/tasks` now maps to `openclaw sessions --all-agents --json`
- `/api/agents` now maps to `openclaw agents list --json`
- `/health` validates bridge + `openclaw status --json`

Sprint 2 updates:
- Server-side task filters: `q`, `agentId`, `status`
- New `/api/config` endpoint for runtime visibility (host/port/auth/bin)
- Desktop supports `VITE_API_BASE` for easier Windows/WSL setup
- Desktop adds agent filter dropdown wired to server filtering

Sprint 3 updates:
- Session history preview endpoint: `/api/tasks/:id/history?limit=25`
- Dashboard row actions: History modal, Copy session key, quick open Control UI
- Optional bearer token input in UI (stored locally)

Sprint 4 updates (backend hardening):
- New endpoint: `POST /api/tasks/:id/ping` to send a safe text ping into a session via OpenClaw CLI
- Improved history parsing for nested arrays/objects in session JSONL content
- Standardized error envelopes across endpoints: `{ error, details, code }`
- Lightweight request logging with request IDs and duration
- Request-level timeout handling + CLI timeout wrapping for reliability

Sprint 5 updates (observability + safety):
- New endpoint: `GET /api/version` (git commit, branch, pid, uptime, start timestamp)
- New endpoint: `GET /api/selfcheck` (version + OpenClaw health verification)
- New endpoint: `POST /api/reload-config` to re-read env-like runtime settings without restart
- New endpoint: `GET /api/metrics` with request/error/latency/cache counters
- `/api/tasks` now uses in-memory lookup cache (default TTL `2000ms`) for sessions + agents with hit/miss diagnostics

Sprint 6-9 updates (connection reliability + dashboard model):
- OpenClaw CLI wrapper now has retry/backoff for transient failures (`CLI_RETRY_*` envs)
- In-flight dedupe added for expensive session/agent fetches to prevent thundering herd
- Stable error diagnostics included in API errors (`diagnostics.retriable`, `attempts`, etc.)
- Circuit breaker cooldown for expensive calls after repeated failures (`BREAKER_*` envs)
- New lightweight `GET /api/healthz` for frequent frontend polling (now grace-smoothed to avoid one-off transient blips)
- `GET /api/selfcheck` and `GET /api/metrics` now expose: `openclawReachable`, `lastSuccessAt`, `consecutiveFailures`, latency p95 estimate, cache age
- New `GET /api/dashboard/summary` with plain-language aggregates for dashboard cards
- New `GET /api/dashboard/sessions` with normalized fields (`statusLabel`, `lastSeenRelative`, `riskFlags`)

Sprint 10 updates (UI-overhaul contract shaping):
- `GET /api/dashboard/summary` now includes stable Home view contract fields:
  - KPI counts: `kpis.active`, `kpis.running`, `kpis.queued`, `kpis.failed`
  - `activityFeed[]` items: `timestamp`, `agentName`, `actionText`, `status`
  - `agentsSnapshot[]` cards for Home/Agents overviews
  - `healthPanel.connection` + `healthPanel.system` for Settings/Home status widgets
- New `GET /api/dashboard/activity` focused activity-feed endpoint
- New `GET /api/dashboard/agents` focused agents snapshot endpoint
- New `GET /api/agents/:id` details endpoint with `status`, `currentTask`, `heartbeat`, `recentTasks`, `recentLogs`
- `GET /api/agents` remains backward-compatible and now adds optional `status/currentTask/heartbeat`

## Structure
- `bridge/` REST bridge service
- `desktop/` Electron + React desktop app

## Quick start
### 1) Bridge
```bash
cd bridge
npm install
npm run dev
```
Bridge runs on `http://127.0.0.1:8787`.

### 2) Desktop
```bash
cd desktop
npm install
npm run dev
```

## Env
Bridge supports:
- `PORT` (default `8787`)
- `HOST` (default `127.0.0.1`)
- `AUTH_TOKEN` (optional; when set, requires `Authorization: Bearer <token>`)
- `OPENCLAW_BIN` (default `/home/hugog/.npm-global/bin/openclaw`)
- `OPENCLAW_PATH_PREFIX` (default `/home/hugog/.npm-global/bin`)
- `CLI_TIMEOUT_MS` (default `15000`)
- `REQUEST_TIMEOUT_MS` (default `20000`)
- `MAX_PING_TEXT` (default `1200`)
- `CACHE_TTL_MS` (default `2000`) used by `/api/tasks` lookup cache
- `CLI_RETRY_COUNT` (default `2`) retries for transient OpenClaw CLI failures
- `CLI_RETRY_BASE_DELAY_MS` (default `250`) exponential backoff base
- `CLI_RETRY_MAX_DELAY_MS` (default `2000`) max backoff delay
- `BREAKER_FAILURE_THRESHOLD` (default `3`) failures before opening circuit for expensive calls
- `BREAKER_COOLDOWN_MS` (default `8000`) cooldown before auto-recovery attempts
- `HEALTH_GRACE_MS` (default `15000`) keeps `/api/healthz` stable during short transient OpenClaw failures

## API examples

### List tasks
```bash
curl -s http://127.0.0.1:8787/api/tasks?limit=20 | jq
```

### Read session history
```bash
curl -s http://127.0.0.1:8787/api/tasks/<session-id>/history?limit=10 | jq
```

### Ping a session
```bash
curl -s -X POST http://127.0.0.1:8787/api/tasks/<session-id>/ping \
  -H 'Content-Type: application/json' \
  -d '{"text":"Quick ping from TaskBridge","agentId":"main"}' | jq
```

### Version + selfcheck
```bash
curl -s http://127.0.0.1:8787/api/version | jq
curl -s http://127.0.0.1:8787/api/selfcheck | jq
```

### Reload runtime config (no restart)
```bash
curl -s -X POST http://127.0.0.1:8787/api/reload-config \
  -H 'Content-Type: application/json' | jq
```

### Metrics + healthz
```bash
curl -s http://127.0.0.1:8787/api/metrics | jq
curl -s http://127.0.0.1:8787/api/healthz | jq
```

### Dashboard-friendly endpoints
```bash
curl -s http://127.0.0.1:8787/api/dashboard/summary | jq
curl -s 'http://127.0.0.1:8787/api/dashboard/sessions?limit=20' | jq
curl -s 'http://127.0.0.1:8787/api/dashboard/activity?limit=20' | jq
curl -s http://127.0.0.1:8787/api/dashboard/agents | jq
curl -s http://127.0.0.1:8787/api/dashboard/health | jq
curl -s http://127.0.0.1:8787/api/agents/<agent-id> | jq
```

### Smoke check: stable health polling + repeated ping attempts
```bash
# 1) baseline healthz (should include state + stableReachable)
curl -s http://127.0.0.1:8787/api/healthz | jq

# 2) quick poll loop (look for no one-sample down blips on transient hiccups)
for i in {1..8}; do curl -s http://127.0.0.1:8787/api/healthz | jq '{ok,state,openclawReachable,stableReachable,consecutiveFailures,lastSuccessAt}'; sleep 1; done

# 3) repeated ping attempts to same session
SID="<session-id>"
for i in {1..5}; do
  curl -s -X POST "http://127.0.0.1:8787/api/tasks/${SID}/ping" \
    -H 'Content-Type: application/json' \
    -d '{"text":"TaskBridge smoke ping"}' | jq '{ok,sent,agentId,attempts,triedAgentIds,code,error}'
  sleep 1
done
```

## API contract (Home / Agents / Settings)

These fields are intended as a stable frontend contract for the UI overhaul.

### Home view
- `GET /api/dashboard/summary`
  - `kpis.active|running|queued|failed`
  - `activityFeed[]` with `timestamp`, `agentName`, `actionText`, `status`
  - `agentsSnapshot[]` with `status`, `currentTask`, `heartbeat`
  - `healthPanel.connection` and `healthPanel.system`

Example:
```json
{
  "contractVersion": "dashboard.v2",
  "kpis": { "active": 3, "running": 1, "queued": 2, "failed": 0 },
  "activityFeed": [
    {
      "timestamp": "2026-02-26T21:33:01.000Z",
      "agentName": "main",
      "actionText": "Session abc123 updated (agent)",
      "status": "running"
    }
  ]
}
```

### Agents view
- `GET /api/dashboard/agents` for cards/snapshot list
- `GET /api/agents/:id` for detail pane
  - `status`, `currentTask`, `heartbeat`, `recentTasks`, `recentLogs`

Example (`GET /api/agents/:id`):
```json
{
  "contractVersion": "agent.detail.v1",
  "id": "main",
  "status": "active",
  "currentTask": { "sessionId": "abc123", "kind": "agent" },
  "heartbeat": { "lastSeenRelative": "2m ago", "stale": false },
  "recentTasks": [{ "sessionId": "abc123", "status": "running" }],
  "recentLogs": [{ "level": "info", "message": "Task abc123 updated (agent)" }]
}
```

### Settings / health panel
- `GET /api/dashboard/health`
  - `connection.status`, `connection.openclawReachable`, `connection.lastSuccessAt`, `connection.latencyP95Ms`
  - `system.healthy`, `system.uptimeSec`, `system.circuitBreakers`

Example:
```json
{
  "contractVersion": "dashboard.health.v1",
  "connection": { "status": "connected", "openclawReachable": true },
  "system": { "healthy": true, "uptimeSec": 486, "errors": 0 }
}
```

### Error envelope shape
All non-2xx API errors return:
```json
{
  "error": "Human readable summary",
  "details": "Technical detail",
  "code": "MACHINE_CODE",
  "diagnostics": {
    "retriable": true,
    "attempts": 2,
    "timeoutMs": 15000
  }
}
```

## Troubleshooting: stale bridge process on 8787
If UI/API shows old behavior after updates, you may still have an old bridge process bound to `127.0.0.1:8787`.

```bash
# show process listening on 8787 (portable)
ss -ltnp | grep ':8787'

# kill whichever PID owns port 8787
kill -TERM <PID>

# if it does not exit quickly
kill -KILL <PID>

# start fresh bridge
cd bridge
npm run dev

# verify expected version/commit is now live
curl -s http://127.0.0.1:8787/api/version | jq
```

## Troubleshooting: OpenClaw flaky/unreachable
Use lightweight and full diagnostics:

```bash
curl -s http://127.0.0.1:8787/api/healthz | jq
curl -s http://127.0.0.1:8787/api/selfcheck | jq
curl -s http://127.0.0.1:8787/api/metrics | jq
```

If `circuitBreakers.*.state` is `open`, the bridge is in cooldown due to repeated upstream failures. Wait `BREAKER_COOLDOWN_MS` or lower threshold strictness / raise timeout and reload config:

```bash
curl -s -X POST http://127.0.0.1:8787/api/reload-config | jq
```
