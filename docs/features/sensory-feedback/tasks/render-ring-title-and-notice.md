---
id: T8
title: "Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount()"
layer: "ui"
deps: ["T2", "T3", "T4", "T5", "T6"]
blocks: ["T9", "T11"]
acs: ["AC-01", "AC-02", "AC-04", "AC-08", "AC-09"]
files_hint: ["src/ui/index.js", "src/styles.css"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"   # measured: 60 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T8 — Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount()

## Place in the sequence

- **Blocked by:** T2 — Extend the engine snapshot with phaseFullMs and a one-shot justCompleted for every phase type; T3 — Add the pure cue rules: tone data, ringFraction and tabTitle; T4 — Add the ring, notice and focus palette tokens, reduced-motion and 320px layout rules, and a contrast unit test; T5 — Build the Progress ring component (inline SVG track + arc); T6 — Build the audio adapter: lazy AudioContext, unlock inside Start/Resume, play a tone once · **Blocks:** T9 — Play the chime or show the notice at completion; unlock sound in Start/Resume; T11 — e2e: ring vs countdown, tab title states, 320px layout and reduced motion · **Wave:** 4, after its dependencies.
- **Lane:** shares files with T4 via `src/styles.css`, T9 via `src/ui/index.js`, T10 via `src/ui/index.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** the browser tab's title to show the remaining minutes, the phase and whether it is running, paused or waiting
> **So that** I can keep track without switching back to the timer's tab
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

Puts the ring and the tab title on screen and keeps them in step with the countdown in every timer state.

## Inlined context

> `index.js` <mount(root, engine): unchanged responsibilities, plus it builds the ring, the sound-unavailable notice and the title updates, and runs them in the fixed render order (§6 Flow 1). … It remains the ONLY getSnapshot() caller (ADR-0002).>
>
> — `sad.md §5, «src/ui/index.js», abridged` · full text: [sad.md](../sad.md)

> Flow 4 — each tick: getSnapshot(now) → title text from whole minutes rounded up, phase name, running or paused or ready → ring fraction from the remaining whole second over phaseFullMs, phase colour from the phase type. Running: ring steps once per second; hidden tab: the title may trail by up to 60 s. Paused: ring frozen, title marked paused. Waiting for Start after Reset or a newly loaded phase: ring full, title marked ready. Postcondition: ring and countdown agree within 1 s, phase name always shown as text, no chime on any tick.
>
> — `sad.md §6, «Flow 4», abridged` · full text: [sad.md](../sad.md)

> Flow 5 — commit for a phase waiting for Start: idle phase follows the live value, new `remainingMs` and `phaseFullMs`; ring full, title shows the new duration in whole minutes at once. Commit for a started phase: `phaseFullMs` still the pinned value; ring keeps measuring against it, no jump and no stick.
>
> — `sad.md §6, «Flow 5», abridged` · full text: [sad.md](../sad.md)

> | Tab title freshness | visible tab: shows the on-page countdown's whole minute (rounded up) within 1 s; hidden tab: already shows the next phase waiting for Start when the Completion chime starts, and at most 60 s behind while running | e2e |
>
> — `spec.md §6, «Tab title freshness», verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:** `render()` is the single `getSnapshot()` caller in `src/ui/`. Both `justCompletedFocusAt` and `justCompleted` are consumed there, in a fixed order: title → ring → chime/notice → Session counter
>
> — `sad.md §8, «One-shot consumption», verbatim` · full text: [sad.md](../sad.md)

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

### AC-02 — happy path

> **Given** a phase is running
> **When** the User pauses it, or presses Reset, or the phase completes and the next phase loads waiting for Start
> **Then** on pause the ring stays frozen at the portion that was left; after Reset, and for a newly loaded waiting phase, the ring is full
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the timer is in any state
> **When** the User looks at the browser's tab strip
> **Then** the tab title shows the remaining time as whole minutes, rounded up (so it never shows zero minutes while time is left), together with the phase name, and distinguishes the three states: running shows the minutes and phase; paused is marked as paused with the frozen minutes; waiting for Start is marked as ready with the minutes the phase will run for — the one tolerance: while the tab is hidden, a running phase's minutes may trail the countdown by up to a minute between completions, but are always correct at a Phase completion (§6 Tab title freshness)
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant

> **Given** a phase is running or paused, and the User commits a new Configured duration for that same phase type
> **When** the phase keeps running, or is resumed
> **Then** the ring keeps measuring against the length that phase started with — it neither jumps nor sticks, and stays in step with the unchanged countdown; after Reset, the full ring corresponds to the new Configured duration
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — cross-context

> **Given** a phase is waiting for Start
> **When** the User commits a new Configured duration for that phase type (`docs/features/adjustable-durations/spec.md` AC-03)
> **Then** the ring shows full and the tab title shows the new duration in whole minutes immediately, matching the on-page countdown
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/ui/index.js`: in `mount()`, build the ring (`createRing()`) next to the countdown and the (initially hidden) sound-unavailable notice element with plain-language text; keep the phase name as text.
- [ ] In `render()` (still the only `getSnapshot()` caller), in the fixed order title → ring → chime/notice → Session counter: set `document.title` from `tabTitle(snapshot)` and call `ring.update(ringFraction(snapshot), snapshot.phase)`. Leave the chime/notice slot and the Session-counter step in place for T9.
- [ ] Also refresh title and ring right after a valid duration commit (AC-09), reusing the same render path.
- [ ] `src/styles.css`: only the placement of the ring/notice inside the existing layout if T4 left it open.

## Edge cases

| Case | Behaviour |
|---|---|
| Tab hidden while running | Title may trail by up to 60 s between completions; correct at a completion. |
| Paused | Ring frozen at the portion left; title marked paused with the frozen minutes. |
| Reset, or the next phase loaded after a completion | Ring full; title marked ready with the minutes the phase will run for. |
| Duration committed for an idle phase | Ring full and title show the new whole minutes immediately. |
| Duration committed for a running or paused phase | Ring keeps the pinned length; no jump, no stick; after Reset the new length applies. |
| Invalid duration | Existing validation message shows; ring and title unchanged. |

## Definition of Done

- [ ] Manual/e2e check: title and ring change in step with the countdown in all three states (full e2e in T11).
- [ ] `render()` remains the only `getSnapshot()` caller in `src/ui/`.
- [ ] Existing unit and e2e tests still green.
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
