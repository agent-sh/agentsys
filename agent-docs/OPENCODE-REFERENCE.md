# OpenCode Integration Reference

> OpenCode (opencode.ai, github.com/anomalyco/opencode)

## Executive Summary

OpenCode has significant features Claude Code doesn't have:
- **Extended thinking** across 7+ providers (Anthropic, OpenAI, Google, Bedrock, etc.)
- **LSP integration** for code intelligence
- **Session compaction** with auto-summarization
- **12+ plugin hooks** for deep customization
- **Permission wildcards** with cascading approval
- **Event bus** for pub-sub across all operations

---

## Quick Facts

| Aspect | OpenCode | Claude Code |
|--------|----------|-------------|
| Config file | `opencode.json` (JSONC supported) | `settings.json` |
| State directory | `.opencode/` | `.claude/` |
| Commands location | `.opencode/commands/`, `~/.config/opencode/commands/` | Plugin commands |
| Skills location | `.opencode/skills/`, `~/.config/opencode/skills/`, `.claude/skills/`, `~/.claude/skills/` | `.claude/skills/` |
| Agent definitions | `.opencode/agents/*.md` | Plugin agents |
| Model selection | Multiple providers | Anthropic only |
| User questions | Numbered list | Checkboxes |
| Project instructions | `AGENTS.md` (reads `CLAUDE.md` too) | `CLAUDE.md` |

---

## What Our Installer Does

When user runs `agentsys` and selects OpenCode:

```
~/.agentsys/                    # Full package copy

~/.config/opencode/commands/         # 10 commands (global)
├── next-task.md
├── delivery-approval.md
├── ship.md
├── deslop.md
├── enhance.md
├── audit-project.md
├── drift-detect.md
├── repo-map.md
├── sync-docs.md
└── perf.md

~/.config/opencode/agents/           # 29 agents (global)
├── task-discoverer.md
├── exploration-agent.md
├── planning-agent.md
├── implementation-agent.md
├── delivery-validator.md
└── ...

~/.config/opencode/skills/           # 24 skills (global)
├── task-discovery/SKILL.md
├── orchestrate-review/SKILL.md
├── deslop/SKILL.md
└── ...

~/.config/opencode/plugins/          # Native plugin (global)
└── agentsys.ts
```

**Native Plugin Features:**
- Auto-thinking selection (adjusts budget per agent)
- Workflow enforcement (blocks git push until /ship)
- Session compaction with state preservation
- Provider-agnostic thinking config

---

## Model Selection

### OpenCode Model Format

```
provider/model
```

**Examples:**
- `opencode/claude-opus-4-5` - Via OpenCode's proxy
- `anthropic/claude-opus-4-5` - Direct Anthropic
- `openai/gpt-4o` - OpenAI
- `groq/llama-3.3-70b` - Groq

### Specifying Model in Commands

OpenCode commands can specify model in frontmatter:

```yaml
---
description: Complex analysis task
agent: general
model: opencode/claude-opus-4-5
subtask: true
---
```

### Specifying Model in Agents

```yaml
# .opencode/agents/my-agent.md
---
description: Deep analysis agent
mode: subagent
model: opencode/claude-opus-4-5
temperature: 0.7
steps: 50
permission:
  edit: allow
  bash: ask
---

System prompt content here...
```

### Per-Agent Config in opencode.json

```jsonc
{
  "agent": {
    "build": {
      "model": "opencode/claude-opus-4-5"
    },
    "triage": {
      "model": "opencode/claude-haiku-4-5"
    }
  }
}
```

---

## User Interaction Differences

### The Checkbox Problem

**Claude Code** - AskUserQuestion renders as interactive checkboxes:
```
[x] Option A (Recommended)
[ ] Option B
[ ] Option C
```

**OpenCode** - Questions render as numbered list:
```
1) Option A
2) Option B
3) Option C

Your selection: _
```

### OpenCode Question API

```typescript
// OpenCode's Question format
{
  question: "Which task source?",
  header: "Task Source",           // max 30 chars
  options: [
    { label: "GitHub Issues", description: "Fetch from gh issues" },
    { label: "Linear", description: "Fetch from Linear" }
  ],
  multiple: true,    // Allow multi-select (comma-separated numbers)
  custom: true       // Allow typing custom answer
}
```

### Implication for AgentSys

Our agents use `AskUserQuestion` which works in both platforms, but:
- Claude Code: Beautiful checkbox UI
- OpenCode: Functional numbered list

**No code changes needed** - the functionality works, just different UI.

---

## Command Format Comparison

### Claude Code Format (Current)

