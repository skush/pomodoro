---
id: T18
title: "Review fix F8: source scan forbidding permission-requesting APIs under src/"
layer: "tests"
deps: []
blocks: []
acs: ["AC-12"]
files_hint: ["test/logic/no-permission.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "XS"
status: "done"
origin: "review-2026-09-30 F8"
---

# T18 — Source scan: no permission-requesting API under src/

## Why

Review finding F8 ([review-2026-09-30.md](../_review/review-2026-09-30.md)). The AC-12 e2e
(`test-e2e/sensory-feedback-chime.e2e.js:140-152`) can only check `Notification.permission`,
because headless browsers don't raise permission prompts as `dialog` events. A static scan guards
the whole API family, in the style of `test/logic/write-guard.test.js`.

## Checklist

- [ ] Walk every `.js` file under `src/`. Fail on `requestPermission`, `getUserMedia`, `navigator.permissions` or `Notification(`, and name the file and line.
- [ ] Positive control: the matcher flags a sample string that contains each token.

## Definition of Done

- [ ] `npm test` passes. `npm run lint` is clean.
