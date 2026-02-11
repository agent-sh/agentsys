# Codex CLI Integration Reference

> **OpenAI Codex CLI** (github.com/openai/codex) - Terminal-native AI coding tool
> Written in Rust (codex-rs), with TypeScript SDK available

## Executive Summary

Codex CLI is OpenAI's terminal-based AI coding assistant with unique features:
- **OS-level sandboxing** (Apple Seatbelt on macOS, Docker on Linux)
- **TOML configuration** in `~/.codex/config.toml`
- **Skill system** with `$skill-name` invocation
- **MCP server mode** where Codex itself can be a tool for other agents
- **Multi-provider support** (OpenAI, Anthropic, Google, Ollama, etc.)
- **Approval policies** (suggest, auto-edit, full-auto)

---

## Quick Facts

| Aspect | Codex CLI | Claude Code |
|--------|-----------|-------------|
| Config file | `~/.codex/config.toml` (TOML) | `settings.json` |
| State directory | `.codex/` | `.claude/` |
| Skills location | `~/.codex/skills/<name>/` | `.claude/skills/` |
| Skill invocation | `$skill-name` | `/skill-name` |
| Model default | `o4-mini` | `claude-sonnet-4` |
| User questions | `request_user_input` tool | `AskUserQuestion` tool |
| Project instructions | `AGENTS.md` | `CLAUDE.md` |
| Sandbox | OS-level (Seatbelt/Docker) | Process-level |

---

## What Our Installer Does

When user runs `awesome-slash` and selects Codex:

```
~/.awesome-slash/           # Full package copy

~/.codex/skills/            # 24 skills installed
├── next-task/SKILL.md
├── deslop/SKILL.md
├── enhance/SKILL.md
├── ship/SKILL.md
├── audit-project/SKILL.md
├── drift-detect/SKILL.md
├── repo-map/SKILL.md
├── sync-docs/SKILL.md
├── perf/SKILL.md
└── ... (15 more internal skills)
```

Skills are invoked with `$` prefix: `$next-task`, `$ship`, etc.

---

## Model Selection

### Codex Model Format

Default model: `o4-mini`

**Built-in Models:**
- `o3`, `o4-mini`, `gpt-5.1`, `gpt-5.1-codex`

**Provider Format:**
```
provider/model
```

**Examples:**
- `openai/gpt-4o` - OpenAI
- `anthropic/claude-sonnet-4` - Anthropic
- `google/gemini-pro` - Google
- `ollama/llama-3` - Local Ollama

### Configuring Providers

```toml
# ~/.codex/config.toml

[providers.anthropic]
name = "anthropic"
baseURL = "https://api.anthropic.com"
envKey = "ANTHROPIC_API_KEY"

[providers.openrouter]
name = "openrouter"
baseURL = "https://openrouter.ai/api/v1"
envKey = "OPENROUTER_API_KEY"
```

---

## User Interaction

### Question Format

Codex uses `request_user_input` tool with a JSON schema:

```json
{
  "questions": [
    {
      "id": "task_selection",
      "header": "Select Task",
      "question": "Which task should I work on?",
      "options": [
        {
          "label": "Option A (Recommended)",
          "description": "Explanation of this choice"
        },
        {
          "label": "Option B",
          "description": "Another option"
        },
        {
          "label": "Other",
          "description": "Provide custom input"
        }
      ]
    }
  ]
}
```

### Question Constraints

| Element | Constraint |
|---------|-----------|
| **Questions per call** | 1-5 (5 max recommended) |
| **Options per question** | 2-4 mutually exclusive |
| **Label length** | Keep concise (no strict limit) |
| **ID field** | Required, unique |
| **Header field** | Short category label |

### Key Differences from Claude Code

| Aspect | Claude Code | Codex CLI |
|--------|-------------|-----------|
| Tool name | `AskUserQuestion` | `request_user_input` |
| Label limit | 30 chars (OpenCode) | No strict limit |
| Multi-select | `multiSelect: true` | Not documented |
| Custom input | Always available | "Other" option |
| Max questions | 4 | ~5 |

### Implication for awesome-slash

