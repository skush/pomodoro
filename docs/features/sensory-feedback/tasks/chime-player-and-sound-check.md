---
id: T6
title: "Build the audio adapter: lazy AudioContext, unlock inside Start/Resume, play a tone once"
layer: "ui"
deps: ["T3"]
blocks: ["T8", "T9"]
acs: ["AC-05", "AC-07", "AC-11", "AC-12"]
files_hint: ["src/ui/audio.js", "test/logic/audio.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"   # measured: 52 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T6 — Build the audio adapter: lazy AudioContext, unlock inside Start/Resume, play a tone once

## Place in the sequence

- **Blocked by:** T3 — Add the pure cue rules: tone data, ringFraction and tabTitle · **Blocks:** T8 — Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount(); T9 — Play the chime or show the notice at completion; unlock sound in Start/Resume · **Wave:** 3, after its dependencies.
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** a soft chime with a different tone for a Focus end and a break end
> **So that** I know whether to take a break or get back to work without looking
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

Provides the sound path itself: synthesise the tone, enable sound only from the User's own press, and report whether sound can play.

## Inlined context

> `audio.js` <NEW: createChimePlayer() → {unlock() → available?, play(tone) → played?}, one lazily created AudioContext; each note is an OscillatorNode + GainNode envelope scheduled relative to the context's currentTime (§4 decision 5).>
>
> — `sad.md §5, «src/ui/audio.js», verbatim` · full text: [sad.md](../sad.md)

> One lazily created `AudioContext`, unlocked only inside the User's own Start/Resume press, and checked at unlock and at each completion. The context is created on the first Start and `resume()`d on every Start/Resume, which is the User's gesture, so there's no permission prompt (AC-12). If it is missing or not `running` right after that, or at a completion, the sound-unavailable notice shows and **no chime is queued for later** (AC-11, AC-06b). A later Start/Resume that finds it `running` hides the notice.
>
> — `sad.md §4, decision 5, verbatim` · full text: [sad.md](../sad.md)

> | Chime length | each tone ≤ 2 s, played once, never repeating | unit + e2e |
> | Self-contained | 0 network requests, 0 audio files shipped | e2e |
>
> — `spec.md §6, rows «Chime length», «Self-contained», abridged` · full text: [spec.md](../spec.md)

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

- [ ] `src/ui/audio.js`: `createChimePlayer()` with a lazily created `AudioContext` (guard `window.AudioContext`/`webkitAudioContext`); `unlock()` creates/`resume()`s it and returns whether `state === 'running'`; `play(tone)` schedules one oscillator + gain envelope per note relative to `currentTime`, once, and returns whether it played.
- [ ] Wrap `resume()`, construction and `play()` in try/catch: any failure returns `false`; never queue a tone for later.
- [ ] `test/logic/audio.test.js`: with a fake `AudioContext`, assert unlock true/false for `running` vs `suspended`/missing, `play` schedules each note exactly once and returns `false` when suspended or throwing, and creates no network request or audio element.

## Edge cases

| Case | Behaviour |
|---|---|
| `AudioContext` missing or constructor throws | `unlock()` and `play()` return `false`; no throw. |
| `resume()` rejects or leaves the context `suspended` | `unlock()` returns `false` (notice shown by T9). |
| `play()` called while suspended | Returns `false`; nothing is scheduled for later. |
| Muted OS or unplugged speakers | Invisible to the page; explicitly outside AC-11. |
| Repeated `unlock()` | Reuses the one context; never creates a second. |

## Definition of Done

- [ ] `test/logic/audio.test.js` passes with a fake context.
- [ ] No file fetched, no `<audio>` element, no permission API used.
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
