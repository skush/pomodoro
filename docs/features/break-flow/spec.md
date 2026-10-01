---
status: Draft
owner: "sergii.kushnir@gmail.com"
reviewers: ["Tech Lead"]
updated_at: "2026-10-01"
feature_size: "S"
---

# Spec — break-flow

> **Glossary:** [CONTEXT](./CONTEXT.md) · root [CONTEXT](../../../CONTEXT.md) · [sensory-feedback CONTEXT](../sensory-feedback/CONTEXT.md) · [adjustable-durations CONTEXT](../adjustable-durations/CONTEXT.md)
> **Reference module / docs / channels used:** None beyond the interview + CONTEXT + the shipped specs of `core-timer`, `adjustable-durations`, `sensory-feedback` and `session-tracking`, `docs/roadmap.md`, `src/logic/index.js`, `src/ui/index.js`.

## 1. Context

Today every phase waits for the User when the one before it finishes: a Focus phase ends, the chime plays, and the break sits at full length until the User presses Start (core-timer AC-07). That costs the User three ways. A User who doesn't notice the chime or forgets to press Start never really takes the break, so the rhythm drifts. A User who is at the desk anyway has to press Start for every break, eight presses per four-session cycle. And a User who is ready to work again before the break is over has no direct way back to Focus — "Start" during a break always means "start the break". At the same time, the timer lets any Focus phase be paused and resumed, which works against the method's core idea: a Focus session is meant to be an undisturbed block, and an interrupted one should be discarded and started over, not stitched together from pieces.

There is no external trigger: the owner hit these annoyances while using the shipped timer daily, and the change is small enough to take before anything else on the roadmap.

The committed approach: a User setting, **Auto-start breaks** (on by default), makes a break begin counting down by itself when a Focus phase ends while the page is there to see it; Focus itself never starts on its own. During any break a single **Start focus** control ends the break and starts the next Focus at once. A second setting, **Allow pausing focus** (off by default), makes a Focus phase indivisible: without it, a running Focus offers no pause, only Reset focus, which discards it. Every control names the phase it acts on (Start/Pause/Resume/Reset *focus*, Start/Pause/Resume/Reset *break*), so starting focus can never be mistaken for restarting the break. A control the User's settings never allow is hidden; a control that is only unavailable for the moment is shown greyed out. Both phases keep counting down — a count-up timer belongs to a different, open-ended method, not to fixed-length Pomodoro phases. Competitor research found no verified product that pairs break-only auto-start with a dedicated "start focus now" action during the break and break-labelled controls; products split on whether a skipped break affects the long-break cycle, so this spec fixes that rule explicitly (it doesn't). The sharpest failure the adversarial pass found — a device asleep at the Focus end silently using up the break, including the Long break — is designed out: only an On-time completion auto-starts a break, and a late completion leaves the break waiting at full length.

Traceability — this spec **supersedes** the following shipped criteria for the cases it covers (each stays in force for every case not named here):

- core-timer **US-02, AC-02, AC-02b, AC-02c** (pause and resume) — they keep applying to every break, and to a Focus phase only while Allow pausing focus is on; with it off, a running Focus offers no pause control at all and a pause request does nothing (AC-15). core-timer AC-02's disabled Pause control while nothing is running is replaced: a waiting phase shows no pause control at all (AC-10).
- core-timer **AC-06** (Reset) for a phase already at its full duration — a waiting phase shows no reset control (AC-10); Reset focus and Reset break are offered only while their phase is running or paused.
- core-timer **AC-03** — the legitimate inputs are now this page's phase-labelled controls (AC-10), its two settings (Auto-start breaks, Allow pausing focus), and the duration and cycle-length commits adjustable-durations §1 already added; the guard itself is unchanged (AC-12).
- core-timer **AC-05** — for an awake device with the tab in the background, an On-time Focus completion now starts the break unattended, so the User may return to a break running or already finished. The replacement invariant: at most one phase per completion starts without the User, and a Focus phase never does (AC-02). After a sleep or a frozen tab the rule is unchanged in effect: a late completion leaves the break waiting (AC-03).
- core-timer **AC-07** — "waits for the User to press Start" no longer holds for a break after an On-time Focus completion with Auto-start breaks on (AC-01); it still holds for every Focus phase, and for every break when the setting is off or the completion was late.
- core-timer's control-enablement rule (Start disabled while running) — Start focus is available during a running or paused break (AC-04), except inside the Skip guard (AC-05), which now follows every break start — automatic or by Start break.
- sensory-feedback **AC-02**, **AC-06** and **§3** ("a newly loaded waiting phase", "the next phase waiting for Start", "the next phase never starts on its own") — after an On-time Focus completion with Auto-start breaks on, the ring and tab title show the break running, not waiting (AC-13). sensory-feedback **AC-06b** (after a sleep) is not superseded — AC-03 keeps it.
- sensory-feedback **AC-11** — the sound-unavailable notice must also appear when a break auto-starts, which is not a Start or Resume press (AC-13).