```yaml
---
description: Task description
argument-hint: "[filter] [--status]"
allowed-tools: Bash(git:*), Read, Write, Task
---

# Command Title

Instructions...
```

### OpenCode Format

```yaml
---
description: Task description
agent: general              # Which agent handles this
model: opencode/claude-opus-4-5  # Optional model override
subtask: true               # Run as subtask (background)
---

Instructions with $1, $2, $ARGUMENTS placeholders...
```

### Key Differences

| Field | Claude Code | OpenCode |
|-------|-------------|----------|
| Tool restrictions | `allowed-tools` | `permission` block in agent |
| Arguments | `argument-hint` | `$1`, `$2`, `$ARGUMENTS` |
| Model | Inherited | `model` field |
| Agent selection | N/A | `agent` field |
| Background exec | N/A | `subtask: true` |

---

## Agent System

### Built-in OpenCode Agents

| Agent | Mode | Purpose |
|-------|------|---------|
| `build` | primary | Default, full tool access |
| `plan` | primary | Read-only, requires approval |
| `general` | subagent | Multi-step research |
| `explore` | subagent | Fast read-only exploration |

### Agent Modes

- **primary** - Can be default agent for sessions
- **subagent** - Called via @ mention syntax (e.g., `@agent-name prompt`)
- **all** - Both primary and subagent

### Invoking Subagents in OpenCode

OpenCode does NOT have Claude Code's Task tool. Instead, use @ mention syntax:

```
@general help me search for authentication patterns
@explore find all files that handle user sessions
```

Subagents can be invoked:
1. **Manually** - Type `@agent-name` followed by your prompt
2. **Automatically** - Primary agents may call subagents based on their descriptions

Navigate between sessions with `<Leader>+Right/Left` keybinds.

### Custom Agent Definition

```yaml
# .opencode/agents/opus-reviewer.md
---
description: Deep code review with Opus
mode: subagent
model: opencode/claude-opus-4-5
color: "#FF6B6B"
temperature: 0.3
steps: 100
permission:
  read: allow
  edit: ask
  bash: deny
---

You are a senior code reviewer. Analyze code thoroughly...
```

---

## MCP Integration

OpenCode supports MCP (Model Context Protocol) for external tool integration.

### Local Server Example

```jsonc
{
  "mcp": {
    "my-server": {
      "type": "local",
      "command": ["node", "/path/to/server.js"],
      "enabled": true
    }
  }
}
```

### Remote Server Example

```jsonc
{
  "mcp": {
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

Note: AgentSys uses native OpenCode commands, agents, and skills instead of MCP for better integration and features like auto-thinking selection.

---

## Skill System

### Skill Location

OpenCode searches these locations:
1. `.opencode/skills/<name>/SKILL.md` (project)
2. `~/.config/opencode/skills/<name>/SKILL.md` (global)
3. `.claude/skills/<name>/SKILL.md` (Claude Code compatibility)
4. `~/.claude/skills/<name>/SKILL.md` (Claude Code compatibility)

---
name: my-skill
description: When to use this skill
---

Skill content and instructions...
```

### Compatibility

Our skills are installed to `~/.config/opencode/skills/` for global access.
OpenCode also scans `.claude/skills/` for Claude Code compatibility.

---

## Configuration Hierarchy

**Merge order (lowest to highest priority):**
1. Remote org configs (`.well-known/opencode`)
2. Global: `~/.config/opencode/opencode.json`
3. Custom path: `OPENCODE_CONFIG` env var
4. Project: `opencode.json` in project root
5. Inline: `OPENCODE_CONFIG_CONTENT` env var

### Variable Substitution

```jsonc
{
  "provider": {
    "anthropic": {
      "api_key": "{env:ANTHROPIC_API_KEY}"
    }
  }
}
```

---

## Permission System

### Permission Actions

- `allow` - Always allow
- `deny` - Always deny
- `ask` - Prompt user each time

### Pattern-Based Permissions

```jsonc
{
  "permission": {
    "edit": {
      "*.env": "ask",
      "*.env.example": "allow",
      "*": "allow"
    },
    "bash": "ask",
    "external_directory": "deny"
  }
}
```

### Per-Agent Permissions

```yaml
# In agent definition
permission:
  read: allow
  edit: ask
  bash: deny
  glob: allow
  grep: allow
```

---

## Project Instructions

### Rules Discovery

OpenCode applies rules from these sources:
1. Project rules: `AGENTS.md`
2. Global rules: `~/.config/opencode/AGENTS.md`

