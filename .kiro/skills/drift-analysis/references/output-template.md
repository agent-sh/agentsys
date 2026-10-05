# Reality Check Report format

Keep the title and section names so reports compare run to run. Leave out a section that has nothing in it, except the summary and quick wins.

```markdown
# Reality Check Report

Generated: {timestamp} | Sources: {sources} | Depth: {depth}

## Executive Summary

{2 or 3 sentences: overall state and the biggest concern.}

- Drift items: N | Gaps: N | Issues to close: N | Checked items not done: N

{Anything not checked, from the collector notes: "GitHub not scanned: gh not authenticated."}

## Issues to Close
- #12 {title}: implemented in `src/auth/login.js` (`loginUser`)
- #34 {title}: no longer applies since {change}

## Marked Done, Not Done
### {Phase or checkbox}
**Where**: PLAN.md:40
**Missing**:
- [ ] Password reset (no code under `src/auth/`)
- [ ] Tests for the login flow (no test files match)

## Release Blockers
{Only when a milestone or release is planned.}
1. Issue #78 (security) open
2. No tests for `src/payments/`

## Drift
### {Short name}
**Severity**: critical | high | medium | low
**Evidence**: {file:line, issue number, analyzer entry}
**Fix**: {one concrete action}

## Gaps
### {Short name}
**Severity**: ... | **Category**: security | quality | documentation | infrastructure
**Evidence**: ...
**Fix**: ...

## Reconstruction Plan
### Immediate (this week)
1. {item}: {why now}
### Short term (this month)
### Medium term (this quarter)
### Backlog

## Quick Wins
1. Close #12 (implemented)
2. Update the PLAN.md Phase B status
```

Immediate holds at most 5 items and each later bucket stays short: the plan is for acting on, not a full inventory.
