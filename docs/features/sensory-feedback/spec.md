---
status: Draft
owner: "sergii.kushnir@gmail.com"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-09-29"
feature_size: "S"
---

# Spec — sensory-feedback

> **Glossary:** [CONTEXT](./CONTEXT.md) (feature-scoped) · [root CONTEXT](../../../CONTEXT.md)
> **Reference module / docs / channels used:** None — only the interview, `docs/idea-brief.md` §1/§3/§5/§6, `docs/architecture-map.md`, `docs/features/core-timer/spec.md`, `docs/features/adjustable-durations/spec.md`, `docs/features/session-tracking/spec.md` and CONTEXT.

## 1. Context

Today the timer tells the User what is happening only through a plain text countdown on the page. A User who is working in another tab, or simply looking away from the screen, has no way to learn that a phase ended — they find out only by coming back and reading the digits, which defeats the point of a timer that is supposed to tell them when to stop and when to start again. There is also no at-a-glance sense of how much of the phase is left, or which phase it is, without reading text. The segment is the owner using it as a personal focus tool, and — because this is a portfolio piece — anyone opening the page to judge the work (`docs/idea-brief.md` §3).

This is the last roadmap step (`docs/roadmap.md` step 5), deliberately held until adjustable durations shipped so that everything here reads the User-configured length instead of a hardcoded one. Core-timer explicitly deferred the progress ring, the tab-title countdown, the completion chime and phase colour-coding to this step (`docs/features/core-timer/spec.md` §3 and §8).

**Committed approach:** build a trustworthy eyes-off cue layer. A Completion chime with a distinct Focus-end tone and break-end tone plays within about a second of every Phase completion — including while the tab is hidden, as long as the device is awake. On the page, a Progress ring colour-coded per phase depletes against the length the phase started with. The Tab title mirror shows the remaining whole minutes and the phase, and always says whether the phase is running, paused or waiting for Start. All of it sits in one consistent dark palette that meets WCAG AA. Rationale: a ring, a tab-title countdown and a synthesized chime are common in comparable timers, but none documents distinct end tones or chime timing in a background tab — that is the gap this step owns. The sharpest failure mode is that the background promise silently fails in the very situation it exists for, so it is an explicit, scoped and tested requirement here (§5 AC-06, §6). The success criterion: a User working in another tab never misses, or misreads, a phase end.

Traceability:
- Resolves core-timer §8's open question on visually distinguishing the active phase: one ring colour per phase type, with the phase name still shown as text.
- Addresses `docs/idea-brief.md` §6's risk that background timing "must actually be verified, not assumed": §6 makes it a measured NFR.
- Decision recorded against the research: comparable timers all offer a mute or sound toggle; this step deliberately ships without one (§3), with a revisit in §8.
- Decision recorded against `docs/idea-brief.md` §1 ("a live countdown mirrored in the browser tab title"): at the owner's call, the tab title shows whole minutes (rounded up) rather than a second-by-second countdown — the on-page countdown keeps the seconds (AC-04).
- Decision override: critic finding that the §6 "Self-contained" row cites a manual check — rationale: an automated zero-network-requests e2e check already exists (`test-e2e/durations.e2e.js:226`), so "extends the existing self-contained-load check" is accurate.

## 2. Goals

- A User who is not looking at the page learns of every phase end, and which kind of phase ended, by sound alone.
- A User glancing at the page or at the browser's tab strip can tell the remaining time, the current phase, and whether the timer is running, paused or waiting — without opening the tab or reading the digits closely.
- The page reads as one consistent, accessible dark interface at both desktop and phone widths.

## 3. Non-goals

- **A mute or volume control** — the chime is soft and short, and the browser's own tab mute already exists; keeping the scope to a single S step matters more for now. Revisit per §8.
- **System or push notifications** — the tab-title mirror plus the chime were judged sufficient, and a permission prompt is the distraction this app avoids (`docs/idea-brief.md` §5).
- **Surviving a reload, or the browser discarding the tab, mid-phase** — the running phase lives only in memory by core-timer's design (core-timer AC-08); if the browser throws the tab away, the phase is lost and no chime fires. Persisting a running phase would be a separate feature.
- **Chime timing while the device sleeps or the screen is locked** — the ~1 s promise covers an awake device with the tab in the background; after a sleep, the chime plays once when the page runs again (AC-06b), never on time.
- **Coordinating two open tabs of the app** — each tab chimes and titles independently, the same accepted edge case adjustable-durations §6.1 already accepts.

