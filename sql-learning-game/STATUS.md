# STATUS

## Shipped scope (current)
- ✅ Local web app with Javalin + dark UI.
- ✅ 15-mission SQL campaign (YAML-driven, includes advanced wave level11–15).
- ✅ Real SQL execution on embedded H2.
- ✅ Deterministic per-level reset + seeded data.
- ✅ Query evaluation (correctness, timing, score, XP).
- ✅ Achievements + progress persistence (`data/progress.json`).
- ✅ Hint escalation + sandbox mode.
- ✅ Core unit tests for evaluator + SQL runner.

## Newly added in this wave
- ✅ **Local telemetry pipeline (no external dependency):** frontend now emits `level_attempt`, `hint_used`, and `solve_time`; backend appends events to `data/telemetry.ndjson` and exposes `/api/telemetry/recent`.
- ✅ **Reliability tests for telemetry:** write/read behavior covered, malformed/unwritable-path fallback is non-crashing.
- ✅ **Prompt/hint polish (levels 1–15):** every mission now uses clearer objective cues and step-based hints to improve progression from basics to advanced patterns.
- ✅ **Progression tuning:** added concise explanation/encouragement copy across early and mid levels so reinforcement is consistent (not only advanced wave).
- ✅ **XP rebalance:** updated base XP curve to better reward complexity, especially advanced/boss content (`level11–15` now 290/320/300/340/380).
- ✅ **Scoring rebalance in engine:** difficulty-aware bonus scaling + explicit difficulty XP bonus.
  - multipliers: beginner `1.00`, intermediate `1.10`, advanced `1.25`, boss `1.40`
  - additive XP bonus: intermediate `+10`, advanced `+25`, boss `+45`

## Not shipped yet
- ✅ Telemetry/playtest instrumentation (local NDJSON capture for attempts/hints/solve times).
- ❌ Classroom/admin reporting features.
- ❌ Explain-plan quality scoring (`planScore` still TODO).

## QA outcome (this wave)
- ✅ `mvn test` passes after telemetry + API additions.
- ✅ SQL guardrails/regression checks still pass (no policy relaxations, no level regression).

## Next 3 milestones
1. Build small local telemetry summaries (per-level percentile solve-time + hint usage rates) to inform next tuning pass.
2. Introduce level-authoring schema/checklist linter to prevent content drift and enforce hint-quality standards.
3. Implement explain-plan-based scoring component for advanced/boss optimization missions.