## 2. Goals

- A User with Auto-start breaks on takes every break they were present for, without pressing anything between the Focus end and the break.
- A User can leave any break for the next Focus with one press, at any moment of the break, without disturbing the cycle or the day's count.
- By default every counted Focus session is one undisturbed block; pausing Focus is a choice the User makes in settings, not the default.
- A User can always tell, from the control's own label, whether a press acts on Focus or on the break, and a reflex press never throws away a break or a Focus phase.
- No User ever loses a break — including the Long break — to a device that was asleep or a tab that was frozen when the Focus phase ended.

## 3. Non-goals

- **Auto-starting Focus after a break** — the User asked for Focus to start only on their own press; a break that ends always leaves Focus waiting.
- **Skipping or ending a Focus phase early into the break** — it would make the main control's meaning depend on more states again; Reset focus remains the way to abandon a Focus phase.
- **A setting to forbid pausing breaks** — rest is flexible, and Start focus already covers ending a break early; Allow pausing focus applies to Focus only.
- **Count-up display for either phase** — fixed-length phases are read as "time left"; count-up suits an open-ended method this app doesn't offer.
- **A separate "break started" cue** — the Focus-end chime plus the phase name, ring and tab title switching to the running break are judged enough.
- **Coordinating two open tabs** — each tab keeps the setting values it loaded with until it reloads, the same accepted edge case adjustable-durations §6.1 and sensory-feedback §3 already accept.
- **Keeping a setting where the browser refuses to save it** — in private browsing or with site storage blocked, both settings return to their defaults at every reload; the page still works for that load.

## 4. User stories

### US-01: Break begins on its own

**As a** User
**I want** my break to start counting down by itself when a Focus phase ends while I'm working
**So that** I actually take the break instead of losing it to a missed chime or a forgotten press

### US-02: Leave a break early for Focus

**As a** User
**I want** to end the current break — short or long, running, paused or waiting — and start the next Focus with one press
**So that** I can get back to work the moment I'm ready

### US-03: Control the break itself

**As a** User
**I want** to pause, resume, reset or start the break with controls that say "break"
**So that** I can manage my rest without ever starting Focus by accident

### US-04: Choose whether breaks auto-start

**As a** User
**I want** to turn Auto-start breaks on or off, and have that choice remembered
**So that** I can go back to breaks that wait for me when that suits my day better

### US-05: Never lose a break I wasn't there for

**As a** User
**I want** a break to wait for me when the Focus phase ended while my device was asleep or the tab was frozen
**So that** sleep or a locked phone never uses up my break or my Long break behind my back

### US-06: Know what each control does

**As a** User
**I want** every control to name the phase it acts on, and keyboard focus never left on a control that disappeared
**So that** I always know whether a press touches Focus or the break, including after an unattended phase change

### US-07: Keep Focus sessions undisturbed

