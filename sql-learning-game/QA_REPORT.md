# QA_REPORT.md

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
