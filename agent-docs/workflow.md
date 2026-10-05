# Workflow Agent Reference

Detailed agent responsibilities and tool requirements for /next-task and /ship workflows.

**Related Checklists:**
- [New Agent Checklist](../checklists/new-agent.md)
- [New Command Checklist](../checklists/new-command.md)

**Best Practices:**
- [Multi-Agent Systems](./MULTI-AGENT-SYSTEMS-REFERENCE.md)
- [Prompt Engineering](./PROMPT-ENGINEERING-REFERENCE.md)

## /next-task - Master Workflow Orchestrator

/next-task runs these phases in order. A phase whose plugin is not installed runs the inline fallback in next-task's `commands/next-task.md`, and `--implement` skips Phases 4 and 5.

| Phase | Agent | Model | Required Tools | Purpose |
|-------|-------|-------|----------------|---------|
| 1 | *(orchestrator)* | - | AskUserQuestion | Configure workflow policy |
| 2 | `task-discoverer` | sonnet | Skill, Read, Grep, Bash(gh:*), Bash(glab:*), Bash(git:*) | Find and prioritize tasks |
| 3 | `worktree-manager` | haiku | Bash(git:*), Read | Create isolated worktree |
| 4 | `exploration-agent` | sonnet | Read, Glob, Grep, Bash(git:*) | Map the code the task touches |
| 5 | `planning-agent` | inherit | Read, Glob, Grep, Bash(git:*) | Design implementation plan |
| 6 | **USER APPROVAL** | - | - | Last human touchpoint |
| 7 | `implementation-agent` | inherit | Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(node:*), LSP | Execute plan |
| 8 | `deslop:deslop-agent` | sonnet | Bash(git:*), Bash(node:*), Skill, Read, Glob, Grep | Find AI slop in the diff (uses deslop skill) |
| 8 | `prepare-delivery:test-coverage-checker` | sonnet | Bash(git:*), Bash(node:*), Skill, Read, Grep, Glob | Validate test coverage |
| 9 | Phase 9 review loop | sonnet reviewers | Task(general-purpose) | One reviewer, or up to 4 in parallel for large or risky diffs |
| 10 | `prepare-delivery:delivery-validator` | sonnet | Skill, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(cargo:*), Bash(go:*), Bash(pytest:*), Bash(make:*), Read, Grep, Glob | Validate completion |
| 11 | `sync-docs:sync-docs-agent` | sonnet | Bash(git:*), Bash(node:*), Read, Glob, Grep | Find doc drift; `simple-fixer` applies the fixes |
| 12 | *(orchestrator)* or `/ship` | - | Bash(git:*), Bash(gh:*) | Stopping point: stop, open the PR, or run `/ship` to merge and deploy |

`inherit` means the agent has no `model` key and runs on the caller's model. [docs/reference/AGENTS.md](../docs/reference/AGENTS.md) is the source for each agent's model and tools.

### Gates

- The pre-review gates, the Phase 9 review loop, delivery validation and docs sync run before anything is pushed. A SubagentStop hook reminds the orchestrator of this order while a flow is in progress.
- A gate whose plugin is not installed runs its inline fallback and is named in the final report instead of being skipped silently.
- `exploration-agent` and `planning-agent` are skipped only with `--implement`, which still needs the user's plan approval.

### Review Decision Gate

The review loop stops when no critical or high findings remain, when the same findings come back twice (stalled), or after 3 rounds. A stalled or capped loop with open critical findings is blocked: /next-task reports them and asks the user whether to continue, fix manually, or stop.

---

## /ship - PR Workflow

| Phase | Responsibility | Tools |
|-------|----------------|-------|
| 1-3 | Pre-flight, commit, push and open the PR | Bash(git:*), Bash(gh:*), Bash(node:*) |
| 4 | CI and review loop (`ship-ci-review-loop.md`) | Bash(gh:*), optional Task(next-task:ci-fixer) |
| 5 | Standalone review, skipped when the /next-task review loop approved | Task(general-purpose), up to 3 for large diffs |
| 6 | Merge, with write access only | Bash(gh:*) |
| 7-10 | Deploy and validate, multi-branch repos only (`ship-deployment.md`) | Platform CLIs (Railway, Vercel, Netlify) |
| 11-12 | Cleanup after the merge, report | Bash(git:*), Bash(gh:*) |

Phase 4 runs on every run, including runs from /next-task: CI and external auto-reviewers only see the code once the PR exists. It stops after 5 rounds without converging.

---

## ci-monitor Agent (next-task, haiku)

**Responsibility:** Wait for a PR's checks to finish and report their state plus the review feedback that needs action. A standalone delegate: `/next-task` and `/ship` do not spawn it.

**Tools:** `Bash(gh:*)`, `Bash(git:*)`, `Read`, `Task`

**Behavior:**
1. Blocks on `gh pr checks "$PR" --watch --interval 30`, bounded to 30 minutes; a timeout is reported, not retried
2. Lists unresolved review threads and review comments, bots included
3. Hands each failing check and change request to `next-task:ci-fixer` when it is installed and `Task` is available, at most 5 fix rounds; otherwise reports them
4. Does not reply to or resolve threads and does not merge: the caller decides

---

## ci-fixer Agent (next-task, sonnet)

**Responsibility:** Fix one CI failure or one review comment that needs a code change, commit it, and push the PR branch. Used by `/ship` Phase 4 and by ci-monitor.

**Tools:** `Bash(git:*)`, `Bash(npm:*)`, `Read`, `Edit`, `Grep`, `Glob`

**Behavior:**
1. Makes the smallest change that fixes the cause in the log or the comment
2. Never changes a test's assertions, disables a lint rule, or skips a check to get green
3. If the cause is unclear or the comment looks wrong, changes nothing and says why
4. Pushes to the PR branch only, never with `--force`
5. Returns JSON (`fixed`, `changes`, `committed`, `commitMessage`, `reason`); replying to and resolving threads stays with the caller

---

## Agent Tool Restrictions

| Agent | Allowed Tools | Disallowed |
|-------|---------------|------------|
| worktree-manager | Bash(git:*), Read | Write, Edit |
| ci-monitor | Bash(gh:*), Bash(git:*), Read, Task | Write, Edit |
| ci-fixer | Bash(git:*), Bash(npm:*), Read, Edit, Grep, Glob | Bash(gh:*), Task |
| simple-fixer | Read, Edit, Bash(git:*) | Task |
| deslop:deslop-agent | Bash(git:*), Bash(node:*), Skill, Read, Glob, Grep | Write, Edit, Task |

---

## Quality Gates (Pre-Review)

Agents that run in parallel after implementation, before review:

| Agent | Purpose | Key Files |
|-------|---------|-----------|
| `deslop:deslop-agent` | Find AI slop in the branch diff; read-only, `simple-fixer` applies its fixes | deslop `skills/deslop/SKILL.md`, `scripts/detect.js`, `lib/patterns/` |
| `prepare-delivery:test-coverage-checker` | Check that changed code has tests that exercise it | Advisory only |

**deslop:deslop-agent** thoroughness levels:
- `quick`: regex patterns
- `normal` (the /next-task default): adds the multi-pass analyzers
- `deep`: adds CLI tools such as jscpd and madge when installed

Only HIGH certainty findings with a fix strategy become fixes. MEDIUM and LOW findings stay in the report for a human.

---

## State Files

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | `{state-dir}/` | Active worktree/task registry |
| `flow.json` | `{state-dir}/` (worktree) | Workflow progress |
| `preference.json` | `{state-dir}/sources/` | Cached task source |

State directory varies by platform:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`
