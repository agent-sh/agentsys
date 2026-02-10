# Learning Guide: Advanced AI CLI Integration - MCP Servers, SDKs, and Cross-Tool Patterns

**Generated**: 2026-02-10
**Sources**: 38 resources analyzed
**Depth**: deep
**Prerequisite**: [ai-cli-non-interactive-programmatic-usage.md](./ai-cli-non-interactive-programmatic-usage.md)

## TL;DR

- **Claude Code** is the most integration-ready: runs AS an MCP server (`claude mcp serve`), has a full Agent SDK (Python/TypeScript), supports custom subagents, MCP client with 100+ servers, session forking, and containerized hosting.
- **Gemini CLI** supports MCP as a client (stdio/http/sse), has an extension system for packaging MCP servers + commands + hooks, supports remote agents via A2A protocol, and has a tools API for custom tool registration. No server mode or SDK.
- **Codex CLI** has MCP support via `shell-tool-mcp` (acts as MCP client, not server), a Rust rewrite (`codex-rs`) underway, and a TypeScript SDK at `sdk/typescript/`. No server mode.
- **OpenCode** is archived (Sept 2025), succeeded by **Crush** (charmbracelet/crush). Crush supports MCP (stdio/http/sse), agent skills, LSP integration, and multi-provider support. No server mode or SDK.

**Bottom line**: For cross-tool consultation, Claude Code is the best "callee" because `claude mcp serve` lets other tools connect to it natively via MCP protocol, not just CLI subprocess calls.

---

## Table of Contents

