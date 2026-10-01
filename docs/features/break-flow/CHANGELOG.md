# Changelog — break-flow

## break-flow — breaks start on their own, Start focus during a break, Allow pausing focus

**What:** After an On-time Focus completion the next break (Short or Long) now starts counting down
by itself (setting **Auto-start breaks**, on by default). During any break a single **Start focus**
control ends it and starts the next Focus at once, without touching the cycle or the day's count.
A second setting, **Allow pausing focus** (off by default), makes Focus indivisible: with it off a
running Focus offers only Reset focus. Every control now names its phase (Start/Pause/Resume/Reset
*focus* or *break*). A break is never used up by a sleeping device: a completion noticed more than
5 s late leaves the break waiting at full length, and one noticed more than 2 minutes late plays no
chime and shows no sound notice (sensory-feedback AC-06b).

**Why:** Every break waited for a Start press, so a missed chime meant a lost break, and there was
no direct way back to Focus from a break. See [spec.md](spec.md) §1/§2. Key decisions:
[ADR-0001](adr/0001-auto-start-breaks-with-a-backdated-start-from-the-ui.md) (the UI backdates the auto-start to the Focus end),
[ADR-0002](adr/0002-enforce-skip-guard-and-focus-pause-policy-in-the-engine.md) (the Skip guard and focus-pause policy are enforced in the engine) and
[ADR-0003](adr/0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots.md) (controls are
derived from a pure layout and rendered into three fixed slots, so keyboard focus and the Skip guard
are predictable). Supersedes parts of core-timer and
sensory-feedback as listed in spec §1.

**How to use:** Defaults need no action: finish a Focus and the break starts. Press **Start focus**
at any moment of a break to skip to Focus (it is greyed out for the first 3 s of a break so a
reflex press can't skip it). Turn Auto-start breaks off, or Allow pausing focus on, next to the
duration settings.

**Operational notes:**
- Migration: none — no backend or database. Two new `localStorage` keys, `break-flow:auto-start-breaks` and `break-flow:allow-pausing-focus`; a missing or invalid value reads as the default.
- Feature flag / config: the two settings above are the only knobs.
- Rollback: revert the merge and re-run `npm run build` (static `index.html`); the two saved keys are simply ignored by the older build.
- Tooling: `npm run test:e2e` now includes `test-e2e/break-flow.e2e.js`.
- Known limit: Firefox background-tab timing is not promised (spec AC-01). The final build was not put through another real device sleep after the 2-minute rule; that rule is covered by unit and fake-clock e2e tests.
