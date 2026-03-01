# RISKS

Top risks for current plan, with practical mitigations.

## 1) Weak test coverage in core evaluator/API
- Risk: regressions in level validation, result matching, or scoring go unnoticed.
- Impact: player trust drops; missions feel "buggy".
- Mitigation:
  - Add automated tests for `EvaluationEngine`, `SqlRunner`, and `/api/*` smoke paths.
  - Gate releases on test pass + minimal manual playtest script.

## 2) SQL safety boundaries in sandbox/level execution
- Risk: dangerous or unsupported SQL slips through command filtering.
- Impact: broken session state, confusing learner experience.
- Mitigation:
  - Explicit allowlist per mode (level vs sandbox).
  - Add parser/keyword hard checks + tests for blocked commands.
  - Reset DB state deterministically after failed destructive attempts.

## 3) Difficulty curve mismatch for target audience (16–25)
- Risk: missions too easy/hard; churn after first few levels.
- Impact: poor retention, weaker learning outcomes.
- Mitigation:
  - Track attempts/time per mission.
  - Run small playtests and rebalance hints/XP every content release.

## 4) Content scaling bottleneck
- Risk: adding new missions is slow or inconsistent in quality.
- Impact: roadmap slip for 20+ level goal.
- Mitigation:
  - Create strict level template + review checklist.
  - Add automated lint/check for level YAML schema.

## 5) Local-only persistence fragility (`data/progress.json`)
- Risk: corrupted file or device switch causes progress loss.
- Impact: user frustration; restarts from zero.
- Mitigation:
  - Add backup/restore and integrity checks.
  - Optional import/export flow before moving to multi-user storage.
