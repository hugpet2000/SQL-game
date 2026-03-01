# QA_REPORT.md

## SQL Learning Game v1.1 — QA Sprint Re-Validation (post telemetry/playtest + content polish)
- Date: 2026-03-01
- Scope: Stability re-check (API/routes/guardrails), telemetry/playtest non-regression, repetition-first + ramp heuristic, and scope-creep audit
- Verdict: **PASS**

### 1) v1.1 Stability: core API smoke + unlocked routes + guardrails — ✅ PASS
- `mvn test` → **BUILD SUCCESS** (26 tests, 0 failures)
- Live smoke (`localhost:7070`):
  - `GET /api/health` → `{"ok":true}`
  - `GET /api/levels/unlocked` and `GET /api/unlocked-levels` both return compatible payload with both keys: `unlocked` + `unlockedLevels`
  - `POST /api/levels/level-1/run` with correct query returns `success:true` and valid result rows
  - Guardrail check: `POST /api/sandbox/run` with `RUNSCRIPT ...` returns blocked error: `That command is blocked in sandbox mode for safety.`
  - Route guardrail remains correct: `GET /api/levels/not-a-level` returns `404 {"error":"Unknown level"}`

### 2) Telemetry/playtest additions non-regression (gameplay loop) — ✅ PASS
- UI additions (session summary/playtest state variables in `index.html`) do **not** alter backend API contracts.
- Gameplay-critical flow remains intact: level load → run query → feedback/result/progress update → unlocked refresh.
- No crash/regression observed in API-driven loop with latest frontend/backend code.

### 3) Heuristic check: repetition-first clarity + slight difficulty ramp messaging — ✅ PASS
- Sidebar and advanced-wave copy explicitly communicates retention-first loop:
  - `Difficulty ramps across 5 waves. Levels 11–15 are retention rounds: retry first, then unlock hints.`
- Levels 11–15 prompts/hints consistently use explicit repetition framing (`Practice loop: (1) ... (2) ... (3) ...`).
- Objective cues show gradual ramp (11 join retention, 12 correlated ranking, 13 cooldown data-drift check, 14 anti-join, 15 boss slice-first aggregation).

### 4) Scope-creep audit (no teacher/admin, no mission count changes) — ✅ PASS
- No teacher/admin endpoints/features found in backend routes (`App.java`) or project status docs.
- Mission count unchanged: `src/main/resources/levels` contains **15** level files.
- Existing roadmap still tracks classroom/admin as out-of-scope/not shipped.

## SQL Learning Game v1.1 — Final QA Re-Gate (post backend fix `e2feca89f7eaa48faf4965ee771fe4ac675d17b3`)
- Date: 2026-03-01
- Scope: Immediate re-gate of unlocked-route regression + gameplay smoke
- Verdict: **PASS**

## Checklist Results

1) **`/api/levels/unlocked` works** — ✅ PASS  
   Live smoke (`localhost:7070`):
   - `GET /api/levels/unlocked` → `{"unlocked":["level-1","level-2"],"unlockedLevels":["level-1","level-2"]}`

2) **`/api/unlocked-levels` works** — ✅ PASS  
   Live smoke:
   - `GET /api/unlocked-levels` → `{"unlocked":["level-1","level-2"],"unlockedLevels":["level-1","level-2"]}`

3) **Payload compatibility (`unlocked` + `unlockedLevels`)** — ✅ PASS  
   Verified both endpoints return both keys with compatible values.

4) **Route shadowing is gone** — ✅ PASS  
   Evidence:
   - Route registration in `App.java` has `/api/levels/unlocked` and `/api/unlocked-levels` before `/api/levels/{id}`.
   - `GET /api/levels/unlocked` now resolves to unlocked payload (not `Unknown level`).
   - `GET /api/levels/not-a-level` still correctly returns `{"error":"Unknown level"}`.

5) **Core gameplay smoke still passes** — ✅ PASS  
   Live smoke:
   - `GET /api/health` → `{"ok":true}`
   - `POST /api/levels/level-1/run` (text/plain body: `SELECT name FROM customers ORDER BY name;`) → `success:true`
   - `GET /api/progress` returns updated progress payload including completed `level-1`

## Commands / Runs
- `mvn -Dtest=ApiIntegrationTest,LevelRepositoryRegressionTest,SqlRunnerTest test` → **BUILD SUCCESS** (13 tests, 0 failures)
- Live endpoint smoke against local app on `:7070` via `curl`

## Release Gate Decision
**PASS v1.1** — unlocked endpoint regression is resolved, compatibility route is intact, payload keys are backward compatible, and gameplay smoke remains green.

## SQL Learning Game — Live-Hosting Readiness QA (subagent run)
- Date: 2026-03-01
- Scope: local mode, hosted auth-guard behavior (enabled/disabled), backup/export path, endpoint/gameplay smoke
- Verdict: **FAIL (not ready for live-hosting gate)**

### Checklist
1) **Local mode still works** — ✅ PASS
- `mvn -Psmoke test` → BUILD SUCCESS (1/1)
- `mvn test` → BUILD SUCCESS (30 tests, 0 failures)
- Manual run (`mvn -q exec:java`) + smoke:
  - `GET /api/health` → `{"ok":true}`
  - `GET /api/levels/unlocked` returns unlocked payload
  - `POST /api/levels/level-1/run` with level-1 solution returns `success:true`
  - `POST /api/sandbox/run` with blocked command returns safety error as expected

2) **Hosted mode auth guard behavior (enabled/disabled)** — ❌ FAIL
- No auth-guard implementation found in current code path (`App.java` routes are public; no auth middleware/header/token validation).
- No auth enable/disable environment flags found for request guarding (only `HOST`/`PORT` in `Main.java`).
- Result: cannot validate expected “enabled blocks unauthenticated, disabled allows” behavior because the feature is not present.

3) **Backup/export path works** — ❌ FAIL
- No backup/export API route exists in current server routes.
- Probe checks:
  - `GET /api/export` → HTTP 404
  - `GET /api/backup` → HTTP 404
- Result: backup/export path is not implemented/exposed in this build.

4) **Smoke endpoints and core gameplay still functional** — ✅ PASS
- Core API routes and level-run gameplay loop are healthy in both automated and manual smoke checks.

### Live-hosting risks
- **High:** No auth guard on public API; hosted deployment would expose gameplay/progress/leaderboard endpoints without access control.
- **High:** No backup/export mechanism for persistence files (`data/*.json`, `data/*.ndjson`) in hosted operations.
- **Medium:** Current test suite does not include hosted-mode security or backup/export coverage, so regressions in these areas would go undetected until runtime.

### Recommendation
- Keep local QA gate green, but block live-hosting release until:
  1. Auth guard/middleware is implemented with explicit enable/disable config and tests for both states.
  2. Backup/export flow (API or operational script) is implemented and verified end-to-end.
