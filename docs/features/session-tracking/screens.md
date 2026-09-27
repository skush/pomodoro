---
status: draft
feature_size: "XS"
tool: "code"
updated_at: "2026-09-28"
---

# Screens — session-tracking

> The canonical **screen manifest** — every screen in every state — produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest** — never the raw Figma / `.pen` file.

## Source

- **Tool:** `code` — no `docs/design-system.md` exists yet (`ux-flows.md` already noted this and
  recommended `/sdd:design-system`; this run degrades the same way, named here rather than
  blocking). No fallback was actually needed — `code` is this project's real, deliberate posture
  (vanilla JS/CSS, `CLAUDE.md` "no framework"), not a degraded substitute for a Figma/Pencil MCP.
- **File:** inline wireframes below.
- **Component reuse baseline:** no formal `docs/design-system.md` inventory exists, so this
  manifest reuses the actual shipped DOM elements from `src/ui/index.js` (`mount()`) by name —
  Timer card, Phase label, Countdown display, Control buttons — as the *existing* set. Only the
  pieces session-tracking itself introduces are marked `NEW:` below.

## Screens

### SCR-01 — Timer screen

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Page loaded or reloaded; task label pre-filled with the last-committed value (or empty), today's completed-session count shown as its rollover-checked, currently-saved value (AC-03, AC-04b; `sad.md` §6 Flow 4) | Timer card, Phase label, Countdown display, Control buttons (Start/Pause/Reset), `NEW:` Task label input, `NEW:` Session count display | wireframe below |
| empty | Task label currently holds no saved value — placeholder hint shown, disappearing the moment the User types (AC-01b; `sad.md` §6 Flow 3) | `NEW:` Task label input (placeholder variant) | wireframe below |
| validation | Task label field is at the 100-character limit; further typing/pasting is blocked and an inline message appears (AC-02; `sad.md` §6 Flow 3) | `NEW:` Task label input, `NEW:` Inline validation message | wireframe below |
| loading | N/A — the page load is a synchronous `localStorage` read with zero network requests; there is no perceptible loading interval to show a state for (`spec.md` §6 NFR "Self-contained load") | — | — |
| error | N/A — storage reads and writes are fail-soft and silent by design (`sad.md` §8 Error handling; §2 Conventions): a corrupted/missing field falls back to its own default, and a failed write leaves the app running in-memory with nothing shown to the User (`spec.md` §6 NFR "Corrupted or missing persisted state", "Storage write failure"). The one User-visible rejection this feature has is the `validation` state above, not an error banner | — | — |

```text
+----------------------------------------------------+
| SCR-01 — default                                    |
|                                                      |
|   Focus                                             |
|   24:59                                             |
|                                                      |
|   [ Start ]  [ Pause ]  [ Reset ]                    |
|                                                      |
|   Task label: [ Write the proposal draft         ]   |
|                                                      |
|   Today's completed sessions: 3                     |
+----------------------------------------------------+
```

```text
+----------------------------------------------------+
| SCR-01 — empty (task label)                         |
|                                                      |
|   Focus                                             |
|   24:59                                             |
|                                                      |
|   [ Start ]  [ Pause ]  [ Reset ]                    |
|                                                      |
|   Task label: [ What are you focusing on?        ]   |
|                (placeholder, disappears on typing)   |
|                                                      |
|   Today's completed sessions: 0                      |
+----------------------------------------------------+
```

```text
+----------------------------------------------------+
| SCR-01 — validation (task label at limit)            |
|                                                      |
|   Focus                                             |
|   24:59                                             |
|                                                      |
|   [ Start ]  [ Pause ]  [ Reset ]                    |
|                                                      |
|   Task label: [ <100 characters, cannot type more> ] |
|   Task label is limited to 100 characters.           |
|                                                      |
|   Today's completed sessions: 3                      |
+----------------------------------------------------+
```

## New components

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| Task label input | core-timer's shipped UI has no text input at all — only the phase label, countdown, and three control buttons; this is the first free-text field in the app | pending — no `docs/design-system.md` exists yet; `implement` should register it once that canon is created |
| Session count display | core-timer's shipped UI has no numeric stat display; the countdown is a duration string, not a count | pending — same as above |
| Inline validation message | core-timer's shipped UI has no inline field-level message; distinct from a page-level error banner (this feature has no error-banner state — see SCR-01's `error` row) | pending — same as above |
