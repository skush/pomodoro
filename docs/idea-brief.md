---
status: Draft
owner: "sergii.kushnir@gmail.com"
updated_at: "2026-09-05"
depth: "medium"
---

# Idea brief — pomodoro-timer

## 1. Raw idea

Build a polished, professional Pomodoro timer as a single self-contained index.html file using vanilla HTML, CSS, and JavaScript. Requirements: Timers: 25-minute focus session, 5-minute short break, and 15-minute long break with phase auto-switching. Controls: Start, pause, and reset buttons with a clear visual display of the active state. Features: An SVG circular progress ring that depletes as time passes, a live countdown mirrored in the browser tab title, an optional text input task label to track what you are focusing on, and a daily completed session counter. Audio & Design: A soft completion chime generated via the Web Audio API (no external audio files required) and a clean, modern dark-mode interface.

## 2. Problem

There's no ready single-file, zero-setup Pomodoro timer that also serves as a clean demonstration of vanilla front-end work — most timers either require a framework/build step or are cluttered with ads and accounts. The gap is a trustworthy, accurate timer you can just open, with nothing to install and nothing hidden in the implementation.

## 3. Users

The idea's owner, using it as a personal focus tool and — because it's explicitly a portfolio/demo piece — anyone reviewing the owner's work (e.g. a recruiter or another engineer opening the file to judge code quality) is a secondary audience whose experience of the code (not just the UI) matters.

## 4. Why now

No external trigger — this is a "would be nice" portfolio piece, not a response to an incident or deadline. Said plainly per the interview's own rule: when there's no real trigger, that's worth naming rather than inventing one.

## 5. Out of scope

- **Durable/cross-device session history via a backend + database** — explicitly deferred to a possible future phase; adding a server would break the "open one file" promise that is the point of this feature.
- **Browser push/system notifications** — tab-title countdown + completion chime were judged sufficient; a permission prompt was seen as added complexity/distraction for a single-file demo.
- **Multi-user or account features** — no login, no sharing; single local user only.

## 6. Risks

- User-adjustable focus/break durations were chosen over fixed constants, but what happens if the durations are changed while a session is already running (does it restart? finish the current session on the old value?) is undefined — needs an explicit answer before/during spec.
- A naive `setInterval` countdown drifts once the tab is backgrounded/throttled; the interview resolved to commit to timestamp-based time calculation so the countdown and completion chime stay correct even when the tab isn't focused — this must actually be verified, not assumed, once built.
- The daily completed-session counter is expected to persist locally (same browser/machine) via browser storage; if the owner actually wants the count to survive a wipe or follow them across devices, this brief does not cover that — it's parked in the deferred backend phase.

## 7. Recommendation

Build the timer exactly as scoped: one self-contained `index.html`, classic Pomodoro cadence (long break after every 4th focus session), durations exposed as adjustable rather than hardcoded, and a countdown driven by real elapsed time rather than a naive tick counter so it stays accurate in the background. Keep persistence local-browser-only for now. Treat a real backend-tracked history as a distinct, later feature — not a requirement to satisfy inside this one.

## 8. Open questions

- Behavior when a duration is changed mid-session (restart vs. finish current at old value) — owner: spec.
- When the daily counter resets (local midnight vs. rolling 24h) — owner: spec.
- Whether/when the deferred backend + database phase becomes an actual roadmap item — owner: sergii.kushnir@gmail.com.
