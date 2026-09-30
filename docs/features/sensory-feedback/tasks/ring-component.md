---
id: T5
title: "Build the Progress ring component (inline SVG track + arc)"
layer: "ui"
deps: ["T3", "T4"]
blocks: ["T8"]
acs: ["AC-01", "AC-02", "AC-03"]
files_hint: ["src/ui/ring.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"   # measured: 45 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T5 — Build the Progress ring component (inline SVG track + arc)

## Place in the sequence

- **Blocked by:** T3 — Add the pure cue rules: tone data, ringFraction and tabTitle; T4 — Add the ring, notice and focus palette tokens, reduced-motion and 320px layout rules, and a contrast unit test · **Blocks:** T8 — Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() · **Wave:** 3, after its dependencies.
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** a ring that depletes as the current phase runs
> **So that** I can tell how much of the phase is left without reading the digits
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

Provides the ring element that shows how much of the phase is left, in the phase's own colour.

## Inlined context

> `ring.js` <NEW: createRing() → {element, update(fraction, phase)}. It is an inline SVG track + arc; the arc length is set through stroke-dashoffset, and the phase colour through a data-phase attribute mapped to CSS tokens.>
>
> — `sad.md §5, «src/ui/ring.js», verbatim` · full text: [sad.md](../sad.md)

> The ring changes once per second (ringFraction steps with the displayed second). A short transition smooths each step. Under `prefers-reduced-motion: reduce`, all ring transitions (depletion, refill, colour change) are removed
>
> — `sad.md §8, «Motion», abridged` · full text: [sad.md](../sad.md)

> Phase name stays visible text (colour is an extra cue, AC-03).
>
> — `sad.md §8, «Accessibility», abridged` · full text: [sad.md](../sad.md)

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

### AC-03 — happy path

> **Given** any phase is shown, in any state
> **When** the User looks at the page
> **Then** the ring shows that phase type's own colour — different from the other two phase types — and the phase name is still shown as text, so the phase can be identified without relying on colour — the text is the required way to tell the phases apart; the colour is an extra cue
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/ui/ring.js`: `createRing()` returns `{element, update(fraction, phase)}`; SVG track + arc, `stroke-dashoffset` from the fraction, `data-phase` attribute for colour.
- [ ] Clamp `fraction` to [0, 1] and ignore unknown phases (fail-soft, never throw).
- [ ] Unit-test `update` against a minimal fake element if `ring.js` can be imported under Node; otherwise it is verified through T11.

## Edge cases

| Case | Behaviour |
|---|---|
| Fraction below 0 or above 1, or NaN | Clamped to [0, 1]; NaN treated as 1 (full); no throw. |
| Unknown phase value | Keeps the previous colour; no throw. |
| Reduced motion | Handled in CSS (T4); this module never animates in JS. |

## Definition of Done

- [ ] `createRing().update()` sets the arc length and `data-phase` as specified.
- [ ] No JS animation, no DOM outside its own element.
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
