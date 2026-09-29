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

The committed approach: each phase type gets a **Configured duration** (see `CONTEXT.md`) that the User sets and commits (blur/Enter, same discipline as the task label), clamped to 1–180 minutes rather than rejected outright, persisted in this browser's local storage, and read wherever the engine currently reads a hardcoded constant. A duration change never disturbs a phase that's already running or paused — it applies only the next time that phase type starts fresh — but an idle (not-yet-started) phase's display updates immediately. Alongside per-phase durations, the classic 4-focus cadence itself becomes configurable: a **Configured cycle length** (2–8 Focus sessions before a Long break, default 4, same commit/clamp/persistence discipline) replaces the fixed 4 — unlike a duration change, a cycle-length change applies immediately, including to whatever cycle is currently in progress, since it only changes a comparison threshold rather than disrupting a countdown already running. A `researcher` competitive pass found that no comparable app publicly documents this running/paused-timer edge case at all (competitors are either silent or avoid it entirely, e.g. offering only a post-completion "extend" action) — our explicit, tested rule is the differentiator. A `devils-advocate` failure-mode pass surfaced the sharpest risk this spec must close: a corrupted, zero, or non-numeric stored duration must never let a phase complete instantly and silently inflate the daily count — §5 AC-06 makes this a hard, tested invariant, the same fallback discipline session-tracking already applies to its own stored fields.

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

### AC-01 (US-01) — happy path

**Given** a User is viewing the app with a phase type currently idle
**When** the User types a new duration (in minutes, 1–180) for that phase type and commits it (blurs the field or presses Enter)
**Then** the system saves that as the phase type's Configured duration, and the next time that phase type starts fresh, it runs for exactly that long

### AC-02 (US-01) — error

**Given** a duration value — whether just committed by the User or read from storage — is a valid whole number outside the 1–180 minute range (e.g. 0, or 500)
**When** the system encounters it (at commit time, or on page load / before that phase type would start)
**Then** the system clamps it to the nearest valid bound (1 or 180 minutes) rather than rejecting a commit outright or discarding a stored value entirely, and — when this happens at commit time — shows the User the clamped value it actually saved. A value that isn't a valid whole number at all (non-numeric, empty, or otherwise unparsable) is handled differently — see AC-06 — never treated as a bound to clamp toward.

### AC-03 (US-04) — happy path (idle immediate update)

**Given** a phase type is currently idle, displaying its previous Configured duration
**When** the User commits a new Configured duration for that same phase type
**Then** the system updates that phase's idle display to the new duration immediately, without requiring the User to start it first

### AC-04 (US-02) — domain invariant

**Given** a phase is currently running
**When** the User commits a new Configured duration for that same phase type
**Then** the system does not alter the running phase's remaining time in any way — it keeps counting down exactly as it was — and the new duration only takes effect the next time that phase type starts fresh

### AC-05 (US-05) — domain invariant

**Given** a phase is currently paused, with a specific amount of time frozen as its remaining time
**When** the User commits a new Configured duration for that same phase type
**Then** the system leaves the paused phase's frozen remaining time exactly as it was, so resuming continues counting down from that same frozen value, and the new duration only takes effect the next time that phase type starts fresh

### AC-06 (US-06) — domain invariant

