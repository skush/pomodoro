# Data-model audit — sensory-feedback (2026-09-30)

**Outcome:** no schema change. Zero migrations staged. Nothing written to a live `migrations/` tree
(the repo has none: no database, ADR-0002).

- **Staged migration files:** none.
- **Promote-time convention hint:** N/A, there is no migration tool or naming to follow.
- **Conventions detected:** `localStorage` scalars namespaced `<feature>:<key>`, written only by
  `src/ui/index.js` gatekeepers. This feature adds none.
- **Convention deviations:** none.
- **Drift detection:** N/A. There is no DDL to compare with a domain layer. The seven existing keys
  match the constants in `src/ui/index.js:29-36`.
- **Breaking-change decompositions:** none.
- **TBDs:** none.

**Self-check (4 mandatory):** naming (N/A, no new names) · down reversibility (vacuous, 0 up files) ·
FK indexes (vacuous, 0 FKs) · convention adherence (pass, nothing added). The `erDiagram` block
parse-check is below.

`api` would also have accepted the fast-lane skip: no endpoint, event or public signature changes.
