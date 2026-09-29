---
status: Living
updated_at: "2026-09-29"
---

# Domain Context — adjustable-durations

## Glossary

- **Configured duration** — the User-set length per phase type (Focus / Short break / Long break), persisted across reloads, that determines the full duration the next time that phase type starts fresh. NOT the phase's current remaining/full duration right now — a phase already running or paused stays at whatever was configured when it started; Configured duration is the setting that applies to the NEXT fresh start.
- **Configured cycle length** — the User-set number of Focus phases (2–8, default 4) that must complete before the next Long break, persisted across reloads. NOT the in-cycle focus count (`CONTEXT.md`'s root glossary) — the in-cycle focus count is the live, ephemeral progress counter compared against this setting; Configured cycle length is the threshold itself, changeable at any time and applied to the very next Long-break decision, including mid-cycle.