Claude Code compatibility fallbacks:
- If no project `AGENTS.md` exists: `CLAUDE.md`
- If no global `~/.config/opencode/AGENTS.md` exists: `~/.claude/CLAUDE.md`

You can also configure additional instruction files via the `instructions` array in `opencode.json` (for example, with glob patterns in monorepos).

### Generating AGENTS.md

```bash
# In OpenCode
/init
```

Creates `AGENTS.md` with project context.

---

## Known Limitations

### UI Differences (Not Fixable)

1. **Questions show as numbers, not checkboxes** - OpenCode limitation
2. **No rich markdown in responses** - Terminal rendering

### Functional Gaps

1. **No hook system** - OpenCode has plugins with hooks, but different from Claude Code hooks
2. **No marketplace** - Manual installation only
3. **No Task tool** - OpenCode uses @ mentions for subagent invocation, not Task tool

### Workarounds

| Issue | Workaround |
|-------|------------|
| No checkboxes | Works functionally, just different UI |
| Model selection | Users can set in `opencode.json` |
| Agent invocation | Use @ mentions (`@agent-name prompt`) instead of Task tool |
| Multi-agent workflows | Define native OpenCode agents in `.opencode/agents/` |

---

## Testing OpenCode Integration

### Verify MCP Connection

```bash
# In OpenCode session
# Use any MCP tool
workflow_status
```

### Verify Commands

```bash
# Should list AgentSys commands
/next-task
/deslop
/ship
```

### Verify State Directory

```bash
# After running workflow
ls .opencode/
# Should see: tasks.json, flow.json (in worktree)
```

---

## Improvement Opportunities

### Short Term

1. Add `model:` hints to complex commands for better OpenCode experience
2. Document the numbered-list vs checkbox difference
3. Add OpenCode-specific examples to USAGE.md

### Medium Term

1. Create native OpenCode agent definitions (`.opencode/agents/`)
2. Add OpenCode plugin with hooks for workflow enforcement
3. Test with different model providers

### Long Term

1. OpenCode-native UI for task selection
2. Integrate with OpenCode's built-in agents
3. Cross-platform state sync

---

---

## Extended Thinking / Reasoning Configuration

OpenCode supports thinking/reasoning across **multiple providers** with different APIs.

### Provider-Specific Thinking Config

| Provider | Variants | Configuration |
|----------|----------|---------------|
| **Anthropic** | `high`, `max` | `thinking: { type: "enabled", budgetTokens: 16000 }` |
| **OpenAI/GPT-5** | `none`, `minimal`, `low`, `medium`, `high`, `xhigh` | `reasoningEffort: "high"` |
| **Google Gemini** | `low`, `high`, `max` | `thinkingConfig: { includeThoughts: true, thinkingBudget: 16000 }` |
| **Amazon Bedrock** | `high`, `max` | `reasoningConfig: { type: "enabled", budgetTokens: 16000 }` |
| **Groq** | `none`, `low`, `medium`, `high` | `includeThoughts: true, thinkingLevel: "high"` |

### Configuring Extended Thinking

**Per-Agent (in opencode.json):**
```jsonc
{
  "agent": {
    "build": {
      "model": "anthropic/claude-sonnet-4-20250929",
      "options": {
        "thinking": {
          "type": "enabled",
          "budgetTokens": 16000
        }
      }
    },
    "explore": {
      "model": "openai/gpt-5.1",
      "options": {
        "reasoningEffort": "high",
        "reasoningSummary": "auto"
      }
    }
  }
}
```

**Via Plugin Hook (runtime):**
```typescript
"chat.params": async (input, output) => {
  if (input.agent === "planning-agent") {
    output.options.thinking = { type: "enabled", budgetTokens: 16000 }
  }
}
```

**Cycle at Runtime:** Press `Ctrl+T` to cycle through available thinking variants.

---

## Question API Details

### Format Comparison

| Field | Claude Code | OpenCode |
|-------|-------------|----------|
| Multi-select | `multiSelect: true` | `multiple: true` |
| Custom input | Always available | `custom: true` (default) |
| Header max | 12 chars | 30 chars |
| **Label max** | No strict limit | **30 chars** (enforced) |
| Batch questions | 1-4 questions | Unlimited |

