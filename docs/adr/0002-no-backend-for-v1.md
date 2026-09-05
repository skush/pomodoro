---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-05"
feature_size: ""
ticket: ""
---

# 0002 — Use browser localStorage instead of a backend + database for v1

- **Status:** Accepted
- **Date:** 2026-09-05
- **Deciders:** sergii.kushnir@gmail.com, during the `interview` and `survey` sessions

## Context

The idea brief originally proposed tracking sessions in a database via a Node.js backend, but the
core requirement is a single self-contained `index.html`. Adding a server changes what the project
is — no longer "open one file" — so the two were weighed against each other directly.

## Decision drivers

- Must ship as one self-contained `index.html`, zero deployment (`docs/idea-brief.md` §1).
- The project is explicitly a portfolio/demo piece valuing clean, minimal execution (`docs/idea-brief.md` §3).
- No stated need yet for cross-device history — only a local daily counter (`docs/idea-brief.md` §6).

## Considered options

1. **Backend + database now** — durable, queryable, cross-device session history; requires running and deploying a server, breaking the single-file promise.
2. **Browser localStorage only** — daily counter and last task label persist locally per browser/machine; zero server, fits the self-contained-file constraint exactly.
3. **No persistence at all** — simplest, but the "daily completed session counter" requirement becomes meaningless across reloads.

## Decision outcome

**Chosen:** Option 2. Satisfies the daily-counter requirement with real persistence while keeping the deliverable a single file with no deployment story. A backend-tracked history is deferred as a distinct future feature, not folded into this one.

## Consequences

**Positive**
- Zero infrastructure to build, run, or maintain for v1.
- The counter/task-label requirement is genuinely met (survives reloads), not merely simulated.

**Negative**
- No cross-device or cross-browser history; clearing site data loses the counter.
- If a backend phase is built later, it will need a migration path for whatever's in localStorage (or accept that v1 history simply doesn't carry over).

**Neutral**
- Revisiting this decision later is a separate, additive feature, not a rewrite of the v1 timer itself.

## Links

- Idea brief: [[../idea-brief.md]] §5, §7, §8
- Architecture map: [[../architecture-map.md]] §Datastores, §Constraints & known tech-debt
