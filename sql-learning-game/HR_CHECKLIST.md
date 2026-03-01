# HR_CHECKLIST.md — Pre-Spawn Budget Checklist

Use this **before every sub-agent spawn**.

## 1) Scope Gate
- [ ] Single deliverable only (one bug, one feature slice, or one doc update)
- [ ] Clear done criteria in 3 bullets max
- [ ] Out-of-scope explicitly listed

## 2) Context Gate
- [ ] Only required files included (target: 3–5)
- [ ] No `target/`, logs, or unrelated markdown in context
- [ ] Reuse existing project docs (`ROADMAP.md`, `STATUS.md`) instead of repeating history

## 3) Budget Gate
- [ ] Token cap set in prompt (default 3k; hard stop 6k)
- [ ] Retry cap set (max 2)
- [ ] Output format constrained (patch/diff + short notes)

## 4) Execution Gate
- [ ] Fast validation command prepared (unit test or specific build target)
- [ ] If validation fails twice, re-scope before re-spawn
- [ ] Record result in `STATUS.md` (what changed, what remains)

## 5) Kill Conditions
Abort spawn and rewrite prompt if:
- [ ] Agent asks for whole-repo context
- [ ] Agent starts broad refactor not requested
- [ ] Estimated cost exceeds cap without clear progress
