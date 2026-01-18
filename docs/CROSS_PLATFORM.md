# Cross-Platform Integration Guide

This document describes how to use awesome-slash-commands with different AI coding assistants.

## Supported Platforms

| Platform | Integration Method | Status |
|----------|-------------------|--------|
| Claude Code | Native plugins | ✅ Full support |
| OpenCode | MCP + Agent configs | 🔄 In development |
| Codex CLI | MCP + Skills | 🔄 In development |

## Common Architecture

All three platforms share:

1. **MCP (Model Context Protocol)** - Universal tool interface
2. **Agent/Subagent systems** - Specialized assistants with tool restrictions
3. **Slash commands** - User-invoked actions
4. **Configuration files** - JSON/YAML/Markdown formats

## Claude Code (Native)

Use the plugins directly:

```bash
# Clone the repository
git clone https://github.com/avifenesh/awesome-slash.git

# Install in Claude Code
claude --add-plugin /path/to/awesome-slash/plugins/next-task
claude --add-plugin /path/to/awesome-slash/plugins/ship
```

### Available Commands
- `/next-task` - Master workflow orchestrator
- `/ship` - Complete PR workflow

### Available Agents (18 Total)

**Core Workflow (Opus):**
- `exploration-agent` - Deep codebase analysis
- `planning-agent` - Design implementation plans
- `implementation-agent` - Execute plans with quality code
- `review-orchestrator` - Multi-agent code review with iteration

**Quality Gates (Sonnet):**
- `deslop-work` - Clean AI slop from committed but unpushed changes
- `test-coverage-checker` - Validate new work has test coverage
- `delivery-validator` - Autonomous delivery validation
- `docs-updater` - Update docs related to changes

**Operational (Sonnet/Haiku):**
- `policy-selector` - Configure workflow policy [haiku]
- `task-discoverer` - Find and prioritize tasks [sonnet]
- `worktree-manager` - Create isolated worktrees [haiku]
- `ci-monitor` - Monitor CI status with sleep loops [haiku]
- `ci-fixer` - Fix CI failures and PR comments [sonnet]
- `simple-fixer` - Execute pre-defined code fixes [haiku]

**Reality Check (Sonnet/Opus):**
- `issue-scanner` - Analyze GitHub issues, PRs, milestones [sonnet]
- `doc-analyzer` - Examine documentation for plans [sonnet]
- `code-explorer` - Deep codebase structure analysis [sonnet]
- `plan-synthesizer` - Combine findings into prioritized plan [opus]

## OpenCode Integration

### Option 1: MCP Server (Recommended)

Add to your OpenCode MCP config:

```json
{
  "mcpServers": {
    "awesome-slash": {
      "command": "node",
      "args": ["/path/to/awesome-slash/mcp-server/index.js"],
      "env": {
        "PLUGIN_ROOT": "/path/to/awesome-slash"
      }
    }
  }
}
```

### Option 2: Agent Configuration

Copy agent definitions to OpenCode format:

```bash
# Global agents
mkdir -p ~/.config/opencode/agent/

# Convert Claude Code agent to OpenCode format
# See scripts/convert-agents.js
```

**OpenCode Agent Format** (`.opencode/agent/workflow.md`):

```markdown
---
name: workflow-orchestrator
model: claude-sonnet-4-20250514
tools:
  read: true
  write: true
  bash: true
  glob: true
  grep: true
---

You are a workflow orchestrator that manages development tasks.

When invoked, you should:
1. Check for existing workflow state in .claude/.workflow-state.json
2. Continue from the last checkpoint if resuming
3. Follow the 13-phase workflow (/next-task) or 12-phase workflow (/ship) from task discovery to completion
```

## Codex CLI Integration

### Option 1: MCP Server

Add to your Codex config:

```json
{
  "mcpServers": {
    "awesome-slash": {
      "command": "node",
      "args": ["/path/to/awesome-slash/mcp-server/index.js"]
    }
  }
}
```

### Option 2: Custom Skills

Create Codex skills that wrap our functionality:

```yaml
# ~/.codex/skills/next-task.yaml
name: next-task
description: Intelligent task prioritization with code validation
trigger: "find next task|what should I work on|prioritize tasks"
script: |
  node /path/to/awesome-slash/scripts/next-task-runner.js
```

## MCP Server Tools

When using the MCP server integration, these tools become available:

| Tool | Description |
|------|-------------|
| `workflow_status` | Get current workflow state |
| `workflow_start` | Start a new workflow |
| `workflow_resume` | Resume from checkpoint |
| `workflow_abort` | Cancel and cleanup |
| `task_discover` | Find and prioritize tasks |
| `task_implement` | Implement selected task |
| `review_code` | Run multi-agent review |
| `ship_pr` | Create and merge PR |

## Shared Libraries

All integrations use the same core libraries:

```
lib/
├── state/
│   ├── workflow-state.js      # State management
│   └── workflow-state.schema.json
├── platform/
│   ├── detect-platform.js     # Auto-detect project type
│   └── verify-tools.js        # Check required tools
└── patterns/
    ├── review-patterns.js     # Code review patterns
    └── slop-patterns.js       # AI slop detection
```

## Platform-Specific Considerations

### Claude Code
- Full plugin support with hooks, agents, commands
- Native state management integration
- Best experience with opus model for complex tasks

### OpenCode
- Works with any model provider (Claude, OpenAI, Google, local)
- Agent definitions in Markdown format
- Custom tools via MCP

### Codex CLI
- OpenAI-native with GPT-5-Codex
- Skills system for custom actions
- MCP for external tools

## Migration Guide

### From Claude Code to OpenCode

1. Export workflow state: `node lib/state/workflow-state.js --export`
2. Convert agents: `node scripts/convert-agents.js --target opencode`
3. Install MCP server or copy converted agents

### From Claude Code to Codex

1. Export workflow state
2. Convert to Codex skills: `node scripts/convert-agents.js --target codex`
3. Install MCP server or copy converted skills

## Contributing

To add support for a new platform:

1. Create converter in `scripts/convert-agents.js`
2. Add platform detection to `lib/platform/detect-platform.js`
3. Test with the target platform
4. Submit PR with documentation
