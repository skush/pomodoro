---
status: Draft
owner: "sergii.kushnir@gmail.com"
reviewers: ["Tech Lead"]
updated_at: "2026-09-27"
feature_size: "XS"
---

# Spec — session-tracking

> **Glossary:** [CONTEXT](../../../CONTEXT.md)
> **Reference module / docs / channels used:** `docs/idea-brief.md` §1/§6/§8, `docs/roadmap.md` step 3 + open decision D2, `docs/architecture-map.md` (Datastores), and `docs/features/core-timer/{spec.md,sad.md,adr/0002-structural-encapsulation-control-guard.md}` for the established write-guard pattern this spec reuses.

## 1. Context

core-timer shipped a trustworthy timer engine, but a User running a session today has no way to note what they're focusing on, and no way to see how many Focus sessions they've actually completed — they'd have to track both themselves outside the app. This step is the first roadmap increment after core-timer: it adds a task-label note and a daily completed-Focus-session count, both scoped to this single browser.

There's no external trigger — this is the next unblocked "would be nice" portfolio increment (`docs/idea-brief.md` §4), not a response to an incident or deadline; it exists because core-timer is done and this is the next roadmap step in order.

The committed approach: a task-label text input whose last value is saved to and restored from this browser's local storage, and a daily count of naturally-completed Focus sessions that resets at local midnight — both written only through the app's own UI layer, reusing core-timer's structural-encapsulation write-guard so nothing outside the page's own legitimate write paths (a Focus-session completion, the label input's own change handler, and the daily-rollover check) can ever alter either value. This deliberately diverges from the project's default clamp-invalid-input convention for the task-label limit: over-limit input is rejected as a whole with an inline message rather than silently truncated, so the User always knows the limit exists rather than losing text without noticing.

`docs/roadmap.md`'s open decision D2 ("local midnight vs. rolling 24h window") is resolved here as **local midnight** — matching the placeholder assumption already recorded in `docs/architecture-map.md`'s Datastores table. `CONTEXT.md`'s existing "Task label" definition (persisted, pre-filled from the last-saved value) is what this spec's AC-03 formalizes as testable, business-observable behavior.

## 2. Goals

- A User can note what they're currently focusing on in a simple text field that remembers its last value across reloads.
- A User can see, at a glance, how many Focus sessions they've completed today, updating live as sessions complete.
- The daily count is trustworthy: it credits only genuinely-completed Focus sessions, survives the tab being left open across a midnight boundary without corruption, and cannot be changed by anything other than the page's own timer completing or its own label input.

## 3. Non-goals

- **Per-session history** (which label was attached to which specific completed session) — deferred; only a single running daily total is kept, matching `CONTEXT.md`'s existing "Session counter" definition (cumulative only, no log).
- **Manually editing or resetting the daily counter** — no settings surface for this; keeps the count trustworthy without adding a way to tamper with it.
- **Weekly/monthly aggregate stats or charts** — a later roadmap step's concern, not this one.
- **Cross-device/cloud sync of the counter or label** — inherited from the no-backend decision (`docs/adr/0002-no-backend-for-v1.md`); local-browser-only for this step.
- **A settings screen for the task-label length limit** — the limit is a fixed constant for this step (no settings UI exists yet in this app); making it configurable is future scope, not this one.

## 4. User stories

### US-01: Note what I'm focusing on

**As a** User
**I want** to type a short label describing my current task
**So that** I can remind myself what I'm focusing on during this session

### US-02: See today's completed focus count

**As a** User
**I want** to see how many Focus sessions I've completed today
**So that** I can gauge my progress without counting manually

### US-03: Keep my last task label after reloading

**As a** User
**I want** the task label I last typed to still be there when I reopen or reload the page
**So that** I don't have to retype it every time

### US-04: Trust the daily count starts over for a new day

**As a** User
**I want** the completed-session count to correctly start over at the beginning of a new day
**So that** yesterday's sessions never inflate today's count

### US-05: Trust nothing but my own actions change the count

**As a** User
**I want** the saved count and label to change only because of my own completed sessions and my own typing
**So that** I can rely on what the app shows me as accurate

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** a User is viewing the app
**When** the User types text into the task label field
**Then** the system displays exactly what they typed as the current task label

### AC-01b (US-01) — happy path (empty state)

**Given** the task label field currently holds no saved value
**When** the User views it
**Then** the system shows a placeholder hint inviting the User to describe what they're focusing on, and that hint disappears the moment the User types anything

### AC-02 (US-01) — error

**Given** a User is typing into the task label field
**When** the text they've typed would exceed 100 characters
**Then** the system rejects that input as a whole — the label is not saved or updated past its last valid value, and no part of it is silently truncated — and shows the User an inline message that the task label must be 100 characters or fewer

### AC-03 (US-03) — happy path

**Given** a User saved a task label on a previous visit
**When** the User reopens or reloads the page
**Then** the system pre-fills the task label field with exactly that last-saved value

### AC-04 (US-02) — happy path

**Given** a User completes a Focus session naturally (its countdown reaches zero while running)
**When** that completion happens
**Then** the system increments today's completed-session count by exactly one and displays the updated count

### AC-05 (US-02) — domain invariant

**Given** a User resets the current phase, or a Short break or Long break phase completes
**When** that happens
**Then** the system does not change today's completed-session count — only a Focus phase reaching zero naturally increments it

### AC-06 (US-04) — cross-context

**Given** the tab is left open, backgrounded, or the machine sleeps across local midnight, whether mid-session or between sessions
**When** the User next views the page after local midnight has passed
**Then** the system shows a completed-session count that reflects only sessions completed on the new calendar day — the previous day's count is not carried over

### AC-07 (US-05) — authorization

**Given** the app's saved daily count and task label
**When** a write attempt arrives from anything other than this page's own Focus-completion event, its own task-label input field, or its own daily-rollover check (for example a message from another tab or origin, or any other unwired source)
**Then** the system's write guard ignores it — only those three paths can ever change the saved count or label, a built and testable behavior, not merely an assumption about browser isolation

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Task label length limit | ≤ 100 characters, enforced by rejecting the whole over-limit input (not truncating) with an inline message | unit test on the validation function |
| Daily count persistence | Value and its calendar date survive 100% of a full browser close-and-reopen cycle, with 0 data loss, until the User clears site data | manual check: close and reopen the browser |
| Daily reset correctness | The count resets to 0 on the first read after local midnight has passed, verified across 100% of ≥5 mocked midnight-boundary test cases (exactly-at-midnight, mid-sleep crossing, long-absence crossing, and others), regardless of how long the tab was left open beforehand | unit test using a fixed/mocked date boundary |
| Corrupted or missing persisted state | 0 thrown exceptions across all fuzzed/invalid stored-data cases (missing key, malformed JSON, wrong type) — falls back to count = 0, label = empty | unit test with invalid stored data |
| Self-contained load | Zero network requests beyond the initial `index.html` load (unchanged from core-timer) | manual check via the browser devtools Network tab |

## 6.1 Security / privacy

- **Data classification:** internal — persisted only in this browser's local storage; nothing is transmitted anywhere.
- **Personal data touched:** potentially, if the User types something personal (e.g. a client or project name) into the task label — stored only locally, never transmitted, never logged.
- **AuthZ/AuthN impact:** none — single local User, no accounts; the only boundary is the AC-07 write guard (only a Focus-completion event, the label input's own change handler, and the daily-rollover check can change saved state).
- **Abuse cases:**
  - a message from another tab or origin attempting to write the counter or label: denied by the AC-07 guard, reinforced by (not resting solely on) the browser's own execution-context isolation.
  - two tabs of this same app open at once, each independently writing to the same shared local storage: not defended against — accepted as an edge case outside this step's scope (a single local User is assumed to run one tab at a time); unlike the in-memory timer engine, local storage is genuinely shared across same-origin tabs, so this is a real gap, not just a theoretical one — a future step can add cross-tab reconciliation if it becomes a real problem.
  - a User editing local storage directly via devtools: accepted — it's their own local copy of the page, not an action against another party (same reasoning as `docs/features/core-timer/spec.md` §6.1).
  - a User pasting a very long or unusual string into the task label: rejected past 100 characters (AC-02) and always rendered as plain text, never interpreted as markup — no script-injection surface since nothing is rendered as HTML.
- **Security review:** N/A — no backend, no accounts, no persisted or transmitted data beyond this browser's own local storage (same reasoning as core-timer).

## 7. Metrics / KPIs

- **Daily-count correctness across a midnight boundary** — baseline: unverified (0), target: confirmed via the NFR check (unit test + manual check) before this step is marked done.
- **Task-label round-trip persistence** — baseline: unverified (0), target: a saved label confirmed to survive a full page reload before this step is marked done.
- **Counter/label write integrity** — baseline: unverified (0), target: 100% of non-own-write attempts confirmed as no-ops (AC-07), verified by unit tests before this step is marked done.

## 8. Open questions

- [ ] Should the task label clear automatically once a Long break begins (mirroring the in-cycle focus count's reset), or does it persist indefinitely until the User changes it? Default now: persists indefinitely — a task can reasonably span multiple cycles. — owner: PM (sergii.kushnir@gmail.com), due: before `design`
- [ ] Exact wording of the task-label's placeholder hint and the 100-character rejection message? Default now: implementer's choice at `design`/`screens` time, kept short and plain-language. — owner: Tech Lead, due: before `screens`/`design`
