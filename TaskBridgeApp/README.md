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

### Error envelope shape
All non-2xx API errors return:
```json
{
  "error": "Human readable summary",
  "details": "Technical detail",
  "code": "MACHINE_CODE"
}
```
