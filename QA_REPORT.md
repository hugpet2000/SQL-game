# QA_REPORT

## TaskBridgeApp — Sprint 4 Extended QA (long cycle)
Status: **FAIL** (API + build mostly pass; critical scope gap found)
Date: 2026-02-26
Workspace: `/home/hugog/.openclaw/workspace/TaskBridgeApp`

### Scope executed
- A) Bridge API deep checks (`/health`, `/api/config`, `/api/agents`, `/api/tasks` filters, `/api/tasks/:id/history`, `/api/tasks/:id/ping`)
- Auth enabled/disabled behavior with `AUTH_TOKEN`
- Timeout behavior checks (slow CLI simulation)
- B) Frontend build + functional wiring checks (filters/pagination/history/actions)
- C) WSL↔Windows reachability checklist

### A) Bridge API deep checks

#### PASS evidence
1. **Health/config/agents/tasks endpoints respond correctly**
   - `GET /health` on test bridge (`127.0.0.1:8788`) returned `200` with OpenClaw status payload.
   - `GET /api/config` returned runtime config (`host/port/authEnabled/openclawBin/requestTimeoutMs/cliTimeoutMs`).
   - `GET /api/agents` returned agent list.
   - `GET /api/tasks` returned mapped sessions with paging/filter metadata.

2. **Filter combinations validated**
   - `GET /api/tasks?status=active&limit=3` → 3 items, filters echoed as `{status:"active"}`.
   - `GET /api/tasks?q=qa&agentId=qa&limit=10` → filtered down to QA agent session(s).
   - `GET /api/tasks?status=zzz` → empty result, no server error.

3. **History endpoint validated**
   - Existing session: `GET /api/tasks/{id}/history?limit=5` → `found:true`, 5 entries.
   - Missing session: `GET /api/tasks/does-not-exist/history` → `found:false`, empty items.

4. **Ping endpoint validated (POST route)**
   - `POST /api/tasks/{id}/ping` with body `{"text":"qa ping from sprint4"}` → `200`, `ok:true`, run metadata returned.
   - Negative check: empty body text returns `400 INVALID_TEXT`.

5. **Auth toggle behavior validated**
   - Bridge with `AUTH_TOKEN=secret123` on `127.0.0.1:8790`:
     - `/health` without token: **200** (expected public health).
     - `/api/config` and `/api/tasks` without token: **401 AUTH_REQUIRED**.
     - same endpoints with wrong token: **401**.
     - same endpoints with `Authorization: Bearer secret123`: **200**.

6. **Timeout behavior validated**
   - Simulated slow CLI via `OPENCLAW_BIN=/tmp/fake-openclaw-slow` (`sleep 20`).
   - `GET /health` on port `8791` failed after ~15s (`elapsed=0:15.02`) with `503`.
   - Confirms CLI timeout guard; no retry behavior observed.

#### FAIL finding (critical)
- **[HIGH][API-SCOPE-GAP] `/api/tasks/:id/ping` missing on default running bridge instance (port 8787)**
  - Repro:
    1) Query active bridge on `http://127.0.0.1:8787`.
    2) `POST /api/tasks/{id}/ping` with valid JSON body.
    3) Observe `404 Cannot POST /api/tasks/{id}/ping`.
  - Expected: endpoint exists per Sprint 4 scope and returns 200/4xx structured JSON.
  - Actual: endpoint absent on default bridge process in this runtime, while present on freshly started Sprint-4 bridge (`8788`).
  - Impact: environment drift/version mismatch can break dashboard row action “Ping” depending on which bridge process users are connected to.
  - Recommendation: ensure single canonical bridge process/version, pin port, and add startup/version banner (or `/api/config` build/version field) so clients can detect mismatch.

### B) Frontend checks

#### Build output (PASS)
- Command: `cd TaskBridgeApp/desktop && npm run build`
- Result: **PASS**
- Artifacts:
  - `dist/index.html` (0.31 kB, gzip 0.23 kB)
  - `dist/assets/index-D8Ny521q.js` (149.68 kB, gzip 48.39 kB)

