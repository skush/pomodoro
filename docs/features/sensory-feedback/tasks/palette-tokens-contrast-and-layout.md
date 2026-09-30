---
id: T4
title: "Add the ring, notice and focus palette tokens, reduced-motion and 320px layout rules, and a contrast unit test"
layer: "ui"
deps: []
blocks: ["T5", "T8"]
acs: ["AC-03", "AC-13"]
files_hint: ["src/styles.css", "test/logic/contrast.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"   # measured: 42 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T4 — Add the ring, notice and focus palette tokens, reduced-motion and 320px layout rules, and a contrast unit test

## Place in the sequence

- **Blocked by:** none · **Blocks:** T5 — Build the Progress ring component (inline SVG track + arc); T8 — Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() · **Wave:** 1, no dependencies, can start immediately.
- **Lane:** shares files with T8 via `src/styles.css` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** the whole page to share one readable dark palette and fit a phone-width screen
> **So that** the timer is comfortable to read in any lighting and on any device
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

Provides the one dark palette (a ring colour per phase, track, notice, focus indicator) and the layout rules that make the page readable and 320 px safe.

## Inlined context

> `styles.css` <new :root tokens: one ring colour per phase type + the ring track + the notice colours + a focus-indicator colour; a short ring transition, removed entirely under @media (prefers-reduced-motion: reduce); layout checked at 320 CSS px.>
>
> — `sad.md §5, «src/styles.css», abridged` · full text: [sad.md](../sad.md)

> | Text contrast | ≥ 4.5:1 for normal text, ≥ 3:1 for large text (WCAG AA) for all text — including placeholders, validation messages and the sound-unavailable notice; only disabled controls are exempt, as in WCAG | automated (unit) contrast check over the declared text-on-background palette token pairs |
> | Non-text contrast | each phase's ring colour, and focus indicators, ≥ 3:1 against the background; the ring's remaining arc ≥ 3:1 against its elapsed track, for each phase colour (WCAG AA) | automated contrast check over the palette |
> | Phone width | 0 px horizontal overflow at 320 CSS px, with a three-digit countdown and every notice or validation message shown | e2e viewport check |
> | Reduced motion | when the User's system asks for reduced motion: 0 animated ring transitions — covering the depletion, the refill to full on Reset or a newly loaded phase, and the colour change between phases; the ring changes at most once per second, in discrete steps | e2e with the reduced-motion preference emulated |
>
> — `spec.md §6, rows «Text contrast», «Non-text contrast», «Phone width», «Reduced motion», verbatim` · full text: [spec.md](../spec.md)

> Dark-only CSS custom properties on `:root` in `src/styles.css`, extended with one ring colour per phase type, the ring track colour, the notice colours and a focus-indicator colour. `src/styles.css` stays the single token source; the contrast unit test reads the tokens from it, not from a copy
>
> — `sad.md §8, «Design tokens / theming», verbatim` · full text: [sad.md](../sad.md)

> `:root` today: `--bg #121212`, `--fg #eaeaea`, `--muted #9a9a9a`, `--accent #eaeaea`, `--control-bg #1e1e1e`, `--control-border #333`.
>
> — `src/styles.css lines 1-8 (HEAD), abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

— `data-model.md, «No schema change», verbatim` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-03 — happy path

> **Given** any phase is shown, in any state
> **When** the User looks at the page
> **Then** the ring shows that phase type's own colour — different from the other two phase types — and the phase name is still shown as text, so the phase can be identified without relying on colour — the text is the required way to tell the phases apart; the colour is an extra cue
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — happy path

> **Given** the page is shown on a phone-width screen, down to 320 CSS pixels wide
> **When** the User views any timer state, including a three-digit countdown
> **Then** every visible element of the page — the ring, countdown, phase name, controls, settings fields, Session counter, Task label, any validation message and the sound-unavailable notice (AC-11) — is visible and usable without horizontal scrolling or overlapping
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/styles.css`: add `:root` tokens for the three ring colours, the ring track, the notice text/background, and the focus indicator; add `[data-phase]`-mapped ring rules, the notice style, and a short `stroke-dashoffset`/colour transition, with `@media (prefers-reduced-motion: reduce)` removing every ring transition.
- [ ] `src/styles.css`: make the layout hold at 320 CSS px with a three-digit countdown and every notice/validation message visible (no horizontal overflow, no overlap).
- [ ] `test/logic/contrast.test.js`: parse the `:root` tokens from `src/styles.css` (not a copy) and assert ≥ 4.5:1 for every declared normal-text pair incl. the notice and validation message, ≥ 3:1 for each ring colour and the focus indicator against `--bg`, and ≥ 3:1 for each ring colour against the ring track.

## Edge cases

| Case | Behaviour |
|---|---|
| Three-digit countdown at 320 CSS px | No horizontal scroll, no overlap. |
| Validation message and sound-unavailable notice both shown at 320 px | Both fully visible, no overlap. |
| Reduced motion on | No ring transition of any kind. |
| Two phases share a similar hue | Phase name text is still the required distinguisher; colours must still differ per phase type (AC-03). |

## Definition of Done

- [ ] `test/logic/contrast.test.js` passes for all declared pairs.
- [ ] The three ring colours are pairwise different.
- [ ] Reduced-motion rule present and removes all ring transitions (verified end to end in T11).
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
