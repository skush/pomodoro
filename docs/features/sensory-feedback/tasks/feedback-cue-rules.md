---
id: T3
title: "Add the pure cue rules: tone data, ringFraction and tabTitle"
layer: "domain"
deps: ["T2"]
blocks: ["T5", "T6", "T8"]
acs: ["AC-01", "AC-04", "AC-05", "AC-09"]
files_hint: ["src/logic/feedback.js", "src/logic/index.js", "test/logic/feedback.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"   # measured: 53 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T3 — Add the pure cue rules: tone data, ringFraction and tabTitle

## Place in the sequence

- **Blocked by:** T2 — Extend the engine snapshot with phaseFullMs and a one-shot justCompleted for every phase type · **Blocks:** T5 — Build the Progress ring component (inline SVG track + arc); T6 — Build the audio adapter: lazy AudioContext, unlock inside Start/Resume, play a tone once; T8 — Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() · **Wave:** 2, after its dependencies.
- **Lane:** shares files with T2 via `src/logic/index.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** a ring that depletes as the current phase runs
> **So that** I can tell how much of the phase is left without reading the digits
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

Defines, as unit-tested pure functions, what the ring shows, what the tab title says and which tone plays, so the UI only draws what these return.

## Inlined context

> `feedback.js` <NEW, pure, re-exported from index.js: TONES (focusEnd / breakEnd note lists) + toneFor(phase); ringFraction(snapshot), which is the remaining whole second ÷ phaseFullMs clamped to [0, 1], so it steps with the countdown once per second; tabTitle(snapshot), which gives whole minutes rounded up + the phase name + the running / paused / ready state (AC-04, exact wording owned by `screens`).>
>
> — `sad.md §5, «src/logic/feedback.js», verbatim` · full text: [sad.md](../sad.md)

> Tones are note lists, each note having a frequency, start offset, duration and peak gain. … So ≤ 2 s per tone, peak gain ≤ 0.3, the rising-vs-falling distinctness (AC-05), the whole-minute rounding-up (AC-04) and the ring-vs-countdown agreement are all Node unit tests.
>
> — `sad.md §4, decision 6, abridged` · full text: [sad.md](../sad.md)

> | Chime length | each tone ≤ 2 s, played once, never repeating | unit + e2e |
> | Chime loudness | peak output gain of each tone ≤ 0.3 of full scale | unit (over the tone definition) |
> | Ring vs countdown agreement | ring's remaining fraction within 1 s-equivalent of the countdown at every visible update | unit + e2e sample |
>
> — `spec.md §6, rows «Chime length», «Chime loudness», «Ring vs countdown agreement», verbatim` · full text: [spec.md](../spec.md)

> The exact character of the two tones (pitch, length, envelope)? Default now: each ≤ 2 s, within the AC-05 distinctness rule (opposite melodic direction or different note count) and the §6 loudness ceiling. — owner: sergii.kushnir@gmail.com, due: before `sdd:implement`
>
> — `spec.md §8, open question 3, verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

— `data-model.md, «No schema change», verbatim` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** the User has pressed Start on a phase
> **When** the phase runs
> **Then** the Progress ring is full at the start, its remaining portion shrinks in step with the countdown, and it is empty at the moment of the Phase completion — the ring updates together with the countdown, once per second, with a short smooth transition between steps so it reads as a continuous sweep (reduced motion: §6)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the timer is in any state
> **When** the User looks at the browser's tab strip
> **Then** the tab title shows the remaining time as whole minutes, rounded up (so it never shows zero minutes while time is left), together with the phase name, and distinguishes the three states: running shows the minutes and phase; paused is marked as paused with the frozen minutes; waiting for Start is marked as ready with the minutes the phase will run for — the one tolerance: while the tab is hidden, a running phase's minutes may trail the countdown by up to a minute between completions, but are always correct at a Phase completion (§6 Tab title freshness)
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — happy path

> **Given** a phase is running
> **When** it reaches a Phase completion
> **Then** a Focus completion plays the Focus-end tone, and a Short break or Long break completion plays the break-end tone — the two tones are distinguishable by construction: they differ in melodic direction (one rising, one falling) or in their number of notes, and neither exceeds the §6 loudness ceiling
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — cross-context

> **Given** a phase is waiting for Start
> **When** the User commits a new Configured duration for that phase type (`docs/features/adjustable-durations/spec.md` AC-03)
> **Then** the ring shows full and the tab title shows the new duration in whole minutes immediately, matching the on-page countdown
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/logic/feedback.js`: export `TONES` (`focusEnd`, `breakEnd` note lists: frequency, start offset, duration, peak gain) and `toneFor(phase)` (Focus → `focusEnd`, Short/Long break → `breakEnd`). Pick the tone character within the AC-05 rule and the §6 ceilings; record the choice for the §8 open question.
- [ ] `src/logic/feedback.js`: `ringFraction(snapshot)` = remaining whole second ÷ `phaseFullMs`, clamped to [0, 1]; `tabTitle(snapshot)` = whole minutes rounded up + phase name + running / paused / ready. `screens.md` does not exist, so the exact wording is decided here and must contain the three state markers.
- [ ] `src/logic/index.js`: re-export the new symbols.
- [ ] `test/logic/feedback.test.js`: tone length ≤ 2 s, peak gain ≤ 0.3, focus vs break distinct (opposite direction or different note count); `ringFraction` against `formatDuration` over sampled snapshots incl. a mid-phase duration commit and an idle phase after a commit; `tabTitle` rounds up and never shows 0 while time is left, and distinguishes the three states.

## Edge cases

| Case | Behaviour |
|---|---|
| `remainingMs` between two whole seconds | Ring uses the remaining whole second, so it steps with the countdown. |
| `remainingMs` = 0 | Ring fraction 0; after a completion the snapshot is already the next idle phase, so the title shows it as ready. |
| `remainingMs` under 1 minute | Title shows 1 min (rounded up), never 0. |
| Duration committed for an idle phase | `phaseFullMs` and `remainingMs` both follow it, ring fraction 1, title shows the new whole minutes. |
| Duration committed for a started phase | Fraction still measured against the pinned `phaseFullMs`. |
| Fraction outside [0, 1] from bad input | Clamped, never thrown. |

## Definition of Done

- [ ] `test/logic/feedback.test.js` passes for tones, ring fraction and title.
- [ ] Existing tests still green.
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
