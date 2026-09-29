---
status: Draft
owner: "sergii.kushnir@gmail.com"
reviewers: ["Tech Lead"]
updated_at: "2026-09-29"
feature_size: "S"
---

# Spec — adjustable-durations

> **Glossary:** [CONTEXT](../../../CONTEXT.md), [feature CONTEXT](./CONTEXT.md)
> **Reference module / docs / channels used:** `docs/idea-brief.md` §7/§8, `docs/roadmap.md` step 4 + open decision D1, `docs/architecture-map.md`, and `docs/features/{core-timer,session-tracking}/{spec.md,sad.md,adr/*}` for the established wall-clock-deadline engine and write-guard patterns this spec extends. Ideation: a `researcher` competitive pass and a `devils-advocate` failure-mode pass (medium depth), both cited in §1 ¶3.

## 1. Context

core-timer and session-tracking shipped a trustworthy fixed-cadence timer (25/5/15 minutes) with a daily completed-session count. A User whose own focus rhythm doesn't match the classic Pomodoro numbers — someone who prefers 50-minute deep-work blocks, or a 10-minute break — currently has no way to adjust that without editing the source and rebuilding. This step lets the User configure their own Focus/Short-break/Long-break durations and their own cycle length, persisted like the task label, while keeping the engine's existing correctness guarantees intact.

There's no external trigger — this is the next unblocked roadmap step (`docs/roadmap.md` step 4), now that session-tracking is shipped; `docs/idea-brief.md` §7 named adjustable durations as part of the original recommendation.

The committed approach: each phase type gets a **Configured duration** (see `CONTEXT.md`) that the User sets and commits (blur/Enter, same discipline as the task label), restricted to a strict whole number of minutes from 1 to 180 — the same range for all three phase types, kept uniform for simplicity — a commit outside that range, or not a whole number at all, is rejected outright and reverts to the last valid value, the same discipline the task label already uses for its own limit. It's persisted in this browser's local storage and read wherever the engine currently reads a hardcoded constant; storage is re-read and re-validated at page load and again before each fresh start, so an invalid or out-of-range stored value (however it got there) is always corrected — falling back to that phase type's classic default — before it could ever be used. Alongside per-phase durations, the classic 4-focus cadence itself becomes configurable: a **Configured cycle length** (2–8 Focus sessions before a Long break, default 4, same commit/reject/persistence discipline) replaces the fixed 4 — unlike a duration change, a cycle-length change applies immediately, including to whatever cycle is currently in progress, since it only changes a comparison threshold rather than disrupting a countdown already running. A `researcher` competitive pass found that no comparable app publicly documents this running/paused-timer edge case at all (competitors are either silent or avoid it entirely, e.g. offering only a post-completion "extend" action) — our explicit, tested rule is the differentiator. A `devils-advocate` failure-mode pass surfaced the sharpest risk this spec must close: a corrupted, zero, or non-numeric stored duration must never let a phase complete instantly and silently inflate the daily count — §5 AC-06 makes this a hard, tested invariant, the same fallback discipline session-tracking already applies to its own stored fields.

A duration or cycle-length commit is a new kind of input that changes the timer engine's own state (an idle phase's effective duration) outside of Start/Pause/Reset. This extends core-timer's control-guard (`docs/features/core-timer/adr/0002-structural-encapsulation-control-guard.md`): a commit, triggered only by this page's own UI and never by an external channel, is a legitimate fourth input alongside the original three — the guard's real intent (no message-driven or cross-tab tampering) is preserved, not weakened.

`docs/roadmap.md`'s open decision D1 ("does changing a duration mid-session restart the current phase, or finish it at the old value?") is resolved here: **it finishes at the old value** — matching this spec's §5 AC-04/AC-05 and the "no chain of unattended transitions" philosophy core-timer's engine already follows. `CONTEXT.md`'s new "Configured duration" term (added alongside this spec) is what §5 formalizes as testable, business-observable behavior.

## 2. Goals

