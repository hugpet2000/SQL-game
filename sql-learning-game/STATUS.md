# STATUS

## Shipped scope (current)
- ✅ Local web app with Javalin + dark UI.
- ✅ 10-mission SQL campaign (YAML-driven).
- ✅ Real SQL execution on embedded H2.
- ✅ Deterministic per-level reset + seeded data.
- ✅ Query evaluation (correctness, timing, score, XP).
- ✅ Achievements + progress persistence (`data/progress.json`).
- ✅ Hint escalation + sandbox mode.

## What is not shipped yet
- ❌ Automated test suite for core gameplay reliability.
- ❌ Telemetry/playtest instrumentation for balancing.
- ❌ Additional mission packs (beyond 10 levels).
- ❌ Classroom/admin reporting features.

## Next 3 actions
1. Add core regression tests (evaluator, SQL runner, API smoke).
2. Run quick playtest pass and rebalance first 5 mission hints/XP.
3. Define level-authoring template to speed content expansion.

## Delivery note (Telegram-style)
MVP is playable and feature-complete for a first demo. Priority now is stability tests + learning-balance polish before expanding content.
