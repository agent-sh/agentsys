---
name: drift-analysis
description: Use when the user asks about plan drift, a reality check, whether docs or a roadmap match the code, project state, or implementation gaps between what is documented and what is built.
version: 5.3.0
---

# Drift analysis

Drift is the distance between what a project says and what it does: plans with checked boxes and no code behind them, READMEs describing features that are gone, open issues for work that already shipped, milestones that slipped without anyone saying so.

For a full scan, run `/drift-detect`. It collects GitHub, docs, code and analyzer data with a script and hands it to the `plan-synthesizer` agent, which writes a Reality Check Report. Use this skill directly for a narrower question ("is the roadmap in PLAN.md still true?") or when you are the one doing the synthesis.

## Kinds of drift

- **Plan drift**: items marked done that are not, items unchecked for months, milestones overdue with open work.
- **Documentation drift**: docs that describe missing features or removed symbols, and features no doc mentions.
- **Issue drift**: issues open for work that is done or no longer applies; high-priority issues untouched for months.
- **Scope drift**: far more documented than built, or a backlog that only grows.

## How to judge it

- Evidence first. Every finding names a file and line, an issue number or an analyzer entry, and you checked it in the code yourself. A wrong "already done" closes a live issue.
- Match by meaning. "User authentication" may be `auth/`, `login.js` or `session/`.
- Look for patterns. One stale issue is noise; ten is a finding. Active projects always carry some drift, mature ones should carry little.
- Weigh by impact. User-facing and public-API drift outrank internals; security outranks everything.
- Keep the plan short enough to act on: a handful of immediate items, each with a reason.

What the collected data holds and how to read the analyzer's structural signals: [references/signals.md](references/signals.md). Report layout: [references/output-template.md](references/output-template.md).

Without a repo-intel map the analyzer signals are absent and the scan still works. `/repo-intel init` (repo-intel plugin) adds symbol-level doc drift when the user wants it.