1. [MCP Server Capabilities](#mcp-server-capabilities)
2. [MCP Client Capabilities](#mcp-client-capabilities)
3. [SDK / Programmatic Library Access](#sdk--programmatic-library-access)
4. [Extension / Plugin Systems](#extension--plugin-systems)
5. [Remote Agents & A2A Protocol](#remote-agents--a2a-protocol)
6. [Server / Daemon / Long-Running Patterns](#server--daemon--long-running-patterns)
7. [Cross-Tool Integration Matrix](#cross-tool-integration-matrix)
8. [Best Integration Patterns by Use Case](#best-integration-patterns-by-use-case)
9. [Detailed Tool Deep-Dives](#detailed-tool-deep-dives)

---

## MCP Server Capabilities

Can the tool **run AS an MCP server** that other tools connect to?

| Tool | Runs as MCP Server? | Command | What It Exposes |
|------|---------------------|---------|-----------------|
| **Claude Code** | Yes | `claude mcp serve` | Read, Edit, Write, Bash, Glob, Grep tools |
| **Gemini CLI** | No | N/A | N/A |
| **Codex CLI** | No (has `shell-tool-mcp` server) | `npx @openai/codex-shell-tool-mcp` | Sandboxed shell execution only |
| **OpenCode/Crush** | No | N/A | N/A |

### Claude Code as MCP Server (Key Feature)

Claude Code can expose its full tool suite to any MCP client:

```bash
# Start Claude Code as an MCP server (stdio transport)
claude mcp serve
```

**Use in Claude Desktop:**

```json
{
  "mcpServers": {
    "claude-code": {
      "type": "stdio",
      "command": "claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

**Use from any MCP client (including other AI CLIs):**

Any tool that supports MCP can connect to Claude Code's tools. This means Gemini CLI, through its extension system, could theoretically connect to a Claude Code MCP server and use Claude's Read/Edit/Bash tools.

**What gets exposed:**
- File operations: Read, Write, Edit, Glob, Grep
- Shell execution: Bash
- Search: WebSearch, WebFetch

**Important caveat**: The MCP server only exposes Claude Code's *tools* -- the calling client is responsible for its own AI model and tool approval flow. This is different from calling Claude Code's AI via `-p`.

### Codex shell-tool-mcp

Codex provides `@openai/codex-shell-tool-mcp` -- a specialized MCP server for sandboxed shell execution:

```toml
# ~/.codex/config.toml
[features]
shell_tool = false

[mcp_servers.shell-tool]
command = "npx"
args = ["-y", "@openai/codex-shell-tool-mcp"]
```

**What it does:**
- Intercepts `execve()` system calls at kernel level
- Enforces `.rules` file policies (allow/prompt/forbidden)
- Provides sandboxed shell within Codex's security model
- Codex acts as MCP **client**, not server

---

## MCP Client Capabilities

Can the tool **connect TO external MCP servers**?

| Tool | MCP Client? | Transport Types | Config Method |
|------|-------------|-----------------|---------------|
| **Claude Code** | Yes (deep) | stdio, http, sse | `claude mcp add`, `.mcp.json`, `--mcp-config` |
| **Gemini CLI** | Yes (via extensions) | stdio, http, sse | `settings.json`, extensions |
| **Codex CLI** | Yes (limited) | stdio | `config.toml` |
| **Crush** (OpenCode successor) | Yes | stdio, http, sse | Config file |

### Claude Code MCP Client

The most comprehensive MCP client:

```bash
# Add an HTTP MCP server
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Add a stdio MCP server
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub --dsn "postgres://..."

# Add with authentication
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
# Then: /mcp to authenticate via OAuth

# Load from config file (useful for programmatic invocation)
claude -p "query" --mcp-config ./mcp.json

# Strict mode: ONLY use specified MCP servers
claude -p "query" --strict-mcp-config --mcp-config ./mcp.json

# In Agent SDK (Python)
async for message in query(
    prompt="Open example.com",
    options=ClaudeAgentOptions(
        mcp_servers={
            "playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}
        }
    )
):
    ...
```

**Key features:**
- OAuth 2.0 authentication for remote servers
- Scopes: local (default), project (`.mcp.json`, git-checked), user (global)
- Tool Search: auto-loads tools on-demand when many MCP servers configured
- MCP resources via `@server:protocol://path` references
- MCP prompts as `/mcp__server__prompt` commands
- Dynamic `list_changed` notifications
- Managed MCP for enterprise (allowlists/denylists)

### Gemini CLI MCP Client

Via the extension system and `settings.json`:

```json
// ~/.gemini/settings.json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

**Via extensions (bundled MCP servers):**

```json
// gemini-extension.json
{
  "name": "my-extension",
  "mcpServers": {
    "db": {
      "command": "${extensionPath}/servers/db-server",
      "args": ["--config", "${extensionPath}/config.json"]
    }
  }
}
```

**Key features:**
- MCP servers loaded at startup
- Multiple servers prefix tool names: `serverAlias__toolName`
- Extension-bundled MCP servers auto-start
- Variable substitution: `${extensionPath}`, `${workspacePath}`

### Crush (OpenCode Successor) MCP Client

```yaml
# Configuration supports all three transports
mcpServers:
  filesystem:
    type: stdio
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env:
      ALLOWED_DIRS: "/home/user/projects"
  remote-api:
    type: http
    url: "https://api.example.com/mcp"
    timeout: 30
```

---

## SDK / Programmatic Library Access

Can you use the tool as an **importable library** (not just CLI subprocess)?

| Tool | Has SDK? | Languages | Package |
|------|----------|-----------|---------|
| **Claude Code** | Yes (Agent SDK) | Python, TypeScript | `claude-agent-sdk`, `@anthropic-ai/claude-agent-sdk` |
| **Gemini CLI** | No SDK | N/A | N/A (has Tools API for extensions) |
| **Codex CLI** | Partial (TypeScript SDK) | TypeScript | `sdk/typescript/` in repo |
| **Crush** | No SDK | N/A | N/A |

### Claude Agent SDK (Most Mature)

The Agent SDK provides the same tools, agent loop, and context management as Claude Code CLI:

**Python:**
```python
pip install claude-agent-sdk

from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Find and fix bugs in auth.py",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Edit", "Bash"],
        permission_mode="acceptEdits",
        # Session management
        resume="session-id",
        fork_session=True,
        # Structured output
        output_format={"type": "json_schema", "schema": {...}},
        # Custom subagents
        agents={
            "reviewer": AgentDefinition(
                description="Code reviewer",
                prompt="Review code quality",
                tools=["Read", "Grep", "Glob"]
            )
        },
        # MCP servers
        mcp_servers={
            "db": {"command": "npx", "args": ["-y", "@bytebase/dbhub"]}
        },
        # Hooks
        hooks={
            "PostToolUse": [HookMatcher(matcher="Edit|Write", hooks=[log_change])]
        }
    )
):
    if hasattr(message, "result"):
        print(message.result)
```

**TypeScript:**
```typescript
npm install @anthropic-ai/claude-agent-sdk

import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix bugs in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits",
    resume: sessionId,
    forkSession: true,
    outputFormat: { type: "json_schema", schema: mySchema },
    agents: { reviewer: { description: "...", prompt: "...", tools: [...] } },
    mcpServers: { db: { command: "npx", args: [...] } }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

**Key SDK capabilities beyond CLI:**
- Async iterator streaming
- Programmatic hooks (callbacks, not shell scripts)
- Type-safe structured outputs (Zod/Pydantic)
- Native message objects with metadata
- Session management (resume, fork)
- Custom subagent definitions
- Tool approval callbacks (`canUseTool`)

### Gemini CLI Tools API (Extension-Level)

Not an importable SDK, but Gemini CLI's core exposes a Tools API for custom tool registration:

```typescript
// BaseTool interface (within Gemini CLI extensions)
interface BaseTool {
  name: string;
  displayName: string;
  description: string;
  parameterSchema: JSONSchema;
  execute(params: any, signal: AbortSignal): Promise<ToolResult>;
  validateToolParams(params: any): boolean;
  shouldConfirmExecute(params: any): boolean;
}

// ToolResult
interface ToolResult {
  llmContent: string | PartListUnion;  // For model
  returnDisplay: string | FileDiff;     // For user
}
```

**Dynamic tool discovery** via `tools.discoveryCommand` in `settings.json`:
```json
{
  "tools": {
    "discoveryCommand": "./my-tool-discovery.sh"
  }
}
```

The command outputs JSON describing custom tools, registered as `DiscoveredTool` instances.

---

## Extension / Plugin Systems

| Tool | Extension System | What Can Be Packaged |
|------|-----------------|---------------------|
| **Claude Code** | Plugins (`plugin.json`) | Commands, agents, skills, MCP servers, hooks |
| **Gemini CLI** | Extensions (`gemini-extension.json`) | Commands, MCP servers, hooks, skills, sub-agents, context |
| **Codex CLI** | None (uses AGENTS.md + .rules) | N/A |
| **Crush** | Agent Skills (open standard) | Skills from configurable directories |

### Gemini CLI Extensions (Rich System)

```bash
# Install from GitHub
gemini extensions install https://github.com/owner/my-extension

# Scaffold new extension from template
gemini extensions new ./my-ext mcp-server

# Link for local development
gemini extensions link ./my-ext

# Manage
gemini extensions list
gemini extensions enable/disable <name>
gemini extensions update --all
```

**Extension structure:**
```
my-extension/
  gemini-extension.json    # Config (MCP servers, settings, tool exclusions)
  GEMINI.md                # Context file (auto-loaded)
  commands/                # Custom slash commands (TOML files)
  skills/                  # Agent skills
  agents/                  # Sub-agents (.md files)
  hooks/hooks.json         # Lifecycle hooks
```

**Templates available:** `context`, `custom-commands`, `exclude-tools`, `mcp-server`

---

## Remote Agents & A2A Protocol

| Tool | Remote Agent Support | Protocol |
|------|---------------------|----------|
| **Claude Code** | Yes (via Agent SDK hosting) | Custom (Agent SDK) |
| **Gemini CLI** | Yes | Agent-to-Agent (A2A) protocol |
| **Codex CLI** | No | N/A |
| **Crush** | No | N/A |

### Gemini CLI A2A (Agent-to-Agent)

Gemini CLI can connect to remote subagents using the A2A protocol:

```json
// settings.json
{
  "remoteAgents": [
    {
      "name": "research-agent",
      "agent_card_url": "https://my-agent.example.com/.well-known/agent.json"
    }
  ]
}
```

**Commands:**
- `/agents` -- list, refresh, enable, disable remote agents
- Remote agents appear alongside local sub-agents

### Claude Code Agent SDK Hosting

Deploy Claude Code agents as long-running services:

**Deployment patterns:**
1. **Ephemeral**: New container per task, destroyed when complete
2. **Long-running**: Persistent container, multiple Claude processes
3. **Hybrid**: Ephemeral containers hydrated with history (session resume)
4. **Single container**: Multiple SDK processes in one container

**Sandbox providers:**
- Modal Sandbox
- Cloudflare Sandboxes
- Daytona
- E2B
- Fly Machines
- Vercel Sandbox

**Resource requirements:** 1GiB RAM, 5GiB disk, 1 CPU per instance

---

## Server / Daemon / Long-Running Patterns

| Tool | Long-Running Mode | How |
|------|-------------------|-----|
| **Claude Code** | MCP Server + Agent SDK hosting | `claude mcp serve` / SDK containers |
| **Gemini CLI** | No | N/A |
| **Codex CLI** | No | N/A |
| **Crush** | No | N/A |

Claude Code is the only tool that supports true long-running server patterns:

1. **MCP Server** (`claude mcp serve`): Exposes tools via MCP protocol
2. **Agent SDK Containers**: Deploy as Docker/cloud services with session persistence
3. **GitHub Actions**: `claude-code-action@v1` for CI/CD-triggered agents

---

## Cross-Tool Integration Matrix

| Feature | Claude Code | Gemini CLI | Codex CLI | Crush |
|---------|------------|------------|-----------|-------|
| **Runs as MCP server** | `claude mcp serve` | No | `shell-tool-mcp` (shell only) | No |
| **MCP client** | Deep (stdio/http/sse + OAuth) | Yes (via extensions) | Limited (stdio) | Yes (stdio/http/sse) |
| **Importable SDK** | Python + TypeScript | No | TypeScript (partial) | No |
| **Extension system** | Plugins | Extensions (rich) | AGENTS.md | Agent Skills |
| **Remote agents** | Agent SDK hosting | A2A protocol | No | No |
| **Subagents** | `--agents` JSON, file-based | `.md` files in agents/ | No | No |
| **Hooks** | Pre/Post ToolUse, Stop, etc. | hooks.json | No | No |
| **LSP integration** | No | No | No | Yes |
| **Multi-provider** | Anthropic, Bedrock, Vertex, Azure | Google, Vertex | OpenAI, Azure, Gemini, Ollama, etc. | All major |
| **Custom tools** | Built-in + MCP | Built-in + discovery + MCP | Built-in | Built-in + MCP |
| **Session fork** | `--fork-session` | No | No | No |
| **Cost control** | `--max-budget-usd` | No | No | No |

---

## Best Integration Patterns by Use Case

### 1. "I want tool X to consult tool Y for a second opinion"

**Best approach**: Use CLI subprocess calls with `-p` flag and `--output-format json`.

```bash
# From any AI session's shell, call Claude Code
result=$(claude -p "Review this code" --output-format json --max-turns 5 | jq -r '.result')

# From any AI session's shell, call Gemini
result=$(gemini -p "Review this code" --output-format json | jq -r '.response')

# From any AI session's shell, call Codex
result=$(codex -q --json "Review this code")
```

### 2. "I want tool X to use tool Y's tools (not just AI advice)"

**Best approach**: Use MCP. Connect tool X as MCP client to tool Y as MCP server.

```bash
# Start Claude Code as MCP server
claude mcp serve

# Connect Gemini CLI to Claude Code's tools via extension
# In gemini-extension.json or settings.json:
{
  "mcpServers": {
    "claude-code": {
      "command": "claude",
      "args": ["mcp", "serve"]
    }
  }
}
```

Now Gemini CLI can use Claude Code's Read, Edit, Bash tools through MCP.

### 3. "I want to build an automated pipeline calling multiple AI tools"

**Best approach**: Use Claude Agent SDK as orchestrator, call other tools via Bash.

```python
from claude_agent_sdk import query, ClaudeAgentOptions

# Claude as orchestrator with Bash access to call other tools
async for message in query(
    prompt="""
    1. Analyze the codebase architecture
    2. Then run: gemini -p "Review architecture for scaling issues" --output-format json
    3. Compare your analysis with Gemini's
    4. Write a combined report
    """,
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Bash", "Write"],
        permission_mode="acceptEdits"
    )
):
    if hasattr(message, "result"):
        print(message.result)
```

### 4. "I want to expose my AI tool as a service for other tools"

**Best approach**: Only Claude Code supports this natively.

```bash
# Claude Code as MCP server
claude mcp serve

# For Gemini/Codex: wrap in a custom MCP server
# Create a thin MCP wrapper around the CLI
```

### 5. "I want conversation continuity across multiple tools"

**Best approach**: Use Claude Code sessions + file-based context sharing.

```bash
# Step 1: Claude analyzes, saves to file
claude -p "Analyze architecture" --output-format json > /tmp/analysis.json
SESSION=$(cat /tmp/analysis.json | jq -r '.session_id')

# Step 2: Gemini reads Claude's output, adds its perspective
cat /tmp/analysis.json | jq -r '.result' | \
  gemini -p "Review this analysis. What's missing?" --output-format json > /tmp/gemini-review.json

# Step 3: Claude continues with Gemini's feedback
GEMINI_FEEDBACK=$(cat /tmp/gemini-review.json | jq -r '.response')
claude -p "A reviewer noted: $GEMINI_FEEDBACK. Update your analysis." \
  --resume "$SESSION" --output-format json
```

### 6. "I want Gemini to use custom tools from an extension that calls Claude"

**Best approach**: Create a Gemini extension that wraps Claude Code.

```json
// gemini-extension.json
{
  "name": "claude-consultant",
  "version": "1.0.0",
  "description": "Consult Claude Code for second opinions",
  "mcpServers": {
    "claude-code": {
      "command": "claude",
      "args": ["mcp", "serve"]
    }
  }
}
```

Install:
```bash
gemini extensions install ./claude-consultant
```

Now Gemini sessions can access Claude Code's tools natively.

---

## Detailed Tool Deep-Dives

### Claude Code: Overlooked Capabilities

1. **`claude mcp serve`** -- Run as MCP server for other tools
2. **`--agents` JSON flag** -- Define specialized subagents inline
3. **`--fork-session`** -- Branch conversations without losing original
4. **`--json-schema`** -- Validated structured output with type safety
5. **`--permission-prompt-tool`** -- Delegate permission prompts to an MCP tool
6. **`--input-format stream-json`** -- Accept streaming JSON input
7. **`--from-pr`** -- Resume sessions linked to GitHub PRs
8. **`--remote`** -- Create web sessions on claude.ai from terminal
9. **`--teleport`** -- Resume web sessions in local terminal
10. **Plugin system** -- Bundle agents, skills, MCP servers, hooks
11. **Managed MCP** -- Enterprise allowlist/denylist for MCP servers
12. **MCP Tool Search** -- Auto on-demand loading when many tools configured
13. **Agent teams** -- Multiple agents collaborating via SendMessage

### Gemini CLI: Overlooked Capabilities

1. **Extensions system** -- Full packaging of MCP + commands + hooks + skills
2. **A2A protocol** -- Connect to remote agents
3. **Sub-agents** -- Define in `.md` files within agents/ directory
4. **Agent Skills** -- Auto-discovered from skills/ directory
5. **Tools API** -- `tools.discoveryCommand` for dynamic tool registration
6. **Hooks system** -- Lifecycle hooks in `hooks/hooks.json`
7. **`--output-format stream-json`** -- Real-time event streaming
8. **Custom commands** -- TOML-based commands in extensions
9. **Context files** -- GEMINI.md auto-loaded from extensions
10. **Extension management** -- Install from GitHub, scaffold, link for dev

### Codex CLI: Overlooked Capabilities

1. **`shell-tool-mcp`** -- MCP server for sandboxed shell execution
2. **Codex-rs (Rust rewrite)** -- Performance-focused reimplementation
3. **TypeScript SDK** (`sdk/typescript/`) -- Programmatic access
4. **`.rules` files** -- Declarative security policies (allow/prompt/forbidden)
5. **`full-auto` sandboxing** -- Network-disabled, directory-confined execution
6. **`fullAutoErrorMode`** -- `ignore-and-continue` for automation resilience
7. **Multi-provider** -- OpenAI, Azure, Gemini, Ollama via `--provider`
8. **AGENTS.md** -- Project configuration (shared with Claude Code)

### Crush (OpenCode Successor): Overlooked Capabilities

1. **MCP support** -- Full stdio/http/sse transport support
2. **Agent Skills** -- Open standard, auto-discovered from directories
3. **LSP integration** -- Language Server Protocol for code intelligence
4. **Multi-model** -- Switch models mid-session, preserving context
5. **Cross-platform** -- macOS, Linux, Windows, Android, FreeBSD, OpenBSD, NetBSD
6. **AGENTS.md support** -- Compatible with Claude Code/Codex project configs

---

## Common Pitfalls for Advanced Integration

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| MCP server tools but no AI | `claude mcp serve` exposes tools, not the AI model | Use `-p` for AI advice, `mcp serve` for tool access |
| Extension MCP servers not loading | Gemini extensions need restart | Restart Gemini CLI after adding extensions |
| Codex MCP limited to shell | `shell-tool-mcp` only provides shell, not full Codex | Use `-q` for full Codex capabilities |
| A2A agents not discoverable | Gemini needs `agent_card_url` endpoint | Ensure agent card is at `/.well-known/agent.json` |
| Cross-tool context loss | Each tool has isolated context | Use files or session IDs to bridge context |
| MCP Tool Search confusion | Tools load on-demand, may seem missing | Set `ENABLE_TOOL_SEARCH=false` to debug |
| Extension variable expansion | `${VAR}` vs `$VAR` syntax differences | Use `${VAR}` in `.mcp.json`, `$(echo $VAR)` in Crush |

---

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [Claude Code MCP Guide](https://code.claude.com/docs/en/mcp) | Official Docs | Complete MCP client + server reference |
| [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) | Official Docs | Python/TypeScript SDK with full capabilities |
| [Agent SDK Hosting](https://platform.claude.com/docs/en/agent-sdk/hosting) | Official Docs | Production deployment patterns |
| [Agent SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions) | Official Docs | Session management and forking |
| [Claude Code Sub-agents](https://code.claude.com/docs/en/sub-agents) | Official Docs | Custom agents, --agents flag, delegation |
| [Gemini CLI Extensions Reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md) | Official Docs | Extension config, MCP bundling, variables |
| [Gemini CLI Remote Agents](https://github.com/google-gemini/gemini-cli/blob/main/docs/core/remote-agents.md) | Official Docs | A2A protocol, remote agent configuration |
| [Gemini CLI Tools API](https://github.com/google-gemini/gemini-cli/blob/main/docs/core/tools-api.md) | Official Docs | Custom tool registration, discovery |
| [Codex shell-tool-mcp](https://github.com/openai/codex/tree/main/shell-tool-mcp) | Official Docs | Sandboxed MCP shell execution |
| [Crush (OpenCode successor)](https://github.com/charmbracelet/crush) | Repository | MCP, agent skills, LSP integration |
| [MCP Specification](https://modelcontextprotocol.io/introduction) | Standard | Protocol spec for building MCP servers/clients |

---

*Generated by /learn from 38 sources (deep research).*
*See `resources/ai-cli-advanced-integration-patterns-sources.json` for full source metadata.*
