# BUDGET.md — Token Efficiency Guardrails

## Goal
Ship the SQL Learning Game with minimal LLM spend while keeping quality acceptable.

## Hard Limits (per task)
- **Design/planning turn:** ≤ 1.5k tokens
- **Implementation turn:** ≤ 3k tokens
- **Debug turn:** ≤ 2k tokens
- **Any single spawn:** stop/re-scope if projected > 6k tokens

## Cost Controls
1. **One objective per spawn** (no mixed "plan + code + refactor + docs").
2. **Pass only needed files** (max 3–5 files, no whole-repo dumps).
3. **Use diffs, not rewrites** (targeted edits over full-file regeneration).
4. **Constrain output format** ("return patch + 3 bullets" when possible).
5. **Reuse stable artifacts** (`ROADMAP.md`, `STATUS.md`) instead of re-explaining context.
6. **Fail fast at 2 retries**; then escalate with a tighter prompt and concrete error logs.
7. **No speculative work**: only implement accepted roadmap items.

## Prompt Hygiene
- State: **role, exact task, files, acceptance checks, token cap**.
- Ban fluff: ask for concise reasoning and actionable output only.
- Always include a **done condition** and **out-of-scope** list.

## Monitoring
- Track per-session: spawned task, estimated tokens, retries, outcome.
- Weekly review: top 3 token sinks and one rule update to remove waste.

## Red Flags (pause and re-scope)
- Prompt exceeds ~250 lines.
- More than 2 spawn retries for same issue.
- Repeated full-file rewrites.
- Context includes build artifacts (`target/`) or unrelated docs.