**CRITICAL: Label Length**
OpenCode enforces a **30-character limit** on option labels. Truncate task titles:
```javascript
function truncateLabel(num, title) {
  const prefix = `#${num}: `;
  const maxTitleLen = 30 - prefix.length;
  return title.length > maxTitleLen
    ? prefix + title.substring(0, maxTitleLen - 1) + '...'
    : prefix + title;
}
```

### OpenCode Question Schema

```typescript
{
  question: string,           // Full question text
  header: string,             // Label (max 30 chars)
  options: [
    { label: string, description: string }
  ],
  multiple?: boolean,         // Allow multi-select
  custom?: boolean            // Allow custom answer (default: true)
}
```

### Adapting Our AskUserQuestion Calls

Our agents use Claude's `AskUserQuestion` format. For OpenCode compatibility:

```typescript
// Claude Code format (current)
{
  questions: [{
    question: "Which task source?",
    header: "Source",        // max 12 chars
    multiSelect: false,
    options: [
      { label: "GitHub Issues", description: "..." }
    ]
  }]
}

// OpenCode equivalent
{
  questions: [{
    question: "Which task source?",
    header: "Task Source",   // max 30 chars - can be more descriptive
    multiple: false,
    custom: true,
    options: [
      { label: "GitHub Issues", description: "..." }
    ]
  }]
}
```

**Key Insight:** The formats are similar enough that Claude's `AskUserQuestion` tool works in OpenCode - it just renders as numbered list instead of checkboxes.

---

## Plugin Hooks (Deep Customization)

OpenCode has 12+ hooks for intercepting and modifying behavior.

### Hook Categories

**Chat Hooks:**
| Hook | Purpose |
|------|---------|
| `chat.message` | Intercept/modify user messages |
| `chat.params` | Modify temperature, reasoning effort, options |
| `chat.headers` | Add custom HTTP headers |

**Tool Hooks:**
| Hook | Purpose |
|------|---------|
| `tool.execute.before` | Modify tool arguments |
| `tool.execute.after` | Modify tool results |

**Permission Hook:**
| Hook | Purpose |
|------|---------|
| `permission.ask` | Override permission decisions (allow/deny/ask) |

**Experimental Hooks:**
| Hook | Purpose |
|------|---------|
| `experimental.chat.system.transform` | Modify system prompt |
| `experimental.session.compacting` | Customize session compaction |
| `experimental.chat.messages.transform` | Transform message history |

### Example: Workflow Enforcement via Hooks

```typescript
export const WorkflowPlugin: Plugin = async (ctx) => {
  return {
    "permission.ask": async (input, output) => {
      // Block git push during review phase
      if (input.permission === "bash" && input.metadata?.command?.includes("git push")) {
        const state = await getWorkflowState(ctx.directory)
        if (state?.phase === "review") {
          output.status = "deny"
        }
      }
    },

    "chat.params": async (input, output) => {
      // Use higher reasoning for complex agents
      if (["planning-agent", "implementation-agent"].includes(input.agent)) {
        output.options.thinking = { type: "enabled", budgetTokens: 16000 }
      }
    }
  }
}
```

---

## Session Compaction

OpenCode auto-compacts sessions when context overflows.

### How It Works

1. **Overflow Detection:** Monitors tokens vs model context limit
2. **Pruning:** Removes old tool outputs (keeps recent 40k tokens)
3. **Summarization:** Creates compacted summary message
4. **Continuation:** Auto-continues conversation

### Customizing Compaction

```typescript
"experimental.session.compacting": async (input, output) => {
  // Add workflow context to compaction
  const state = await getWorkflowState()
  output.context.push(`Current workflow phase: ${state?.phase}`)
  output.context.push(`Active task: ${state?.task?.title}`)

  // Custom compaction prompt
  output.prompt = "Summarize preserving: 1) workflow state 2) pending decisions 3) key findings"
}
```

---

## Permission System (Advanced)

### Wildcard Pattern Matching

```jsonc
{
  "permission": {
    "edit": {
      "*.env": "ask",
      "*.env.example": "allow",
      "src/**/*.ts": "allow",
      "*": "ask"
    },
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "rm -rf *": "deny",
      "*": "ask"
    }
  }
}
```

### Cascading Approval

When user selects "always" for a permission:
- All pending permissions matching same pattern are auto-approved
- Future requests matching pattern are auto-approved for session

### Permission Hook for Workflow

```typescript
"permission.ask": async (input, output) => {
  const workflowPatterns = {
    "git push": "deny",      // Block during review
    "gh pr create": "deny",  // Only /ship creates PRs
    "npm publish": "deny"    // Block publishing
  }

  for (const [pattern, action] of Object.entries(workflowPatterns)) {
    if (input.metadata?.command?.includes(pattern)) {
      output.status = action
      return
    }
  }
}
```

---

## LSP Integration

OpenCode has built-in Language Server Protocol support.

### Features

- **Symbol lookup:** Document and workspace symbols
- **Multiple servers:** pyright, TypeScript, custom
- **Dynamic spawning:** Per-file-type activation
- **Diagnostics:** Real-time error reporting

### Configuration

```jsonc
{
  "lsp": {
    "typescript": {
      "command": ["typescript-language-server", "--stdio"],
      "extensions": [".ts", ".tsx", ".js", ".jsx"]
    },
    "python": {
      "command": ["pyright-langserver", "--stdio"],
      "extensions": [".py"]
    },
    "custom": {
      "command": ["my-lsp", "--stdio"],
      "extensions": [".custom"],
      "disabled": false
    }
  }
}
```

---

## Event Bus

OpenCode has a pub-sub event system for all operations.

### Key Events

| Event | Description |
|-------|-------------|
| `session.created` | New session started |
| `session.compacted` | Session compressed |
| `message.updated` | Message content changed |
| `tool.execute.before/after` | Tool lifecycle |
| `file.edited` | File modified |
| `permission.updated` | Permission changed |

### Subscribing to Events

```typescript
"event": async ({ event }) => {
  switch (event.type) {
    case "tool.execute.after":
      // Update workflow state after tool completion
      await updateWorkflowState(event.properties)
      break
    case "session.compacted":
      // Preserve workflow context
      await preserveWorkflowContext(event.properties.sessionID)
      break
  }
}
```

---

## Native Plugin vs MCP

### Comparison

| Aspect | Native Plugin | MCP Server |
|--------|---------------|------------|
| Setup | `.opencode/plugins/` | MCP config + server process |
| Performance | Faster (in-process) | Slower (IPC) |
| Hooks | Full access (12+) | Tools only |
| Auth | Built-in OAuth/API | Manual |
| Events | Full subscription | None |

### Recommendation

**Use MCP** when:
- Cross-platform compatibility needed (Claude + OpenCode + Codex)
- Simple tool exposure

**Use Native Plugin** when:
- OpenCode-only features needed (hooks, events, compaction)
- Maximum performance required
- Deep workflow integration

---

## Implementation Opportunities

### Short Term (adapt existing)

1. **Question format:** Our `AskUserQuestion` works but could use longer headers (30 vs 12 chars)
2. **Model hints:** Add `model:` to agent frontmatter for OpenCode users
3. **Permission patterns:** Document recommended permission config for workflows

### Medium Term (new features)

1. **Native plugin:** Create OpenCode plugin alongside MCP server
2. **Reasoning config:** Add thinking budget config to our agents
3. **Compaction hook:** Preserve workflow state during session compaction
4. **Event integration:** Use event bus for workflow state management

### Long Term (unique value)

1. **LSP integration:** Leverage code intelligence for better reviews
2. **Permission enforcement:** Use hooks to enforce workflow gates
3. **Auto-model selection:** Choose reasoning level based on task complexity

---

## Global Thinking Model Configuration

### Proposal for AgentSys

Add to user's `opencode.json`:

```jsonc
{
  "agent": {
    // Simple agents - no extended thinking
    "worktree-manager": {
      "model": "anthropic/claude-haiku-4-5"
    },
    "simple-fixer": {
      "model": "anthropic/claude-haiku-4-5"
    },

    // Medium agents - standard thinking
    "task-discoverer": {
      "model": "anthropic/claude-sonnet-4",
      "options": { "thinking": { "type": "enabled", "budgetTokens": 8000 } }
    },

    // Complex agents - extended thinking
    "planning-agent": {
      "model": "anthropic/claude-sonnet-4",
      "options": { "thinking": { "type": "enabled", "budgetTokens": 16000 } }
    },
    "delivery-validator": {
      "model": "anthropic/claude-sonnet-4",
      "options": { "thinking": { "type": "enabled", "budgetTokens": 16000 } }
    }
  }
}
```

### Model Selection Strategy

| Agent Category | Model | Thinking Budget |
|----------------|-------|-----------------|
| **Execution** (worktree, simple-fixer) | Haiku | None |
| **Discovery** (task-discoverer, ci-monitor) | Sonnet | 8k |
| **Analysis** (exploration, deslop-agent) | Sonnet | 12k |
| **Reasoning** (planning, review, delivery) | Sonnet | 16k |
| **Synthesis** (plan-synthesizer, enhancement-orchestrator) | Opus | 16k+ |

---

## Resources

- **Docs**: https://opencode.ai/docs
- **GitHub**: https://github.com/anomalyco/opencode
- **Config Schema**: https://opencode.ai/config.json
- **SDK**: `npm install @opencode-ai/sdk`
- **Plugin SDK**: `npm install @opencode-ai/plugin`