- A User can set their own Focus/Short-break/Long-break durations (1–180 minutes each), and the app uses those values instead of the fixed 25/5/15 the next time each phase type starts.
- A User can set their own number of Focus sessions before a Long break (2–8, default 4), replacing the fixed classic cadence.
- A duration change is predictable: it never disrupts a phase already running or paused, but an idle phase reflects a new duration the moment it's committed. A cycle-length change, in contrast, takes effect immediately, including for a cycle already in progress.
- The engine's existing correctness guarantees (accurate wall-clock countdown, the daily completed-session count, the single-writer storage guard) keep holding exactly as before, unaffected by whatever durations or cycle length the User has configured.

## 3. Non-goals

- **Preset duration profiles** (quick-select buttons for common combinations like 50/10/20) — this step is free-form numeric input only; presets are a UX nicety for later.
- **Reinterpreting what "today's completed sessions" means when Focus duration changes** — the existing session-tracking count (`docs/features/session-tracking/spec.md`) continues to mean exactly one increment per naturally-completed Focus phase, regardless of its configured length; no weighting or duration-aware scoring is introduced.
- **Cross-device/cloud sync of configured durations** — inherited from the no-backend decision (`docs/adr/0002-no-backend-for-v1.md`); local-browser-only, same as every other persisted value in this app.

## 4. User stories

### US-01: Set my own durations

**As a** User
**I want** to set my own Focus, Short-break, and Long-break durations
**So that** the timer matches my own work rhythm instead of the fixed classic numbers

### US-02: Trust a running phase isn't disrupted

**As a** User
**I want** a duration change to leave a phase I'm currently running untouched
**So that** editing my settings never causes a surprise countdown jump mid-session

### US-03: See my configured settings after reload

**As a** User
**I want** my custom durations and cycle length to still be set when I reopen or reload the page
**So that** I don't have to re-enter them every time

### US-04: See an idle phase reflect my latest change immediately

**As a** User
**I want** an idle phase's displayed duration to update the moment I commit a new value
**So that** I can see and confirm what I just set before starting it

### US-05: Trust a paused phase keeps its frozen time

**As a** User
**I want** a phase I've paused to keep exactly the time it had left, even if I then change that phase type's duration
**So that** resuming picks up exactly where I left off, never at a jumped-to value

### US-06: Trust a bad stored duration can't be gamed

**As a** User
**I want** a corrupted or invalid stored duration to never let a phase complete instantly
**So that** my daily count stays trustworthy no matter what ends up in storage

### US-07: Trust my progress isn't disturbed by a settings change

**As a** User
**I want** changing a duration to leave my current cycle position and today's completed-session count exactly as they were
**So that** adjusting my settings never costs me progress I've already made

### US-08: Trust nothing but my own edits change what's saved

**As a** User
**I want** the saved configured durations and cycle length to change only because of my own committed edits
**So that** I can rely on what the app shows me as accurate

### US-09: Set my own cycle length

**As a** User
**I want** to set how many Focus sessions happen before a Long break (2–8)
**So that** the cadence matches how I actually like to work, not just the classic 4

### US-10: Trust a cycle-length change is applied consistently, even mid-cycle

**As a** User
**I want** a cycle-length change to be reflected in the very next Long-break decision, even if I'm partway through the current cycle
**So that** the setting I just changed to takes effect right away, without a confusing delay

## 5. Acceptance criteria

*A value is a valid whole number only in its strict form: an optional leading `-` followed only by digits — no decimal point, no letters, no exponent notation, no surrounding non-digit characters. A cleanly-formed but out-of-range number (e.g. `500`, `-5`) is still a valid whole number for AC-02/AC-11's purposes; `12.5`, `25abc`, `1e2`, and empty/non-numeric text are not valid whole numbers at all, for AC-06/AC-12's purposes.*

### AC-01 (US-01) — happy path

**Given** a User is viewing the app with a phase type currently idle
**When** the User types a new duration for that phase type — a whole number of minutes, 1–180, the same range for every phase type — and commits it (blurs the field or presses Enter)
**Then** the system saves that as the phase type's Configured duration, and the next time that phase type starts fresh, it runs for exactly that long

### AC-02 (US-01) — error

