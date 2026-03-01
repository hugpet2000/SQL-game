# SPRINT_BOARD — Sprint S2-2026-03-01

## Sprint Goal
Ship **live-hosting readiness** for the first public test URL with strong auth coverage, a safe export endpoint, and hosted UX polish.

Focus: reduce launch risk while making first impressions crisp for external testers.

## Scope (Parallel Tracks)
- **Track A (Primary): Live-hosting Readiness**
  - export endpoint (scoped + audited), auth mode tests, hosted UX polish.
- **Track B (Secondary): Release Safety & Ops**
  - rollback readiness, staging smoke, guardrails for prod-lite.

## In Progress
- Define export endpoint contract + scope rules (per-user vs admin export).
- Map auth modes and current coverage gaps (email+password, magic link, admin-only, etc.).
- Hosted UX polish checklist (loading/error/empty states, mobile nav, copy).

## Backlog (This Sprint)
1. **Export endpoint pack**
   - Build authenticated export endpoint with strict scope enforcement.
   - Add rate limiting + audit logs (requester, timestamp, response size).
   - Add tests for export payload correctness and access control.
2. **Auth mode test pack**
   - Add integration tests per supported auth mode (including failure cases).
   - Ensure staging/prod config parity checks are automated.
   - Verify session cookie/security flags in hosted environment.
3. **Hosted UX polish pack**
   - Fix core layout issues on small screens.
   - Improve loading + error states for login/lesson/runner.
   - Tighten copy for onboarding and login messages.
4. **Release safety pack**
   - Staging smoke checklist run with real deploy.
   - Rollback drill verified once.
   - “Kill switch” for export endpoint (feature flag or config).

## Done
- Sprint plan aligned to live-hosting readiness goals.
- Risk/acceptance criteria defined for launch gating.

## Explicit Acceptance Criteria (Sprint Exit)
### A) Export Endpoint
- [ ] Endpoint is authenticated and **scoped** (user only or admin-only per spec).
- [ ] Access control tests verify no cross-user data leakage.
- [ ] Rate limiting enabled and audit log entries captured per request.
- [ ] Export payload includes expected fields and matches schema contract.

### B) Auth Mode Tests
- [ ] Each supported auth mode has integration test coverage.
- [ ] Failure cases are covered (bad token, expired link, wrong password).
- [ ] Staging and prod-like configs are validated before release.
- [ ] Session cookie flags verified in hosted environment.

### C) Hosted UX Polish
- [ ] Login + lesson flow has clear loading/error/empty states.
- [ ] Mobile layout passes quick check on common breakpoints.
- [ ] Copy is concise and user-facing error messages are helpful.
- [ ] Public URL smoke test passes end-to-end without assistance.

### D) Release Safety
- [ ] Staging smoke checklist completed after a fresh deploy.
- [ ] Rollback drill performed once and documented.
- [ ] Export endpoint can be disabled quickly (feature flag/config).

## Risks / Watchouts
- **Data exposure risk:** export endpoint scope bugs could leak other users’ data.
- **Auth drift risk:** config mismatch between staging and prod breaks login.
- **UX regression risk:** polish changes introduce layout issues on small screens.
- **Schedule risk:** adding analytics/reporting now would delay launch readiness.

## Scope Guardrails (Enforced)
1. **No new major systems this sprint.**
   - No teacher/admin feature track (deferred to **v1.4+**).
   - No multiplayer/online leaderboard/major UI rewrites.
2. **Launch readiness over expansion.**
   - Ship export + auth tests + polish before any new content.
3. **Safety gates required.**
   - Export endpoint must be gated + audited before public URL.
4. **Keep scope small.**
   - Avoid new analytics dashboards or external integrations.

## Deferred / Out of Scope
- Teacher/admin tooling and classroom reporting (**v1.4+**).
- Large curriculum expansion beyond current wave pacing.
- Advanced explain-plan quality scoring as a primary deliverable this sprint.

## Sprint Definition of Done (Coordination)
- Board is current and reflects active work.
- Acceptance criteria are testable and measurable.
- Guardrails are explicit and referenced in planning/review.
- Team can demonstrate export endpoint, auth test suite, and hosted UX polish outcomes.