The `gen-adapters` script automatically transforms `AskUserQuestion` to `request_user_input` when generating Codex adapter files. It also removes `multiSelect` lines (unsupported in Codex) and injects a note about the required `id` field. Source files use `AskUserQuestion` as the canonical format; Codex compatibility is handled at build time.

---

## Skill System

### Skill Structure

```
~/.codex/skills/
└── skill-name/
    ├── SKILL.md (required)
    │   ├── YAML frontmatter (name, description)
    │   └── Markdown instructions
    └── Bundled Resources (optional)
        ├── scripts/
        ├── references/
        └── assets/
```

### SKILL.md Format

```yaml
---
name: skill-name
description: "Use when user asks to \"trigger phrase 1\", \"trigger phrase 2\". Description of what it does and key capabilities."
---

# Skill Instructions

Content and procedures...
```

### Description Best Practices

**Critical**: The description is the PRIMARY triggering mechanism. It must include:

1. **Specific trigger phrases** - "Use when user asks to..."
2. **What the skill does** - Brief explanation of capabilities
3. **Proper YAML escaping** - Wrap in quotes, escape internal quotes

**Good Example:**
```yaml
description: "Use when user asks to \"find next task\", \"what should I work on\", \"automate workflow\". Orchestrates complete task-to-production workflow."
```

**Bad Example:**
```yaml
description: Master workflow orchestrator  # No trigger phrases!
```

### Progressive Disclosure

| Level | Content | Size |
|-------|---------|------|
| Metadata | name + description | ~100 words (always loaded) |
| SKILL.md body | Core instructions | <500 lines (loaded on trigger) |
| references/ | Detailed docs | Unlimited (loaded as needed) |

**Note:** Some awesome-slash skills exceed 500 lines. Future improvement: split into references/.

### Invoking Skills

```bash
# In Codex session
$skill-name

# Or reference in chat
"Use $next-task to find my next task"
```

### Apps Integration

Codex has an "apps" system for connectors:

```bash
# List available apps
/apps

# Insert app in composer
$app-name
```

---

## Configuration

### Config File Location

`~/.codex/config.toml` (TOML format)

### Key Settings

```toml
# Model selection
model = "o4-mini"

# Approval mode: suggest | auto-edit | full-auto
approvalMode = "suggest"

# Error handling in full-auto mode
fullAutoErrorMode = "ask-user"

# Desktop notifications
notify = true

# History settings
[history]
maxSize = 100
saveHistory = true
sensitivePatterns = ["password", "secret", "api_key"]
```

### Approval Policies

| Mode | Behavior |
|------|----------|
| `suggest` | Show changes, require approval for each |
| `auto-edit` | Auto-apply file edits, ask for shell commands |
| `full-auto` | Run everything automatically (sandboxed) |

### Runtime Approval Policies

When using Codex as MCP server:

| Policy | Behavior |
|--------|----------|
| `untrusted` | Prompt for every action |
| `on-request` | Prompt when uncertain |
| `on-failure` | Prompt only on errors |
| `never` | Fully autonomous |

---

## MCP Integration

### Codex MCP Support

Codex supports MCP (Model Context Protocol) for tool integration.

**Codex as MCP Server:**
```bash
# Start Codex as MCP server
codex mcp-server

# Inspect with MCP inspector
npx @modelcontextprotocol/inspector codex mcp-server
```

**Managing MCP Servers:**
```bash
codex mcp add my-server
codex mcp list
codex mcp get my-server
codex mcp remove my-server
```

Note: awesome-slash uses native Codex skills (in `~/.codex/skills/`) instead of MCP for better integration.

---

## Project Instructions

### AGENTS.md

Codex reads `AGENTS.md` files hierarchically:
1. `~/.codex/AGENTS.md` (global)
2. Repository root `AGENTS.md`
3. Current directory `AGENTS.md`

### Example AGENTS.md

```markdown
# Project Guidelines

## Code Style
- Use TypeScript strict mode
- Prefer async/await over callbacks
- All functions must have JSDoc comments

## Testing
- Run `npm test` before committing
- Maintain >80% code coverage

## Git Conventions
- Use conventional commits (feat:, fix:, docs:)
- Never force push to main
```

### Compatibility with CLAUDE.md

Codex primarily reads `AGENTS.md`, but our MCP server sets `AI_STATE_DIR=.codex` to ensure state files are written to the correct location.

