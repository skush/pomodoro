# Changelog — session-tracking

## session-tracking — task label + daily completed-session counter

**What:** The timer card now has a task-label field ("What are you focusing on?", up to 100
characters, saved as you commit it) and a "Today's completed sessions" counter that increments
once for every genuinely completed Focus session — never for a Reset, never for a Short/Long
break — and resets automatically at local midnight.

**Why:** Core-timer (step 2) proved the engine; this is the first feature that gives the User a
reason to keep the tab open across sessions instead of a one-off countdown. See
[spec.md](spec.md) §1/§2. The key technical bets:
[ADR-0001](adr/0001-expose-true-focus-completion-timestamp.md) (the engine latches the true
completion instant, not the moment it's observed, so a completion detected after the tab was
backgrounded across midnight is still attributed to the day it truly finished on) and
[ADR-0002](adr/0002-centralize-session-tracking-writes.md) (exactly one function may ever write to
`localStorage`, and every write re-persists the app's full in-memory state so an external edit —
devtools, another tab — never survives the next legitimate write).

**How to use:** Type a task label under the timer controls; it saves when you blur the field or
press Enter (not on every keystroke). The session count updates automatically as Focus phases
complete and rolls over to 0 at local midnight the next time the page is open or polled — no
manual reset needed.

**Operational notes:**
- Migration: none — no backend, no database ([`docs/adr/0002-no-backend-for-v1`](../../adr/0002-no-backend-for-v1.md)). Storage is three `localStorage` keys (`session-tracking:count`, `:date`, `:label`).
- Feature flag / config: none.
- Rollback: revert the commit(s) and re-run `npm run build`; entirely client-side static content
  (`index.html`), so rollback is a redeploy of the previous committed file. A User's existing
  `localStorage` values are simply ignored by the reverted build, not migrated or deleted.

**Acceptance criteria delivered:** AC-01, AC-01b, AC-02, AC-03, AC-04, AC-04b, AC-05, AC-06,
AC-06b, AC-07 (spec.md §5 — the full set) — task-label capture and persistence, and a daily count
that credits only genuine same-tracked-day Focus completions, survives sleep/backgrounding across
midnight without misattribution, and never adopts a storage value the app itself didn't just
write.
