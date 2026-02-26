# QA Report — Final Closure Gate (Post-blocker Fixes)

Date: 2026-02-26
Repo: `/home/hugog/.openclaw/workspace/TaskBridgeApp`
Tester: QA subagent (`closure-qa-gate`)

## Final release verdict
**FAIL (not ready for release)**

Two release-blocking issues remain in backend reliability/contract alignment (see blockers section).

---

## Strict checklist results

## A) UI heuristic gate

### 1) Information hierarchy clarity
**PASS**
- Clear top-level nav (Home / Agents / Settings), concise header, and card grouping.
- Home presents KPIs + activity + health in predictable sections.

### 2) Master-detail completeness on Agents
**PASS**
- Agents view is explicit master/detail:
  - left list (`Agents`) + right pane (`Agent Details`)
  - selected agent details include status, heartbeat, current task, recent tasks, logs/events.

### 3) Accessibility basics (labels/focus/non-color cues)
**PARTIAL PASS (non-blocking gaps)**
- Labels: settings fields are wrapped in labeled rows (`SettingsRow`), so form labeling is present.
- Non-color cues: status badges include text labels (not color-only).
- Gap: no explicit `:focus-visible` styling for keyboard users in current UI code.

### 4) Connection state comprehension + error recoverability
**PASS**
- State model is understandable (`connected/degraded/offline`) with status badges and health card.
- Recoverability present: manual refresh, reconnect action in disconnected empty-state, and connection test/save in Settings.

### 5) No stale-state self-check messaging
**PASS**
- Prior stale toast/self-check timing path is no longer present in current UI code.
- UI now uses passive selfcheck polling within refresh flow, not stale toast branching.

---

## B) Backend connection gate

Test setup:
- Auth OFF bridge: `127.0.0.1:8895`
- Auth ON bridge (`AUTH_TOKEN=secret123`): `127.0.0.1:8896`

### 1) `/healthz`, `/selfcheck`, `/metrics`, `/version`
**FAIL (contract mismatch + partial pass)**
- `GET /healthz` -> **404 NOT_FOUND** (missing route alias).
- `GET /api/healthz` -> present (503 when OpenClaw unreachable, expected behavior).
- `GET /api/selfcheck` -> 200.
- `GET /api/metrics` -> 200 (401 with auth enabled unless valid token).
- `GET /api/version` -> 200.

### 2) `/dashboard` summary/session/health endpoints used by UI
**FAIL**
- Backend endpoints exist and return data:
  - `GET /api/dashboard/summary` -> 200
  - `GET /api/dashboard/sessions` -> 200
  - `GET /api/dashboard/health` -> 200
- But desktop UI is still wired to legacy endpoints only:
  - `/api/tasks`, `/api/agents`, `/api/metrics`, `/api/selfcheck` (see `desktop/src/main.jsx` lines ~167-171)
- No current fetch usage for `/api/dashboard/summary|sessions|health` detected.

### 3) Ping reliability repeated-run check
**FAIL (critical crash)**
Repro on auth-off instance (`:8895`):
1. Resolve valid session id from `/api/tasks?limit=1`.
2. `POST /api/tasks/:id/ping` repeatedly.
3. First request returned `504 Request timeout` after ~20s.
4. Bridge then crashes with uncaught `ERR_HTTP_HEADERS_SENT`.

Crash evidence (from `/tmp/taskbridge-8895.log`):
- `POST /api/tasks/<id>/ping 504 ...`
- `Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client`
- process exits (Node.js crash)

### 4) Auth off/on check
**PASS (with expected public endpoints)**
- Auth ON (`AUTH_TOKEN=secret123`):
  - Protected endpoints (`/api/metrics`, `/api/dashboard/*`) return 401 without/with wrong token, and 200 with correct token.
  - `/api/version` and `/api/selfcheck` remain public (200), consistent with current backend behavior.

---

## C) Build gate

### Desktop build (`npm run build`)
**PASS**
- Command: `cd desktop && npm run build`
- Result: successful Vite production build
- Artifact sample: `dist/assets/index-BzCxPx7X.js` (166.10 kB, gzip 52.65 kB)

---

## Remaining blockers (explicit)

1. **BLOCKER-1 (Critical): ping endpoint can crash bridge process under timeout/error path**
   - Area: backend reliability
   - Symptom: `POST /api/tasks/:id/ping` can produce `ERR_HTTP_HEADERS_SENT` and terminate server.
   - Release impact: unacceptable operational instability.

2. **BLOCKER-2 (High): dashboard endpoint contract not consumed by desktop UI**
   - Area: UI/backend integration
   - Symptom: UI still fetches legacy task/agent endpoints, not `/api/dashboard/summary|sessions|health` requested for dashboard model.
   - Release impact: intended contract migration incomplete.

3. **BLOCKER-3 (Medium): missing `/healthz` top-level route alias**
   - Area: backend contract consistency
   - Symptom: `/healthz` returns 404 while `/api/healthz` exists.
   - Release impact: breaks strict checklist/API compatibility expectation.

---

## Conclusion
Final closure gate remains **FAIL** due to unresolved release blockers above, despite UI structure improvements and successful desktop production build.
