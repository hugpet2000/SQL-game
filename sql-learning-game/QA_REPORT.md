# QA_REPORT.md

## SQL Learning Game v1.1 — Final QA Gate (post unlocked-route fix)
- Date: 2026-03-01
- Scope: Final release gate checklist
- Verdict: **FAIL**

## Checklist Results

1) **API gameplay smoke** — ✅ PASS  
   Evidence (live smoke on `localhost:7070`):
   - `GET /api/health` → `{"ok":true}`
   - `POST /api/levels/level-1/run` with `SELECT name FROM customers ORDER BY name;` → `success:true`
   - `GET /api/progress` returns updated progress payload

2) **Unlocked routes both work** — ❌ FAIL  
   Live smoke:
   - `GET /api/levels/unlocked` → `{"error":"Unknown level"}` (**wrong**)  
   - `GET /api/unlocked-levels` → `{"unlocked":["level-1","level-2"]}` (works)

   Interpretation: `/api/levels/unlocked` is being captured by `/api/levels/{id}` and treated as an unknown level id.

3) **Mission YAML loading regression** — ✅ PASS  
   Evidence: `LevelRepositoryRegressionTest` passed:
   - loads all YAML mission files from `resources/levels`
   - each mission resets and executes expected query without error

4) **SQL guardrail checks** — ✅ PASS  
   Evidence: `SqlRunnerTest` passed guardrails:
   - blocks forbidden commands in sandbox and level mode
   - enforces single-statement level runs
   - enforces level allowlist (e.g., SELECT-only)
   - preserves sandbox DDL/DML learning behavior

5) **Confirm no scope creep** — ✅ PASS (for this QA cycle)  
   - This final QA gate introduced only `QA_REPORT.md`.
   - No code changes were made during this cycle.

## Commands / Runs
- `mvn -Dtest=ApiIntegrationTest,LevelRepositoryRegressionTest,SqlRunnerTest test` → **BUILD SUCCESS** (12 tests, 0 failures)
- Live endpoint smoke via local app process on port `7070`

## Release Gate Decision
**FAIL v1.1** due to unresolved critical route behavior: `/api/levels/unlocked` does not function as intended.

### Required fix before PASS
- Ensure `/api/levels/unlocked` is not shadowed by `/api/levels/{id}` (route order/specificity handling), then rerun this gate.
