---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-05"
feature_size: ""
ticket: ""
---

# 0003 — Use esbuild as the dev-time build tool

- **Status:** Accepted
- **Date:** 2026-09-05
- **Deciders:** sergii.kushnir@gmail.com, during the `survey` greenfield foundation session

## Context

Once the source is split into modules (ADR 0001), something has to bundle and inline them into the
single committed `index.html`. The tool only runs at dev/build time and must never become a runtime
dependency of the shipped file.

## Decision drivers

- The build tool is dev-time only — must not leak into the shipped artifact's runtime.
- Should be fast and low-ceremony for a small, single-page project.
- No framework-specific tooling — this project is plain JS/CSS/HTML.

## Considered options

1. **esbuild** — very fast, minimal config, well-suited to bundling a handful of plain JS/CSS files into one output; no framework assumptions.
2. **A hand-written Node script (string templating/concatenation)** — zero dependencies, but reimplements bundling logic (module resolution, minification) that's better left to a maintained tool.
3. **A full-featured bundler (e.g. webpack)** — capable but heavyweight configuration for a project this small.

## Decision outcome

**Chosen:** Option 1. esbuild is fast, needs almost no configuration for this project's size, and stays strictly a dev-time tool with no runtime footprint in the generated `index.html`.

## Consequences

**Positive**
- Near-instant builds; simple `npm run build` script.
- Small, well-understood config surface for a project this size.

**Negative**
- One more dev dependency (`devDependencies` only, not part of the shipped file).

**Neutral**
- Swapping to a different bundler later only touches `scripts/build.js`, not the source layout.

## Links

- Architecture map: [[../architecture-map.md]] §Stack
- Related ADR: [[0001-generate-single-file-from-modular-source.md]]
