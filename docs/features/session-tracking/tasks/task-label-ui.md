---
id: T5
title: "Wire the task-label input: typing, placeholder, 100-char limit, commit-on-blur/Enter"
layer: "ui"
deps: ["T3", "T4"]
blocks: ["T7"]
acs: ["AC-01", "AC-01b", "AC-02", "AC-03"]
files_hint: ["src/ui/index.js", "src/styles.css", "index.html"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

# T5 — Wire the task-label input: typing, placeholder, 100-char limit, commit-on-blur/Enter

## Place in the sequence

- **Blocked by:** T3 — Field validation/fallback functions (calls the length-check function); T4 — Centralized write gatekeeper (commits through it, never directly). · **Blocks:** T7 — Edge-case test hardening. · **Wave:** 3 (parallel with T6 — both add markup/wiring to `mount()`, but touch distinct DOM elements; `implement` may still serialize them since both list `src/ui/index.js`).
- **Lane:** shares `src/ui/index.js` with T6 — serialized by `implement`.

## Why (user story)

> **As a** User
> **I want** to type a short label describing my current task
> **So that** I can remind myself what I'm focusing on during this session
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **As a** User
> **I want** the task label I last typed to still be there when I reopen or reload the page
> **So that** I don't have to retype it every time
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

This task builds the actual DOM input and its wiring: live typing (US-01), the placeholder/limit UI, and the blur/Enter commit that US-03's reload restore depends on.

## Inlined context

> Task-label commits on blur/Enter, not every keystroke — resolved during `clarify` after the first draft assumed live-save; user explicitly preferred blur/Enter.
>
> — `sad.md §4, Solution strategy point 8 (context), abridged` · full text: [sad.md](../sad.md)

> placeholder hint reads "What are you focusing on?" and the over-limit inline message reads "Task label is limited to 100 characters."
>
> — `sad.md §4, Solution strategy point 8, verbatim` · full text: [sad.md](../sad.md)

> Note over UI,Storage: overwrites whatever Storage currently holds — no read-before-write merge (ADR-0002)
>
> — `sad.md §6, «Task-label commit and reload restore», verbatim` · full text: [sad.md](../sad.md)

> | default | Page loaded or reloaded; task label pre-filled with the last-committed value (or empty) ... | ... `NEW:` Task label input ... |
> | empty | Task label currently holds no saved value — placeholder hint shown, disappearing the moment the User types (AC-01b) | `NEW:` Task label input (placeholder variant) |
> | validation | Task label field is at the 100-character limit; further typing/pasting is blocked and an inline message appears (AC-02) | `NEW:` Task label input, `NEW:` Inline validation message |
>
> — `screens.md, SCR-01 states table, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** a User is viewing the app
> **When** the User types text into the task label field
> **Then** the system displays exactly what they typed as the current task label
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-01b — happy path (empty state)

> **Given** the task label field currently holds no saved value
> **When** the User views it
> **Then** the system shows a placeholder hint inviting the User to describe what they're focusing on, and that hint disappears the moment the User types anything
>
> — `spec.md §5, AC-01b, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — error

> **Given** a User is typing into the task label field and it already holds 100 characters (measured as raw string length, not a visual-character count)
> **When** the User attempts to enter more text, whether by typing or pasting
> **Then** the system does not accept anything beyond the 100th character — the field never exceeds 100 characters, whether the attempt was one keystroke or a paste that would have pushed it over — and shows the User an inline message that the task label is limited to 100 characters
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — happy path

> **Given** a User saved a task label on a previous visit
> **When** the User reopens or reloads the page
> **Then** the system pre-fills the task label field with exactly that last-saved value
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add a text input to `mount()`'s DOM tree with placeholder `"What are you focusing on?"` — `src/ui/index.js`
- [ ] Wire `input`/`paste` handling through T3's length-check function; on rejection show the inline message `"Task label is limited to 100 characters."` — `src/ui/index.js`
- [ ] Wire `blur` and `Enter`-keydown to commit the current value through T4's centralized writer — `src/ui/index.js`
- [ ] On mount, pre-fill the field from T4's read function (last-committed value, or empty → placeholder shows) — `src/ui/index.js`
- [ ] Style the input and the inline limit message — `src/styles.css`
- [ ] Run `npm run build` and commit the regenerated `index.html` alongside — `index.html`

## Edge cases

| Case | Behaviour |
|---|---|
| Field cleared back to empty | Placeholder hint reappears (AC-01b) |
| User types then closes the tab without blurring/Enter | Next load shows the previously committed value, not the abandoned typing (`ux-flows.md` Flow US-03) |
| Paste that would push the field from 95 to 110 characters | Rejected in full via T3's function — field stays at 95, limit message shown |

## Definition of Done

- [ ] Manual check: typed text displays live, placeholder toggles correctly, 100-char hard stop holds for both typed and pasted input, reload restores the last-committed value
- [ ] Every Hard Rule inlined above still holds — commit is blur/Enter only, writes go only through T4's function
- [ ] lint + vet clean
