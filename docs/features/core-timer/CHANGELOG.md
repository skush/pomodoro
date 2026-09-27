# Changelog — core-timer

## core-timer — wall-clock Pomodoro timer engine + UI

**What:** The Pomodoro app now runs a complete classic cycle — 4 focus sessions (25 min), 3 short
breaks (5 min) between them, then 1 long break (15 min) — driven entirely by Start/Pause/Reset. The
countdown stays accurate even if the tab is backgrounded, minimized, or the machine sleeps mid-phase:
it re-syncs from the real elapsed wall-clock time the moment the tab becomes visible again, rather
than drifting from missed timer ticks.

**Why:** This is the foundation step of the pomodoro-timer roadmap — every later step (session
tracking, adjustable durations, sensory feedback) needs a correct, trustworthy timer engine first.
See [spec.md](spec.md) §1/§2. The core technical bet is
[ADR-0001](adr/0001-wall-clock-deadline-timing.md): timing is computed from an absolute deadline
(`Date.now() + remaining`), never a per-tick counter, so drift is structurally impossible between
renders. [ADR-0002](adr/0002-structural-encapsulation-control-guard.md) locks down how the engine is
protected from any input other than its own three controls — by construction (module encapsulation),
not a runtime check.

**How to use:** Open `index.html` (or the live page — see [README.md](../../../README.md)). Click
**Start** to begin the current phase; **Pause**/**Start** to pause and resume without losing your
place; **Reset** to return the current phase to its full duration without disturbing the cycle
position or the in-cycle focus count. No configuration — the classic 25/5/15 durations are fixed for
this step (adjustable durations are a later roadmap step, spec §3 Non-goals).

**Operational notes:**
- Migration: none — no backend, no database ([`docs/adr/0002-no-backend-for-v1`](../../adr/0002-no-backend-for-v1.md)).
- Feature flag / config: none.
- Rollback: revert the commit(s) and re-run `npm run build`; the change is entirely client-side static
  content (`index.html`), so rollback is a redeploy of the previous committed file, nothing to migrate
  or unwind server-side.

**Acceptance criteria delivered:** AC-01, AC-01b, AC-02, AC-02b, AC-02c, AC-03, AC-04, AC-05, AC-06,
AC-07, AC-08 (spec.md §5 — the full set) — a complete cycle end-to-end using only Start/Pause/Reset,
with the countdown surviving backgrounding/sleep and every redundant control press being a safe
no-op.