**As a** User
**I want** a Focus phase to be indivisible by default — interrupted means discarded and started over — with the option to allow pausing it
**So that** every Focus session I count was one real, undisturbed block, unless I decide otherwise

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** Auto-start breaks is on and a Focus phase is running on an awake device with the page open (visible in any supported browser, or in a background tab of desktop Chrome or Edge — the browsers sensory-feedback §3 holds its background timing promise for)
**When** that Focus phase reaches zero — an On-time completion
**Then** the Focus-end chime plays once, the completion is credited exactly as before (in-cycle focus count, Session counter), and the correct next break — Short or Long per the cycle — begins counting down by itself from its full length, measured from the Focus phase's true end; its length comes from the current Configured duration, checked and corrected exactly as for any fresh start (adjustable-durations AC-06); the phase name, ring and tab title show that break running. In a background tab of any other browser (e.g. Firefox) no auto-start is promised: the 5 s On-time tolerance (§6) decides, and a completion noticed later is a late completion (AC-03)

### AC-02 (US-01, US-04) — domain invariant

**Given** any break is running, whether it auto-started or the User started it
**When** the break reaches zero
**Then** the break-end chime plays once and the next Focus phase is shown at its full length, waiting for the User to press Start focus — a Focus phase never starts on its own, with Auto-start breaks on or off, so at most one phase per completion ever starts without the User

### AC-03 (US-05) — cross-context

**Given** Auto-start breaks is on and a Focus phase is running when the device sleeps, the screen locks, or the browser freezes or backgrounds the tab so that the Focus end is only noticed later — a late completion
**When** the User returns to the page, however much time has passed
**Then** the Focus-end chime plays exactly once, the completion is credited as session-tracking decides, and the correct next break — including a Long break — is shown at its full length, waiting, with Start break and Start focus offered; the break is never counted down or used up while the User was away, and no break-end chime plays

### AC-04 (US-02) — happy path

**Given** a Short break or Long break is running, paused, or waiting at full length, and the Skip guard (AC-05) is not active
**When** the User presses Start focus
**Then** the break ends at once with no chime, and the next Focus phase starts counting down from the current Configured focus duration — checked and corrected exactly as for any fresh start (adjustable-durations AC-06) — with the phase name, ring and tab title showing Focus running

### AC-04b (US-02) — domain invariant