**Given** a User commits a duration value that is not a valid whole number in the 1–180 minute range (out of range, non-numeric, empty, decimal, or otherwise not a strict whole number)
**When** that commit happens
**Then** the system rejects it outright — the field reverts to the last validly committed Configured duration for that phase type, unchanged — and shows the User an inline message stating the valid 1–180 range

### AC-03 (US-04) — happy path (idle immediate update)

**Given** a phase type is currently idle, displaying its previous Configured duration
**When** the User commits a new Configured duration for that same phase type
**Then** the system updates that phase's idle display to the new duration immediately, without requiring the User to start it first

### AC-04 (US-02) — domain invariant

**Given** a phase is currently running
**When** the User commits a new Configured duration for that same phase type
**Then** the system does not alter the running phase's remaining time in any way — it keeps counting down exactly as it was — and the new duration only takes effect the next time that phase type starts fresh

### AC-04b (US-02) — domain invariant (Reset)

**Given** the User changed a phase type's Configured duration while that phase was running or paused, per AC-04/AC-05
**When** the User then presses Reset
**Then** the now-idle phase reflects the current Configured duration (not whatever duration it was running or paused with) — Reset returns the phase to its fresh, idle state, and idle always shows the currently configured value, the same as AC-03

### AC-05 (US-05) — domain invariant

**Given** a phase is currently paused, with a specific amount of time frozen as its remaining time
**When** the User commits a new Configured duration for that same phase type
**Then** the system leaves the paused phase's frozen remaining time exactly as it was, so resuming continues counting down from that same frozen value, and the new duration only takes effect the next time that phase type starts fresh

### AC-06 (US-06) — domain invariant

**Given** a stored duration value for a phase type — encountered on page load or before that phase type would start fresh — is not a valid whole number in the 1–180 range (missing, malformed, non-numeric, decimal, or out of range)
**When** the system encounters it
**Then** the system treats it as no valid Configured duration, falls back to that phase type's classic default (Focus 25 minutes, Short break 5 minutes, Long break 15 minutes), and writes that default back to storage immediately — under no circumstance does an invalid stored value let a phase complete faster than its own valid minimum, or complete instantly

### AC-07 (US-07) — cross-context

**Given** a User commits a new Configured duration or Configured cycle length
**When** that commit happens
**Then** the system leaves the in-cycle focus count and today's completed-session count (`docs/features/session-tracking/spec.md`) exactly as they were at that moment — a commit never advances, resets, or otherwise alters progress already made (AC-13 separately governs how a new cycle length shapes the *next* Long-break decision, a distinct point in time from the commit itself)

### AC-08 (US-08) — authorization

**Given** the app's saved Configured durations and Configured cycle length
**When** a write attempt to any of those values arrives from anything other than this app's own duration-commit action, cycle-length-commit action, or its own load-time/pre-start correction (AC-06/AC-12) — for example a message from another tab or origin, a change made in another same-origin tab, or a devtools edit
**Then** the system's write guard ignores that attempt as a trigger for its own logic, and the next time one of those three legitimate paths writes, it writes the full current in-memory state of all four settings together (all three durations plus the cycle length) — overwriting, never adopting, whatever had been saved in the meantime, even for the settings that particular write wasn't specifically about. This extends, but does not widen, session-tracking's existing write guard (`docs/features/session-tracking/spec.md` AC-07): the daily count, tracked date, and task label remain writable only by their own three existing triggers, unaffected by duration or cycle-length commits, exactly as before

### AC-09 (US-03) — happy path

**Given** a User previously committed custom durations for one or more phase types
**When** the User reopens or reloads the page
**Then** the system pre-fills each phase type's duration field with exactly the Configured duration currently in effect — its last-committed value, or the classic default if none was ever validly committed or storage needed correcting (AC-06)

### AC-10 (US-09) — happy path

**Given** a User is viewing the app
**When** the User types a new cycle length — a whole number, 2–8 — and commits it (blurs the field or presses Enter)
**Then** the system saves that as the Configured cycle length, and it governs every Long-break decision from that point forward

### AC-11 (US-09) — error

