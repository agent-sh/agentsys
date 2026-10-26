# Workflow Agent Reference

Detailed agent responsibilities and tool requirements for the pre-ship gates. `/prepare-delivery` runs them locally and never pushes or opens a PR; push and open the PR with your own flow.

**Related Checklists:**
- [New Agent Checklist](../checklists/new-agent.md)
- [New Command Checklist](../checklists/new-command.md)

**Best Practices:**
- [Multi-Agent Systems](./MULTI-AGENT-SYSTEMS-REFERENCE.md)
- [Prompt Engineering](./PROMPT-ENGINEERING-REFERENCE.md)

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
