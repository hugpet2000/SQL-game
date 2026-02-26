# QA Report — Sprint 5 Extended

Date: 2026-02-26
Repo: `/home/hugog/.openclaw/workspace/TaskBridgeApp`
Tester: QA subagent

## Scope
1. Backend new endpoints: `/api/version`, `/api/selfcheck`, `/api/metrics`, `/api/reload-config` + critical paths.
2. Regression: `/api/tasks` filters, `/api/tasks/:id/history`, `/api/tasks/:id/ping`, auth mode on/off.
3. Validate stale-process troubleshooting in README.
4. Frontend static/behavior review for diagnostics/doctor features; run `npm run build`.

---

## Environment / Setup
- Observed stale old bridge process already listening on `:8787` (`pid=40771`) before restart.
- Verified fresh bridge instances:
  - Auth OFF: `127.0.0.1:8879`
  - Auth ON (`AUTH_TOKEN=test123`): `127.0.0.1:8878`
  - Restart validation on canonical port: `127.0.0.1:8787`

---

## Results Summary

### 1) New backend endpoints

| Endpoint | Result | Evidence |
|---|---|---|
| `GET /api/version` | **PASS** | `200`, returns `service, commit, branch, pid, uptimeSec, startedAt` |
| `GET /api/selfcheck` | **PASS** | `200`, returns `ok:true` + details including OpenClaw status probe |
| `GET /api/metrics` | **PASS** | `200`, returns counters: `requests/errors/avgLatencyMs/cacheHits/cacheMisses/uptimeSec` |
| `POST /api/reload-config` | **PASS** | `200`, returns `before/after` runtime config + cache clear confirmation |

Critical path smoke:
- `GET /health` → **PASS (200)**
- `GET /api/tasks` → **PASS (200)**
- `GET /api/agents` → **PASS (200)**
- `GET /api/config` → **PASS (200)**

### 2) Regression checks

| Area | Result | Notes |
|---|---|---|
| `/api/tasks` filters | **PASS** | `agentId`, `status`, `q` filters return expected reduced sets |
| `/api/tasks/:id/history` | **PASS** | `200`, `found:true`, history items returned |
| `/api/tasks/:id/ping` valid text | **FAIL (intermittent)** | One observed `502` (`Failed to ping session`, OpenClaw command exited code 1) |
| `/api/tasks/:id/ping` invalid text | **PASS** | `400` with `code: INVALID_TEXT` |
| Auth OFF mode | **PASS** | `/api/tasks` accessible without token |
| Auth ON mode | **PASS** | No token / bad token => `401 AUTH_REQUIRED`; correct token => `200` |

### 3) README stale-process troubleshooting

Status: **PARTIAL FAIL**

What was validated:
- Stale process scenario reproduced: old process on `:8787` found.
- Kill + restart flow works when adapted to available tooling.
- Post-restart `/api/version` showed fresh instance and current commit.

Issue found:
- README command uses `rg`:
  - `ss -ltnp | rg ':8787'`
- On this environment, `rg` is not installed, so the command fails (`rg: command not found`).

Severity: **Medium** (troubleshooting doc step fails as written in a default/minimal environment).

### 4) Frontend static + behavior review

Code review target: `desktop/src/main.jsx`
- Diagnostics/doctor features are present (status strip, diagnostics view, bridge doctor actions, probing, cache clear, toasts).
- Token handling logic preserved in request headers.

Build validation:
- Ran `npm run build` in `desktop/`
- Result: **PASS**
- Output:
  - `vite v5.4.21 building for production...`
  - `✓ 24 modules transformed.`
  - `dist/assets/index-DD_MRRFA.js 160.11 kB (gzip 51.13 kB)`
  - `✓ built in 511ms`

---

## Defects / Risks

### DEFECT-1: Ping endpoint intermittently fails
- Severity: **High**
- Endpoint: `POST /api/tasks/:id/ping`
- Repro:
  1. Select active session id (e.g. `aec43fb7-c638-4f5a-ba0a-a0c4a579ab82`)
  2. POST `{"text":"qa ping via test","agentId":"main"}`
  3. Observe occasional `502`
- Actual:
  - `{ "error":"Failed to ping session", "details":"Command failed: ... openclaw agent --session-id ... --json", "code":1 }`
- Expected:
  - Stable `200` for valid ping requests.
- Evidence:
  - Server log entry: `POST .../ping 502`

### DEFECT-2: README stale-process step depends on missing `rg`
- Severity: **Medium**
- Location: `README.md`, troubleshooting section
- Repro: run `ss -ltnp | rg ':8787'` on host without ripgrep.
- Actual: command fails (`rg: command not found`).
- Expected: troubleshooting commands should run in baseline environment or document dependency.
- Suggested fix: replace with `grep` variant or provide both.

---

## Final Verdict

**CONDITIONAL PASS / RELEASE WITH FIXES**

- Sprint 5 core backend and frontend objectives are implemented and mostly working.
- Blocking quality concerns remain:
  1) intermittent ping 502s,
  2) README troubleshooting command portability issue (`rg` dependency).

Recommended before final sign-off:
- Stabilize ping execution path / error handling and retest multiple attempts.
- Update README troubleshooting command to be dependency-safe (`grep` fallback).
