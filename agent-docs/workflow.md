# Workflow Agent Reference

Detailed agent responsibilities and tool requirements for /next-task and /ship workflows.

**Related Checklists:**
- [New Agent Checklist](../checklists/new-agent.md)
- [New Command Checklist](../checklists/new-command.md)

**Best Practices:**
- [Multi-Agent Systems](./MULTI-AGENT-SYSTEMS-REFERENCE.md)
- [Prompt Engineering](./PROMPT-ENGINEERING-REFERENCE.md)

## /next-task - Master Workflow Orchestrator

The main orchestrator **MUST spawn these agents in order**:

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
| 10 | `prepare-delivery:delivery-validator` | sonnet | Skill, Bash(git:*), Bash(npm:*), Bash(node:*), Read, Grep, Glob | Validate completion |
| 11 | `sync-docs:sync-docs-agent` | sonnet | Bash(git:*), Bash(node:*), Read, Glob, Grep | Find doc drift; `simple-fixer` applies the fixes |
| 12 | `/ship` command | - | - | PR creation and merge |

`inherit` means the agent has no `model` key and runs on the caller's model. [docs/reference/AGENTS.md](../docs/reference/AGENTS.md) is the source for each agent's model and tools.

### MUST-CALL Agents (Cannot Skip)

- **`exploration-agent`** - Required for understanding codebase before planning
- **`planning-agent`** - Required for creating implementation plan
- **Phase 9 review loop** - Required for code review before shipping
- **`prepare-delivery:delivery-validator`** - Required before calling /ship

### Review Decision Gate

The review loop stops when no critical or high findings remain, when the same findings come back twice (stalled), or after 3 rounds. A stalled or capped loop with open critical findings is blocked: /next-task reports them and asks the user whether to continue, fix manually, or stop.

---

## /ship - PR Workflow

| Phase | Responsibility | Required Tools |
|-------|----------------|----------------|
| 1-3 | Pre-flight, commit, create PR | Bash(git:*), Bash(gh:*) |
| 4 | **CI & Review Monitor Loop** | Bash(gh:*), Task(ci-fixer) |
| 5 | Internal review (standalone only) | Task(review) |
| 6 | Merge PR | Bash(gh:*) |
| 7-10 | Deploy & validate | Bash(deployment:*) |

> **Phase 4 is MANDATORY** - even when called from /next-task.
> External auto-reviewers (Copilot, Claude, Gemini, Codex) comment AFTER PR creation.

---

## ci-monitor Agent

**Responsibility:** Monitor CI and PR comments, delegate fixes.

**Required Tools:**
- `Bash(gh:*)` - Check CI status and PR comments
- `Task(ci-fixer)` - Delegate fixes to ci-fixer agent

**Must Follow:**
1. Wait 3 minutes for auto-reviews on first iteration
2. Check ALL 4 reviewers (Copilot, Claude, Gemini, Codex)
3. Iterate until zero unresolved threads

---

## ci-fixer Agent

**Responsibility:** Fix CI failures and address PR comments.

**Required Tools:**
- `Read` - Read failing files
- `Edit` - Apply fixes
- `Bash(npm:*)` - Run tests
- `Bash(git:*)` - Commit and push fixes

**Must Follow:**
1. Address EVERY comment, including minor/nit suggestions
2. Reply to each comment explaining the fix
3. Resolve thread only after addressing

---

## Agent Tool Restrictions

| Agent | Allowed Tools | Disallowed |
|-------|---------------|------------|
| worktree-manager | Bash(git:*), Read | Write, Edit |
| ci-monitor | Bash(gh:*), Bash(git:*), Read, Task | Write, Edit |
| simple-fixer | Read, Edit, Bash(git:*) | Task |
| deslop:deslop-agent | Bash(git:*), Bash(node:*), Skill, Read, Glob, Grep | Write, Edit, Task |

---

## Quality Gates (Pre-Review)

Agents that run in parallel after implementation, before review:

| Agent | Purpose | Key Files |
|-------|---------|-----------|
| `deslop:deslop-agent` | Clean AI slop from committed work | `deslop skill + lib/patterns/` |
| `prepare-delivery:test-coverage-checker` | Validate new code has tests | Advisory only |

**deslop:deslop-agent** uses the 3-phase pipeline:
- Phase 1: Regex patterns (HIGH certainty, auto-fix)
- Phase 2: Multi-pass analyzers (MEDIUM certainty, verify)
- Phase 3: CLI tools (LOW certainty, advisory)

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
