---
id: T15
title: "Review fix F5: fall back to the main-thread timer when the wake-up worker errors after construction"
layer: "ui"
deps: ["T7"]
blocks: ["T13"]
acs: ["AC-06"]
files_hint: ["src/ui/wakeup.js", "test/logic/wakeup.test.js", "index.html"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
status: "done"
origin: "review-2026-09-30 F5"
---

# T15 — Fall back when the worker errors after construction

## Why

Review finding F5 ([review-2026-09-30.md](../_review/review-2026-09-30.md)). `ensureWorker()` in
`src/ui/wakeup.js:61-86` falls back only when `new WorkerClass(url)` throws. A worker whose script
fails to load later fires an `error` event that nothing listens for. Causes include a CSP block, or
the blob URL being revoked at `wakeup.js:72` before the load finishes. `workerFailed` stays false,
`arm()` keeps posting to a dead worker, and the main-thread fallback never starts. That contradicts
spec §3 and ADR-0001: "if the wake-up worker cannot start the page falls back to a main-thread timer".

## Checklist

- [ ] Add `worker.onerror`. It sets `workerFailed = true`, drops the worker, and re-arms the current deadline through `setTimeoutFn`, if one is armed. It never throws (fail-soft, CLAUDE.md).
- [ ] The page-side handlers still only call `onWake`, never an engine control method (ADR-0001 carve-out). Keep the message-channel source scan green.
- [ ] Unit test in `test/logic/wakeup.test.js`: a fake worker fires `onerror` after `arm()`, and `onWake` fires once through the fallback timer. A later `arm()` uses the fallback. A cancelled arm never fires.
- [ ] `npm run build`, then commit the regenerated `index.html`.

## Definition of Done

- [ ] `npm test` and `npm run lint` pass. `index.html` matches `src/`.
