---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-05"
feature_size: ""
ticket: ""
---

# 0001 — Generate the single-file deliverable from modular source instead of hand-maintaining it

- **Status:** Accepted
- **Date:** 2026-09-05
- **Deciders:** sergii.kushnir@gmail.com, during the `survey` greenfield foundation session

## Context

The idea brief requires a single self-contained `index.html` with no framework, but the pipeline
relies on TDD throughout `implement`. A hand-maintained single file has no natural unit-test seam;
the timer/cycle logic needs to be importable and testable in isolation.

## Decision drivers

- Must ship as one self-contained `index.html` (`docs/idea-brief.md` §1).
- The pipeline requires unit-testable production code (TDD gate in `implement`).
- No framework, no runtime dependency in the shipped artifact.

## Considered options

1. **Hand-maintain everything directly in index.html** — truest to "single file" literally, but logic isn't importable, forcing a headless-browser/DOM test harness for even pure logic.
2. **Modular source + a build step that inlines into one committed index.html** — source stays testable with a plain Node test runner; the build step is a dev-time tool only, invisible to anyone opening the shipped file.
3. **Ship multiple files (index.html + separate .js/.css)** — simplest to test, but violates the explicit "self-contained single file" requirement.

## Decision outcome

**Chosen:** Option 2. Keeps the shipped artifact exactly as specified (one file, open and go) while giving the logic layer a normal, framework-free unit-test seam via Node's built-in test runner.

## Consequences

**Positive**
- Logic (`src/logic/`) is testable with zero browser/DOM dependency.
- The shipped `index.html` still has zero runtime dependencies — the build tool only runs at dev time.

**Negative**
- Adds one dev-time step (`npm run build`) that must run before the committed `index.html` is trusted as current — a source/output drift is possible if someone edits `index.html` directly.

**Neutral**
- The build step can be swapped for a different bundler later without touching the source layout.

## Links

- Idea brief: [[../idea-brief.md]]
- Architecture map: [[../architecture-map.md]] §Stack, §Module inventory
- Related ADR: [[0003-esbuild-as-the-build-tool.md]]
