# Project Memory: awesome-slash

Quick reference for AI assistants. Follow links for details.

## Critical Rules

1. **Production project** - Real users, test thoroughly, don't break things
2. **Plugin for OTHER projects** - Optimize for plugin users, not internal dev
3. **No summary files** - No `*_AUDIT.md`, `*_SUMMARY.md`, etc. Use CHANGELOG.md
4. **PR reviews** - Wait 3 min for auto-reviewers, address ALL comments

## Quick Links

| Need To... | Go To |
|------------|-------|
| Release new version | [checklists/release.md](./checklists/release.md) |
| Add slash command | [checklists/new-command.md](./checklists/new-command.md) |
| Add agent | [checklists/new-agent.md](./checklists/new-agent.md) |
| Add lib module | [checklists/new-lib-module.md](./checklists/new-lib-module.md) |
| Update MCP server | [checklists/update-mcp.md](./checklists/update-mcp.md) |
| Understand workflow | [agent-docs/workflow.md](./agent-docs/workflow.md) |
| Full release guide | [agent-docs/release.md](./agent-docs/release.md) |

## Knowledge Base

| Topic | Document |
|-------|----------|
| Prompt design | [agent-docs/PROMPT-ENGINEERING-REFERENCE.md](./agent-docs/PROMPT-ENGINEERING-REFERENCE.md) |
| MCP/tool patterns | [agent-docs/FUNCTION-CALLING-TOOL-USE-REFERENCE.md](./agent-docs/FUNCTION-CALLING-TOOL-USE-REFERENCE.md) |
| Multi-agent systems | [agent-docs/MULTI-AGENT-SYSTEMS-REFERENCE.md](./agent-docs/MULTI-AGENT-SYSTEMS-REFERENCE.md) |
| Token efficiency | [agent-docs/CONTEXT-OPTIMIZATION-REFERENCE.md](./agent-docs/CONTEXT-OPTIMIZATION-REFERENCE.md) |
| Cross-platform | [lib/cross-platform/RESEARCH.md](./lib/cross-platform/RESEARCH.md) |

## Architecture

```
lib/                    # Shared library (canonical source)
├── cross-platform/     # Platform detection, MCP helpers
├── patterns/           # Slop detection pipeline
├── state/              # Workflow state management
└── index.js            # Main exports

plugins/                # Claude Code plugins
├── next-task/          # Master workflow (14 agents)
├── ship/               # PR workflow
├── deslop-around/      # AI slop cleanup
├── project-review/     # Multi-agent review
└── reality-check/      # Plan drift detection

mcp-server/             # Cross-platform MCP server
bin/cli.js              # npm CLI installer
checklists/             # Action checklists
agent-docs/             # Knowledge base
docs/                   # User documentation
```

## Key Commands

```bash
npm test                     # Run tests (do before commits)
./scripts/sync-lib.sh        # Sync lib/ to plugins/
npm pack                     # Build package
awesome-slash                # Run installer
```

## State Files

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | `.claude/` | Active task registry |
| `flow.json` | `.claude/` (worktree) | Workflow progress |
| `preference.json` | `.claude/sources/` | Cached task source |

Platform-aware: `.claude/` (Claude), `.opencode/` (OpenCode), `.codex/` (Codex)

## Workflow Agents (MUST-CALL)

Cannot skip in /next-task:
- `exploration-agent` → before planning
- `planning-agent` → before implementation
- `review-orchestrator` → before shipping
- `delivery-validator` → before /ship

## PR Auto-Review

4 reviewers: Copilot, Claude, Gemini, Codex

1. Wait 3 min after PR creation
2. Read ALL comments
3. Address EVERY comment
4. Iterate until zero unresolved

## Core Priorities

1. User DX (plugin users)
2. Worry-free automation
3. Token efficiency
4. Quality output
5. Simplicity
