# pomodoro

A single self-contained `index.html` Pomodoro timer. Vanilla JavaScript, no framework, no backend.
Full foundation rationale: `docs/architecture-map.md` + `docs/adr/`.

## Stack

- JavaScript (ES modules), Node.js ≥18 for tooling only — the shipped artifact has zero runtime dependency on Node.
- No framework. No server. No database.
- Persistence: browser `localStorage` only (see `docs/adr/0002-no-backend-for-v1.md`).

## Structure

- `src/logic/` — pure functions / state machine. No DOM, no browser APIs. This is what gets unit-tested.
- `src/ui/` — DOM, SVG, Web Audio, `localStorage` access. Imports from `src/logic/`, never the other way around.
- `src/main.js` — wires `logic` and `ui` together. The only manual wiring point.
- `src/styles.css` — plain CSS, dark-mode only, no preprocessor, no utility framework.
- `scripts/build.js` — bundles `src/` with esbuild and inlines the result into the committed root `index.html`.
- `test/logic/` — `node:test` unit tests against `src/logic/`.

## The build-then-commit workflow

`index.html` at the repo root is **generated**, not hand-edited. Run `npm run build` after any
change under `src/`, and commit the regenerated `index.html` alongside the source change — the two
must never drift. Never mention SQLite/Redis/etc. tokens here; there is no datastore.

## Commands

- `npm run build` — regenerate `index.html`.
- `npm test` — run unit tests (`node --test`, auto-discovers `test/**`).
- `npm run lint` — ESLint (flat config in `eslint.config.js`).

## Conventions

- Error handling: fail-soft in `src/ui/` — clamp invalid input, never throw to the user.
- No IDs, no migrations — no persisted records beyond scalar counters/strings in `localStorage`.
- No component library yet — this is the first feature; whatever it builds in `src/ui/` becomes the
  precedent the next feature reuses.