**Given** a User commits a cycle-length value that is not a valid whole number in the 2–8 range (out of range, non-numeric, empty, decimal, or otherwise not a strict whole number)
**When** that commit happens
**Then** the system rejects it outright — the field reverts to the last validly committed Configured cycle length, unchanged — and shows the User an inline message stating the valid 2–8 range

### AC-12 (US-09) — domain invariant

**Given** a stored cycle-length value — encountered on page load — is not a valid whole number in the 2–8 range (missing, malformed, non-numeric, decimal, or out of range)
**When** the system encounters it
**Then** the system treats it as no valid Configured cycle length, falls back to the classic default of 4, and writes that default back to storage immediately

### AC-13 (US-10) — cross-context

**Given** a cycle is already in progress, with some number of Focus sessions already completed toward the Long break (the in-cycle focus count)
**When** the User commits a new Configured cycle length before the next Focus session completes
**Then** committing it alone changes nothing yet — it does not retroactively trigger a Long break and does not alter or reset the in-cycle focus count — but the next Focus session to complete naturally is decided against the newly committed cycle length: if the in-cycle focus count (including that just-completed session) has now reached or passed it, a Long break follows next, exactly as if that had always been the configured length; otherwise a Short break follows as usual

### AC-14 (US-03) — happy path

**Given** a User previously committed a custom cycle length
**When** the User reopens or reloads the page
**Then** the system pre-fills the cycle-length field with exactly the Configured cycle length currently in effect — its last-committed value, or the classic default of 4 if none was ever validly committed or storage needed correcting (AC-12)

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Duration bounds | Every Configured duration stays within 1–180 minutes at all times, for every phase type, whether freshly typed, freshly loaded, or previously corrupted — 0 exceptions | unit test on the validation function |
| Commit discipline | A duration or cycle-length field's value applies (to display, storage, and the engine) only on blur/Enter, never on an intermediate keystroke while the User is still editing | manual check, mirroring session-tracking's task-label commit check |
| Running/paused isolation | 100% of duration commits while that same phase type is running or paused leave its current remaining time byte-for-byte unchanged (AC-04/AC-05); a commit while idle updates the display immediately instead (AC-03); Reset after such a change shows the current Configured duration, not the one that was running (AC-04b) — all three behaviors verified | unit test |
| Corrupted/missing persisted duration | Each phase type's Configured duration falls back to its own classic default on any stored value that isn't a valid whole number in 1–180 (missing key, malformed value, non-numeric, decimal, or out of range — AC-06), immediately written back to storage — 0 thrown exceptions, 0 instant completions | unit test with invalid stored data |
| Duration persistence | Configured durations survive 100% of a full browser close-and-reopen cycle, with 0 data loss, until the User clears site data | manual check: close and reopen the browser |
| Display width | Any phase type can reach a 3-digit minute value (up to 180); the countdown area reserves fixed width for the 3-digit case at all times, so no surrounding control ever shifts position — including mid-countdown as displayed minutes drop from 3 digits to 2 (e.g. 100:00 → 99:59) | manual check across the full 1–180 range, observed live through a 100→99 minute crossing |
| Cycle-length bounds | The Configured cycle length stays within 2–8 at all times, whether freshly typed, freshly loaded, or previously corrupted — 0 exceptions | unit test on the validation function |
| Cycle-length persistence + fallback | Configured cycle length survives 100% of a full browser close-and-reopen cycle with 0 data loss (AC-14), and falls back to 4 — written back to storage immediately — on any stored value that isn't a valid whole number in 2–8 (AC-12) — 0 thrown exceptions | manual check (close/reopen) + unit test with invalid stored data |
| Self-contained load | Zero network requests beyond the initial `index.html` load (unchanged from core-timer/session-tracking) | manual check via the browser devtools Network tab |

## 6.1 Security / privacy

