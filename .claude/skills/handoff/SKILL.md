---
name: handoff
description: Write a handoff document so a fresh session can pick up the work exactly where this one left off, instead of compacting the current context. Use this whenever the user says "handoff", "hand off", "wrap up the session", "context is getting full", "start fresh", "before I /clear", or asks to save progress for a new session. Also suggest it proactively when the context window is getting long and the task is mid-flight.
---

# Handoff

Compaction summarizes everything, lossily, and keeps you in a bloated session. A handoff does the opposite: you decide what matters, write it to disk, and the next session starts clean with only that.

## When invoked

1. Stop feature work. Do not start new edits while writing the handoff.
2. Gather facts from the repo, not from memory:
   - `git status` and `git diff --stat` for uncommitted work
   - `git log --oneline -10` for recent commits
   - Any failing test or build output you've seen this session (rerun if cheap)
3. Write `.claude/handoffs/HANDOFF-<YYYY-MM-DD-HHMM>.md` using the template below, and overwrite `.claude/handoffs/LATEST.md` with the same content.
4. If there is uncommitted work, ask the user whether to commit it (suggest a WIP message) before they clear. Never commit without asking.
5. Tell the user, in one or two lines, the file path and the exact prompt to start the next session with:
   `Read .claude/handoffs/LATEST.md and continue from "Next steps".`

## Template

```markdown
# Handoff — <short task name>
Date: <timestamp>   Branch: <branch>   Last commit: <sha + subject>

## Goal
One or two sentences: what we're ultimately trying to achieve and why.

## Current state
What works now. What's half-done. Be concrete: files, functions, endpoints.

## Decisions made (and why)
- <decision> — <reason>. Include rejected alternatives so the next session doesn't retry them.

## Dead ends
- <approach tried> — <why it failed, with the actual error if relevant>

## Open problems
- <bug / unknown>, where it shows up, how to reproduce.

## Next steps
1. The single most important next action, specific enough to start immediately.
2. ...

## Key files
- `path/to/file` — why it matters

## Commands
How to build, run, and test what we were working on (only the ones actually used).

## Gotchas
Environment quirks, flaky tests, things the user asked us not to touch.
```

## Writing rules

- Write for a competent engineer with zero context. No "as discussed", no pronouns pointing at the conversation.
- Prefer exact paths, commands, error strings, and commit SHAs over prose.
- Dead ends and rejected options are the most valuable part; compaction usually loses them. Never skip that section if anything was tried and abandoned.
- Keep it under ~150 lines. If longer, you're transcribing, not handing off.
- Leave out anything re-derivable from the code or git log in seconds.
- Don't include secrets, tokens, or `.env` contents.

## Resuming (next session)

When a session starts with a request to read a handoff:
1. Read `LATEST.md`.
2. Verify the stated state against the repo (`git status`, branch, last commit). Flag any mismatch before acting.
3. Start on "Next steps" item 1.