#### Functional checks status
- **Runtime GUI interaction:** **NOT EXECUTED** (OpenClaw browser control unavailable: Chrome relay not attached in this session).
- **Code-path/wiring verification (PASS):**
  - Query/status/agent filters are sent as `/api/tasks` query params.
  - Pagination implemented client-side (`PAGE_SIZE=20`, Prev/Next guards present).
  - History button calls `GET /api/tasks/:id/history?limit=25` and opens modal.
  - Copy key button uses clipboard API.
  - “Open UI” action rewrites API port to `:18789`.

> Explicit limitation: no claim is made for live click-through behavior (modal rendering, button UX, pagination UI transitions) because GUI automation could not be run in this environment.

### C) WSL↔Windows reachability checklist

#### Verified in WSL (PASS)
- WSL distro IP detected: `172.28.202.129`.
- Windows host resolver entry seen from WSL: `10.255.255.254`.
- Bridge started with `HOST=0.0.0.0 PORT=8789` and confirmed listening on all interfaces.
- Health reachable from WSL via:
  - `http://127.0.0.1:8789/health` → 200
  - `http://172.28.202.129:8789/health` → 200

#### Not directly executable from this session
- True **Windows→WSL** client test (PowerShell/browser on Windows side) cannot be executed from this Linux-only runtime.
- Suggested verification command on Windows:
  - `Invoke-RestMethod http://<WSL_IP>:8789/health`

### Severity summary
- **HIGH:** 1
- **MEDIUM:** 0
- **LOW:** 0
- **ENV LIMITATIONS:** 1 (GUI runtime automation unavailable)

### Overall conclusion
Sprint 4 extended QA is **FAIL** due to critical endpoint availability mismatch on the default bridge process (`8787`) despite passing behavior on the tested Sprint-4 bridge instance (`8788/8790/8791`).

---

## Current cycle
Status: **PASS** (compile + static QA)
Date: 2026-02-26
Scope: `mvn clean test package` + static code review against `SPEC.md` and prior findings (GUI runtime tests remain limited in headless environment)

## Build/test evidence
- Command: `mvn clean test package`
- Result: **BUILD SUCCESS**
- Notes: no test sources present (`No tests to run`), jar produced at `target/inkommande-mvp-1.0-SNAPSHOT.jar`

## Test matrix
- [x] App launch + first-time setup (code path review)
- [x] Path invalidation recovery (code path review)
- [x] Add file dialog (drag/drop + browse) (code path review)
- [x] Duplicate filename handling (code path review)
- [x] Metadata save reliability (code path review)
- [x] Dashboard sort/filter/pagination (code path review)
- [x] Search + autocomplete typing smoothness (static performance review)
- [ ] Open file action (not executable in headless QA environment)
- [x] Error handling for permission/path issues (code path review)
- [x] Compile/build checks (`mvn clean test package`)

## Prior findings re-check

### 1) Dashboard/search DB query runs on EDT (UI thread)
- **Previous severity:** High
- **Current status:** **Resolved**
- **Evidence:** `AppFrame.requestTableRefresh()` now uses `tableWorker = new SwingWorker<>()` and calls `db.listFiles(query)` inside `doInBackground()`.

### 2) Metadata save does not validate update result
- **Previous severity:** Medium
- **Current status:** **Resolved**
- **Evidence:** `Database.saveMetadata(...)` checks `int updated = ps.executeUpdate(); if (updated != 1) throw ...;` and rolls back on failure.

### 3) Dark mode toggle persisted but mostly not applied
- **Previous severity:** Medium
- **Current status:** **Resolved**
- **Evidence:** Theme-aware getters (`appBg`, `cardBg`, `textColor`, `borderColor`, `inputBg`, `tableAlt`) branch on `darkMode`; toggle rebuilds UI via `buildUi()`.