**Given** the User has ended a break early with Start focus — a Skipped break
**When** the cycle continues
**Then** the Skipped break itself adds nothing to and removes nothing from the in-cycle focus count or the Session counter (session-tracking's midnight rollover still applies as usual), and it doesn't move the next Long break earlier or later; after a Skipped Long break the cycle continues from its first Focus, as it would after a completed one

### AC-05 (US-02) — error

**Given** a break has just started — auto-started after an On-time completion (AC-01), or started by the User with Start break
**When** the User presses Start focus within 3 seconds of that break's start — the Focus phase's true end for an auto-started break, the Start break press for a User-started one — the Skip guard
**Then** the press does nothing and the break keeps going; for that time Start focus is shown greyed out in the main position, so the User can see it isn't available yet, and it becomes available on its own when the 3 seconds have passed in real time; pausing the break doesn't extend the guard — a break paused inside it keeps Start focus greyed out until the 3 seconds have passed — and Resume break starts no new guard; Reset break leaves the break waiting, where no guard applies; a break waiting at full length has no Skip guard

### AC-06 (US-03) — happy path

**Given** a break is shown
**When** the User uses the break's own controls
**Then** each acts only on the break: a running break offers Pause break and Reset break; a paused break offers Resume break and Reset break; a waiting break offers Start break; Pause break freezes the remaining time, Resume break continues from exactly that time, Reset break returns the break to its full length — the current Configured duration (adjustable-durations AC-04b) — stopped and waiting, and Start break starts it counting down; none of them ever starts Focus, and Start focus stays offered alongside them in every break state; breaks can always be paused, whatever Allow pausing focus says

### AC-07 (US-04) — happy path

**Given** the User opens the settings
**When** they look for, then change, Auto-start breaks
**Then** the setting is shown next to the duration settings, is on the first time the app is used, keeps the User's choice across reloads, and takes effect at the next Focus completion — a Focus phase already running follows whatever the setting is at the moment it ends; changing the setting never alters a phase already running, paused or waiting

### AC-08 (US-04) — happy path

**Given** Auto-start breaks is off
**When** a Focus phase completes
**Then** the next break is shown at its full length, waiting, with Start break in the main position and Start focus offered beside it — today's waiting behaviour, plus the option to go straight to Focus

### AC-09 (US-04, US-07) — error

**Given** the saved value of Auto-start breaks or Allow pausing focus is missing, unreadable or not a valid on/off value, or the browser refuses to save it
**When** the page loads, or the User changes the setting
**Then** the page treats that setting as its default — Auto-start breaks on, Allow pausing focus off — when nothing valid can be read, and a change the browser couldn't save still applies for the rest of this page load; the page never shows an error or stops working because of it

### AC-10 (US-06) — domain invariant

**Given** any phase in any state
**When** the User looks at the controls
**Then** every control names the phase it acts on — no control is labelled only "Start", "Pause", "Resume" or "Reset" — the phase name stays visible as text, and the main position holds:
- Focus waiting: **Start focus**.
- Focus running: **Pause focus** when Allow pausing focus is on; empty when it is off. Reset focus is beside it in both cases, never in the main position.
- Focus paused (only reachable with Allow pausing focus on): **Resume focus**, with Reset focus beside it.
- Break running, within the Skip guard: **Start focus**, greyed out, with Pause break and Reset break beside it.
- Break paused, within the Skip guard: **Start focus**, greyed out, with Resume break and Reset break beside it.
- Break running: **Start focus**, with Pause break and Reset break beside it.
- Break paused: **Start focus**, with Resume break and Reset break beside it.
- Break waiting: **Start break**, with Start focus beside it.

These lists are complete: a waiting phase shows no pause or reset control. A control the User's settings never allow (Pause focus with Allow pausing focus off) is hidden, not greyed out; the only control ever greyed out is Start focus within the Skip guard. When Reset break returns a break to waiting, Start focus does not take the place where Reset break was, so a repeated press there cannot skip the break — the exact arrangement is settled at the screens stage

### AC-11 (US-06) — domain invariant

**Given** keyboard focus is on one of the timer's controls
**When** the set of controls changes — after a press, or without one (a break auto-starts, a phase completes, the Skip guard ends, a setting hides a control)
**Then** keyboard focus is never left on a control that disappeared or became unavailable: it moves to the main position — within the Skip guard that is the greyed-out Start focus, which can still hold keyboard focus, so a reflex key press does nothing — and when the main position is empty (Focus running with Allow pausing focus off) it moves to the phase name and countdown, never onto Reset focus; keyboard focus that is anywhere else (the Task label, a duration field, a setting) is never moved; the phase change is announced the way phase changes already are

> **Design note (2026-10-01, owner):** Pause *X* and Resume *X* of the same phase count as **one pause toggle control** in one position. After Pause break or Pause focus, keyboard focus stays on that control, which now reads Resume, and does not move to the main position. A reflex double press therefore pauses and resumes, and can't skip the break (§7 KPI). Every other control that disappears moves focus as written above. See `sad.md` §1 ¶4 and `adr/0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots.md`.

### AC-12 (US-01, US-02, US-03, US-04, US-07) — authorization

**Given** a User's page is open
**When** an input arrives that did not come from that page's own controls, its own two settings, or its own duration and cycle-length commits — for example a message from another tab, or another tab saving different setting values
**Then** the page ignores it: the timer and the settings in use change only in direct response to this page's own inputs (core-timer AC-03's guard, extended to the new controls and settings); values of Auto-start breaks and Allow pausing focus that another tab saved are picked up only on this page's next load, while saved Configured durations and cycle length keep the read points adjustable-durations already set — page load, and before each fresh start, which now includes a break that auto-starts and a Focus started with Start focus

### AC-13 (US-01) — cross-context

**Given** a break has auto-started (AC-01)
**When** the User looks at, or listens for, the sensory cues
**Then** the ring starts full and shrinks with the break, the tab title shows the break running (not waiting), the break-end chime plays at its completion as usual, and if sound cannot be played when the break auto-starts, the sound-unavailable notice (sensory-feedback AC-11) appears at that moment rather than only at the next press

### AC-14 (US-01, US-04) — cross-context

**Given** the User changes a break's Configured duration
**When** the change is committed before the Focus phase ends, or after the break has auto-started
**Then** a change committed before the Focus end applies to the break that auto-starts; a change committed after the break has auto-started leaves that running break at its length and applies from the next fresh start of a break of that type, or from a Reset break — the adjustable-durations rule that a started phase keeps its length (AC-04, AC-04b)

