# agentsys

> A modular runtime and orchestration system for AI agents - works with Claude Code, OpenCode, and Codex CLI

## Critical Rules

1. **Plain text output** - No emojis, no ASCII art. Use `[OK]`, `[ERROR]`, `[WARN]`, `[CRITICAL]` for status markers.
2. **No unnecessary files** - Don't create summary files, plan files, audit files, or temp docs.
3. **Task is not done until tests pass** - Every feature/fix must have quality tests.
4. **Create PRs for non-trivial changes** - No direct pushes to main.
5. **Always run git hooks** - Never bypass pre-commit or pre-push hooks.
6. **Use single dash for em-dashes** - In prose, use ` - ` (single dash with spaces), never ` -- `.
7. **Report script failures before manual fallback** - When any project script fails (npm test/run/build, scripts/*, agentsys-dev, node bin/dev-cli.js), you MUST:
   - Report the failure with exact error output to the user
   - Diagnose the root cause of the failure
   - Fix the script/tooling issue, not work around it manually
   - NEVER silently fall back to doing the work by hand
8. **Token efficiency** - Be concise. Save tokens over decorations.

## Model Selection

| Model | When to Use |
|-------|-------------|
| **Opus** | Complex reasoning, analysis, planning |
| **Sonnet** | Validation, pattern matching, most agents |
| **Haiku** | Mechanical execution, no judgment needed |

## Core Priorities

1. User DX (plugin users first)
2. Worry-free automation
3. Token efficiency
4. Quality output
5. Simplicity

## Commands

- `/next-task` - Task workflow: discovery, implementation, PR, merge
- `/ship` - PR creation, CI monitoring, merge
- `/enhance` - Run enhancement analyzers
- `/audit-project` - Multi-agent code review
- `/deslop` - Clean AI slop patterns
- `/drift-detect` - Compare plan vs implementation
- `/perf` - Performance investigation
- `/repo-map` - Generate AST-based repo map
- `/sync-docs` - Update documentation to match code

## Dev Commands

```bash
npm test          # Run tests
npm run validate  # All validators
```

## References

<<<<<<< HEAD
40 agents across 11 plugins. Key agents by model:

| Model | Agents | Use Case |
|-------|--------|----------|
| **opus** | planning, implementation, perf-orchestrator, debate-orchestrator | Complex reasoning, judgment |
| **sonnet** | exploration, learn, task-discoverer, delivery-validator, ci-fixer, deslop-agent, reporters | Validation, pattern matching |
| **haiku** | worktree-manager, ci-monitor, simple-fixer | Mechanical execution |

See [README.md](./README.md#command-details) and [docs/reference/AGENTS.md](./docs/reference/AGENTS.md) for full agent list.
</agents>

<skills>
## Skills

26 skills across plugins. Agents invoke skills for reusable implementation.

| Category | Key Skills |
|----------|------------|
| Workflow | `orchestrate-review`, `discover-tasks`, `validate-delivery` |
| Enhancement | `enhance-*` (9 skills for plugins, agents, docs, prompts, hooks) |
| Performance | `baseline`, `benchmark`, `profile`, `theory-tester` |
| Cleanup | `deslop`, `sync-docs`, `drift-analysis`, `repo-mapping` |

See [README.md](./README.md#skills) for full skill list.
</skills>

<state-files>
## State Files

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | `{stateDir}/` | Active task registry |
| `flow.json` | `{stateDir}/` (worktree) | Workflow progress |
| `preference.json` | `{stateDir}/sources/` | Cached task source |
| `suppressions.json` | `~/.<claude\|opencode\|codex>/enhance/` | Auto-learned suppressions |

Platform-aware state directory:
- Claude Code: `.claude/`
- OpenCode: `config/.opencode/`
- Codex: `.codex/`
</state-files>

<workflow-agents>
## Workflow Agents (MUST-CALL)

Cannot skip in /next-task:
- `exploration-agent` → before planning
- `planning-agent` → before implementation
- **Phase 9 review loop** → MUST use orchestrate-review skill
- `delivery-validator` → before sync-docs:sync-docs-agent
- `sync-docs:sync-docs-agent` → before /ship
</workflow-agents>

<pr-auto-review>
## PR Auto-Review

4 reviewers: Copilot, Claude, Gemini, Codex

1. Wait 3 min after PR creation (initial auto-reviews)
2. Claude-review may take 10+ min - wait for it
3. Read ALL comments
4. Address EVERY comment
5. Iterate until zero unresolved
</pr-auto-review>

<model-selection>
## Model Selection

| Model | When to Use |
|-------|-------------|
| **Opus** | Complex reasoning, analysis where imperfection compounds |
| **Sonnet** | Validation, pattern matching, most agents |
| **Haiku** | Mechanical execution, no judgment needed |
</model-selection>

<priorities>
## Core Priorities

1. User DX (plugin users)
2. Worry-free automation
3. Token efficiency
4. Quality output
5. Simplicity
</priorities>

<end-reminder>
**REMEMBER**:
- Use CHANGELOG.md for completion tracking (not summary files)
- BEFORE starting → Read the relevant checklist (`checklists/*.md`)
- BEFORE delivering any work, especially releases → Go through that checklist item by item
- 4 platforms: Claude Code + OpenCode + Codex + Cursor - ALL must work
- Agent/Skill pattern: Agents invoke skills, skills have implementation
- Create PRs for non-trivial changes
</end-reminder>

</project-memory>
||||||| ddd8211
40 agents across 11 plugins. Key agents by model:

| Model | Agents | Use Case |
|-------|--------|----------|
| **opus** | planning, implementation, perf-orchestrator, debate-orchestrator | Complex reasoning, judgment |
| **sonnet** | exploration, learn, task-discoverer, delivery-validator, ci-fixer, deslop-agent, reporters | Validation, pattern matching |
| **haiku** | worktree-manager, ci-monitor, simple-fixer | Mechanical execution |

See [README.md](./README.md#command-details) and [docs/reference/AGENTS.md](./docs/reference/AGENTS.md) for full agent list.
</agents>

<skills>
## Skills

26 skills across plugins. Agents invoke skills for reusable implementation.

| Category | Key Skills |
|----------|------------|
| Workflow | `orchestrate-review`, `discover-tasks`, `validate-delivery` |
| Enhancement | `enhance-*` (9 skills for plugins, agents, docs, prompts, hooks) |
| Performance | `baseline`, `benchmark`, `profile`, `theory-tester` |
| Cleanup | `deslop`, `sync-docs`, `drift-analysis`, `repo-mapping` |

See [README.md](./README.md#skills) for full skill list.
</skills>

<state-files>
## State Files

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | `{stateDir}/` | Active task registry |
| `flow.json` | `{stateDir}/` (worktree) | Workflow progress |
| `preference.json` | `{stateDir}/sources/` | Cached task source |
| `suppressions.json` | `~/.<claude\|opencode\|codex>/enhance/` | Auto-learned suppressions |

Platform-aware state directory:
- Claude Code: `.claude/`
- OpenCode: `config/.opencode/`
- Codex: `.codex/`
</state-files>

<workflow-agents>
## Workflow Agents (MUST-CALL)

Cannot skip in /next-task:
- `exploration-agent` → before planning
- `planning-agent` → before implementation
- **Phase 9 review loop** → MUST use orchestrate-review skill
- `delivery-validator` → before sync-docs:sync-docs-agent
- `sync-docs:sync-docs-agent` → before /ship
</workflow-agents>

<pr-auto-review>
## PR Auto-Review

4 reviewers: Copilot, Claude, Gemini, Codex

1. Wait 3 min after PR creation (initial auto-reviews)
2. Claude-review may take 10+ min - wait for it
3. Read ALL comments
4. Address EVERY comment
5. Iterate until zero unresolved
</pr-auto-review>

<model-selection>
## Model Selection

| Model | When to Use |
|-------|-------------|
| **Opus** | Complex reasoning, analysis where imperfection compounds |
| **Sonnet** | Validation, pattern matching, most agents |
| **Haiku** | Mechanical execution, no judgment needed |
</model-selection>

<priorities>
## Core Priorities

1. User DX (plugin users)
2. Worry-free automation
3. Token efficiency
4. Quality output
5. Simplicity
</priorities>

<end-reminder>
**REMEMBER**:
- Use CHANGELOG.md for completion tracking (not summary files)
- BEFORE starting → Read the relevant checklist (`checklists/*.md`)
- BEFORE delivering any work, especially releases → Go through that checklist item by item
- 3 platforms: Claude Code + OpenCode + Codex - ALL must work
- Agent/Skill pattern: Agents invoke skills, skills have implementation
- Create PRs for non-trivial changes
</end-reminder>

</project-memory>

## References

- Part of the [agentsys](https://github.com/agent-sh/agentsys) ecosystem
- https://agentskills.io
