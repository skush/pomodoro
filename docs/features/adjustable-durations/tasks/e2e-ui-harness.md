---
id: T10
title: "Add a dev-only headless-browser harness for e2e-through-UI tests"
layer: "tests"
deps: []
blocks: ["T11"]
acs: []
files_hint: ["package.json", "package-lock.json", "test-e2e/"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T10 — Add a dev-only headless-browser harness for e2e-through-UI tests

## Place in the sequence

- **Blocked by:** — · **Blocks:** T11 — Write the e2e-through-UI tests · **Wave:** 1 (no dependency on the feature code; can start with T1/T3).
- **Lane:** own lane (`package.json`, `test-e2e/`) — no overlap with `src/`.

## Why (user story)

> **As a** User
> **I want** my custom durations and cycle length to still be set when I reopen or reload the page
> **So that** I don't have to re-enter them every time
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

Reload behaviour (AC-09, AC-14) can only be tested in a real browser; this task provides the harness that makes that possible.

## Inlined context

> Levels: **unit** (pure engine + validation logic, in-memory storage fake), **e2e-through-UI** (flows driven through the real rendered page in a headless browser).
>
> Note: the automated e2e-through-UI level needs a headless-browser driver as a dev-only dependency, which the repo does not have today. `tasks` and `implement` must add it as an explicit task. It must not enter the shipped `index.html`.
>
> — `spec.md ## Test plan, Levels + Test data, abridged` · full text: [spec.md](../spec.md)

> - Cleanup boundary: per-test. […] a fresh browser context per e2e-through-UI test.
> - For e2e-through-UI, the page's storage is seeded before load.
> - Pre-release / on schedule: e2e-through-UI.
>
> — `spec.md ## Test plan, Test data + CI placement, abridged` · full text: [spec.md](../spec.md)

> **Hard rule:** the shipped artifact has zero runtime dependency on Node; Node ≥18 is for tooling only. `npm test` (`node --test`) auto-discovers `test/**`.
>
> — `CLAUDE.md, Stack + Commands, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

_No spec §5 acceptance criterion maps to this task; it delivers the harness T11 needs. Its DoD is a passing smoke test._

## Checklist

- [ ] Add one headless-browser driver as a **devDependency** only — `package.json`, `package-lock.json`
- [ ] Add script `npm run test:e2e` that runs the suite against the built root `index.html` (opened as a `file://` page or a throwaway static serve) — `package.json`
- [ ] Put e2e files in `test-e2e/`, **not** under `test/`, so `npm test` does not pick them up — `test-e2e/`
- [ ] Add a helper that opens a fresh browser context per test, seeds the page's storage before load from a key/value object, and exposes the countdown text and the field locators — `test-e2e/helpers.js`
- [ ] Add a smoke test: page loads, the Focus countdown reads `25:00` — `test-e2e/smoke.test.js`
- [ ] Exclude `test-e2e/` from lint failures only if the linter cannot parse it; otherwise keep it linted — `eslint.config.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Driver browser binary not installed | `npm run test:e2e` fails with a clear install hint; `npm test` is unaffected |
| `npm run build` not run | Harness reads the committed `index.html`; note in the script output that it must be current |
| Driver import in `src/` | Not allowed — dev-only; `npm run build` output must not contain it |

## Definition of Done

- [ ] `npm run test:e2e` runs the smoke test green
- [ ] `npm test` still passes and does not execute `test-e2e/`
- [ ] the driver appears only under `devDependencies`; `npm run build` output is unchanged
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
