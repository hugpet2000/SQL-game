# ROADMAP

Baseline: MVP now includes a 15-level campaign (level1–15), polished progressive prompts/hints, scoring/progress/achievements, and core evaluator/runner/integration tests.

## Phase 1 — Reliability hardening (in progress)
- ✅ API smoke/integration test coverage for core gameplay route flow.
- ✅ Level-loading regression checks (all YAMLs parse + expected queries execute).
- ⏳ Improve SQL error feedback taxonomy for common learner mistakes.
- Milestone target: **v1.1 stable core**

## Phase 2 — Learning quality & balancing (current)
- ✅ Prompt/hint polish pass completed for levels 1–15.
- ✅ XP/score balancing pass completed with difficulty-aware reward scaling.
- ⏳ Validate tuning with telemetry-backed playtest data.
- Milestone target: **v1.2 stronger learning outcomes**

## Phase 3 — Content expansion (next)
- Expand beyond 15 to 25+ missions.
- Add focused tracks (subqueries, CTE intro, data quality scenarios).
- Build lightweight tooling for faster level QA.
- Milestone target: **v1.3 expanded curriculum**

## Immediate next 3 milestones
1. **Telemetry-first balancing loop:** capture attempts, hint tier usage, and solve times; run one tuning iteration from observed data.
2. **Authoring quality guardrails:** add schema/checklist linter for level content consistency (objective cue, prompt shape, 3-step hints).
3. **Advanced scoring depth:** add explain-plan quality scoring and calibrate it for optimization-focused missions.
