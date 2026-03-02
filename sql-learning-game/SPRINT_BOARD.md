# SPRINT_BOARD — Sprint S3-2026-03-02

## Sprint Goal
Ship **Roadmap Level Select UI** (Mario/Duolingo style) **ahead of live hosting** while keeping core gameplay stable.

Focus: make level selection visually engaging with avatar progression; launching hosted environment is paused until roadmap UI is done.

## Scope (Parallel Tracks)
- **Track A (Primary): Roadmap UI**
  - visual node map with avatar, locked states, click-to-play flow.
- **Track B (Secondary): Stability Guardrails**
  - keep v1.1 reliability green; avoid regressions while UI changes land.

## In Progress
- Define roadmap layout (node positions, wave grouping, avatar marker).
- Decide transition from roadmap → play view (open SQL play screen on click).
- Preserve existing level list as fallback while roadmap ships.

## Backlog (This Sprint)
1. **Roadmap UI pack**
   - Render each level as a circular node on a path.
   - Show locked/unlocked/complete states with distinct styling.
   - Avatar marker moves to current/unlocked level.
   - Clicking a node opens the SQL play view.
2. **Transition & state pack**
   - Toggle roadmap view ↔ play view without losing progress state.
   - Keep keyboard/accessible navigation for roadmap nodes.
3. **Stability pack**
   - Regression check for level load + run + reset.
   - Ensure unlocked gating still enforced.

## Done
- Sprint plan aligned to roadmap UI priority.

## Explicit Acceptance Criteria (Sprint Exit)
### A) Roadmap UX
- [ ] Nodes are visible and clearly indicate locked/unlocked/completed.
- [ ] Avatar marker reflects current/unlocked progress.
- [ ] Clicking a node opens the SQL play view for that level.
- [ ] Locked nodes are visible but disabled.

### B) Stability
- [ ] Core gameplay loop unaffected (run/reset/feedback).
- [ ] Unlocked routing still correct.
- [ ] No crash on missing level data.

## Risks / Watchouts
- **UX confusion risk:** roadmap should not hide how to start a level.
- **Accessibility risk:** nodes must be keyboard focusable with clear focus state.
- **Regression risk:** level loading or progress gating breaks.

## Scope Guardrails (Enforced)
1. **No live hosting work this sprint.**
   - Hosting is paused until roadmap UI ships.
2. **No new levels this sprint.**
3. **No teacher/admin features (deferred to v1.4+).**

## Deferred / Out of Scope
- Live hosting rollout (paused).
- Telemetry dashboards or analytics expansions.
- Content expansion beyond current wave.

## Sprint Definition of Done (Coordination)
- Board reflects roadmap UI work as primary goal.
- Acceptance criteria testable and verified.
- Gameplay still stable after UI transition.
