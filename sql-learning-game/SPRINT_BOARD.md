# SPRINT_BOARD — Sprint S-2026-03-01

## Sprint Goal
Ship **v1.1 stability hardening** while running a **small v1.2 playtest prep loop** to validate learning flow.

Focus: make core gameplay reliable and measurable before adding new systems.

## Scope (Parallel Tracks)
- **Track A (Primary): v1.1 Stability Hardening**
  - test reliability, reset determinism, evaluator correctness, error feedback quality.
- **Track B (Secondary): v1.2 Playtest Prep (small)**
  - lightweight telemetry + playtest checklist to collect balancing signals.

## In Progress
- Expand regression coverage around evaluator equivalence (ordering/casing/null/duplicates).
- Harden SQL runner error taxonomy for common student mistakes.
- Add minimal telemetry fields for playtests: attempts, solve time, max hint tier reached.

## Backlog (This Sprint)
1. **Test hardening pack**
   - Add integration tests for run → evaluate → save cycle across representative levels.
   - Add deterministic reset stress checks (repeated reset + same expected output).
   - Add negative tests for forbidden statements by level rules.
2. **Telemetry/playtest prep pack**
   - Persist telemetry events locally (no external analytics dependency).
   - Define small internal playtest protocol (sample size, script, capture template).
   - Add one balancing review pass based on collected telemetry.
3. **Learning-flow validation (repetition-first)**
   - Verify 5-level wave pacing uses repeat-then-slightly-harder progression.
   - Ensure hints escalate consistently and reinforce previous concepts.

## Done
- 15 playable campaign levels shipped.
- Prompt/hint polish and XP rebalance completed.
- Core evaluator/runner tests passing.
- Roadmap aligned to v1.1 stability then v1.2 learning-quality tuning.

## Explicit Acceptance Criteria (Sprint Exit)
### A) Test Hardening
- [ ] `mvn test` passes consistently with no flaky failures across **3 consecutive local runs**.
- [ ] Evaluator tests cover: order-insensitive equivalence, case normalization, null handling, duplicate rows.
- [ ] Reset determinism verified by automated test: repeated reset returns identical schema + seed state.
- [ ] Forbidden SQL enforcement verified for restricted levels with clear learner-facing messages.

### B) Telemetry + Playtest Prep
- [ ] Telemetry captures at minimum per attempt: `levelId`, `attemptIndex`, `elapsedMs`, `hintTierUsed`, `outcome`.
- [ ] Telemetry is local/offline-first and does not block gameplay if write fails.
- [ ] A lightweight playtest script exists (objective, steps, success/failure logging template).
- [ ] At least one mini-playtest batch is runnable end-to-end using current build + telemetry.

## Risks / Watchouts
- **Scope creep risk:** adding admin dashboards/reporting now would delay stability goals.
- **Signal quality risk:** telemetry without a consistent playtest script can produce noisy balancing data.
- **Overfitting risk:** tuning to tiny samples may hurt broader learner progression.
- **Regression risk:** evaluator changes can silently break equivalent-query acceptance.

## Scope Guardrails (Enforced)
1. **No new major systems this sprint.**
   - No teacher/admin feature track (deferred to **v1.4**).
   - No multiplayer/online leaderboard/major UI rewrites.
2. **Prioritize reliability over expansion.**
   - Fix, test, instrument, then tune.
3. **Repetition-first pedagogy is non-negotiable.**
   - Slight difficulty increases in **5-level waves**, not abrupt jumps.
4. **Playtest scope stays small.**
   - Minimal telemetry schema and lightweight protocol only.

## Deferred / Out of Scope
- Teacher/admin tooling and classroom reporting (**v1.4+**).
- Large curriculum expansion beyond current wave pacing.
- Advanced explain-plan quality scoring as a primary deliverable this sprint.

## Sprint Definition of Done (Coordination)
- Board is current and reflects active work.
- Acceptance criteria are testable and measurable.
- Guardrails are explicit and referenced in planning/review.
- Team can demonstrate hardening outcomes + a runnable playtest prep flow.
