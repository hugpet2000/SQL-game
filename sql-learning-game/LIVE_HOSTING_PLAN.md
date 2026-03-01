# LIVE_HOSTING_PLAN.md

## Goal
Ship a **first public test URL** quickly while keeping operational risk low and reversible.

Success means: external testers can sign in, run core SQL exercises, and we can monitor/fix issues without downtime drama.

---

## Sprint 2 Focus (Live-hosting readiness)
**Primary deliverables:**
- **Export endpoint** for learner progress/data (controlled + secured).
- **Auth mode tests** that validate all supported auth configurations.
- **Hosted UX polish** for first-impression quality on the public URL.

**Sprint 2 acceptance criteria**
- [ ] Export endpoint exists, is authenticated, and returns correct scoped data (per-user or admin-only, as intended).
- [ ] Export endpoint includes rate limiting and audit logging (requester + timestamp).
- [ ] Auth mode tests cover all supported modes (e.g., email+password, magic link, admin-only) and pass in CI.
- [ ] Hosted UX polish checklist complete (loading states, error banners, empty states, mobile nav basics, copy clarity).
- [ ] Public URL smoke test: new tester can sign in → complete lesson → export own data without guidance.

**Sprint 2 risks / watchouts**
- **Data exposure risk:** export endpoint could leak other users’ data if scope enforcement is flawed.
- **Auth drift risk:** staging vs prod auth config mismatch breaks login at launch.
- **UX regression risk:** polish changes may introduce layout breaks on smaller screens.

---

## Phase Plan (Dev → Staging → Prod-lite)

### 1) Dev (local + preview)
**Purpose:** fast iteration and integration testing.

- Environment: local Docker/dev server + per-branch preview deploys.
- Data: synthetic seed data only.
- Auth: basic login flow wired (email+password or magic link), no anonymous admin paths.
- Export endpoint: scaffolded and gated by auth; fixture data validated.
- UX polish: layout and copy tweaks validated in preview.
- Infra minimums:
  - `.env` for local only; no secrets in repo.
  - app-level error logging enabled.
  - DB migrations scripted and repeatable.
- Exit criteria:
  - Core learning loop works end-to-end: login → choose lesson → run query → get feedback/progress.
  - Export endpoint returns correct payload for current user (or admin role) in dev.
  - Auth mode tests pass in CI.
  - Staging deploy is automated from main branch.

### 2) Staging (production-like dry run)
**Purpose:** verify release process and security baseline before public access.

- Environment: separate staging app + separate staging DB.
- Data: sanitized fixtures; no production PII.
- Domain: `staging.<domain>` protected behind allowlist or tester password gate.
- Minimum observability:
  - uptime check + basic alerting (5xx spike / app down).
  - central logs with request IDs.
- Release checks:
  - migration up/down tested.
  - backup + restore tested once (time-boxed drill).
  - performance sanity: app usable with at least 20 concurrent test users.
  - export endpoint smoke-tested with staging auth configuration.
- Exit criteria:
  - security minimums (below) are implemented and verified.
  - rollback procedure tested once successfully.
  - hosted UX polish checklist validated on desktop + mobile.
  - acceptance checklist is green except explicitly waived items.

### 3) Prod-lite (first public test URL)
**Purpose:** limited public beta, controlled blast radius.

- Environment: production project but feature-limited and traffic-limited.
- Access model:
  - invite-only or capped signups (e.g., first 50–200 testers).
  - admin routes locked to admin role + IP allowlist where possible.
- Operational guardrails:
  - daily backup job verified.
  - error budget trigger: if severe bug rate exceeds threshold, pause signups.
  - kill switch for risky features (feature flags).
- Change policy (first 1–2 weeks):
  - small releases only, no schema-breaking changes on Fridays/evenings.
  - one on-call owner per day.

---

## Security Minimums (Must-have before public URL)

### Auth
- [ ] All write/progress endpoints require authenticated user.
- [ ] Passwords hashed with Argon2/bcrypt (no custom crypto).
- [ ] Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax` (or stricter).
- [ ] Basic rate limiting on login + password reset endpoints.
- [ ] Admin actions protected by role checks server-side (not UI-only).

### Secrets
- [ ] No secrets in git history or frontend bundle.
- [ ] Secrets stored in environment/secret manager (per-env values).
- [ ] Rotate keys before first public launch if ever shared in chat/files.
- [ ] Separate keys for dev/staging/prod-lite.

### Backups
- [ ] Automated daily DB backup configured.
- [ ] Retention policy set (minimum 7 days for sprint phase).
- [ ] One restore test completed and documented (RTO target ≤ 60 min).
- [ ] Backup access restricted to maintainers only.

---

## Rollback Plan (Pragmatic)

### Trigger conditions
Rollback immediately if any of:
- login failure rate > 20% for 10 minutes,
- data corruption/progress loss detected,
- critical auth bypass/security issue,
- sustained 5xx > 10% for 10 minutes after deploy.

### Procedure
1. **Freeze deploys** and announce incident in team channel.
2. **Flip traffic** to previous stable release (or redeploy previous artifact).
3. **Disable risky features** via feature flags.
4. If schema migration caused issue:
   - execute tested down migration, or
   - restore DB from latest clean backup if down migration unsafe.
5. Run smoke tests on rolled-back version.
6. Post incident note: root cause, user impact, corrective actions.

### Roll-forward criteria
- fix reviewed by second person,
- reproducible test added,
- staging validation repeated,
- explicit go/no-go approval logged.

---

## Acceptance Checklist for First Public Test URL

### Product readiness
- [ ] New tester can complete first lesson without assistance.
- [ ] Query execution feedback is clear for success and failure cases.
- [ ] Progress tracking persists across logout/login.
- [ ] Export endpoint allows user to retrieve their own progress.

### Reliability
- [ ] Uptime monitor active and alerting to at least one owner.
- [ ] Error logging visible with actionable stack traces.
- [ ] Basic load sanity test completed (target cohort size).

### Security & operations
- [ ] Auth, secrets, backup minimums all green.
- [ ] HTTPS enforced; no mixed content warnings.
- [ ] Privacy/legal placeholder pages published (Terms/Privacy short form is enough for test phase).

### Launch controls
- [ ] Signup gating enabled (invite code/waitlist/cap).
- [ ] In-app feedback channel available (form/Discord/email).
- [ ] Rollback runbook link pinned for on-call.
- [ ] Named launch owner + backup owner for first 72 hours.

---

## Suggested Sprint Split (Rapid Iteration)
- **Day 1–2:** auth mode tests + export endpoint scaffold + env/secrets cleanup.
- **Day 3:** backups + restore drill + rollback drill.
- **Day 4:** hosted UX polish + staging soak + bug fixes.
- **Day 5:** prod-lite launch to limited testers + daily review loop.

This plan intentionally favors speed with clear safety rails over full enterprise maturity.
