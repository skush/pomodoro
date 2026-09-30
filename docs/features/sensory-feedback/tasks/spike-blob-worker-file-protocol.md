---
id: T1
title: "Spike: confirm an inline Blob worker starts from file:// in Chrome, and that the zero-network check ignores blob: URLs"
layer: "tests"
deps: []
blocks: ["T7"]
acs: ["AC-06", "AC-12"]
files_hint: ["test-e2e/durations.e2e.js", "test-e2e/helpers.js", "docs/features/sensory-feedback/adr/0001-wake-the-page-at-the-deadline-from-an-inline-worker.md"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"   # measured: 36 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T1 — Spike: confirm an inline Blob worker starts from file:// in Chrome, and that the zero-network check ignores blob: URLs

## Place in the sequence

- **Blocked by:** none · **Blocks:** T7 — Build the inline wake-up worker and rework the message-channel source scan · **Wave:** 1, no dependencies, can start immediately.
- **Lane:** shares files with T12 via `test-e2e/helpers.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** the chime to play on time even while the timer's tab is in the background
> **So that** I can work in another tab and still stop and start on time
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

De-risks the background promise: proves the wake-up mechanism can exist in the shipped single file before anything is built on it.

## Inlined context

> Needs a spike: a Blob-URL worker must be confirmed to start when `index.html` is opened from `file://` in both target browsers, and the existing zero-network-requests e2e check (`test-e2e/durations.e2e.js:226`) must not count the `blob:` URL as a request (`sad.md` §11).
>
> — `adr/0001-wake-the-page-at-the-deadline-from-an-inline-worker.md, «Consequences → Negative», verbatim` · full text: [adr/](../adr/)

> Fallback: if constructing the worker throws (for example, workers are blocked), `createWakeup` falls back to a main-thread `setTimeout`. This is fail-soft per `CLAUDE.md`. The chime still plays, possibly late in a hidden tab.
>
> — `adr/0001, «Decision outcome → Shape», abridged` · full text: [adr/](../adr/)

> | Self-contained | 0 network requests, 0 audio files shipped | e2e (extends the existing self-contained-load check) |
>
> — `spec.md §6, «Self-contained», verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

— `data-model.md, «No schema change», verbatim` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 — happy path

> **Given** a phase is running in a desktop browser (§3), the timer's tab is in the background, and the device stays awake — for any length of time
> **When** the phase reaches its Phase completion
> **Then** the Completion chime is started within 1 second of that moment and never before it — "started" meaning the page has handed the tone to the browser's audio output; how soon the sound is then audible depends on the output device and the browser's audio start-up, which the page does not control — and by the time it starts the tab title already shows the next phase waiting for Start
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — authorization

> **Given** the User has granted the page no browser permissions
> **When** they use the timer, including in a background tab
> **Then** no permission prompt ever appears (no notifications, no microphone, nothing else); sound is enabled by the User's own press of Start, and nothing is fetched from anywhere
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write a throwaway page that builds a worker from a Blob URL and posts one message back after 50 ms; open it from `file://` in desktop Chrome (current stable) and record start / no-start next to ADR-0001 (Consequences).
- [ ] In the existing zero-network check (`test-e2e/durations.e2e.js:226`), exclude `blob:` URLs from the counted requests; keep every other URL counted. Add a positive control (a real `http:` request is still counted).
- [ ] If either browser refuses the Blob worker from `file://`, stop and record it as an ADR-0001 amendment before T7 starts.

## Edge cases

| Case | Behaviour |
|---|---|
| Browser blocks the Blob worker on `file://` | Recorded as an ADR-0001 amendment; T7 relies on the main-thread fallback there, with the late-chime limit documented. |
| `blob:` URL shows up in the request log | Excluded from the count only; an `http:`/`https:` request still fails the check. |

## Definition of Done

- [ ] Spike result for Chrome is written next to ADR-0001.
- [ ] Zero-network e2e check passes with a Blob worker present and still fails on a real network request (positive control).
