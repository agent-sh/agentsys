# Workflow Agent Reference

Detailed agent responsibilities and tool requirements for the /ship workflow and the pre-ship gates.

**Related Checklists:**
- [New Agent Checklist](../checklists/new-agent.md)
- [New Command Checklist](../checklists/new-command.md)

**Best Practices:**
- [Multi-Agent Systems](./MULTI-AGENT-SYSTEMS-REFERENCE.md)
- [Prompt Engineering](./PROMPT-ENGINEERING-REFERENCE.md)

## /ship - PR Workflow

| Phase | Responsibility | Tools |
|-------|----------------|-------|
| 1-3 | Pre-flight, commit, push and open the PR | Bash(git:*), Bash(gh:*), Bash(node:*) |
| 4 | CI and review loop (`ship-ci-review-loop.md`) | Bash(gh:*) |
| 5 | Internal review | Task(general-purpose), up to 3 for large diffs |
| 6 | Merge, with write access only | Bash(gh:*) |
| 7-10 | Deploy and validate, multi-branch repos only (`ship-deployment.md`) | Platform CLIs (Railway, Vercel, Netlify) |
| 11-12 | Cleanup after the merge, report | Bash(git:*), Bash(gh:*) |

Phase 4 runs on every run: CI and external auto-reviewers only see the code once the PR exists. It stops after 5 rounds without converging.

---

## Agent Tool Restrictions

| Agent | Allowed Tools | Disallowed |
|-------|---------------|------------|
| deslop:deslop-agent | Bash(git:*), Bash(node:*), Skill, Read, Glob, Grep | Write, Edit, Task |

---

## Quality Gates (Pre-Review)

Agents `/prepare-delivery` runs in parallel before review:

| Agent | Purpose | Key Files |
|-------|---------|-----------|
| `deslop:deslop-agent` | Find AI slop in the branch diff; read-only, the caller applies its fixes | deslop `skills/deslop/SKILL.md`, `scripts/detect.js`, `lib/patterns/` |
| `prepare-delivery:test-coverage-checker` | Check that changed code has tests that exercise it | Advisory only |

**deslop:deslop-agent** thoroughness levels:
- `quick`: regex patterns
- `normal` (the default): adds the multi-pass analyzers
- `deep`: adds CLI tools such as jscpd and madge when installed

Only HIGH certainty findings with a fix strategy become fixes. MEDIUM and LOW findings stay in the report for a human.

---

## State Files

| File | Location | Purpose |
|------|----------|---------|
| `flow.json` | `{state-dir}/` (worktree) | Workflow progress |

State directory varies by platform:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`