### AC-15 (US-07) — happy path

**Given** Allow pausing focus is off (the default) and a Focus phase is running
**When** the User wants to interrupt it
**Then** no pause control is shown for it; Reset focus discards it — it returns to its full length, waiting for Start focus, and is never counted as a Focus session; a pause requested by any other means (for example bypassing the hidden control) does nothing and the Focus phase keeps running

### AC-16 (US-07) — happy path

**Given** Allow pausing focus is on and a Focus phase is running
**When** the User presses Pause focus and later Resume focus
**Then** the Focus phase freezes at its remaining time and then continues from exactly that time — core-timer's pause and resume (AC-02c), unchanged

### AC-17 (US-07) — domain invariant

**Given** the User changes Allow pausing focus
**When** a Focus phase is running, paused or waiting at that moment
**Then** the setting is shown next to Auto-start breaks, is off the first time the app is used, keeps the User's choice across reloads, and applies from the next control state it affects without ever altering a phase already in progress — a Focus phase paused before the setting was turned off stays paused and can still be resumed or reset; a Focus phase running when the setting is turned on immediately offers Pause focus, and a Focus phase running when it is turned off loses Pause focus at once and keeps running (keyboard focus moves as in AC-11)

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| On-time completion tolerance | a Focus completion noticed ≤ 5 s after its true end counts as On-time and auto-starts the break; > 5 s counts as late and leaves the break waiting | unit test on the timer engine with an injected clock, at 5 s and 5.001 s |
| Auto-started break accuracy | remaining break time differs from (full length − real time since the Focus end) by ≤ 1 s | unit test with an injected clock; manual stopwatch check on desktop Chrome |
| Skip guard length | 3 s (± 0.25 s) of real time from the break's start — the Focus phase's true end for an auto-started break, the Start break press otherwise | unit test on the guard rule with an injected clock |
| Start focus response | Focus shown running ≤ 250 ms after the press | manual check during a running break |
| Chimes per completion | exactly 1, including after a late completion | unit test on the timer engine: one completion → one chime; e2e return-after-sleep check |
| Self-contained load | zero network requests beyond the initial page load | browser devtools Network tab |

## 6.1 Security / privacy

- **Data classification:** public — two on/off preferences.
- **Personal data touched:** two new saved values, Auto-start breaks and Allow pausing focus (on/off each), not personal.
- **AuthZ/AuthN impact:** none — single local User, no accounts; core-timer's input guard is extended to the new controls and settings (AC-12).
- **Abuse cases:**
  - another tab or origin trying to start, skip, pause or reset a phase: ignored by the input guard (AC-12).
  - a hand-edited or corrupted saved value: read as that setting's default, never an error (AC-09).
  - a pause of Focus forced past the hidden control while pausing is not allowed: does nothing (AC-15).
  - rapid pressing of Start focus right after a break starts, automatically or by Start break: absorbed by the Skip guard (AC-05); redundant presses otherwise stay no-ops.
  - with Allow pausing focus on, Start focus and Pause focus share the main slot (ADR-0003, AC-11), so a mouse double-click on Start focus starts the Focus and then pauses it: accepted — the pause is undone with Resume focus, nothing is lost, and the setting is off by default (review round 2, D).
- **Security review:** N/A — no new data beyond two preferences, no network access, no permission boundary.

## 7. Metrics / KPIs