### 4) Button styling helper ignored provided colors
- **Previous severity:** Low
- **Current status:** **Resolved**
- **Evidence:** `styleButton(JButton button, Color bg, Color fg)` now applies `button.setBackground(bg)` and `button.setForeground(fg)`.

## Remaining defects
- **None identified in static/compile scope.**
- Constraint: full runtime verification (notably "Open selected file") still requires non-headless/manual QA execution.

## Conclusion
Sprint 2 codebase **passes** compile + static QA against current SPEC scope, and all previously reported defects are resolved in code.

## Deep QA Run
Date: 2026-02-26
Scope: Attempted real Swing runtime + best-effort runtime verification in this environment.

### Environment reality
- Host is headless WSL (`DISPLAY` unset).
- `xvfb-run` not installed.
- `Xvfb` binary not installed.
- `Desktop.isDesktopSupported()` = `false`.

### What was truly tested
1. **Real app startup attempt (GUI):**
   - Command: `mvn -q -DskipTests exec:java -Dexec.mainClass=com.plupp.inkommande.Main`
   - Actual: fails immediately with `No X11 DISPLAY variable was set...`.
2. **xvfb fallback attempt:**
   - Could not execute; xvfb tooling absent.
3. **Runtime DB flows via compiled app classes (non-mock):**
   - Seeded 60 imported records through `Database.insertImportedFile(...)`.
   - Saved metadata (`saveMetadata`) on even rows.
   - Edited metadata (`updateFileMetadata`) and verified searchable.
   - Deleted row (`deleteFileById`) and verified row count decrement.
   - Executed search (`listFiles("Finance")`) and autocomplete (`autocomplete("Inv", 10)`).
   - Negative-path checks: invalid ID save/delete correctly throw SQL errors.

### Evidence snapshot
- `ALL_ROWS=60`
- `SEARCH_FINANCE=15`
- `AUTOCOMPLETE_INV=10 FIRST=Invoice 10`
- `EDIT_MATCH=1`
- `AFTER_DELETE_ROWS=59`
- `NEG_SAVE=EXPECTED_FAIL`
- `NEG_DELETE=EXPECTED_FAIL`

### Findings (severity-tagged)
- **[HIGH][ENV-BLOCKER] GUI test execution blocked by missing display server**
  - Repro:
    1) On this host, run app start command above.
    2) Observe Maven exec error referencing missing X11 DISPLAY/headful libs.
  - Expected: app window opens for interaction tests.
  - Actual: app cannot start, so UI flows (change location/browse/import dialogs/search Enter/pagination/open-file button) are untestable here.
  - Recommended fix: run QA on GUI-capable host or install virtual display stack (`xvfb` + lightweight WM) and rerun scripted UI checks.

- **[MEDIUM][ENV-LIMITATION] Open-file action cannot be validated in current runtime**
  - Repro: `Desktop.isDesktopSupported()` returns false in this environment.
  - Expected: selected file opens in OS default app.
  - Actual: action path cannot execute under headless runtime.
  - Recommended fix: validate on desktop session with associated file handlers.

### Manual GUI test script for Hugo (run on desktop session)
1. `cd InkommandeMVP && mvn -q -DskipTests exec:java -Dexec.mainClass=com.plupp.inkommande.Main`
2. First launch: choose writable base dir; verify `<base>/INKOMMANDE` created.
3. Click **Change location** to a second writable dir; verify table clears and status indicates location change.
4. Click **Add file** -> **Browse files...** select 2 files with same name from different dirs; verify second copy gets ` (1)` suffix.
5. In metadata dialog:
   - Try empty title -> expect validation error.
   - Enter valid title/date (`YYYY-MM-DD`) and save.
6. In dashboard:
   - Use search box, type 2+ chars, verify autocomplete appears.
   - Press **Down** then **Enter** on suggestion; verify first row selected and filtered results shown.