**Given** a duration value — whether read from storage or just committed by the User — is missing, empty, non-numeric, or otherwise not a valid whole number at all (as distinct from AC-02's valid-but-out-of-bounds numeric case)
**When** the system encounters it (on page load, before that phase type would start, or at commit time)
**Then** the system treats it as no valid Configured duration and falls back to that phase type's classic default (Focus 25 minutes, Short break 5 minutes, Long break 15 minutes) — under no circumstance does an invalid value let a phase complete faster than its own valid minimum, or complete instantly

### AC-07 (US-07) — cross-context

**Given** a User commits a new Configured duration for any phase type
**When** that commit happens
**Then** the system leaves the in-cycle focus count, the current cycle position, and today's completed-session count (`docs/features/session-tracking/spec.md`) exactly as they were — a duration change never advances, resets, or otherwise alters progress already made

### AC-08 (US-08) — authorization

**Given** the app's saved Configured durations and Configured cycle length
**When** a write attempt to any of those values arrives from anything other than this app's own duration-commit or cycle-length-commit action (for example a message from another tab or origin, a change made in another same-origin tab, or a devtools edit)
**Then** the system's write guard ignores that attempt as a trigger for its own logic, and the next time a legitimate commit saves the Configured durations or cycle length, it writes only the app's own current in-memory values for those settings — overwriting, never adopting, whatever those specific saved values had become in the meantime. This extends, but does not widen, session-tracking's existing write guard (`docs/features/session-tracking/spec.md` AC-07): the daily count, tracked date, and task label remain writable only by their own three existing triggers, unaffected by duration or cycle-length commits, exactly as before

### AC-09 (US-03) — happy path

**Given** a User previously committed custom durations for one or more phase types
**When** the User reopens or reloads the page
**Then** the system pre-fills each phase type's duration field with exactly its last-committed Configured duration, or the classic default for any phase type never customized

### AC-10 (US-09) — happy path

**Given** a User is viewing the app
**When** the User types a new cycle length (a whole number, 2–8) and commits it (blurs the field or presses Enter)
**Then** the system saves that as the Configured cycle length, and it governs every Long-break decision from that point forward

### AC-11 (US-09) — error

**Given** a cycle-length value — whether just committed by the User or read from storage — is a valid whole number outside the 2–8 range (e.g. 1, or 9)
**When** the system encounters it (at commit time, or on page load)
**Then** the system clamps it to the nearest valid bound (2 or 8) rather than rejecting a commit outright or discarding a stored value entirely, and — when this happens at commit time — shows the User the clamped value it actually saved

### AC-12 (US-09) — domain invariant

**Given** a cycle-length value — whether read from storage or just committed by the User — is missing, empty, non-numeric, or otherwise not a valid whole number at all (as distinct from AC-11's valid-but-out-of-bounds numeric case)
**When** the system encounters it (on page load or at commit time)
**Then** the system treats it as no valid Configured cycle length and falls back to the classic default of 4

### AC-13 (US-10) — cross-context

**Given** a cycle is already in progress, with some number of Focus sessions already completed toward the Long break (the in-cycle focus count)
**When** the User commits a new Configured cycle length before the next Focus session completes
**Then** committing it alone changes nothing yet — it does not retroactively trigger a Long break and does not alter or reset the in-cycle focus count — but the next Focus session to complete naturally is decided against the newly committed cycle length: if the in-cycle focus count (including that just-completed session) has now reached or passed it, a Long break follows next, exactly as if that had always been the configured length; otherwise a Short break follows as usual

### AC-14 (US-03) — happy path

**Given** a User previously committed a custom cycle length
**When** the User reopens or reloads the page
**Then** the system pre-fills the cycle-length field with exactly that last-committed Configured cycle length, or the classic default of 4 if never customized

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Duration bounds | Every Configured duration stays within 1–180 minutes at all times, whether freshly typed, freshly loaded, or previously corrupted — 0 exceptions | unit test on the validation/clamp function |
| Commit discipline | A duration or cycle-length field's value applies (to display, storage, and the engine) only on blur/Enter, never on an intermediate keystroke while the User is still editing | manual check, mirroring session-tracking's task-label commit check |
| Running/paused isolation | 100% of duration commits while that same phase type is running or paused leave its current remaining time byte-for-byte unchanged (AC-04/AC-05); a commit while idle updates the display immediately instead (AC-03) — both behaviors verified | unit test |
| Corrupted/missing persisted duration | Each phase type's Configured duration falls back to its own classic default on any stored value that isn't a valid whole number at all (missing key, malformed value, non-numeric, wrong type — AC-06), and clamps to bounds when it's a valid but out-of-range number (AC-02) — 0 thrown exceptions, 0 instant completions either way | unit test with invalid stored data |
| Duration persistence | Configured durations survive 100% of a full browser close-and-reopen cycle, with 0 data loss, until the User clears site data | manual check: close and reopen the browser |
| Display width | The countdown display never truncates, wraps, or shifts layout for any duration up to 180 minutes (a 3-digit minute value) | manual check across the full 1–180 range |
| Cycle-length bounds | The Configured cycle length stays within 2–8 at all times, whether freshly typed, freshly loaded, or previously corrupted — 0 exceptions | unit test on the validation/clamp function |
| Cycle-length persistence + fallback | Configured cycle length survives 100% of a full browser close-and-reopen cycle with 0 data loss (AC-14), and falls back to 4 on any stored value that isn't a valid whole number at all (AC-12), clamping instead when it's a valid but out-of-range number (AC-11) — 0 thrown exceptions either way | manual check (close/reopen) + unit test with invalid stored data |
| Self-contained load | Zero network requests beyond the initial `index.html` load (unchanged from core-timer/session-tracking) | manual check via the browser devtools Network tab |

## 6.1 Security / privacy

- **Data classification:** internal — persisted only in this browser's local storage; nothing is transmitted anywhere.
- **Personal data touched:** none — durations are plain numeric preferences, not personal data.
- **AuthZ/AuthN impact:** none — single local User, no accounts; the only boundary is the AC-08 write guard on the duration and cycle-length keys (only this app's own duration-commit and cycle-length-commit actions trigger its own logic there; its own next write always overwrites whatever it finds saved) — a boundary kept separate from, and not widening, session-tracking's existing AC-07 write guard on the count/date/label keys.
- **Abuse cases:**
  - a message from another tab or origin attempting to write a Configured duration or cycle length: ignored as a trigger, denied by the AC-08 guard, reinforced by (not resting solely on) the browser's own execution-context isolation.
  - two tabs of this same app open at once, each independently committing different durations or cycle lengths to the same shared local storage: each tab's own next legitimate write (AC-08) overwrites whatever the other tab left behind — no reconciliation between tabs is attempted; accepted as the same known edge case session-tracking already accepts for its own count/label (`docs/features/session-tracking/spec.md` §6.1), extended here to durations and cycle length.
  - a User editing local storage directly via devtools to set an extreme or invalid duration or cycle length: constrained on the next read by AC-06/AC-12's fallback (invalid → classic default) and AC-02/AC-11's clamp (in-range-but-extreme values like exactly 1/180 minutes or 2/8 sessions are valid and honored, by design) — never able to produce an instant or zero-length completion, or a cycle length outside 2–8.
- **Security review:** N/A — no backend, no accounts, no persisted or transmitted data beyond this browser's own local storage (same reasoning as core-timer and session-tracking).

## 7. Metrics / KPIs

- **Duration-change isolation correctness** — baseline: unverified (0), target: 100% of running/paused/idle duration-change cases pass their NFR unit tests before this step is marked done.
- **Corrupted-duration fallback safety** — baseline: unverified (0), target: 0 instant or sub-minimum completions producible from any invalid stored duration value, confirmed via unit test before this step is marked done.
- **Duration + cycle-length round-trip persistence** — baseline: unverified (0), target: committed durations and cycle length confirmed to survive a full page reload before this step is marked done.
- **Cycle-length change correctness** — baseline: unverified (0), target: a mid-cycle cycle-length change confirmed via unit test to be evaluated against the new value on the very next Focus completion, without altering the in-cycle focus count itself, before this step is marked done.

## 8. Open questions

- [ ] Should quick-select duration presets be added alongside free-form input? Default now: free-form numeric input only. — owner: sergii.kushnir@gmail.com, due: before `design`, if reconsidered.
- [ ] Is the accepted multi-tab non-reconciliation gap (§6.1) worth solving generally across this app's whole storage layer, rather than accepting it per-feature? Default now: same accepted gap as session-tracking, unchanged. — owner: sergii.kushnir@gmail.com, due: before a future step that adds a second write surface (e.g. cross-device sync), if one is ever added — same trigger session-tracking's own §6.1 already names for this gap.
