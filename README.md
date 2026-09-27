# pomodoro

A single self-contained `index.html` Pomodoro timer. Vanilla JavaScript, no framework, no backend.

**Live:** https://skush.github.io/pomodoro/

## Run it

Open `index.html` directly in a browser — it's a static file with no build step required at runtime.

## Develop

Source lives under `src/` and is bundled into the committed root `index.html` by `scripts/build.js`.
See [CLAUDE.md](CLAUDE.md) for the full structure and workflow.

```
npm install
npm run build   # regenerate index.html from src/
npm test        # unit tests (node --test)
npm run lint    # eslint
```

`index.html` is generated, not hand-edited — always run `npm run build` after changing `src/` and
commit the regenerated file alongside the source change.

## Design docs

- `docs/architecture-map.md` and `docs/adr/` — project-wide foundation and decisions.
- `docs/features/core-timer/` — spec, SAD, and ADRs for the core timer feature.
- `CONTEXT.md` — domain glossary and invariants.
