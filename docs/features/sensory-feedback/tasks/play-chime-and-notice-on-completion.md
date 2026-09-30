---
id: T9
title: "Play the chime or show the notice at completion; unlock sound in Start/Resume"
layer: "ui"
deps: ["T6", "T8"]
blocks: ["T10"]
acs: ["AC-05", "AC-07", "AC-10", "AC-11", "AC-12"]
files_hint: ["src/ui/index.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"   # measured: 60 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T9 — Play the chime or show the notice at completion; unlock sound in Start/Resume

## Place in the sequence

- **Blocked by:** T6 — Build the audio adapter: lazy AudioContext, unlock inside Start/Resume, play a tone once; T8 — Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() · **Blocks:** T10 — Arm the wake-up on Start/Resume and after an early wake; cancel on Pause/Reset; build · **Wave:** 5, after its dependencies.
- **Lane:** shares files with T8 via `src/ui/index.js`, T10 via `src/ui/index.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** a soft chime with a different tone for a Focus end and a break end
> **So that** I know whether to take a break or get back to work without looking
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

Delivers the audible cue: one tone per Phase completion, none on any control, and a visible notice when sound cannot play.

## Inlined context

> Flow 1 — deadline has passed: settle, next phase idle, `justCompleted` returned. UI sets the tab title to the next phase, ready; ring full in the next phase colour; if sound available (context running): play the Focus-end or break-end tone, once; else show the sound-unavailable notice, no chime held back for later; then credit the Session counter from `justCompletedFocusAt` (unchanged). The next `getSnapshot` returns `justCompleted` null, so no second chime.
>
> — `sad.md §6, «Critical flow 1», abridged` · full text: [sad.md](../sad.md)

> Flow 2 — Start or Resume: create the audio context on first use, then resume it inside this press; running → hide the notice, otherwise show the notice now, before the phase runs unattended. No chime on Start or Resume. Pause or Reset: a wake-up already in flight only runs a render, nothing completes, no chime.
>
> — `sad.md §6, «Critical flow 2», abridged` · full text: [sad.md](../sad.md)

> The notice appears as soon as the problem is found at Start or Resume (before the phase runs unattended) or at the completion, and stays until a later Start or Resume finds sound working.
>
> — `spec.md §5, AC-11 (tail), verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:** `render()` is the single `getSnapshot()` caller in `src/ui/`. Both `justCompletedFocusAt` and `justCompleted` are consumed there, in a fixed order: title → ring → chime/notice → Session counter
>
> — `sad.md §8, «One-shot consumption», verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Fail-soft in `src/ui/`: a missing or blocked `AudioContext`, a failing `resume()`, a throwing `play`, or a worker that can't be constructed is caught. The timer, ring, title and Session counter carry on unchanged (AC-11). Only sound failure is User-visible, as the plain-language inline notice.
>
> — `sad.md §8, «Error handling», abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

— `data-model.md, «No schema change», verbatim` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-05 — happy path

> **Given** a phase is running
> **When** it reaches a Phase completion
> **Then** a Focus completion plays the Focus-end tone, and a Short break or Long break completion plays the break-end tone — the two tones are distinguishable by construction: they differ in melodic direction (one rising, one falling) or in their number of notes, and neither exceeds the §6 loudness ceiling
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — domain invariant

> **Given** the User is using the timer
> **When** they press Start, Pause, Resume or Reset, or commit a duration or cycle-length change
> **Then** no chime plays — the Completion chime plays only at a Phase completion, and exactly once per completion (never again when the User returns to the tab); a Pause or Reset pressed an instant before zero means that phase does not complete, so its chime never plays
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — cross-context

> **Given** a Focus phase is running
> **When** it reaches its Phase completion
> **Then** the Focus-end chime plays, and that same completion is credited to the Session counter exactly as session-tracking decides (`docs/features/session-tracking/spec.md` AC-04 and AC-06) — normally today's count goes up by exactly one; a completion whose true moment fell before a midnight that has since passed still chimes but is not carried into the new day's count; a break completion chimes and never changes the Session counter
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — error

> **Given** sound cannot be played in the User's browser (sound unavailable, blocked, or silently suspended by the browser)
> **When** the User presses Start or Resume, or a phase reaches its Phase completion
> **Then** the phase runs and completes exactly as usual — Session counter, ring and tab title are unaffected and nothing breaks — and the page tells the User in plain language that the completion sound is unavailable, so they know to rely on the ring and the tab title instead; the notice appears as soon as the problem is found at Start or Resume (before the phase runs unattended) or at the completion, and stays until a later Start or Resume finds sound working. A muted operating system or unplugged speakers cannot be seen by the page and are outside this criterion
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — authorization

> **Given** the User has granted the page no browser permissions
> **When** they use the timer, including in a background tab
> **Then** no permission prompt ever appears (no notifications, no microphone, nothing else); sound is enabled by the User's own press of Start, and nothing is fetched from anywhere
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/ui/index.js`: create one `createChimePlayer()` in `mount()`.
- [ ] Start/Resume handlers: call `unlock()` inside the click handler (before `engine.start`), show the notice when it returns `false`, hide it when `true`. No chime here.
- [ ] `render()` chime/notice slot: when the snapshot has `justCompleted`, call `play(toneFor(justCompleted.phase))`; on `false` show the notice and queue nothing. Then run the existing Session-counter step unchanged.
- [ ] Confirm Pause, Reset and duration/cycle-length commits never reach `play`.

## Edge cases

| Case | Behaviour |
|---|---|
| Focus completes | Focus-end tone once; Session counter credited exactly as session-tracking decides (midnight rule stays theirs). |
| Short/Long break completes | Break-end tone once; Session counter unchanged. |
| Sound blocked or suspended at Start/Resume | Notice shown now; phase runs normally. |
| Sound blocked at completion | Notice shown; completion, ring, title, counter unaffected; no chime held back. |
| Later Start/Resume finds sound working | Notice hidden. |
| User returns to the tab after completion | No second chime (`justCompleted` already consumed). |
| Pause or Reset an instant before zero | No completion, so no chime. |

## Definition of Done

- [ ] Unit tests over the wiring pieces that can run in Node pass; e2e in T12 asserts one chime per completion and none on controls.
- [ ] No permission prompt and no network request introduced.
- [ ] `render()` remains the only `getSnapshot()` caller.
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
