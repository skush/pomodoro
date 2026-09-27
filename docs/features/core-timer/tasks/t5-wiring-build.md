---
id: T5
title: "Wire main.js and regenerate the committed index.html"
layer: "wiring"
deps: ["T4"]
blocks: ["T7"]
acs: []
files_hint: ["src/main.js", "index.html", "scripts/build.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T5 — Wire main.js and regenerate the committed index.html

## Place in the sequence

- **Blocked by:** T4 — UI layer: render phase + countdown, wire Start/Pause/Reset. **Blocks:** T7 — README + GitHub Pages hygiene (needs a working committed `index.html` to point the Pages deploy at). **Wave:** 3 (final assembly step — the single manual wire-up point).
- **Lane:** own files (`src/main.js`, `index.html`, `scripts/build.js`) — no overlap with earlier tasks.

## Why (user story)

This task has no dedicated §4 user story of its own — it is the wiring step that makes US-01 through US-06 reachable by a User opening the page at all, per the single manual wire-up convention.

> `src/main.js` — wiring: instantiates the logic engine, hands it to ui.mount. The only manual wiring point.
>
> — `CLAUDE.md, Structure, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

## Inlined context

> `index.html` at the repo root is **generated**, not hand-edited. Run `npm run build` after any change under `src/`, and commit the regenerated `index.html` alongside the source change — the two must never drift.
>
> — `CLAUDE.md, The build-then-commit workflow, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> Self-contained load | zero network requests beyond the initial `index.html` load | manual check via the browser devtools Network tab
>
> — `spec.md §6, NFR table row "Self-contained load", verbatim` · full text: [spec.md](../spec.md)

> `scripts/build.js` — bundles `src/` with esbuild and inlines the result into the committed root `index.html`.
>
> — `CLAUDE.md, Structure, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

This is a pure wiring/build task — it satisfies no §5 AC directly; it is the precondition for every UI-facing AC (T4) to be reachable by an actual User in a browser.

## Checklist

- [ ] `src/main.js` imports `mount` from `src/ui/index.js` and calls it on `document.getElementById('app')` — `src/main.js`
- [ ] Run `npm run build` to regenerate `index.html` from `src/` — `scripts/build.js`, `index.html`
- [ ] Verify the regenerated `index.html` opens standalone with zero network requests beyond its own load (spec §6 NFR) — `index.html`
- [ ] Commit the regenerated `index.html` alongside the `src/` changes in the same change set (`CLAUDE.md` build-then-commit workflow)

## Edge cases

| Case | Behaviour |
|---|---|
| `index.html` committed without a matching `npm run build` run after a `src/` change | Forbidden by convention — the two must never drift (`CLAUDE.md`) |
| Opening `index.html` directly from disk (no dev server) | Must work with zero network requests (spec §6 NFR) |

## Definition of Done

- [ ] `npm run build` completes and `index.html` reflects the current `src/` content
- [ ] Manual check: opening `index.html` in a browser shows the mounted timer with zero network requests in devtools
- [ ] every Hard Rule inlined above still holds
- [ ] lint + vet clean