- **Data classification:** internal — persisted only in this browser's local storage; nothing is transmitted anywhere.
- **Personal data touched:** none — durations are plain numeric preferences, not personal data.
- **AuthZ/AuthN impact:** none — single local User, no accounts; the only boundary is the AC-08 write guard on the duration and cycle-length keys (only this app's own duration-commit, cycle-length-commit, and load-time/pre-start correction actions trigger its own logic there; each of those three writes the full current in-memory state of all four settings, overwriting whatever it finds saved) — a boundary kept separate from, and not widening, session-tracking's existing AC-07 write guard on the count/date/label keys.
- **Abuse cases:**
  - a message from another tab or origin attempting to write a Configured duration or cycle length: ignored as a trigger, denied by the AC-08 guard, reinforced by (not resting solely on) the browser's own execution-context isolation.
  - two tabs of this same app open at once, each independently committing different durations or cycle lengths to the same shared local storage: each tab's own next legitimate write (AC-08) writes its own full in-memory state (all four settings), overwriting whatever the other tab left behind — no reconciliation between tabs is attempted; accepted as the same known edge case session-tracking already accepts for its own count/label (`docs/features/session-tracking/spec.md` §6.1), extended here to durations and cycle length.
  - a User editing local storage directly via devtools to set an extreme or invalid duration or cycle length: picked up passively at the next read point (page load, or before that phase type starts fresh) like any other stored value — a numeric value within range (exactly 1 or 180 minutes, or exactly 2 or 8 sessions) is valid and honored, by design; anything else falls back to the classic default and is written back (AC-06/AC-12) — never able to produce an instant or zero-length completion, or a cycle length outside 2–8.
- **Security review:** N/A — no backend, no accounts, no persisted or transmitted data beyond this browser's own local storage (same reasoning as core-timer and session-tracking).

## 7. Metrics / KPIs

- **Duration-change isolation correctness** — baseline: unverified (0), target: 100% of running/paused/idle duration-change cases pass their NFR unit tests before this step is marked done.
- **Corrupted-duration fallback safety** — baseline: unverified (0), target: 0 instant or sub-minimum completions producible from any invalid stored duration value, confirmed via unit test before this step is marked done.
- **Duration + cycle-length round-trip persistence** — baseline: unverified (0), target: committed durations and cycle length confirmed to survive a full page reload before this step is marked done.
- **Cycle-length change correctness** — baseline: unverified (0), target: a mid-cycle cycle-length change confirmed via unit test to be evaluated against the new value on the very next Focus completion, without altering the in-cycle focus count itself, before this step is marked done.

## 8. Open questions

- [ ] Should quick-select duration presets be added alongside free-form input? Default now: free-form numeric input only. — owner: sergii.kushnir@gmail.com, due: before `design`, if reconsidered.
- [ ] Is the accepted multi-tab non-reconciliation gap (§6.1) worth solving generally across this app's whole storage layer, rather than accepting it per-feature? Default now: same accepted gap as session-tracking, unchanged. — owner: sergii.kushnir@gmail.com, due: before a future step that adds a second write surface (e.g. cross-device sync), if one is ever added — same trigger session-tracking's own §6.1 already names for this gap.

## Test plan

Levels: **unit** (pure engine + validation logic, in-memory storage fake), **e2e-through-UI** (flows driven through the real rendered page in a headless browser). Integration, contract, load: N/A (no separate datastore or boundary — see below).

### AC coverage

| AC | Test name | Level | Expected outcome |
|---|---|---|---|
| AC-01 happy | valid duration commit is saved and used on next fresh start | unit + e2e-through-UI | Stored value equals the typed value; next fresh phase of that type counts down from exactly that length |
| AC-02 error | invalid duration commit is rejected and reverts | unit + e2e-through-UI | Field shows the last valid value, nothing saved, inline message names the 1–180 range |
| AC-03 idle update | idle phase display updates on commit | unit + e2e-through-UI | Idle countdown shows the new duration immediately, without pressing Start |
| AC-04 invariant | running phase is untouched by a duration commit | unit + e2e-through-UI | Remaining time keeps counting down unchanged; new value applies only at the next fresh start |
| AC-04b invariant | Reset after a mid-phase duration change shows the current configured value | unit | Idle phase after Reset shows the newly configured duration, not the one it ran with |
| AC-05 invariant | paused phase keeps its frozen time after a duration commit | unit + e2e-through-UI | Resume continues from the same frozen remaining time |
| AC-06 invariant | invalid stored duration falls back to the classic default and is written back | unit | Focus 25 / Short 5 / Long 15 used and saved; no instant or sub-minimum completion; no exception |
| AC-07 cross-context | committing a setting leaves cycle position and daily count alone | unit | In-cycle focus count and today's completed count identical before and after any duration or cycle-length commit |
| AC-08 authorization | outside writes to the four settings are ignored as a trigger and overwritten next time | unit + e2e-through-UI | A foreign write triggers no engine logic; the next legitimate write saves all four in-memory settings, replacing the foreign value; count, date, and label keys stay writable only by their own triggers |
| AC-09 happy | reload pre-fills each duration field with the value in effect | unit + e2e-through-UI | Fields show last-committed values, or the classic defaults where none is valid |
| AC-10 happy | valid cycle-length commit is saved and governs later Long-break decisions | unit + e2e-through-UI | Stored value equals the typed value; the next Long-break decision uses it |
| AC-11 error | invalid cycle-length commit is rejected and reverts | unit + e2e-through-UI | Field shows the last valid value, nothing saved, inline message names the 2–8 range |
| AC-12 invariant | invalid stored cycle length falls back to 4 and is written back | unit | Cycle length 4 used and saved; no exception |
| AC-13 cross-context | mid-cycle cycle-length change is decided on the next Focus completion | unit | The commit alone triggers no Long break and leaves the in-cycle count unchanged; the next natural Focus completion takes a Long break if the count has reached or passed the new length, otherwise a Short break |
| AC-14 happy | reload pre-fills the cycle-length field with the value in effect | unit + e2e-through-UI | Field shows the last-committed value, or 4 if none is valid |

### Edge cases / error paths

Each row also has its own dedicated test; none is folded into a happy path.

- Duration of 0, 181, or a negative number → rejected, reverts to the last valid value, inline range message.
- Duration of `1` and `180` (boundaries) → accepted and honored.
- Duration of `12.5`, `25abc`, `1e2`, empty, or whitespace → rejected as not a whole number (same outcome as out of range).
- Cycle length of 1, 9, `4.5`, or empty → rejected; cycle length of 2 and 8 → accepted.
- Stored duration missing, `"0"`, `"NaN"`, `"-5"`, or `"500"` → classic default used and written back; a phase started from it never completes instantly.
- Stored value corrupted between page load and the next fresh start → corrected before that start (pre-start correction).
- Storage unavailable or throwing on read or write → fail-soft: classic defaults are used, no exception reaches the User.
- Duration commit while running, while paused, and while idle (three separate rows) → remaining time unchanged, unchanged, updated respectively.
- Cycle-length change lowered below the current in-cycle count (e.g. count 3, length 2) → next Focus completion is followed by a Long break; the count is not retroactively altered.
- 100:00 → 99:59 countdown crossing → the fixed-width countdown area does not shift neighboring controls (visual assertion in the e2e-through-UI run, plus the manual check in §6).
- Blur or Enter commits; an intermediate keystroke never applies to display, storage, or engine.

### Test data

- Seed strategy: an in-memory storage fake pre-populated per case with valid, missing, and corrupted values for the three duration keys and the cycle-length key, plus the existing count, date, and label keys for AC-07/AC-08. For e2e-through-UI, the page's storage is seeded before load.
- Integration dependency: N/A. The only datastore is the browser's own key-value storage, faked in memory at unit level and used for real by the e2e-through-UI run in a real headless browser, so nothing is mocked in the flows that matter end to end.
- Cleanup boundary: per-test. A fresh fake storage and a fresh engine per unit test; a fresh browser context per e2e-through-UI test.
- Note: the automated e2e-through-UI level needs a headless-browser driver as a dev-only dependency, which the repo does not have today. `tasks` and `implement` must add it as an explicit task. It must not enter the shipped `index.html`.

### NFR validation (load)

<!-- N/A: no numeric NFR -->

The numeric bounds in §6 (1–180 and 2–8) are correctness limits covered by the unit tests above, not throughput or latency targets.

### CI placement

- On every PR: unit.
- Pre-release / on schedule: e2e-through-UI, plus the §6 manual checks (close/reopen persistence, Network tab shows zero extra requests, live 100→99 width crossing).