---

## Sandbox Security

### macOS (Seatbelt)

- Apple's Seatbelt wraps all commands
- Network fully blocked by default
- Confined to working directory + temp storage

### Linux (Docker)

- Optional Docker containerization
- iptables firewall denies all egress except API
- Full filesystem isolation

### Full-Auto Mode Safety

In `full-auto` mode:
- All commands run network-disabled
- Confined to working directory
- Temporary storage allowed
- Cannot access other directories

---

## Session Management

### Conversation State

```bash
# Sessions stored in
~/.codex/sessions/

# Each session has
session_id/
├── history.json
└── metadata.json
```

### Thread-Based Architecture

Codex uses threads for conversation management:

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread({
  workingDirectory: "/path/to/project"
});

await thread.run("Find and fix bugs");
```

### Compaction

Codex automatically compacts long sessions:
- Monitors token usage vs context limit
- Prunes old tool outputs
- Creates summary of conversation
- Continues transparently

---

## Multi-Agent Architecture

### Codex as Agent Tool

Other agents can spawn Codex:

```json
{
  "jsonrpc": "2.0",
  "method": "newConversation",
  "params": {
    "model": "o3",
    "cwd": "/home/user/project",
    "approvalPolicy": "on-request",
    "sandbox": "workspace-write"
  }
}
```

### Hierarchical Agent Chains

```
Parent Agent (orchestrator)
    └── Codex (MCP server mode)
            └── Execute coding tasks
```

### Agent Communication

```json
// Send turn to conversation
{
  "method": "sendUserTurn",
  "params": {
    "conversationId": "conv-123",
    "input": [{ "type": "text", "text": "Run tests" }]
  }
}
```

---

## Known Limitations

### Functional Differences

1. **No subagent spawning** - Codex uses MCP server mode instead of Task tool
2. **Skills are global** - Installed to `~/.codex/skills/`, not per-project
3. **TOML config** - Different format from JSON

### State Directory

Codex uses `.codex/` in projects. Our MCP server is configured with `AI_STATE_DIR=.codex` to write state files correctly.

### Question Format

Native Codex uses `request_user_input`. The `gen-adapters` script automatically transforms `AskUserQuestion` → `request_user_input` in all Codex adapter files, removes unsupported `multiSelect` lines, and adds notes about the required `id` field.

---

## Testing Codex Integration

### Verify MCP Connection

```bash
# In Codex session
# Use any MCP tool
workflow_status
```

### Verify Skills

```bash
# Should list installed skills
$next-task
$deslop
$ship
```

### Verify State Directory

```bash
# After running workflow
ls .codex/
# Should see: tasks.json, flow.json (in worktree)
```

---

## Improvement Opportunities

### Short Term

1. **Test question format** - Verify `AskUserQuestion` works via MCP
2. **Skill descriptions** - Ensure skills have good trigger descriptions
3. **Document $skill invocation** - Add to user docs

### Medium Term

1. **Native Codex agents** - Create Codex-native agent definitions
2. **Approval policy hints** - Recommend `on-request` for workflows
3. **Sandbox configuration** - Document recommended sandbox settings

### Long Term

1. **Codex MCP server integration** - Use Codex as a tool from Claude
2. **Cross-platform state sync** - Share state between tools
3. **TypeScript SDK integration** - Programmatic Codex usage

---

## TypeScript SDK

### Installation

```bash
npm install @openai/codex-sdk
```

### Basic Usage

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread({
  workingDirectory: process.cwd()
});

const turn = await thread.run("Find and fix bugs");
console.log(turn.finalResponse);
```

### Structured Output

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const ReviewSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.array(z.object({
    category: z.enum(["style", "performance", "security"]),
    comment: z.string()
  }))
});

const turn = await thread.run("Review the code", {
  outputSchema: zodToJsonSchema(ReviewSchema)
});

const review = ReviewSchema.parse(JSON.parse(turn.finalResponse));
```

---

## Resources

- **GitHub**: https://github.com/openai/codex
- **Rust CLI**: `codex-rs/` directory
- **TypeScript SDK**: `sdk/typescript/`
- **Docs**: `docs/` directory in repo
- **MCP Interface**: `codex-rs/docs/codex_mcp_interface.md`
