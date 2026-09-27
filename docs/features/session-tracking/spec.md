---
status: Draft
owner: "sergii.kushnir@gmail.com"
reviewers: ["Tech Lead"]
updated_at: "2026-09-28"
feature_size: "XS"
---

# Spec — session-tracking

> **Glossary:** [CONTEXT](../../../CONTEXT.md)
> **Reference module / docs / channels used:** `docs/idea-brief.md` §1/§6/§8, `docs/roadmap.md` step 3 + open decision D2, `docs/architecture-map.md` (Datastores), and `docs/features/core-timer/{spec.md,sad.md,adr/0002-structural-encapsulation-control-guard.md}` for the established write-guard pattern this spec reuses.

## 1. Context

core-timer shipped a trustworthy timer engine, but a User running a session today has no way to note what they're focusing on, and no way to see how many Focus sessions they've actually completed — they'd have to track both themselves outside the app. This step is the first roadmap increment after core-timer: it adds a task-label note and a daily completed-Focus-session count, both scoped to this single browser.

There's no external trigger — this is the next unblocked "would be nice" portfolio increment (`docs/idea-brief.md` §4), not a response to an incident or deadline; it exists because core-timer is done and this is the next roadmap step in order.

The committed approach: a task-label text input, committed to this browser's local storage when the User leaves the field or presses Enter (not on every keystroke) and restored on the next load, and a daily count of naturally-completed Focus sessions — credited to the calendar day each session actually finished on, resetting only forward at local midnight, never backward even if the device's clock moves back — both written only through the app's own UI layer, reusing core-timer's structural-encapsulation write-guard: only a Focus-session completion, the label's own commit, and the daily-rollover check may ever write these values, and each of those writes always reflects the app's own current state, overwriting rather than adopting anything changed outside it (e.g. by another tab or a devtools edit). This deliberately diverges from the project's default clamp-invalid-input convention for the task-label limit: typing simply stops accepting further characters once the 100-character limit is reached, rather than accepting more and truncating or rejecting afterward.

`docs/roadmap.md`'s open decision D2 ("local midnight vs. rolling 24h window") is resolved here as **local midnight** — matching the placeholder assumption already recorded in `docs/architecture-map.md`'s Datastores table. `CONTEXT.md`'s existing "Task label" definition (persisted, pre-filled from the last-saved value) is what this spec's AC-03 formalizes as testable, business-observable behavior.

## 2. Goals

- A User can note what they're currently focusing on in a simple text field that remembers its last value across reloads.
- A User can see, at a glance, how many Focus sessions they've completed today, updating live as sessions complete.
- The daily count is trustworthy: it credits only genuinely-completed Focus sessions on the calendar day they actually finished, survives the tab being left open across a midnight boundary without corruption or ever resetting backward, and only ever changes through the page's own timer completion, its own label commit, or its own daily-rollover check — never through anything else.

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

**Given** a User is typing into the task label field and it already holds 100 characters (measured as raw string length, not a visual-character count)
**When** the User attempts to enter more text, whether by typing or pasting
**Then** the system does not accept anything beyond the 100th character — the field never exceeds 100 characters, whether the attempt was one keystroke or a paste that would have pushed it over — and shows the User an inline message that the task label is limited to 100 characters

### AC-03 (US-03) — happy path

**Given** a User saved a task label on a previous visit
**When** the User reopens or reloads the page
**Then** the system pre-fills the task label field with exactly that last-saved value

### AC-04 (US-02) — happy path

**Given** a User completes a Focus session naturally (its countdown reaches zero while running)
**When** that completion is detected
**Then** the system credits the completed-session count for the calendar day the session actually finished on (its true completion moment, not the moment the completion is detected) — if that day is still the day currently being tracked, the displayed count increases by exactly one; if a new calendar day has since begun, the increment does not carry into the new day (see AC-06), which starts at zero regardless

### AC-04b (US-02) — happy path (load state)

**Given** a User opens or reloads the page
**When** the page finishes loading
**Then** the system displays today's completed-session count as currently saved, showing 0 if no Focus session has completed yet today

### AC-05 (US-02) — domain invariant

**Given** a User resets the current phase, or a Short break or Long break phase completes
**When** that happens
**Then** the system does not change today's completed-session count — only a Focus phase reaching zero naturally increments it

### AC-06 (US-04) — cross-context

**Given** the tab is left open, backgrounded, or the machine sleeps across local midnight, whether mid-session or between sessions
**When** the count is next read (on page load, on the tab becoming visible, on any display refresh, or right before crediting a completed session — see AC-04) and local midnight has passed since the count was last reset
**Then** the system resets the count to zero for the new calendar day before doing anything else with it — the previous day's count, and any session whose true completion fell before that midnight, is not carried into the new day's count

### AC-06b (US-04) — domain invariant (clock regression)

**Given** the device's clock or date has moved backward since the count was last reset, so the currently stored date is later than what the device now reports as today
**When** the count is next read or about to be credited
**Then** the system leaves the count as it is — it only ever resets forward to a later calendar day, never backward to an earlier one