## 4. User stories

### US-01: See phase progress at a glance
**As a** User
**I want** a ring that depletes as the current phase runs
**So that** I can tell how much of the phase is left without reading the digits

### US-02: Tell the phase apart at a glance
**As a** User
**I want** each phase type to have its own ring colour
**So that** I know whether I should be focusing or resting the instant I look

### US-03: Follow the timer from another tab
**As a** User
**I want** the browser tab's title to show the remaining minutes, the phase and whether it is running, paused or waiting
**So that** I can keep track without switching back to the timer's tab

### US-04: Hear which phase just ended
**As a** User
**I want** a soft chime with a different tone for a Focus end and a break end
**So that** I know whether to take a break or get back to work without looking

### US-05: Get the chime while working elsewhere
**As a** User
**I want** the chime to play on time even while the timer's tab is in the background
**So that** I can work in another tab and still stop and start on time

### US-06: Use a readable dark interface on any screen
**As a** User
**I want** the whole page to share one readable dark palette and fit a phone-width screen
**So that** the timer is comfortable to read in any lighting and on any device

## 5. Acceptance criteria

### AC-01 (US-01) — happy path
**Given** the User has pressed Start on a phase
**When** the phase runs
**Then** the Progress ring is full at the start, its remaining portion shrinks in step with the countdown, and it is empty at the moment of the Phase completion

### AC-02 (US-01) — happy path
**Given** a phase is running
**When** the User pauses it, or presses Reset, or the phase completes and the next phase loads waiting for Start
**Then** on pause the ring stays frozen at the portion that was left; after Reset, and for a newly loaded waiting phase, the ring is full

### AC-03 (US-02) — happy path
**Given** any phase is shown, in any state
**When** the User looks at the page
**Then** the ring shows that phase type's own colour — different from the other two phase types — and the phase name is still shown as text, so the phase can be identified without relying on colour

### AC-04 (US-03) — happy path
**Given** the timer is in any state
**When** the User looks at the browser's tab strip
**Then** the tab title shows the remaining time as whole minutes, rounded up (so it never shows zero minutes while time is left), together with the phase name, and distinguishes the three states: running shows the minutes and phase; paused is marked as paused with the frozen minutes; waiting for Start is marked as ready with the minutes the phase will run for — the one tolerance: while the tab is hidden, a running phase's minutes may trail the countdown by up to a minute between completions, but are always correct at a Phase completion (§6 Tab title freshness)

### AC-05 (US-04) — happy path
**Given** a phase is running
**When** it reaches a Phase completion
**Then** a Focus completion plays the Focus-end tone, and a Short break or Long break completion plays the break-end tone — the two tones are clearly distinguishable by ear

### AC-06 (US-05) — happy path
**Given** a phase is running, the timer's tab is in the background, and the device stays awake — for any length of time
**When** the phase reaches its Phase completion
**Then** the Completion chime plays within about a second of that moment, and by then the tab title already shows the next phase waiting for Start

### AC-06b (US-05) — domain invariant
**Given** a phase was running and the device slept or locked past the moment that phase would have completed
**When** the page runs again
**Then** the Completion chime for that phase plays exactly once, the tab title shows the next phase waiting for Start, and no further chimes follow — the next phase never starts on its own, so it cannot complete unattended

### AC-07 (US-04) — domain invariant
**Given** the User is using the timer
**When** they press Start, Pause, Resume or Reset, or commit a duration or cycle-length change
**Then** no chime plays — the Completion chime plays only at a Phase completion, and exactly once per completion (never again when the User returns to the tab)

### AC-08 (US-01) — domain invariant
**Given** a phase is running or paused, and the User commits a new Configured duration for that same phase type
**When** the phase keeps running, or is resumed
**Then** the ring keeps measuring against the length that phase started with — it neither jumps nor sticks, and stays in step with the unchanged countdown; after Reset, the full ring corresponds to the new Configured duration

### AC-09 (US-01, US-03) — cross-context
**Given** a phase is waiting for Start
**When** the User commits a new Configured duration for that phase type (`docs/features/adjustable-durations/spec.md` AC-03)
**Then** the ring shows full and the tab title shows the new duration in whole minutes immediately, matching the on-page countdown

