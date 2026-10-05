# /next-task Workflow

Complete technical reference for the `/next-task` workflow.

**TL;DR:** 12 phases, 10 agents plus 1 to 4 review subagents, 3 human interactions (policy, task selection, plan approval). After plan approval the run is autonomous until the stopping point you chose: implemented, PR created, merged, or deployed.

---

## Quick Navigation

| Section | Jump to |
|---------|---------|
| [Workflow Phases](#workflow-phases) | All 12 phases explained |
| [State Management](#state-management) | tasks.json, flow.json, resume |
| [Workflow Enforcement](#workflow-enforcement) | How gates are enforced |
| [Agent Model Allocation](#agent-model-allocation) | Why inherit/sonnet/haiku |
| [Cleanup](#cleanup) | Success and abort handling |
| [Example Flow](#example-flow) | Full walkthrough |

**Related docs:**
- [Agent Reference](../reference/AGENTS.md) - Detailed agent documentation
- [/ship Workflow](./SHIP.md) - The shipping phase in detail
- [Slop Patterns](../reference/SLOP-PATTERNS.md) - What deslop detects

---

## Overview

`/next-task` is a master orchestrator that takes a task from discovery to the stopping point you choose. It runs 12 phases with 3 human interaction points and 10 agents: 6 from next-task (task-discoverer, worktree-manager, exploration-agent, planning-agent, implementation-agent, simple-fixer) and 4 from other plugins (deslop:deslop-agent, prepare-delivery:test-coverage-checker, prepare-delivery:delivery-validator, sync-docs:sync-docs-agent). The review loop adds 1 to 4 general-purpose reviewer subagents. A phase whose plugin is not installed runs an inline fallback and is named in the final report.

**Why this design:** You shouldn't have to ask for the same workflow every session. The orchestrator handles the coordination (launching agents, tracking state, enforcing gates), so you can approve a plan and walk away. Human judgment is only required at meaningful decision points: what to work on, whether the plan is correct, and reviewing the final output. Everything between is automated.

---

## Workflow Phases

### Phase 1: Policy Selection

**Human interaction: Yes**

You configure how the workflow will run:

| Question | Options |
|----------|---------|
| Task Source | GitHub Issues, GitHub Projects, GitLab Issues, Local `tasks.md`, Custom, Other |
| Priority Filter | All, Bugs, Security, Features |
| Stopping Point | Merged, PR Created, Implemented, Deployed, Production |

Your source choice is cached in `{state-dir}/sources/preference.json` and offered first, marked "(last used)", on the next run.

---

### Phase 2: Task Discovery

**Agent:** task-discoverer (sonnet)
**Human interaction: Yes**

The agent:
1. Fetches open tasks from your configured source
2. Excludes tasks claimed in `tasks.json` by another run and, for GitHub sources, issues that already have an open PR
3. Applies the priority filter and scores what is left: critical or p0 +100, high or p1 +50, security +40, small or quick +20, bug open more than 30 days +10
4. Returns up to 5 ranked candidates

The orchestrator shows them (AskUserQuestion, or a numbered list) and you pick one. Nothing is posted to the issue yet; that waits for plan approval.

---

### Phase 3: Worktree Setup

**Agent:** worktree-manager (haiku)
**Human interaction: No**

The agent:
1. Validates the task ID and base branch before any git command
2. Creates `../worktrees/{task-slug}/` on `feature/{task-slug}` from `origin/<base>`, or reuses that worktree on a resume
3. Returns the absolute worktree path and branch

The orchestrator then claims the task in `tasks.json` (locked, so a parallel run cannot take it) and creates `flow.json` in the worktree. Every later agent gets the absolute worktree path.

---

### Phase 4: Exploration

**Agent:** exploration-agent (sonnet)
**Human interaction: No**

The agent:
1. Extracts keywords from task title and description
2. Searches codebase for related files using Grep and Glob
3. Traces dependency graphs
4. Analyzes existing patterns and conventions
5. Outputs exploration report with:
   - Key files identified
   - Patterns discovered
   - Risks and considerations
   - Suggested approach

---

### Phase 5: Planning

**Agent:** planning-agent (inherits the session model)
**Human interaction: No**

The agent:
1. Synthesizes exploration findings
2. Creates step-by-step implementation plan
3. Identifies critical paths and risks
4. Outputs structured JSON between delimiters:

```
=== PLAN_START ===
{
  "overview": "...",
  "architecture": "...",
  "steps": [{ "title": "...", "files": [...], "risks": [...] }],
  "tests": [...],
  "testCommand": "...",
  "critical": { "highRisk": [...], "security": [...] },
  "openQuestions": [],
  "complexity": { "overall": "Medium", "confidence": "High" }
}
=== PLAN_END ===
```

The agent does not post anything; the orchestrator comments on the issue after you approve.

---

### Phase 6: User Approval

**Human interaction: Yes (last one)**

The workflow:
1. Enters Plan Mode
2. Presents formatted plan from planning-agent
3. You can request changes or ask questions
4. You approve via ExitPlanMode
5. For GitHub sources, the orchestrator comments once on the issue with the plan summary

With `--implement`, Phases 4 and 5 are skipped: the orchestrator writes a short plan from the task and still asks for this approval.

**After this point, the workflow runs autonomously until the stopping point.**

---

### Phase 7: Implementation

**Agent:** implementation-agent (inherits the session model)
**Human interaction: No**

The agent:
1. Executes the approved plan step by step, with the tests it calls for
2. Creates one local commit per coherent step
3. Runs the covering tests, type check, lint and build once the implementation is complete
4. Returns a summary with any deviations from the plan; the orchestrator records state

It does not push, open a PR, or run review agents: the review and validation phases are what make a push safe.

---

### Phase 8: Pre-Review Gates

**Agents:** deslop:deslop-agent (sonnet), prepare-delivery:test-coverage-checker (sonnet), next-task:simple-fixer (haiku)
**Human interaction: No**

The orchestrator runs these in parallel where the harness allows:

**deslop:deslop-agent** (`Mode: apply`, `Scope: diff`, `Thoroughness: normal`):
- Scans the files changed on the branch and returns a `DESLOP_RESULT` block; it does not edit
- Only HIGH certainty findings with a fix strategy become `fixes`; the orchestrator hands them to simple-fixer, which commits `fix: clean up AI slop`
- MEDIUM and LOW findings stay in the report
- Not installed: the orchestrator reviews the diff for debug output, leftover TODOs and dead code

**prepare-delivery:test-coverage-checker:**
- Checks that changed code has tests that exercise it, not just a test file with a matching name
- Advisory and read-only - does not block the workflow

**`simplify` skill** on the diff, when available.

---

### Phase 9: Review Loop

**Execution:** Inline in main orchestrator, with `general-purpose` reviewer subagents on sonnet when `Task` is available
**Human interaction: No**

The orchestrator sizes the review to the change:

- Default: one reviewer covering correctness, security, performance and tests.
- Large or risky diffs (roughly 500+ changed lines, 15+ files, or high diff-risk or security-sensitive paths): up to 4 parallel reviewers, one per concern, optionally swapping one for a specialist the diff calls for (database, API, frontend, infra). Never more than 4 at once.

Each reviewer returns a JSON array of `{file, line, severity, description, suggestion}`. The orchestrator merges duplicates, fixes critical and high findings (and medium ones when the fix is small and clearly right), commits, and re-reviews only what changed.

The loop stops when no critical or high findings remain (approved), when the same findings come back twice (stalled), or after 3 rounds. A stalled or capped loop with open critical findings is blocked: the orchestrator reports them and asks whether to continue, fix manually, or stop.

**Restrictions enforced:**
- MUST NOT create PR
- MUST NOT push to remote
- MUST NOT skip review loop

---

### Phase 10: Delivery Validation

**Agent:** prepare-delivery:delivery-validator (sonnet)
**Human interaction: No**

Five checks decide, plus one advisory:
1. Review status - the review loop approved (or the user overrode it)
2. Tests pass
3. Build or type check passes
4. Task requirements met (each requirement in the task maps to the diff)
5. No regressions - no deleted, skipped or weakened tests without a stated reason
6. Diff risk (advisory) - high-risk files from repo-intel need a test that exercises them

**On failure:** the fix instructions go back through Phase 7, then Phases 8 to 10 run again. After two failed validations the run stops and reports.

---

### Phase 11: Documentation Update

**Agent:** sync-docs:sync-docs-agent (sonnet)
**Helper:** next-task:simple-fixer (haiku)
**Human interaction: No**

The agent (`Mode: apply`, `Scope: before-pr`) is read-only:
1. Finds docs that reference the changed files
2. Checks removed exports, code examples, outdated versions and whether CHANGELOG lists the branch's `feat` and `fix` commits
3. Returns confirmed issues and exact `fixes` in a `SYNC_DOCS_RESULT` block

The orchestrator hands the fixes to simple-fixer, which commits `docs: sync documentation with code changes`, then moves to the stopping point. Not installed: the orchestrator updates the README and CHANGELOG itself when the change is user-visible.

---

### Phase 12: Stopping Point

**Human interaction: No**

| Stopping point | What happens |
|----------------|--------------|
| Implemented | Stops and reports the worktree and branch |
| PR Created | Pushes the branch, opens the PR (`Closes #<id>`), reports the URL and stops |
| Merged, Deployed, Production | Runs `/ship --state-file <worktree>/<state-dir>/flow.json --base <base>` |

`/ship` (optional agent: next-task:ci-fixer, sonnet):
1. Pushes the branch and opens the PR, or reuses an open one
2. Waits on CI with `gh pr checks --watch`, no fixed polling, and fixes failures (delegating to ci-fixer when it is installed)
3. Waits for review bots that recent PRs show reviewing this repo, at most 15 minutes per wait
4. Fixes or answers each review comment; on a repo you own it resolves the thread. After 5 rounds without converging it stops and reports
5. Merges when checks are green and no thread is unresolved (needs write access; otherwise it stops at ready for review)
6. Deploys and validates on multi-branch repos
7. Cleanup after the merge:
   - Removes this task's worktree (left in place if it has uncommitted changes)
   - Releases the task in `tasks.json`
   - Comments on and closes the GitHub issue (GitHub task sources)
   - Deletes the feature branch

---

## State Management

### Two-File Architecture

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | Main project `{state-dir}/` | Active task registry |
| `flow.json` | Worktree `{state-dir}/` | Workflow phase progress |

### Platform State Directories

| Platform | State Directory |
|----------|-----------------|
| Claude Code | `.claude/` |
| OpenCode | `.opencode/` |
| Codex CLI | `.codex/` |

Override with `AI_STATE_DIR` environment variable.

### Resume Capability

```bash
/next-task --resume              # Resume active worktree
/next-task --resume 123          # Resume by task ID
/next-task --resume feature/xyz  # Resume by branch name
```

The workflow:
1. Reads `tasks.json` in the main checkout to find the worktree path
2. Reads `flow.json` in the worktree for the recorded phase
3. Continues from that phase

`flow.json` records one of these phases: `policy-selection`, `task-discovery`, `worktree-setup`, `exploration`, `planning`, `user-approval`, `implementation`, `pre-review-gates`, `review-loop`, `delivery-validation`, `docs-update`, `shipping`, `complete`.

A bare `/next-task` never auto-resumes: with active tasks in the registry, it asks whether to resume one or start fresh.

---

## Workflow Enforcement

While a `/next-task` flow is in progress, a SubagentStop hook reminds the orchestrator, each time an agent finishes, of the phase order and what comes next. Outside a flow it does nothing.

**Gates:**
- The pre-review gates, the Phase 9 review loop, delivery validation and docs sync run before anything is pushed
- A gate whose plugin is not installed runs its inline fallback and is named in the final report instead of being skipped silently
- Agents commit locally only; the push happens at the stopping point (the PR step or `/ship`)

---

## Agent Model Allocation

| Model | Agents | Why |
|-------|--------|-----|
| **inherit** | planning-agent, implementation-agent | No `model` key, so they run on the model the session uses |
| **sonnet** | task-discoverer, exploration-agent, deslop:deslop-agent, prepare-delivery:test-coverage-checker, prepare-delivery:delivery-validator, sync-docs:sync-docs-agent, Phase 9 reviewers, ci-fixer (when `/ship` delegates to it) | Structured analysis and validation |
| **haiku** | worktree-manager, simple-fixer | Mechanical execution, no judgment needed |

next-task also ships ci-monitor (haiku), a standalone CI watcher. `/next-task` and `/ship` do not spawn it.

---

## Cleanup

### On Success

`/ship` handles cleanup after a merge:
- Removes this task's worktree (left in place if it has uncommitted changes)
- Releases the task entry in `tasks.json`
- Comments on and closes the GitHub issue (GitHub task sources)
- Deletes the feature branch

### On Abort

```bash
/next-task --abort
```

The abort:
- Marks the flow `aborted` in `flow.json`
- Releases the task entry in `tasks.json`
- Removes the worktree if it has no uncommitted changes; otherwise leaves it and says so

---

## Example Flow

```
User: /next-task

[Policy Selection]
→ Task source? GitHub Issues
→ Priority? Bugs
→ Stop at? Merged

[Task Discovery]
→ Analyzing 47 open issues...
→ Top 5:
  1. Fix authentication timeout (#142)
  2. Handle empty state in dashboard (#89)
  ...
→ Which task? [1]

[Worktree Setup]
→ Creating ../worktrees/fix-auth-timeout-142/
→ Branch: feature/fix-auth-timeout-142

[Exploration]
→ Found: src/auth/session.ts, src/middleware/auth.ts
→ Pattern: JWT with 5-minute hardcoded timeout
→ Risk: Tests mock the timeout value

[Planning]
→ Step 1: Extract timeout to config
→ Step 2: Update session.ts
→ Step 3: Update tests
→ Step 4: Add documentation

[User Approval]
→ Plan looks good? [approve]

[Implementation]
→ Implementing step 1... [OK]
→ Implementing step 2... [OK]
→ Implementing step 3... [OK]
→ Implementing step 4... [OK]

[Pre-Review Gates]
→ deslop: 2 debug logs, simple-fixer removed them [OK]
→ prepare-delivery:test-coverage-checker: new code has tests [OK]

[Review Loop]
→ Round 1: Found 3 issues (1 high, 2 medium)
→ Fixing high issue... [OK]
→ Round 2: Found 0 critical or high issues [OK]

[Delivery Validation]
→ Tests pass [OK]
→ Build passes [OK]
→ Requirements met [OK]

[Docs Update]
→ Updated CHANGELOG.md [OK]

[Ship]
→ Creating PR #156...
→ Waiting for CI...
→ Waiting for reviewers...
→ Addressing 2 comments...
→ Merging PR #156... [OK]
→ Cleanup complete [OK]

Done! PR #156 merged to main.
```

---

## Navigation

[← Back to Documentation Index](../README.md) | [Main README](../../README.md)

**Related:**
- [/ship Workflow](./SHIP.md) - The shipping phase in detail
- [Agent Reference](../reference/AGENTS.md) - All agent documentation
- [Slop Patterns](../reference/SLOP-PATTERNS.md) - What gets detected and cleaned