### AC-07 (US-05) — authorization

**Given** the app's saved daily count and task label
**When** a write attempt arrives from anything other than this page's own Focus-completion event, its own task-label commit, or its own daily-rollover check (for example a message from another tab or origin, a change made in another same-origin tab, or a devtools edit)
**Then** the system's write guard ignores that attempt as a trigger for its own logic, and the next time one of those three legitimate paths writes, it writes the app's own current in-memory value — overwriting, never adopting, whatever the saved value had become in the meantime; only those three paths, carrying the app's own state, ever determine what ends up saved

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Task label length limit | ≤ 100 characters, counted as raw string length (not a visual-character count), enforced by refusing further input once the limit is reached (a hard stop while typing/pasting, never a post-hoc truncation) | unit test on the validation function |
| Daily count persistence | Value and its calendar date survive 100% of a full browser close-and-reopen cycle, with 0 data loss, until the User clears site data | manual check: close and reopen the browser |
| Daily reset correctness | The count resets to 0 on the first read after local midnight has passed (never resetting for a backward clock/date change — AC-06b), verified across 100% of ≥5 mocked midnight-boundary test cases (exactly-at-midnight, mid-sleep crossing, long-absence crossing, a true-completion-before-midnight crossing, and a backward clock change), regardless of how long the tab was left open beforehand | unit test using a fixed/mocked date boundary |
| Corrupted or missing persisted state | Each field falls back to its own default independently (an invalid/negative/non-numeric count resets to 0; an unparseable stored date is treated as no prior date, forcing a fresh rollover; an invalid stored label falls back to empty) — 0 thrown exceptions across all fuzzed/invalid stored-data cases (missing key, malformed JSON, wrong type) | unit test with invalid stored data |
| Storage write failure | The app keeps functioning normally in-memory for the current page load — 0 exceptions thrown, no error shown to the User — the unsaved value simply isn't restored on the next reload | unit test simulating a write failure (e.g. the storage call throwing) |
| Self-contained load | Zero network requests beyond the initial `index.html` load (unchanged from core-timer) | manual check via the browser devtools Network tab |

## 6.1 Security / privacy

- **Data classification:** internal — persisted only in this browser's local storage; nothing is transmitted anywhere.
- **Personal data touched:** potentially, if the User types something personal (e.g. a client or project name) into the task label — stored only locally, never transmitted, never logged.
- **AuthZ/AuthN impact:** none — single local User, no accounts; the only boundary is the AC-07 write guard (only a Focus-completion event, the label's own commit, and the daily-rollover check trigger the app's own logic; the app's own next write always overwrites whatever it finds saved).
- **Abuse cases:**
  - a message from another tab or origin attempting to write the counter or label: ignored as a trigger, denied by the AC-07 guard, reinforced by (not resting solely on) the browser's own execution-context isolation.
  - two tabs of this same app open at once, each independently writing to the same shared local storage: each tab's own next write (AC-07) overwrites whatever the other tab left behind with its own in-memory value — no reconciliation between the two tabs' counts is attempted; accepted as an edge case outside this step's scope (a single local User is assumed to run one tab at a time). Unlike the in-memory timer engine, local storage is genuinely shared across same-origin tabs, so this is a real gap, not just a theoretical one — a future step can add cross-tab reconciliation if it becomes a real problem.
  - a User editing local storage directly via devtools: accepted while the tab is freshly reloaded (the edit is read as the new baseline); once the app's own code writes again (a completion, a label commit, or a rollover), that write overwrites the manual edit — same reasoning as `docs/features/core-timer/spec.md` §6.1, extended by the AC-07 overwrite rule.
  - a User pasting a very long or unusual string into the task label: rejected past 100 characters (AC-02) and always rendered as plain text, never interpreted as markup — no script-injection surface since nothing is rendered as HTML.
- **Security review:** N/A — no backend, no accounts, no persisted or transmitted data beyond this browser's own local storage (same reasoning as core-timer).

## 7. Metrics / KPIs

- **Daily-count correctness across a midnight boundary** — baseline: unverified (0), target: confirmed via the NFR check (unit test + manual check) before this step is marked done.
- **Task-label round-trip persistence** — baseline: unverified (0), target: a saved label confirmed to survive a full page reload before this step is marked done.
- **Counter/label write integrity** — baseline: unverified (0), target: 100% of external write attempts (AC-07) confirmed to trigger no app logic, and confirmed overwritten by the app's own next legitimate write, verified by unit tests before this step is marked done.

## 8. Open questions

- [x] ~~Should the task label clear automatically once a Long break begins...~~ **Resolved during `design` (2026-09-28):** the task label persists indefinitely until the User changes it — a task can reasonably span multiple cycles. No auto-clear trigger exists; see `sad.md` §4.
- [x] ~~Exact wording of the task-label's placeholder hint and the 100-character rejection message?~~ **Resolved during `design` (2026-09-28):** placeholder hint = "What are you focusing on?"; the limit message = "Task label is limited to 100 characters." See `sad.md` §5.
