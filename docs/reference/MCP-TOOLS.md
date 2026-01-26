# MCP Tools Reference

Complete reference for MCP (Model Context Protocol) tools exposed by awesome-slash.

**TL;DR:** 9 tools that work on Claude Code, OpenCode, and Codex CLI. Same API, different state directories.

---

## Quick Navigation

| Tool | Jump to | Purpose |
|------|---------|---------|
| [workflow_status](#workflow_status) | [→](#workflow_status) | Check current state |
| [workflow_start](#workflow_start) | [→](#workflow_start) | Begin new workflow |
| [workflow_resume](#workflow_resume) | [→](#workflow_resume) | Continue interrupted work |
| [workflow_abort](#workflow_abort) | [→](#workflow_abort) | Cancel and cleanup |
| [task_discover](#task_discover) | [→](#task_discover) | Find tasks from sources |
| [review_code](#review_code) | [→](#review_code) | Pattern-based review |
| [slop_detect](#slop_detect) | [→](#slop_detect) | Find AI artifacts |
| [enhance_analyze](#enhance_analyze) | [→](#enhance_analyze) | Improve prompts/plugins |
| [repo_map](#repo_map) | [→](#repo_map) | Build AST repo map |

**Design principle:** MCP provides a standard interface. One implementation serves all platforms. Tools return structured data; agents decide what to do with it.

**Related docs:**
- [Cross-Platform Setup](../CROSS_PLATFORM.md) - Platform-specific configuration
- [Slop Patterns](./SLOP-PATTERNS.md) - What slop_detect finds
- [Agent Reference](./AGENTS.md) - Agents that use these tools

---

## Overview

The MCP server (`mcp-server/index.js`) exposes 9 tools that work across all supported platforms:
- Claude Code
- OpenCode
- Codex CLI

---

## Tool Reference

### workflow_status

Get current workflow state, active task, phase, and resume capability.

**Parameters:** None

**Returns:**

```json
{
  "hasActiveTask": true,
  "task": {
    "id": "123",
    "title": "Fix authentication timeout",
    "source": "github",
    "worktreePath": "../worktrees/fix-auth-timeout-123"
  },
  "phase": "implementation",
  "canResume": true,
  "lastActivity": "2024-01-15T10:30:00Z"
}
```

**Use case:** Check if there's work in progress before starting new workflow.

---

### workflow_start

Start a new workflow with specified policy settings.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| taskSource | string | No | Where to look for tasks: `gh-issues`, `linear`, `tasks-md`, `custom` |
| priorityFilter | string | No | What tasks to prioritize: `continue`, `bugs`, `security`, `features`, `all` |
| stoppingPoint | string | No | How far to take the task: `implemented`, `pr-created`, `all-green`, `merged`, `deployed`, `production` |

**Returns:**

```json
{
  "status": "started",
  "flowId": "abc123",
  "message": "Workflow started with policy: gh-issues, bugs, merged"
}
```

**Use case:** Begin new task-to-production workflow.

---

### workflow_resume

Resume an interrupted workflow from its last checkpoint.

**Parameters:** None (resumes active workflow)

**Returns:**

```json
{
  "status": "resumed",
  "phase": "review-loop",
  "task": { "id": "123", "title": "..." },
  "message": "Resumed at review-loop phase"
}
```

**Use case:** Continue after session interruption.

---

### workflow_abort

Abort current workflow and cleanup resources.

**Parameters:** None

**Returns:**

```json
{
  "status": "aborted",
  "cleaned": ["tasks.json entry", "flow.json status"],
  "remaining": ["worktree (manual cleanup)"]
}
```

**Use case:** Cancel workflow that's stuck or no longer needed.

---

### task_discover

Discover and prioritize available tasks from configured sources.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source | string | No | Task source: `gh-issues`, `linear`, `tasks-md`, `custom` |
| filter | string | No | Filter by type: `bug`, `feature`, `security`, etc. |
| limit | number | No | Maximum tasks to return (default: 10) |
| customFile | string | No | Path to custom task file (when source is `custom`) |

**Returns:**

```json
{
  "tasks": [
    {
      "id": "142",
      "title": "Fix authentication timeout bug",
      "source": "github",
      "priority": 85,
      "labels": ["bug", "priority:high"],
      "age": 14
    }
  ],
  "total": 47,
  "filtered": 5
}
```

**Use case:** Find what to work on next without full workflow.

---

### review_code

Run pattern-based code review on changed files.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| files | string[] | No | Files to review (defaults to git diff) |
| thoroughness | string | No | Analysis depth: `quick`, `normal`, `deep` |
| compact | boolean | No | Use compact output format (default: true) |

**Returns:**

```json
{
  "findings": [
    {
      "file": "src/auth.ts",
      "line": 45,
      "severity": "high",
      "category": "security",
      "message": "Hardcoded timeout value",
      "suggestion": "Use config variable"
    }
  ],
  "summary": {
    "critical": 0,
    "high": 2,
    "medium": 5,
    "low": 3
  }
}
```

**Use case:** Quick code review without full workflow.

---

### slop_detect

Detect AI slop patterns with certainty-based findings.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| path | string | No | Directory or file to scan (default: current directory) |
| mode | string | No | `report` (default) or `apply` |
| thoroughness | string | No | `quick` (regex only), `normal` (+analyzers), `deep` (+CLI tools) |
| compact | boolean | No | Use compact table format (60% fewer tokens) |

**Returns:**

```json
{
  "findings": [
    {
      "file": "src/utils.js",
      "line": 15,
      "pattern": "console.log",
      "certainty": "HIGH",
      "autoFixable": true,
      "match": "console.log(\"debug:\", data)"
    }
  ],
  "summary": {
    "HIGH": 5,
    "MEDIUM": 3,
    "LOW": 1
  },
  "applied": 0
}
```

**Use case:** Find and clean AI artifacts without full workflow.

---

### enhance_analyze

Analyze plugins, agents, docs, or prompts for enhancement opportunities.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| path | string | No | Directory to analyze (default: current directory) |
| focus | string | No | Which analyzer: `all`, `plugin`, `agent`, `docs`, `claudemd`, `prompt` |
| mode | string | No | `report` (default) or `apply` HIGH certainty fixes |
| compact | boolean | No | Use compact output format (default: true) |

**Returns:**

```json
{
  "findings": [
    {
      "analyzer": "agent",
      "file": "agents/explorer.md",
      "line": 5,
      "certainty": "HIGH",
      "category": "frontmatter",
      "message": "Missing model specification",
      "fix": "Add 'model: opus' to frontmatter",
      "autoFixable": true
    }
  ],
  "summary": {
    "plugin": { "HIGH": 0, "MEDIUM": 2, "LOW": 1 },
    "agent": { "HIGH": 1, "MEDIUM": 3, "LOW": 0 }
  }
}
```

**Use case:** Improve prompt and plugin quality.

---

### repo_map

Generate or update a cached AST repo map for symbol and import lookups.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | No | `init`, `update`, `status`, `rebuild` (default: status) |
| includeDocs | boolean | No | Include docs analysis (default: true) |
| docsDepth | string | No | `quick` or `thorough` (default: thorough) |
| full | boolean | No | Force full rebuild on update |
| force | boolean | No | Force rebuild on init |
| cwd | string | No | Repository root (default: current directory) |

**Returns:**

```json
{
  "action": "init",
  "result": {
    "success": true,
    "summary": { "files": 142, "symbols": 847, "languages": ["typescript"] }
  }
}
```

**Use case:** Provide fast, accurate context for drift detection and planning.

---

## Platform Integration

### Claude Code

MCP tools are available automatically when plugins are installed.

```bash
# The plugin registers MCP server in plugin.json
/plugin install next-task@awesome-slash
```

### OpenCode

MCP server configured in `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "awesome-slash": {
      "type": "local",
      "command": ["node", "~/.awesome-slash/mcp-server/index.js"],
      "environment": {
        "PLUGIN_ROOT": "~/.awesome-slash",
        "AI_STATE_DIR": ".opencode"
      }
    }
  }
}
```

### Codex CLI

MCP server configured in `~/.codex/config.toml`:

```toml
[mcp_servers.awesome-slash]
command = "node"
args = ["~/.awesome-slash/mcp-server/index.js"]
env = { PLUGIN_ROOT = "~/.awesome-slash", AI_STATE_DIR = ".codex" }
enabled = true
```

---

## State Directory Detection

The MCP server auto-detects which platform is running:

| Priority | Detection Method | Result |
|----------|-----------------|--------|
| 1 | `AI_STATE_DIR` env var | Use specified directory |
| 2 | `OPENCODE_CONFIG` env or `.opencode/` exists | Use `.opencode/` |
| 3 | `CODEX_HOME` env or `.codex/` exists | Use `.codex/` |
| 4 | Default | Use `.claude/` |

---

## Error Handling

All tools return errors in consistent format:

```json
{
  "error": true,
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "details": { }
}
```

**Common error codes:**

| Code | Meaning |
|------|---------|
| `NO_ACTIVE_TASK` | No workflow in progress (for resume) |
| `TASK_ALREADY_CLAIMED` | Task is being worked on by another workflow |
| `TOOL_NOT_AVAILABLE` | Required tool (gh, git) not installed |
| `INVALID_SOURCE` | Unknown task source type |
| `PATH_NOT_FOUND` | Specified path doesn't exist |

---

## Performance Notes

- Tools use caching where appropriate (60-second TTL for platform detection)
- Slop patterns are pre-indexed for O(1) lookup
- Compact mode reduces response tokens by 60-70%
- File operations use streaming for large files

---

## Navigation

[← Back to Documentation Index](../README.md) | [Main README](../../README.md)

**Related:**
- [Cross-Platform Setup](../CROSS_PLATFORM.md) - Platform-specific configuration
- [Agent Reference](./AGENTS.md) - Agents that use these tools
- [Slop Patterns](./SLOP-PATTERNS.md) - What slop_detect finds
