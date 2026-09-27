# Tracker — core-timer

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Engine control state machine (start/pause/reset + no-ops) | domain | sergii.kushnir@gmail.com | S | — | done |
| T2 | Phase cadence + backgrounding reconciliation | domain | sergii.kushnir@gmail.com | S | T1 | done |
| T3 | Unit tests for the engine state machine | tests | sergii.kushnir@gmail.com | S | T1, T2 | done |
| T4 | UI rendering + control wiring | ui | sergii.kushnir@gmail.com | S | T1, T2 | done |
| T5 | Wire main.js + regenerate index.html | wiring | sergii.kushnir@gmail.com | S | T4 | done |
| T6 | Automated backgrounding/drift hardening test | tests | sergii.kushnir@gmail.com | S | T3 | done |
| T7 | README + GitHub Pages hygiene | docs | sergii.kushnir@gmail.com | S | T5 | done |

**Total:** 7 tasks, ~1 person-day (XS effort budget, `.size`). **All 7 done.**

> **Implementation note (2026-09-27):** this breakdown was written against an already-committed
> core-timer implementation (commits `42c7339`, `9380a64`, `7e9d6e4`). Running `/sdd:implement
> core-timer` verified — rather than re-derived — each task: the per-task gate (`npm test`: 18/18
> green covering every AC in `acs`; `npm run lint`: clean; `npm run build`: reproduces the committed
> `index.html` byte-for-byte, no drift) passed for every task's Definition of Done as already
> implemented. No `vet`/typecheck command exists for this vanilla-JS project (none configured — not
> a gap); no integration-test tier or Docker daemon is applicable (`require_integration: auto` →
> NON-red, correctly so for a zero-backend static page). The one real gap found — sad.md §11's risk
> row still describing the drift NFR as "verified only manually," stale since T6's automated test
> was added in `7e9d6e4` — was fixed in this pass. No task required new production code or new
> commits beyond that doc fix.