- **Breaks the owner misses or forgets to start** — baseline: unmeasured (owner reports it happens), target: 0 over the first 7 days of use after ship (owner's own log).
- **Presses per four-session cycle with no early skips** — baseline: 8 (4 × start Focus, 4 × start break), target: 4 with Auto-start breaks on, at merge.
- **Breaks lost to an accidental Start focus press** — baseline: n/a (no such control), target: 0 over the first 7 days after ship (owner's own log).
- **Breaks or Long breaks used up during sleep** — baseline: n/a, target: 0 — verified by the late-completion unit test and one manual return-after-sleep run at merge.
- **Focus phases lost to a reflex press** — baseline: n/a, target: 0 discarded by an unintended Reset focus over the first 7 days after ship (owner's own log).

## 8. Open questions

- [x] Is 5 s the right On-time completion tolerance, given that a hidden desktop tab already notices a completion within 1 s (sensory-feedback AC-06)? Default now: 5 s. — owner: Tech Lead, due: before `sdd:design` — **resolved 2026-10-01 in `sad.md` §4 decision 6: keep 5 s.**
- [ ] Is a 3 s Skip guard long enough to absorb the old habit without making a deliberate skip feel blocked? Default now: 3 s; revisit after the first 7 days of use. — owner: PM (sergii.kushnir@gmail.com), due: 7 days after ship
- [ ] Should a Long break be harder to skip than a Short break (e.g. a longer Skip guard)? Default now: no — same rules for both. — owner: PM (sergii.kushnir@gmail.com), due: before `sdd:tasks`
- [ ] Should Reset focus ask for confirmation when it would discard a long stretch of Focus? Default now: no — it acts at once, and is kept out of the main position instead. — owner: PM (sergii.kushnir@gmail.com), due: before `sdd:screens`

## Test plan

Every §5 criterion maps to ≥1 test. Unit tests run against the pure logic with an injected clock; component and e2e-through-UI rows are verified by hand in a real browser (the repo has no automated UI harness — `docs/architecture-map.md`), unless `implement` finds one worth adding.

### AC coverage

| AC (spec.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 happy path | on-time focus completion auto-starts the correct break from its full length | unit | one chime, completion credited once, break running; remaining time within 1 s of (full length − time since the focus end); length re-read from current Configured duration |
| AC-01 happy path | auto-started break shows running ring and tab title | e2e-through-UI | focus ends in an open tab → break phase name, full-then-shrinking ring and running title appear with no press |
| AC-02 domain invariant | finished break leaves the next focus waiting, with auto-start on or off | unit | break-end chime once; focus at full length, stopped; never started by itself |
| AC-03 cross-context | late focus completion leaves the break waiting at full length, including a long break | unit | completion noticed after 5.001 s → one focus-end chime, break waiting, no countdown, no break-end chime |
| AC-03 cross-context | returning after sleep shows a waiting break | e2e-through-UI | after the device sleeps past the focus end, the page shows the break waiting with Start break and Start focus offered |
| AC-04 happy path | start focus ends a short, long, running, paused or waiting break at once | unit | break ends silently; focus running from the current Configured focus duration |
| AC-04 happy path | start focus during a break switches the screen to focus | e2e-through-UI | focus shown running within 250 ms of the press |
| AC-04b domain invariant | a skipped break changes no counters and does not move the long break | unit | in-cycle count and Session counter unchanged; long-break timing unchanged; skipped long break restarts the cycle at its first focus |
| AC-05 error | start focus inside the skip guard does nothing | unit | press ignored at 2.99 s, accepted at 3.0 s+ of real time; guard holds across pause, resume starts none, reset leaves the break waiting with no guard |
| AC-05 error | start focus is greyed out and focusable while guarded | component | greyed out in the main position for both running and paused break; becomes available on its own after 3 s |
| AC-06 happy path | break controls act only on the break | unit | pause freezes, resume continues exactly, reset returns to full Configured length stopped, start break starts it; none starts focus |
| AC-06 happy path | each break state offers its listed controls | component | running → Pause/Reset break; paused → Resume/Reset break; waiting → Start break; Start focus present in all |
| AC-07 happy path | auto-start breaks setting defaults on, persists, applies at next completion | unit | default on with nothing saved; saved choice survives reload; a running phase is not altered by a change |
| AC-07 happy path | auto-start breaks setting sits next to the duration settings | component | setting visible beside the durations and reflects the stored value |
| AC-08 happy path | focus completion with auto-start off leaves the break waiting | unit | break at full length, waiting; Start break in the main position with Start focus beside it |
| AC-09 error | missing, unreadable or invalid saved values fall back to defaults | unit | auto-start on, allow-pausing off; no error thrown |
| AC-09 error | browser refusing to save still applies the change for this load | component | change takes effect in the page, no error shown, page keeps working |
| AC-10 domain invariant | control layout matches the lists for every phase, state and setting combination | unit | each state yields exactly the listed controls in the listed positions; no bare Start/Pause/Resume/Reset label; waiting phases have no pause or reset; only Start focus is ever greyed out; Start focus never lands where Reset break was |
| AC-11 domain invariant | keyboard focus never rests on a vanished or unavailable control | component | moves to the main position (greyed Start focus inside the guard), or to phase name and countdown when it is empty, never to Reset focus; pause toggle keeps focus after pressing; focus in the label, duration or setting fields is left alone |
| AC-12 authorization | inputs not from this page's own controls are ignored | unit | foreign messages and other tabs' saved setting values do not change the timer or the settings in use until the next load |
| AC-12 authorization | new controls and settings reach the engine only via the page's own handlers | component | no new input path exists besides the page's controls and commits |
| AC-13 cross-context | auto-started break gives full cues | component | ring starts full and shrinks, title shows break running, break-end chime at completion |
| AC-13 cross-context | sound-unavailable notice appears when a break auto-starts | component | notice shown at the auto-start moment, not only at the next press |
| AC-14 cross-context | duration change before focus end applies; after auto-start waits | unit | break gets the new length if committed before the focus end; running break keeps its length if committed later; applies from the next fresh start or Reset break |
| AC-15 happy path | pause requested while focus pausing is off does nothing | unit | focus keeps running; Reset focus returns it to full length, waiting, never counted |
| AC-15 happy path | no pause control shown for running focus when pausing is off | component | Pause focus hidden; Reset focus present; main position empty |
| AC-16 happy path | pause then resume focus when pausing is allowed | unit | freezes at the remaining time, resumes from exactly that time |
| AC-17 domain invariant | allow-pausing changes never alter a phase in progress | unit | default off, persists; paused focus stays resumable after turning off; running focus gains or loses pause at once and keeps running |
| AC-17 domain invariant | allow-pausing setting sits next to auto-start breaks and keyboard focus moves as in AC-11 | component | setting placed beside auto-start breaks; focus moves per AC-11 when Pause focus disappears |

### Edge cases / error paths

- Focus completion noticed at exactly 5 s → expected: on-time, break auto-starts; at 5.001 s → late, break waiting.
- Start focus pressed twice within the skip guard → expected: both ignored, break keeps running.
- Break paused inside the guard, then resumed → expected: Start focus becomes available only after 3 s of real time, not 3 s of running time.
- Reset break, then an immediate repeat press on the same spot → expected: break stays waiting, not skipped (layout never puts Start focus there).
- Tab frozen past the focus end, then reopened → expected: break waiting, exactly one focus-end chime, no break-end chime.
- Corrupted or hand-edited saved setting value → expected: that setting reads as its default, page works.
- Browser storage blocked → expected: both settings return to defaults on each load, changes still apply for the current load.
- Another tab saves different setting values → expected: this page ignores them until its next load.
- Duration saved in another tab between focus end and break start → expected: break length checked and corrected as for any fresh start.
- Sound cannot be played when a break auto-starts → expected: sound-unavailable notice shown at that moment.

### Test data

- Seed strategy: an injectable clock and in-memory fake saved-settings values (valid, missing, invalid, refusing writes) — the only persistence is two on/off values and existing scalar counters, so no entity factories are needed.
- Integration dependency: N/A — there is no datastore, server or queue (`docs/adr/0002-no-backend-for-v1.md`); browser storage is exercised at the component level in a real browser, not mocked as a datastore.
- Cleanup boundary: per-test — each test builds a fresh engine with a fresh clock; manual browser checks clear site storage before each run.

### NFR validation (load)

<!-- N/A: no numeric NFR -->

No throughput or latency-under-load target exists. The numeric §6 targets are timing rules, covered by the unit rows above: 5 s on-time tolerance (checked at 5 s and 5.001 s), ≤ 1 s auto-started break accuracy, 3 s ± 0.25 s skip guard, exactly one chime per completion (including late). Start focus response ≤ 250 ms and zero extra network requests are manual checks in a real browser.

### CI placement

- On every PR: unit.
- Before merge / pre-release (manual until a UI harness exists): component and e2e-through-UI checks, including one return-after-sleep run.
