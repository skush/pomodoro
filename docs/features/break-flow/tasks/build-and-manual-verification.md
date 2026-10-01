---
id: T10
title: "Regenerate index.html and run the spec §6 manual timing checks"
layer: "wiring"
deps: ["T9"]
blocks: []
acs: ["AC-01", "AC-03"]
files_hint: ["index.html", "docs/features/break-flow/_review/manual-timing-check.md"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T10 — Regenerate index.html and run the spec §6 manual timing checks

## Place in the sequence

- **Blocked by:** T9 — Add test-e2e/break-flow.e2e.js: auto-start, return-after-sleep, Start focus, keyboard focus · **Blocks:** — · **Wave:** 7.
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** a break to wait for me when the Focus phase ended while my device was asleep or the tab was frozen
> **So that** sleep or a locked phone never uses up my break or my Long break behind my back
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

Closes the build-then-commit loop and records the manual checks the spec asks for at merge.

## Inlined context

> `index.html` at the repo root is **generated**, not hand-edited. Run `npm run build` after any change under `src/`, and commit the regenerated `index.html` alongside the source change — the two must never drift.
>
> — `CLAUDE.md, The build-then-commit workflow, abridged`

> | Auto-started break accuracy | remaining break time differs from (full length − real time since the Focus end) by ≤ 1 s | unit test with an injected clock; manual stopwatch check on desktop Chrome |
> | Start focus response | Focus shown running ≤ 250 ms after the press | manual check during a running break |
>
> — `spec.md §6, NFR rows, verbatim` · full text: [spec.md](../spec.md)

> **Breaks or Long breaks used up during sleep** — baseline: n/a, target: 0 — verified by the late-completion unit test and one manual return-after-sleep run at merge.
>
> — `spec.md §7, KPI 4, verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** Auto-start breaks is on and a Focus phase is running on an awake device with the page open (visible in any supported browser, or in a background tab of desktop Chrome or Edge — the browsers sensory-feedback §3 holds its background timing promise for)
> **When** that Focus phase reaches zero — an On-time completion
> **Then** the Focus-end chime plays once, the completion is credited exactly as before (in-cycle focus count, Session counter), and the correct next break — Short or Long per the cycle — begins counting down by itself from its full length, measured from the Focus phase's true end; its length comes from the current Configured duration, checked and corrected exactly as for any fresh start (adjustable-durations AC-06); the phase name, ring and tab title show that break running. In a background tab of any other browser (e.g. Firefox) no auto-start is promised: the 5 s On-time tolerance (§6) decides, and a completion noticed later is a late completion (AC-03)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-03 (US-05) — cross-context

> **Given** Auto-start breaks is on and a Focus phase is running when the device sleeps, the screen locks, or the browser freezes or backgrounds the tab so that the Focus end is only noticed later — a late completion
> **When** the User returns to the page, however much time has passed
> **Then** the Focus-end chime plays exactly once, the completion is credited as session-tracking decides, and the correct next break — including a Long break — is shown at its full length, waiting, with Start break and Start focus offered; the break is never counted down or used up while the User was away, and no break-end chime plays
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Run `npm run build`, `npm test`, `npm run lint`, `npm run test:e2e`; commit `index.html` with the source.
- [ ] Stopwatch a real auto-started break on desktop Chrome/Edge; press Start focus mid-break and time the response; put the device to sleep across a Focus end and confirm a waiting break on return (originally also one chime; amended 2026-10-01 by the owner: no chime and no notice when the return is more than 2 minutes late, sensory-feedback AC-06b).
- [ ] Record the results in `docs/features/break-flow/_review/manual-timing-check.md` (same shape as `docs/features/sensory-feedback/_review/manual-timing-check.md`).

## Edge cases

| Case | Behaviour |
|---|---|
| `index.html` differs after a rebuild | Commit the regenerated file; never hand-edit it |
| The device cannot be put to sleep | Record the check as not run, with the reason; do not claim it |

## Definition of Done

- [ ] The regenerated index.html is committed with the source; npm test, npm run lint and npm run test:e2e are green; the manual notes record the stopwatch accuracy check of an auto-started break (≤ 1 s), the Start focus response (≤ 250 ms) and one real return-after-sleep run (break waiting; originally one chime, amended 2026-10-01 by the owner to no chime and no notice when the return is more than 2 minutes late, sensory-feedback AC-06b).
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean; `npm run build` regenerated
