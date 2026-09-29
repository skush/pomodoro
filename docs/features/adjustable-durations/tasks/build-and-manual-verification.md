---
id: T9
title: "Rebuild index.html and run the manual NFR checks"
layer: "wiring"
deps: ["T7","T8"]
blocks: ["T11"]
acs: []
files_hint: ["index.html"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T9 — Rebuild index.html and run the manual NFR checks

## Place in the sequence

- **Blocked by:** T7 — Wire load-time and pre-start correction of stored durations and cycle length, T8 — Reserve fixed width for a 3-digit minute countdown so no control shifts · **Blocks:** T11 — Write the e2e-through-UI tests · **Wave:** 6.
- **Lane:** own lane (`index.html` only) — last task.

## Why (user story)

> **As a** User
> **I want** my custom durations and cycle length to still be set when I reopen or reload the page
> **So that** I don't have to re-enter them every time
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

Regenerates the committed artifact and confirms the persistence and commit-discipline NFRs that unit tests cannot.

## Inlined context

> | Duration persistence | Configured durations survive 100% of a full browser close-and-reopen cycle, with 0 data loss, until the User clears site data | manual check: close and reopen the browser |
>
> — `spec.md §6, NFR «Duration persistence», verbatim` · full text: [spec.md](../spec.md)

> | Cycle-length persistence + fallback | Configured cycle length survives 100% of a full browser close-and-reopen cycle with 0 data loss (AC-14), and falls back to 4 — written back to storage immediately — on any stored value that isn't a valid whole number in 2–8 (AC-12) — 0 thrown exceptions | manual check (close/reopen) + unit test with invalid stored data |
>
> — `spec.md §6, NFR «Cycle-length persistence + fallback», verbatim` · full text: [spec.md](../spec.md)

> | Commit discipline | A duration or cycle-length field's value applies (to display, storage, and the engine) only on blur/Enter, never on an intermediate keystroke while the User is still editing | manual check, mirroring session-tracking's task-label commit check |
>
> — `spec.md §6, NFR «Commit discipline», verbatim` · full text: [spec.md](../spec.md)

> | Self-contained load | Zero network requests beyond the initial `index.html` load (unchanged from core-timer/session-tracking) | manual check via the browser devtools Network tab |
>
> — `spec.md §6, NFR «Self-contained load», verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

_No spec §5 acceptance criterion maps to this task; its DoD is the NFR quoted under Inlined context._

## Checklist

- [ ] Run `npm run build` and commit the regenerated `index.html` with the source — `index.html`
- [ ] Manual checks: close/reopen the browser keeps durations and cycle length; commit only on blur/Enter; devtools Network shows no requests beyond the initial load; 100→99 minute crossing has no layout shift

## Edge cases

| Case | Behaviour |
|---|---|
| Site data cleared | Classic defaults 25/5/15/4 shown |
| `index.html` stale versus `src/` | Not acceptable — rebuild and commit together |

## Definition of Done

- [ ] `npm run build` output committed; `index.html` matches `src/`
- [ ] Manual checks above recorded as passed
- [ ] `npm test` and `npm run lint` clean

## Verification record

Corrected by review (`../_review/review-2026-09-29.md`, finding #9). The T9 commit message (`3efe264`)
said the manual checks were verified "via the e2e suite added in T11", but that suite landed in a later
commit and at that point tested persistence only with a same-context `page.reload()`. The checks are now
automated end-to-end against the built `index.html` in a real browser (system Edge), in
`test-e2e/durations.e2e.js`:

| NFR check | Test | Result (2026-09-29) |
|---|---|---|
| Durations + cycle length survive a full browser close and reopen | `NFR persistence (AC-09/AC-14): … survive a full browser close and reopen` — on-disk profile, browser process closed and relaunched | pass |
| Commit only on blur/Enter, never on a keystroke | `NFR commit discipline: …` | pass |
| Zero network requests beyond the initial `index.html` | `NFR self-contained load: …` | pass |
| No layout shift across 1–180 min and the 100:00 → 99:59 crossing | `NFR display width: …` | pass |

Still manual-only (not automated): a close/reopen check in a browser other than Edge.
