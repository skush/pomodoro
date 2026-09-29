---
id: T8
title: "Reserve fixed width for a 3-digit minute countdown so no control shifts"
layer: "ui"
deps: ["T5"]
blocks: ["T9"]
acs: []
files_hint: ["src/styles.css"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T8 — Reserve fixed width for a 3-digit minute countdown so no control shifts

## Place in the sequence

- **Blocked by:** T5 — Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation · **Blocks:** T9 — Rebuild index.html and run the manual NFR checks · **Wave:** 4.
- **Lane:** shares `src/styles.css` with T5 (serialized after it); parallel with T6/T7.

## Why (user story)

_No dedicated user story — this task delivers a non-functional requirement from spec §6._

Delivers the spec §6 "Display width" NFR: no surrounding control moves as the countdown crosses 100:00 → 99:59.

## Inlined context

> | Display width | Any phase type can reach a 3-digit minute value (up to 180); the countdown area reserves fixed width for the 3-digit case at all times, so no surrounding control ever shifts position — including mid-countdown as displayed minutes drop from 3 digits to 2 (e.g. 100:00 → 99:59) | manual check across the full 1–180 range, observed live through a 100→99 minute crossing |
>
> — `spec.md §6, NFR «Display width», verbatim` · full text: [spec.md](../spec.md)

> | Layout convention | The countdown display reserves fixed width for a 3-digit minute value (up to 180) at all times, so no surrounding control shifts position — including mid-countdown as displayed minutes cross from 3 digits to 2. A CSS/rendering detail, not an architectural decision — no ADR; verified manually per `spec.md` §6 NFR "Display width" | `spec.md` §6 NFR "Display width"; implementation detail for `screens`/`implement` |
>
> — `sad.md §8, Layout convention row, verbatim` · full text: [sad.md](../sad.md)

> **Screen contract (`screens.md`, SCR-01):** builds SCR-01 state **three-digit countdown**. Reuses Timer card, Phase label, Countdown display, Control buttons, Session count display, Inline validation message; the only new component is `Numeric setting field`.
>
> — `screens.md §Screens, SCR-01, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

_No spec §5 acceptance criterion maps to this task; its DoD is the NFR quoted under Inlined context._

## Checklist

- [ ] Give the Countdown display a fixed width sized for 3 minute digits (tabular-nums / `ch` width) so layout is stable across 180:00 … 0:00 — `src/styles.css`
- [ ] Check the layout at phone width as well as desktop — `src/styles.css`

## Edge cases

| Case | Behaviour |
|---|---|
| Countdown crosses 100:00 → 99:59 | Controls and fields do not move |
| Duration 1–9 minutes | Same reserved width; no jitter |

## Definition of Done

- [ ] Manual: observed live through a 100→99 minute crossing with no layout shift
- [ ] Every Hard Rule inlined above still holds
- [ ] `npm run lint` clean