7. Import >25 files total; verify pagination label (`Page x / y`) and **Next/Prev** behavior.
8. Select a row -> **Edit selected**; change category/tags and save; verify updated values.
9. Select a row -> **Delete selected** (without physical delete); verify row removed but file remains on disk.
10. Select another row -> **Delete selected** with physical delete checked; verify both DB row and file removed.
11. Select existing row -> **Open selected file**; verify OS opens file, otherwise capture exact error popup text.

---

## SQL Learning Game — Reliability-First QA Gate (v1.1)
Status: **FAIL**
Date: 2026-03-01
Workspace: `/home/hugog/.openclaw/workspace/sql-learning-game`

### Scope executed
1. API/route smoke for gameplay loop.
2. Mission YAML loading regression checks (all current levels).
3. SQL guardrail behavior checks.
4. Scope-creep check for new content in this cycle.

### Evidence
- Test suite: `mvn test` → **PASS** (`Tests run: 13, Failures: 0, Errors: 0, Skipped: 0`).
- Runtime smoke app launch: `mvn -q exec:java` (port `7070`) and direct API probes.
- Mission files present under `src/main/resources/levels`: `level1.yml` ... `level15.yml` (15 total).
- API `/api/levels` also returns 15 levels (`level-1` ... `level-15`).

### Findings

#### 1) [MEDIUM][ROUTE-REGRESSION] `/api/levels/unlocked` is unreachable (shadowed by `{id}` route)
- **Expected:** `GET /api/levels/unlocked` returns unlocked list payload (as intended by route definition).
- **Actual:** Returns `404 {"error":"Unknown level"}` because request is routed as `/api/levels/{id}` with `id=unlocked`.
- **Repro steps:**
  1) Start app: `cd sql-learning-game && mvn -q exec:java`
  2) Run: `curl -i http://127.0.0.1:7070/api/levels/unlocked`
  3) Observe `HTTP/1.1 404` and body `{"error":"Unknown level"}`.
- **Impact:** Reliability inconsistency in public API surface; one unlock endpoint is effectively broken.
- **Suggested fix:** Register `/api/levels/unlocked` before `/api/levels/{id}` or remove duplicate endpoint and keep only `/api/unlocked-levels`.

#### 2) [PASS][GAMEPLAY-SMOKE] Core gameplay loop endpoints respond and execute
- `GET /api/health` → 200
- `GET /api/levels` → 200
- `GET /api/levels/level-1` → 200
- `GET /api/levels/level-1/schema` → 200
- `POST /api/levels/level-1/run` with valid query → 200 + successful evaluation payload
- `POST /api/levels/level-1/reset` → 200 `{ok:true}`
- `GET /api/progress` → 200
- `GET /api/unlocked-levels` → 200 with unlocked list
- `POST /api/leaderboard/submit` + `GET /api/leaderboard/top` → 200

#### 3) [PASS][SQL-GUARDRAILS] Safety behavior holds
- Level-mode command allowlist enforced:
  - `POST /api/levels/level-1/run` with `DELETE FROM customers;`
  - Response feedback: `This level only allows: SELECT`.
- Sandbox forbidden-command block enforced:
  - `POST /api/sandbox/run` with `RUNSCRIPT FROM 'http://evil';`
  - Response error: `That command is blocked in sandbox mode for safety.`

#### 4) [PASS][YAML-LOADING] No missing mission files in current set
- `LevelRepository` load list includes `level1.yml` to `level15.yml`.
- All files exist on disk and app boots without load exceptions.
- `/api/levels` exposes all 15 entries.

#### 5) [PASS][SCOPE-CREEP-CHECK] No new content scope creep detected in this change set
- Working-tree changes under `sql-learning-game` are code/tests only:
  - `src/main/java/...` and `src/test/java/...`
- No modified/added files under `src/main/resources/levels` during this cycle.

### Severity summary
- **HIGH:** 0
- **MEDIUM:** 1
- **LOW:** 0

### Gate verdict
**FAIL** for v1.1 reliability gate due to one route regression (`/api/levels/unlocked`) despite otherwise passing gameplay smoke, YAML loading, and SQL guardrail checks.
