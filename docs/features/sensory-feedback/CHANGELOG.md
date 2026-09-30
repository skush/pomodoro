# Changelog — sensory-feedback

## sensory-feedback — progress ring, tab-title mirror, completion chime and phase colours

**What:** The timer now shows how much of the phase is left and which phase it is without reading the digits. A progress ring empties in step with the countdown and has its own colour per phase type (Focus / Short break / Long break). The browser tab title mirrors the state in whole minutes, rounded up (running, paused, or ready to start). A short chime plays at each Phase completion, with a rising tone for Focus end and a falling tone for break end. The chime fires exactly once per completion, including when the tab is in the background. If sound is unavailable, the page says so in plain language and everything else works as before.

**Why:** A User working in another tab had no way to learn that a phase ended ([spec](spec.md) §1). This closes roadmap step 5, which core-timer deferred. Key decisions:
- [ADR-0001](adr/0001-wake-the-page-at-the-deadline-from-an-inline-worker.md) — an inline Blob worker wakes the page at the deadline, because browsers throttle main-thread timers in hidden tabs (see the amendments for the `onerror` fallback and the "started" wording).
- [ADR-0002](adr/0002-extend-engine-snapshot-with-phase-length-and-completion-record.md) — the engine snapshot carries the phase length and a one-shot completion flag, so the UI stays a pure function of the snapshot.

Two decisions by the owner: the tab title shows minutes, not seconds, and Firefox is excluded from the background-timing promise (roadmap step 6).

**How to use:** Press Start (this also unlocks sound in the browser — no permission prompt appears). Switch tabs as you like; the chime starts within 1 s of the deadline and the title already shows the next phase waiting for Start. A notice appears if the browser blocks or suspends sound; the ring and the tab title keep working.

**Operational notes:**
- Migration: none. No new stored values.
- Feature flag / config: none.
- Build: `index.html` is regenerated (`npm run build`) and committed with the source. The wake-up worker is inlined, so there are still 0 network requests and no audio files.
- Known limits:
  - Desktop Chrome (Edge shares the engine) only; Firefox is deferred.
  - After device sleep the chime plays once when the page runs again, never on time (AC-06b).
  - "Within 1 s" is the moment the page hands the tone to audio output. Audible latency depends on the output device. Real Chrome 154 runs: hidden 1 min, tone scheduled +37 ms after the deadline, audible about 1 s; hidden 30 min, audible under 0.25 s (by ear).
  - There is no mute control (open question, revisit 2 weeks after ship).
- Rollback: revert the merge commit; nothing persisted depends on it.

**Acceptance criteria delivered:** AC-01–AC-13 (incl. AC-06b) — the ring sweeps with the countdown and is full after Reset and a new durations commit; per-phase colour with the phase name still shown as text; tab title for running/paused/ready; distinct Focus-end and break-end tones; chime started within 1 s in a hidden tab, once per completion, never from a control press; chime and Session counter credited together (and not across a passed midnight); a plain notice when sound is unavailable; no permission prompt; usable down to 320 px.
