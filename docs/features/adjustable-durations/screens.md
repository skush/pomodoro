---
status: draft
feature_size: "S"
tool: "code"
updated_at: "2026-09-29"
---

# Screens — adjustable-durations

> The canonical **screen manifest** — every screen in every state — produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest** — never the raw Figma / `.pen` file.

## Source

- **Tool:** `code` — no `docs/design-system.md` exists (same posture as core-timer and
  session-tracking; `code` is this project's deliberate stack, not a degradation from a missing MCP).
- **File:** inline wireframes below.
- **Component reuse baseline:** the shipped DOM from `src/ui/index.js` `mount()` plus session-tracking's
  components — Timer card, Phase label, Countdown display, Control buttons (Start/Pause/Reset), Task
  label input, Session count display, Inline validation message.
- **Layout placement** of the four fields within SCR-01 is a wireframe suggestion, not a locked
  decision; `implement` may adjust spacing so long as the manifest's states and components hold.

## Screens

### SCR-01 — Timer screen

No new screen: this feature adds a settings group to the existing single screen (`ux-flows.md`).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Page loaded/reloaded (or a phase type is about to start fresh): each duration field and the cycle-length field pre-filled with the Configured value in effect — last committed, or the classic default 25/5/15/4 if never committed or storage was corrected and written back (AC-06, AC-09, AC-12, AC-14; `sad.md` §6 Flow 3) | Timer card, Phase label, Countdown display, Control buttons, Task label input, Session count display, `NEW:` Numeric setting field ×4 (Focus, Short break, Long break, Cycle length) | wireframe 1 |
| idle-updated | Committed a valid duration for the phase type currently idle: the idle countdown shows the new value at once (AC-01, AC-03; Flow 1) | Countdown display, `NEW:` Numeric setting field | wireframe 2 |
| running-or-paused-unchanged | Committed a valid duration for the phase type that is running or paused: countdown / frozen time is unchanged; field shows the new value, applied at the next fresh start. Reset then shows the current Configured duration (AC-04, AC-04b, AC-05; Flows 1, 2) | Countdown display, Control buttons, `NEW:` Numeric setting field | wireframe 3 |
| validation (duration) | Committed a value that is not a strict whole number in 1–180: field reverts to the last valid value, inline message states the 1–180 range (AC-02; Flow 1) | `NEW:` Numeric setting field, Inline validation message | wireframe 4 |
| validation (cycle length) | Committed a value that is not a strict whole number in 2–8: field reverts, inline message states the 2–8 range (AC-11; Flow 4) | `NEW:` Numeric setting field, Inline validation message | wireframe 4 |
| success (cycle length) | Committed a valid cycle length: field shows it; count display and in-cycle count untouched; it governs the next Long-break decision (AC-07, AC-10, AC-13; Flow 4) | `NEW:` Numeric setting field, Session count display | wireframe 1 |
| three-digit countdown | Any phase type set to 100–180 min: the Countdown display reserves fixed width for 3 minute digits so no control shifts, incl. across 100:00 → 99:59 (spec §6 NFR "Display width") | Countdown display | wireframe 5 |
| loading | N/A — synchronous `localStorage` read, zero network requests (`spec.md` §6 NFR "Self-contained load") | — | — |
| empty | N/A — a field always holds a value: an absent/invalid stored value falls back to the classic default (AC-06/AC-12), and an empty *commit* is a validation rejection, not a resting state | — | — |
| error | N/A — storage reads/writes are fail-soft and silent (`sad.md` §8; CLAUDE.md conventions); a corrupted stored value is corrected without any User-visible message. Foreign writes (AC-08, Flow 5) have no UI. The only User-visible rejection is `validation` above | — | — |

```text
wireframe 1 — default / cycle-length success
+----------------------------------------------------+
|   Focus                                            |
|   25:00                                            |
|                                                    |
|   [ Start ]  [ Pause ]  [ Reset ]                  |
|                                                    |
|   Task label: [ Write the proposal draft        ]  |
|   Today's completed sessions: 3                    |
|                                                    |
|   Durations (minutes)                              |
|   Focus [ 25 ]  Short break [ 5 ]  Long break [ 15 ]|
|   Focus sessions before a long break: [ 4 ]        |
+----------------------------------------------------+
```

```text
wireframe 2 — idle-updated (Focus committed 25 -> 50 while idle)
|   Focus                                            |
|   50:00      <- updated immediately                |
|   Focus [ 50 ]  Short break [ 5 ]  Long break [ 15 ]|
```

```text
wireframe 3 — running-or-paused-unchanged (Focus committed 25 -> 50 mid-run)
|   Focus                                            |
|   17:42      <- keeps counting / stays frozen      |
|   Focus [ 50 ]  ...   (applies at next fresh start)|
```

```text
wireframe 4 — validation
|   Focus [ 25 ]  Short break [ 5 ]  Long break [ 15 ]|
|   Enter a whole number from 1 to 180.   (duration) |
|   -- or --                                         |
|   Focus sessions before a long break: [ 4 ]        |
|   Enter a whole number from 2 to 8.     (cycle)    |
```

```text
wireframe 5 — three-digit countdown (fixed width)
|   Focus                                            |
|   100:00  ->  99:59   (controls do not move)       |
```

## New components

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| Numeric setting field | Task label input is free-text with a per-keystroke length cap; these four fields are labelled whole-number inputs committing only on blur/Enter, validated against a min–max range, reverting on rejection (sad.md §4 decision 7). One component instantiated four times (three durations + cycle length), reusing Inline validation message for its rejection text | pending — no `docs/design-system.md` exists yet; `implement` should register it once that canon is created |
