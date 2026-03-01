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
- ✅ `level11`: LEFT JOIN with zero-order preservation.
- ✅ `level12`: ranking workaround without window functions.
- ✅ `level13`: normalization drift debugging via mismatch detection.
- ✅ `level14`: anti-join with `NOT EXISTS`.
- ✅ `level15`: optimization mindset (filter early, aggregate targeted slice).

## Not shipped yet
- ❌ API/integration smoke tests for full gameplay loop.
- ❌ Telemetry/playtest instrumentation for balancing.
- ❌ Classroom/admin reporting features.

## Next 3 actions
1. Add API + level-loading integration tests.
2. Run playtest balancing pass for levels 11–15 (hints, XP, clarity).
3. Draft level-authoring checklist/template for future packs.

## Retention UX polish (v1.2 pass)
- ✅ Advanced levels (11–15) now include `objectiveCue` for faster objective parsing.
- ✅ Added lightweight `explanationSnippet` + `encouragement` hooks in level model/API.
- ✅ Frontend shows a concise “Why this works” snippet when present.
- ✅ Hint timing polish: advanced hints unlock after first run, auto-nudge appears after repeated misses.
- ✅ Feedback copy tuned for concise encouragement on wins + clearer mismatch guidance.
