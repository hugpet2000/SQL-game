# ROADMAP

Baseline: MVP now includes a 15-level campaign (level1–15), scoring/progress/hints, and core evaluator/runner tests.

## Phase 1 — Reliability hardening (next 1–2 weeks)
- Add API smoke/integration tests (route + gameplay loop).
- Add level-loading regression checks (all YAMLs parse + are reachable).
- Improve SQL error feedback for common learner mistakes.
- Milestone: **v1.1 stable core**

## Phase 2 — Learning quality pass (2–3 weeks)
- Playtest + rebalance advanced wave (level11–15 XP/hints/difficulty).
- Add short post-answer explanation snippets per level.
- Standardize content authoring template/checklist.
- Milestone: **v1.2 stronger learning outcomes**

## Phase 3 — Content expansion (3–5 weeks)
- Expand beyond 15 to 25+ missions.
- Add focused tracks (subqueries, CTE intro, data quality scenarios).
- Build lightweight tooling for faster level QA.
- Milestone: **v1.3 expanded curriculum**

## Phase 4 — Classroom readiness (later)
- Teacher/admin progress view.
- Export/report basics (CSV/JSON).
- First-run onboarding improvements.
- Milestone: **v1.4 classroom pilot**