### AC-10 (US-04) — cross-context
**Given** a Focus phase is running
**When** it reaches its Phase completion
**Then** the Focus-end chime plays, and that same completion is credited to the Session counter exactly as session-tracking decides (`docs/features/session-tracking/spec.md` AC-04 and AC-06) — normally today's count goes up by exactly one; a completion whose true moment fell before a midnight that has since passed still chimes but is not carried into the new day's count; a break completion chimes and never changes the Session counter

### AC-11 (US-04) — error
**Given** sound cannot be played in the User's browser (sound unavailable or blocked)
**When** a phase reaches its Phase completion
**Then** the phase completes exactly as usual — Session counter, ring and tab title are unaffected and nothing breaks — and the page tells the User in plain language that the completion sound is unavailable, so they know to rely on the ring and the tab title instead

### AC-12 (US-05) — authorization
**Given** the User has granted the page no browser permissions
**When** they use the timer, including in a background tab
**Then** no permission prompt ever appears (no notifications, no microphone, nothing else); sound is enabled by the User's own press of Start, and nothing is fetched from anywhere

### AC-13 (US-06) — happy path
**Given** the page is shown on a phone-width screen, down to 320 CSS pixels wide
**When** the User views any timer state, including a three-digit countdown
**Then** the ring, countdown, phase name, controls and settings fields are all visible and usable without horizontal scrolling or overlapping

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Chime timing, hidden tab, awake device | ≤ 1 s after the countdown reaches zero, including after ≥ 30 min hidden | e2e with the page hidden + manual stopwatch check in two browsers |
| Chime timing, visible tab | ≤ 250 ms after the countdown reaches zero | e2e |
| Ring vs countdown agreement | ring's remaining fraction within 1 s-equivalent of the countdown at every visible update | unit + e2e sample |
| Tab title freshness | visible tab: shows the on-page countdown's whole minute (rounded up) within 1 s; hidden tab: correct within 1 s of a Phase completion, and at most 60 s behind while running | e2e |
| Text contrast | ≥ 4.5:1 for normal text, ≥ 3:1 for large text (WCAG AA) on every palette colour pair in use | automated contrast check over the palette |
| Non-text contrast | each phase's ring colour, and focus indicators, ≥ 3:1 against the background (WCAG AA) | automated contrast check over the palette |
| Phone width | 0 px horizontal overflow at 320 CSS px, with a three-digit countdown | e2e viewport check |
| Chime length | each tone ≤ 2 s, played once, never repeating | unit + e2e |
| Self-contained | 0 network requests, 0 audio files shipped | e2e (extends the existing self-contained-load check) |
| Reduced motion | when the User's system asks for reduced motion: 0 animated ring transitions; the ring changes at most once per second, in discrete steps | e2e with the reduced-motion preference emulated |

## 6.1 Security / privacy

- **Data classification:** public — this step adds no data at all.
- **Personal data touched:** none; no new stored values.
- **AuthZ/AuthN impact:** none — single local User, no accounts; the feature requests no browser permission of any kind (AC-12).
- **Abuse cases:**
  - Two tabs of the app open at once: each chimes and titles for its own timer only; double chimes are an accepted edge case, not reconciled (§3), the same as adjustable-durations §6.1.
  - Rapid Start, Pause and Reset presses: can never make a chime play (AC-07).
  - A devtools-tampered stored duration: cannot produce an instant completion and so a chime burst — adjustable-durations AC-06 already falls back to the classic default.
  - The page opened inside another page: gains nothing — no permissions, no data and no network to reach.
- **Security review:** N/A — no new data, storage, network access or permission boundary.

## 7. Metrics / KPIs

- **Background chime misses in the e2e suite** — baseline: n/a (no chime exists), target: 0 late or missing chimes across all runs at merge.
- **Palette contrast failures** — baseline: unmeasured, target: 0 failing colour pairs at merge.
- **Phase ends the owner misses while working in another tab** — baseline: every one (there is no cue today), target: 0 over the first 7 days of use after ship (owner's own log).

## 8. Open questions

- [ ] Add a mute control after all? Default now: none (§3); both ideation agents flagged it as a risk. — owner: sergii.kushnir@gmail.com, due: 2 weeks after ship
- [ ] Should a screen reader announce a Phase completion? Default now: no live announcement; the phase name stays readable as text. — owner: Tech Lead, due: before `sdd:screens`
- [ ] The exact character of the two tones (pitch, length, envelope)? Default now: soft, each ≤ 2 s, clearly distinguishable. — owner: sergii.kushnir@gmail.com, due: before `sdd:implement`
