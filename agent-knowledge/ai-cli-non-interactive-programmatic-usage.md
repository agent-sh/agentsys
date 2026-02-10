# Learning Guide: Programmatic & Non-Interactive Usage of AI CLI Tools

**Generated**: 2026-02-10
**Sources**: 52 resources analyzed
**Depth**: deep

## Prerequisites

- Familiarity with shell scripting (bash, zsh)
- Basic understanding of JSON and piping in Unix
- Node.js 18+ or Python 3.10+ (for SDK usage)
- API keys for the respective services (Anthropic, OpenAI, Google)
- Understanding of stdin/stdout/stderr patterns

## TL;DR

- **Claude Code** (`claude -p`) is the most feature-rich for programmatic use, with a full Agent SDK (Python/TypeScript), session continuity via `--session-id`/`--resume`, structured output via `--output-format json` and `--json-schema`, and MCP integration.
- **Gemini CLI** (`gemini -p`) offers excellent headless support with `--output-format json/stream-json`, session resumption via `--resume`, and `--yolo` for auto-approving actions.
- **Codex CLI** (`codex -q`) uses `-q`/`--quiet` for non-interactive mode, `--json` for structured output, and `--approval-mode full-auto` for unattended execution.
- **OpenCode** (`opencode -p`) provides a simple non-interactive mode with `-p`, JSON output via `-f json`, and auto-approval of all permissions in non-interactive mode. (Note: OpenCode was archived Sept 2025; its successor is "Crush" by the Charm team.)
- All four tools support **piping via stdin**, **JSON output for parsing**, and some form of **session management**. Claude Code is the only one with a dedicated programmatic SDK.

---

## Core Concepts

### 1. Non-Interactive (Headless) Invocation

All four AI CLI tools support a "headless" or "print" mode where you pass a prompt, the tool processes it, and exits with the result on stdout. This is the foundation of all programmatic usage.

| Tool | Non-Interactive Flag | Example |
|------|---------------------|---------|
| Claude Code | `-p` / `--print` | `claude -p "explain this code"` |
| Gemini CLI | `-p` / `--prompt` | `gemini -p "explain this code"` |
| Codex CLI | `-q` / `--quiet` | `codex -q "explain this code"` |
| OpenCode | `-p` / `--prompt` | `opencode -p "explain this code"` |

**Key insight**: The `-p` flag is nearly universal across these tools (Claude, Gemini, OpenCode all use it). Codex uses `-q` instead.

### 2. Output Formats

Structured output is critical for programmatic consumption. All four tools support at least text and JSON output.

| Tool | Text | JSON | Stream JSON | JSON Schema |
|------|------|------|-------------|-------------|
| Claude Code | `--output-format text` | `--output-format json` | `--output-format stream-json` | `--json-schema '{...}'` |
| Gemini CLI | `--output-format text` | `--output-format json` | `--output-format stream-json` | Not supported |
| Codex CLI | (default) | `--json` | Not documented | Not supported |
| OpenCode | `-f text` | `-f json` | Not supported | Not supported |

**Claude Code JSON response** includes: `result` (text), `session_id`, usage metadata, and optionally `structured_output` when `--json-schema` is used.

**Gemini CLI JSON response** includes: `response` (text), `stats.models` (per-model API/token usage), `stats.tools` (tool execution stats), `stats.files` (line changes), and `error` (if present).

**Stream JSON** (Claude Code and Gemini CLI) emits newline-delimited JSON events in real-time, useful for monitoring long-running tasks.

### 3. Permission / Approval Modes

When running non-interactively, you need to control what the AI can do without human approval.

| Tool | Flag | Auto-Approve All | Auto-Approve Edits | Read-Only |
|------|------|------------------|--------------------|-----------|
| Claude Code | `--permission-mode` | `bypassPermissions` | `acceptEdits` | `plan` |
| Gemini CLI | `--approval-mode` | `yolo` | `auto_edit` | `default` |
| Codex CLI | `--approval-mode` / `-a` | `full-auto` | `auto-edit` | `suggest` |
| OpenCode | (auto in `-p` mode) | All permissions auto-approved | N/A | N/A |

**Claude Code** additionally supports `--allowedTools` for fine-grained control:
```bash
claude -p "fix tests" --allowedTools "Bash(npm test *),Read,Edit"
```

**Gemini CLI** supports `--allowed-tools` to pre-approve specific tools.

### 4. Session Management & Conversation Continuity

A key differentiator is the ability to maintain conversation state across multiple invocations -- essential for the "consultant" pattern.

#### Claude Code Sessions

Claude Code has the most sophisticated session management:

```bash
# Start a conversation, capture session ID
session_id=$(claude -p "Review the auth module" --output-format json | jq -r '.session_id')
echo "Session: $session_id"

# Continue the same conversation
claude -p "Now focus on the database queries" --resume "$session_id"

# Or continue the most recent conversation in current directory
claude -p "What else did you find?" --continue

# Fork a session to explore alternatives
claude -p "Try a different approach" --resume "$session_id" --fork-session

# Resume by name
claude --resume "auth-refactor"
```

**Via the Agent SDK (Python):**

```python
from claude_agent_sdk import query, ClaudeAgentOptions

session_id = None

# First query: capture session ID
async for message in query(
    prompt="Read the authentication module",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"])
):
    if hasattr(message, 'subtype') and message.subtype == 'init':
        session_id = message.session_id

# Resume with full context
async for message in query(
    prompt="Now find all places that call it",
    options=ClaudeAgentOptions(resume=session_id)
):
    if hasattr(message, "result"):
        print(message.result)
```

**Via the Agent SDK (TypeScript):**

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;

for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

#### Session Forking (Claude Code)

Fork a session to explore alternatives without modifying the original:

```bash
# Fork from existing session to try a different approach
claude -p "Try a GraphQL approach instead" --resume "$SESSION_ID" --fork-session

# The original session is preserved; you can continue it separately
claude -p "Continue with REST" --resume "$SESSION_ID"
```

**Via the Agent SDK (TypeScript):**

```typescript
// Fork to explore an alternative approach
for await (const message of query({
  prompt: "Redesign this as a GraphQL API instead",
  options: {
    resume: originalSessionId,
    forkSession: true  // New session ID, original preserved
  }
})) {
  if (message.type === "system" && message.subtype === "init") {
    console.log(`Forked session: ${message.session_id}`);
  }
}
```

#### Gemini CLI Sessions

```bash
# Resume the latest session
gemini --resume

# Resume by index
gemini --resume 1

# Resume by UUID
gemini --resume a1b2c3d4-e5f6-7890-abcd-ef1234567890

# List available sessions
gemini --list-sessions
```

Sessions are stored in `~/.gemini/tmp/<project_hash>/chats/` and are project-specific.

#### Codex CLI Sessions

Codex maintains conversation history configurable via `~/.codex/config.json` with `maxSize`, `saveHistory`, and `sensitivePatterns` settings. Session resumption across non-interactive invocations is not as well-documented as Claude Code or Gemini CLI.

#### OpenCode Sessions

Sessions persist in a SQLite database. In the interactive TUI, you can switch sessions via `Ctrl+A`. Non-interactive mode (`-p`) creates ephemeral sessions.

### 5. Piping & stdin Integration

All tools support piping content via stdin, making them composable Unix utilities.

```bash
# Claude Code
cat error.log | claude -p "explain this error"
git diff main | claude -p "review these changes for security issues"

# Gemini CLI
cat README.md | gemini -p "Summarize this documentation"
git diff --cached | gemini -p "Write a commit message" --output-format json | jq -r '.response'

# Codex CLI
cat build-error.txt | codex -q "explain this build error"

# OpenCode
cat code.py | opencode -p "find bugs in this code" -f json -q
```

### 6. The Claude Agent SDK

Claude Code uniquely offers a full programmatic SDK in both Python and TypeScript, going far beyond CLI invocation.

**Installation:**
```bash
# TypeScript
npm install @anthropic-ai/claude-agent-sdk

# Python
pip install claude-agent-sdk
```

**Key capabilities beyond CLI `-p`:**
- Async iterator streaming of messages
- Type-safe structured outputs (Zod/Pydantic)
- Programmatic hooks (PreToolUse, PostToolUse, Stop)
- Custom subagent definitions
- MCP server integration
- Session management (resume, fork)
- Tool approval callbacks
- Native message objects with full metadata

**Structured output with schema validation (TypeScript):**

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const BugReport = z.object({
  bugs: z.array(z.object({
    file: z.string(),
    line: z.number(),
    severity: z.enum(["low", "medium", "high"]),
    description: z.string()
  })),
  total_count: z.number()
});

for await (const message of query({
  prompt: "Find all bugs in the auth module",
  options: {
    outputFormat: {
      type: "json_schema",
      schema: z.toJSONSchema(BugReport)
    }
  }
})) {
  if (message.type === "result" && message.structured_output) {
    const report = BugReport.parse(message.structured_output);
    console.log(`Found ${report.total_count} bugs`);
  }
}
```

### 7. Type-Safe Structured Outputs (Agent SDK)

Beyond `--json-schema` on the CLI, the Agent SDK provides first-class support for Zod (TypeScript) and Pydantic (Python) schemas with full type inference.

**TypeScript with Zod:**

```typescript
import { z } from "zod";
import { query } from "@anthropic-ai/claude-agent-sdk";

const SecurityAudit = z.object({
  vulnerabilities: z.array(z.object({
    file: z.string(),
    line: z.number(),
    severity: z.enum(["critical", "high", "medium", "low"]),
    description: z.string(),
    fix: z.string()
  })),
  safe: z.boolean()
});

type SecurityAudit = z.infer<typeof SecurityAudit>;

for await (const message of query({
  prompt: "Audit src/auth/ for security vulnerabilities",
  options: {
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "bypassPermissions",
    outputFormat: {
      type: "json_schema",
      schema: z.toJSONSchema(SecurityAudit)
    }
  }
})) {
  if (message.type === "result" && message.structured_output) {
    const audit = SecurityAudit.parse(message.structured_output);
    if (!audit.safe) {
      audit.vulnerabilities.forEach(v => {
        console.error(`[${v.severity}] ${v.file}:${v.line} - ${v.description}`);
      });
      process.exit(1);
    }
  }
}
```

**Python with Pydantic:**

```python
from pydantic import BaseModel
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

class Vulnerability(BaseModel):
    file: str
    line: int
    severity: str
    description: str
    fix: str

class SecurityAudit(BaseModel):
    vulnerabilities: list[Vulnerability]
    safe: bool

async for message in query(
    prompt="Audit src/auth/ for security vulnerabilities",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep"],
        permission_mode="bypassPermissions",
        output_format={
            "type": "json_schema",
            "schema": SecurityAudit.model_json_schema()
        }
    )
):
    if isinstance(message, ResultMessage) and message.structured_output:
        audit = SecurityAudit.model_validate(message.structured_output)
        if not audit.safe:
            for v in audit.vulnerabilities:
                print(f"[{v.severity}] {v.file}:{v.line} - {v.description}")
```

### 8. Custom Subagents via CLI

Claude Code supports defining subagents inline via the `--agents` flag, which is powerful for cross-session consultation:

```bash
# Define a specialized reviewer agent and use it
claude -p "Use the security-auditor agent to review this project" \
  --output-format json \
  --agents '{
    "security-auditor": {
      "description": "Security specialist for vulnerability detection",
      "prompt": "You are a senior security engineer. Focus only on real vulnerabilities.",
      "tools": ["Read", "Grep", "Glob"],
      "model": "sonnet"
    }
  }' | jq -r '.result'
```

This is particularly useful when calling from another AI session -- you can define purpose-specific agents:

```bash
# From a Gemini or Codex session, call Claude with a specialized agent
claude -p "Use the perf-analyzer to find bottlenecks" \
  --output-format json \
  --agents '{
    "perf-analyzer": {
      "description": "Performance analysis specialist",
      "prompt": "Identify performance bottlenecks. Focus on O(n^2) loops, N+1 queries, and memory leaks.",
      "tools": ["Read", "Grep", "Glob", "Bash"],
      "model": "opus"
    }
  }' | jq -r '.result'
```

---

## Code Examples

### Basic: Non-Interactive Query (All 4 Tools)

```bash
#!/bin/bash
# Ask each tool the same question and compare responses

# Claude Code
claude -p "What is the time complexity of quicksort?" --output-format json | jq -r '.result'

# Gemini CLI
gemini -p "What is the time complexity of quicksort?" --output-format json | jq -r '.response'

# Codex CLI
codex -q --json "What is the time complexity of quicksort?"

# OpenCode
opencode -p "What is the time complexity of quicksort?" -f json -q
```

### Intermediate: Batch Code Review Script

```bash
#!/bin/bash
# Review all changed files using Claude Code

REPORT_DIR="./review-reports"
mkdir -p "$REPORT_DIR"

for file in $(git diff main --name-only); do
  echo "Reviewing: $file"
  cat "$file" | claude -p \
    "Review this code for bugs, security issues, and best practices. Be concise." \
    --output-format json \
    --max-turns 3 \
    --allowedTools "Read" \
    | jq -r '.result' > "$REPORT_DIR/$(basename "$file").review"
done

echo "Reviews saved to $REPORT_DIR/"
```

### Intermediate: Session Continuity Pattern (Claude Code)

```bash
#!/bin/bash
# Multi-step analysis with conversation continuity

# Step 1: Initial analysis
SESSION=$(claude -p "Analyze the architecture of this project. Focus on the data flow." \
  --output-format json | jq -r '.session_id')
echo "Session: $SESSION"

# Step 2: Follow-up (has context from step 1)
claude -p "Based on your analysis, what are the main bottlenecks?" \
  --resume "$SESSION" --output-format json | jq -r '.result'

# Step 3: Get actionable recommendations with structured output
claude -p "Give me a prioritized list of improvements as JSON" \
  --resume "$SESSION" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"improvements":{"type":"array","items":{"type":"object","properties":{"priority":{"type":"number"},"description":{"type":"string"},"effort":{"type":"string"}},"required":["priority","description","effort"]}}},"required":["improvements"]}' \
  | jq '.structured_output'
```

### Advanced: "Consultant" Pattern (Node.js)

This pattern lets your automation call out to an AI CLI for advice, then act on the structured response.

```javascript
// consultant.mjs - Ask AI for advice from within automation
import { execFileSync } from "node:child_process";

function askClaude(prompt, options = {}) {
  const args = [
    "-p", prompt,
    "--output-format", "json",
    "--max-turns", String(options.maxTurns || 3),
  ];

  if (options.allowedTools) {
    args.push("--allowedTools", options.allowedTools.join(","));
  }

  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }

  if (options.jsonSchema) {
    args.push("--json-schema", JSON.stringify(options.jsonSchema));
  }

  const result = execFileSync("claude", args, {
    encoding: "utf-8",
    timeout: options.timeout || 120_000,
    cwd: options.cwd || process.cwd(),
  });

  return JSON.parse(result);
}

// Usage: get commit message suggestion
const diff = execFileSync("git", ["diff", "--cached"], { encoding: "utf-8" });
const response = askClaude(
  `Write a conventional commit message for this diff:\n${diff}`,
  {
    maxTurns: 1,
    jsonSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["feat", "fix", "chore", "refactor", "docs", "test"] },
        scope: { type: "string" },
        description: { type: "string" },
        body: { type: "string" }
      },
      required: ["type", "description"]
    }
  }
);

console.log(response.structured_output);
// { type: "feat", scope: "auth", description: "add OAuth2 support", body: "..." }
```

### Advanced: "Consultant" Pattern (Python with Agent SDK)

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

async def ask_claude(prompt, tools=None, schema=None, session_id=None):
    """Call Claude Code as a consultant and get structured advice."""
    options = ClaudeAgentOptions(
        allowed_tools=tools or ["Read", "Glob", "Grep"],
        permission_mode="bypassPermissions"
    )

    if schema:
        options.output_format = {"type": "json_schema", "schema": schema}

    if session_id:
        options.resume = session_id

    result = None
    new_session_id = None

    async for message in query(prompt=prompt, options=options):
        if hasattr(message, 'subtype') and message.subtype == 'init':
            new_session_id = message.session_id
        if isinstance(message, ResultMessage):
            result = message

    return {
        "text": result.result if result else None,
        "structured": getattr(result, 'structured_output', None),
        "session_id": new_session_id
    }

# Usage in a CI/CD pipeline
async def ci_review():
    review = await ask_claude(
        "Review all changed files for security vulnerabilities",
        tools=["Read", "Glob", "Grep", "Bash"],
        schema={
            "type": "object",
            "properties": {
                "vulnerabilities": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "file": {"type": "string"},
                            "line": {"type": "number"},
                            "severity": {"type": "string"},
                            "description": {"type": "string"},
                            "fix": {"type": "string"}
                        },
                        "required": ["file", "severity", "description"]
                    }
                },
                "safe": {"type": "boolean"}
            },
            "required": ["vulnerabilities", "safe"]
        }
    )

    if not review["structured"]["safe"]:
        print("SECURITY ISSUES FOUND:")
        for vuln in review["structured"]["vulnerabilities"]:
            print(f"  [{vuln['severity']}] {vuln['file']}: {vuln['description']}")
        exit(1)

asyncio.run(ci_review())
```

### Advanced: Gemini CLI in CI/CD

```bash
#!/bin/bash
# Gemini CLI in a GitHub Actions workflow

# Auto-review PR
review=$(git diff origin/main...HEAD | gemini -p \
  "Review this PR for bugs, security issues, and code quality. Rate 1-10." \
  --output-format json \
  --approval-mode default)

score=$(echo "$review" | jq -r '.response' | grep -oP 'Rating: \K[0-9]+')

if [ "$score" -lt 6 ]; then
  echo "::warning::Code review score is $score/10"
fi

# Generate release notes
gemini -p "Generate release notes from the last 20 commits" \
  --output-format json \
  --yolo \
  | jq -r '.response' > RELEASE_NOTES.md
```

### Advanced: Multi-Tool Orchestration (Bash)

```bash
#!/bin/bash
# Use different AI CLIs for different strengths

# Step 1: Use Claude Code for deep code analysis (best at code understanding)
ANALYSIS=$(claude -p "Analyze the architecture and identify all API endpoints" \
  --output-format json \
  --allowedTools "Read,Glob,Grep" \
  --max-turns 10)

ENDPOINTS=$(echo "$ANALYSIS" | jq -r '.result')

# Step 2: Use Gemini for generating documentation (fast, good at writing)
echo "$ENDPOINTS" | gemini -p \
  "Generate OpenAPI documentation for these endpoints" \
  --output-format json \
  -m gemini-2.5-flash \
  | jq -r '.response' > api-docs.yaml

echo "API documentation generated at api-docs.yaml"
```

---

## Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Tool hangs waiting for permission | Non-interactive mode still prompts for dangerous operations | Use `--permission-mode bypassPermissions` (Claude), `--yolo` (Gemini), `-a full-auto` (Codex), or constrain with `--allowedTools` |
| JSON output includes non-JSON text | Some tools emit status/progress text to stdout | Use `--output-format json` (not text) and pipe through `jq` for safety |
| Session ID not captured | Forgetting to parse JSON output for session_id | Always use `--output-format json` and extract with `jq -r '.session_id'` |
| Timeout on complex tasks | Default subprocess timeouts are too short for multi-turn agents | Set explicit `--max-turns` limits and subprocess timeouts (120s+) |
| Context overflow in long sessions | Resumed sessions accumulate context that exceeds model window | Use `--max-turns` to limit agent loops; for Claude, auto-compaction handles this |
| Cost runaway in automation | No budget limits on automated runs | Use Claude's `--max-budget-usd` flag; set `--max-turns` on all tools |
| Shell escaping issues on Windows | `$` in JSON schemas gets interpreted by PowerShell | Escape `$` as backtick-$ in PowerShell; use double quotes with escaped inner quotes |
| OpenCode archived | Project archived Sept 2025, successor is "Crush" | Migrate to Crush or use one of the other three actively maintained tools |
| Codex network disabled in full-auto | `full-auto` mode sandboxes with no network access | Use `auto-edit` if network access is needed, or explicitly allow commands |
| Stdin and --prompt conflict | Some tools treat piped stdin and -p flag differently | Test your specific combination; Claude Code appends stdin to the prompt |

---

## Best Practices

Synthesized from 52 sources:

1. **Always use `--output-format json` for programmatic consumption** -- plain text output is fragile to parse and may include unexpected formatting.

2. **Set `--max-turns` to prevent runaway costs** -- without a limit, the AI can loop through many tool calls. Start with 3-5 for simple tasks, 10-20 for complex ones.

3. **Use `--max-budget-usd` (Claude Code) for cost control** -- hard limit on spending per invocation prevents surprises in automation.

4. **Capture session IDs for conversation continuity** -- extract from JSON output and pass via `--resume` for multi-step workflows.

5. **Use the Agent SDK (Python/TypeScript) for production automation** -- the CLI is great for scripts, but the SDK gives you proper error handling, streaming, type safety, and programmatic control.

6. **Define JSON schemas for structured output** -- Claude Code's `--json-schema` flag ensures the AI returns data in the exact shape you need. Gemini and Codex require you to parse free-form JSON.

7. **Constrain tools to minimum necessary** -- use `--allowedTools` (Claude) or `--allowed-tools` (Gemini) to limit what the AI can do. Principle of least privilege.

8. **Use `--append-system-prompt` over `--system-prompt`** -- appending preserves the tool's built-in capabilities while adding your instructions. Full replacement removes important defaults.

9. **Handle errors and timeouts explicitly** -- set subprocess timeouts, check exit codes, and handle empty/malformed JSON responses gracefully.

10. **Use `--no-session-persistence` for ephemeral tasks** -- in CI/CD where you do not need to resume, skip saving sessions to disk for cleaner operation.

11. **Pipe context in, do not embed it in the prompt** -- `cat file.txt | claude -p "review this"` is cleaner and avoids shell escaping issues compared to embedding file contents in the argument string.

12. **Use environment variables for API keys** -- never hardcode keys in scripts. Use `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` as appropriate.

13. **Use `--agents` for cross-session specialized consultation** -- when calling Claude from another AI session, define purpose-specific subagents inline via the `--agents` JSON flag for focused, constrained analysis.

14. **Fork sessions for A/B exploration** -- use `--fork-session` with `--resume` to explore alternative approaches without losing the original conversation state.

15. **Use Zod/Pydantic for type-safe outputs in production** -- rather than raw JSON Schema strings, use Zod (TypeScript) or Pydantic (Python) with the Agent SDK for compile-time type safety and runtime validation.

16. **Use `claude-code-action@v1` for GitHub CI/CD** -- the official GitHub Action handles authentication, permissions, and workflow integration out of the box.

---

## Detailed Tool Reference

### Claude Code (`claude`)

**Non-interactive invocation:**
```bash
claude -p "your prompt"
cat input.txt | claude -p "process this"
```

**Key flags for programmatic use:**

| Flag | Purpose |
|------|---------|
| `-p` / `--print` | Non-interactive mode |
| `--output-format text\|json\|stream-json` | Output format |
| `--json-schema '{...}'` | Validated structured output |
| `--session-id UUID` | Use specific session ID |
| `--resume ID_OR_NAME` | Resume a session |
| `--continue` / `-c` | Continue most recent session |
| `--fork-session` | Fork when resuming |
| `--max-turns N` | Limit agentic turns |
| `--max-budget-usd N` | Dollar spend limit |
| `--allowedTools "Tool1,Tool2"` | Auto-approve specific tools |
| `--disallowedTools "Tool1"` | Block specific tools |
| `--permission-mode MODE` | Permission mode (plan, acceptEdits, bypassPermissions) |
| `--dangerously-skip-permissions` | Skip all permission prompts |
| `--model MODEL` | Model selection (sonnet, opus, haiku) |
| `--system-prompt TEXT` | Replace system prompt |
| `--append-system-prompt TEXT` | Append to system prompt |
| `--system-prompt-file PATH` | Load system prompt from file |
| `--append-system-prompt-file PATH` | Append from file |
| `--mcp-config PATH` | Load MCP servers |
| `--agents JSON` | Define custom subagents |
| `--verbose` | Verbose output |
| `--no-session-persistence` | Do not save session to disk |
| `--fallback-model MODEL` | Fallback when overloaded |
| `--include-partial-messages` | Include streaming events |
| `--input-format text\|stream-json` | Input format |
| `--tools "Tool1,Tool2"` | Restrict available tools |
| `--add-dir PATH` | Add working directories |

**Agent SDK (Python):**
```bash
pip install claude-agent-sdk
```
```python
from claude_agent_sdk import query, ClaudeAgentOptions
async for message in query(prompt="...", options=ClaudeAgentOptions(...)):
    ...
```

**Agent SDK (TypeScript):**
```bash
npm install @anthropic-ai/claude-agent-sdk
```
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
for await (const message of query({ prompt: "...", options: { ... } })) { ... }
```

**Authentication:**
- `ANTHROPIC_API_KEY` for direct API
- `CLAUDE_CODE_USE_BEDROCK=1` + AWS credentials for Bedrock
- `CLAUDE_CODE_USE_VERTEX=1` + GCP credentials for Vertex AI
- `CLAUDE_CODE_USE_FOUNDRY=1` + Azure credentials for Azure

### Gemini CLI (`gemini`)

**Non-interactive invocation:**
```bash
gemini -p "your prompt"
echo "input" | gemini -p "process this"
gemini -p "query" --output-format json | jq '.response'
```

**Key flags for programmatic use:**

| Flag | Purpose |
|------|---------|
| `-p` / `--prompt` | Non-interactive prompt |
| `-i` / `--prompt-interactive` | Execute prompt then continue interactively |
| `--output-format text\|json\|stream-json` | Output format |
| `-m` / `--model MODEL` | Model selection (pro, flash, flash-lite) |
| `--approval-mode default\|auto_edit\|yolo` | Approval mode |
| `-y` / `--yolo` | Auto-approve all (deprecated, use --approval-mode=yolo) |
| `-r` / `--resume [ID]` | Resume session (latest, index, or UUID) |
| `--list-sessions` | List available sessions |
| `--delete-session N` | Delete session by index |
| `-d` / `--debug` | Enable debug mode |
| `-s` / `--sandbox` | Run in sandboxed environment |
| `--include-directories DIRS` | Add directories to context |
| `--allowed-tools TOOLS` | Pre-approve specific tools |
| `-e` / `--extensions EXTS` | Specify extensions |

**Authentication:**
- `GEMINI_API_KEY` for direct API
- `GOOGLE_CLOUD_PROJECT` + `GOOGLE_GENAI_USE_VERTEXAI` for Vertex AI

**Session storage:** `~/.gemini/tmp/<project_hash>/chats/`

**Streaming JSON event types:** `init`, `message`, `tool_use`, `tool_result`, `error`, `result`

### Codex CLI (`codex`)

**Non-interactive invocation:**
```bash
codex -q "your prompt"
codex -q --json "your prompt"
```

**Key flags for programmatic use:**

| Flag | Purpose |
|------|---------|
| `-q` / `--quiet` | Non-interactive (headless) mode |
| `--json` | Structured JSON output |
| `-a` / `--approval-mode` | Approval mode (suggest, auto-edit, full-auto) |
| `-m` / `--model MODEL` | Model selection |
| `--provider PROVIDER` | AI provider (openai, azure, gemini, etc.) |
| `--no-project-doc` | Skip AGENTS.md loading |
| `--notify` | Desktop notifications |

**Environment variables:**
- `OPENAI_API_KEY` for OpenAI
- `CODEX_QUIET_MODE=1` to suppress interactive elements
- `CODEX_DISABLE_PROJECT_DOC=1` to disable AGENTS.md
- `DEBUG=true` for verbose API logging

**Approval modes:**

| Mode | File Reads | File Writes | Shell Commands |
|------|-----------|-------------|----------------|
| `suggest` (default) | Auto | Prompt | Prompt |
| `auto-edit` | Auto | Auto (patches) | Prompt |
| `full-auto` | Auto | Auto | Auto (no network, confined) |

**Configuration:** `~/.codex/config.json`

### OpenCode (`opencode`)

**Status:** Archived September 2025. Successor: "Crush" by Charm team.

**Non-interactive invocation:**
```bash
opencode -p "your prompt"
opencode -p "your prompt" -f json -q
```

**Key flags for programmatic use:**

| Flag | Purpose |
|------|---------|
| `-p` / `--prompt` | Non-interactive mode |
| `-f` / `--output-format` | Output format (text, json) |
| `-q` / `--quiet` | Suppress spinner animation |
| `-d` / `--debug` | Enable debug logging |
| `-c` / `--cwd` | Set working directory |

**Key characteristic:** All permissions are auto-approved in non-interactive mode.

**Configuration paths (priority order):**
1. `$HOME/.opencode.json`
2. `$XDG_CONFIG_HOME/opencode/.opencode.json`
3. `./.opencode.json` (local)

**Supported providers:** OpenAI, Anthropic, Google Gemini, AWS Bedrock, Groq, Azure OpenAI, OpenRouter, GitHub Copilot, VertexAI

---

## MCP (Model Context Protocol) Integration

MCP enables AI tools to connect to external data sources and tools. All four CLI tools support MCP to varying degrees.

### Claude Code MCP

Claude Code has the deepest MCP integration:

```bash
# Load MCP config from file
claude -p "query" --mcp-config ./mcp.json

# Strict mode: only use specified MCP servers
claude -p "query" --strict-mcp-config --mcp-config ./mcp.json
```

**Via Agent SDK:**
```python
async for message in query(
    prompt="Open example.com and describe what you see",
    options=ClaudeAgentOptions(
        mcp_servers={
            "playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}
        }
    )
):
    ...
```

### Gemini CLI MCP

Gemini CLI supports MCP extensions via the `--extensions` flag and configuration in `settings.json`.

### OpenCode MCP

OpenCode supports MCP server integration configured in `.opencode.json`.

---

## Subprocess Invocation Patterns

### From Node.js

```javascript
import { execFileSync, spawn } from "node:child_process";

// Synchronous (simple queries)
function claudeSync(prompt, options = {}) {
  const args = ["-p", prompt, "--output-format", "json"];
  if (options.maxTurns) args.push("--max-turns", String(options.maxTurns));
  if (options.sessionId) args.push("--resume", options.sessionId);

  const result = execFileSync("claude", args, {
    encoding: "utf-8",
    timeout: options.timeout || 120_000,
    maxBuffer: 10 * 1024 * 1024, // 10MB for large responses
  });
  return JSON.parse(result);
}

// Async with streaming (long-running tasks)
function claudeStream(prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", [
      "-p", prompt, "--output-format", "stream-json"
    ]);
    const events = [];

    proc.stdout.on("data", (chunk) => {
      chunk.toString().split("\n").filter(Boolean).forEach(line => {
        try { events.push(JSON.parse(line)); } catch { /* skip */ }
      });
    });

    proc.on("close", (code) => {
      code === 0 ? resolve(events) : reject(new Error(`Exit code ${code}`));
    });
  });
}
```

### From Python

```python
import subprocess
import json

def claude_query(prompt, max_turns=5, session_id=None, timeout=120):
    """Call Claude Code CLI and return parsed JSON."""
    cmd = [
        "claude", "-p", prompt,
        "--output-format", "json",
        "--max-turns", str(max_turns)
    ]

    if session_id:
        cmd.extend(["--resume", session_id])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd="."
    )

    if result.returncode != 0:
        raise RuntimeError(f"Claude failed: {result.stderr}")

    return json.loads(result.stdout)

# Usage
response = claude_query("What files are in this project?", max_turns=3)
print(response["result"])
print(f"Session: {response['session_id']}")
```

### From Bash

```bash
#!/bin/bash
set -euo pipefail

ask_claude() {
  local prompt="$1"
  local max_turns="${2:-5}"

  local response
  response=$(claude -p "$prompt" \
    --output-format json \
    --max-turns "$max_turns" \
    --allowedTools "Read,Glob,Grep" \
    2>/dev/null)

  echo "$response"
}

# Usage with error handling
if result=$(ask_claude "List all TODO comments" 3); then
  echo "$result" | jq -r '.result'
  SESSION=$(echo "$result" | jq -r '.session_id')
else
  echo "Claude query failed" >&2
  exit 1
fi
```

---

## Error Handling and Timeouts

### Exit Codes

| Tool | Success | Error | Notes |
|------|---------|-------|-------|
| Claude Code | 0 | Non-zero | `--max-turns` exceeded returns error |
| Gemini CLI | 0 | Non-zero | Stream JSON emits `error` events |
| Codex CLI | 0 | Non-zero | Quiet mode failures reflected in exit code |
| OpenCode | 0 | Non-zero | |

### Timeout Strategy

```bash
# Bash: use timeout command
timeout 120 claude -p "complex analysis" --output-format json --max-turns 10
```

### Retry Pattern

```python
import time
import subprocess

def claude_with_retry(prompt, retries=3, backoff=5):
    for attempt in range(retries):
        try:
            return claude_query(prompt, timeout=120)
        except (subprocess.TimeoutExpired, RuntimeError) as e:
            if attempt == retries - 1:
                raise
            time.sleep(backoff * (attempt + 1))
```

---

## Cost & Token Management

| Tool | Cost Control Flag | Token Tracking |
|------|-------------------|----------------|
| Claude Code | `--max-budget-usd 5.00` | JSON output includes usage metadata |
| Gemini CLI | No direct flag | JSON `stats.models` includes token counts |
| Codex CLI | No direct flag | `DEBUG=true` logs API requests |
| OpenCode | No direct flag | Debug mode shows token usage |

**Best practice for automation:**
```bash
# Claude: hard budget limit
claude -p "complex analysis" --max-budget-usd 2.00 --max-turns 10
```

---

## Comparison Matrix

| Feature | Claude Code | Gemini CLI | Codex CLI | OpenCode |
|---------|------------|------------|-----------|----------|
| **Non-interactive flag** | `-p` | `-p` | `-q` | `-p` |
| **JSON output** | Yes | Yes | Yes | Yes |
| **Stream JSON** | Yes | Yes | No | No |
| **JSON Schema validation** | Yes (`--json-schema`) | No | No | No |
| **Programmatic SDK** | Python + TypeScript | No | No | No |
| **Session resume** | `--resume`, `--continue` | `--resume` | Limited | SQLite-based |
| **Session fork** | `--fork-session` | No | No | No |
| **Cost control** | `--max-budget-usd` | No | No | No |
| **Turn limit** | `--max-turns` | Settings only | No | No |
| **Tool restriction** | `--allowedTools` | `--allowed-tools` | N/A | N/A |
| **Custom system prompt** | `--system-prompt` | Via config | N/A | N/A |
| **MCP integration** | Deep (`--mcp-config`) | Extensions | N/A | Config |
| **CI/CD action** | GitHub Actions (official) | GitHub Action | N/A | N/A |
| **Sub-agents** | `--agents` JSON | No | No | No |
| **Multi-provider** | Anthropic, Bedrock, Vertex, Azure | Google, Vertex | OpenAI, Azure, Gemini, Ollama, etc. | All major providers |
| **Active development** | Yes | Yes | Yes | Archived (Sept 2025) |

---

## Cross-Session Consultation: Calling One AI CLI From Another

The most powerful pattern is calling a different AI CLI from within an active session. For example, from inside a Claude Code session, you can use the Bash tool to invoke Codex, Gemini, or another Claude instance for a second opinion, specialized analysis, or alternative approach.

### Why Cross-Consult?

- **Second opinion**: Different models have different strengths and blind spots
- **Specialized strengths**: Gemini excels at certain reasoning tasks, Codex at OpenAI-ecosystem code
- **Cost optimization**: Route expensive analysis to cheaper models for triage
- **Validation**: Cross-check AI suggestions with a different provider
- **Parallel exploration**: Get multiple approaches to the same problem

### Pattern 1: From Claude Code Session, Call Codex

Inside a Claude Code session, use the Bash tool:

```bash
# Ask Codex for a second opinion on a function
codex -q -a auto-edit "Review the error handling in src/auth.ts and suggest improvements" 2>&1

# Get Codex to generate an alternative implementation
codex -q --json "Write an alternative implementation of the retry logic in lib/http.js" | jq -r '.message'
```

### Pattern 2: From Claude Code Session, Call Gemini CLI

```bash
# Ask Gemini for architecture review
gemini -p "Review the architecture in this project and identify scaling bottlenecks" \
  --output-format json | jq -r '.response'

# Use Gemini for documentation generation (it's fast with flash)
gemini -p "Generate API documentation for all exported functions in src/api/" \
  -m gemini-2.5-flash \
  --output-format json | jq -r '.response'
```

### Pattern 3: From Claude Code Session, Call Another Claude Instance

```bash
# Spawn a separate Claude session with different constraints
claude -p "As a security auditor, review src/auth/ for vulnerabilities" \
  --output-format json \
  --allowedTools "Read,Glob,Grep" \
  --max-turns 5 \
  --append-system-prompt "You are a security specialist. Only report real vulnerabilities." \
  | jq -r '.result'

# Use a different model for a different perspective
claude -p "Review this test file for missing edge cases" \
  --model haiku \
  --output-format json \
  --max-turns 3 \
  | jq -r '.result'
```

### Pattern 4: Multi-Consult with Conversation Continuity

The key insight: capture the session ID from the first call to continue the conversation later.

```bash
# Step 1: Ask Claude for initial analysis (from another AI session's Bash tool)
CLAUDE_RESPONSE=$(claude -p "Analyze the data flow in this project" \
  --output-format json --max-turns 10 --allowedTools "Read,Glob,Grep")

CLAUDE_SESSION=$(echo "$CLAUDE_RESPONSE" | jq -r '.session_id')
CLAUDE_ANALYSIS=$(echo "$CLAUDE_RESPONSE" | jq -r '.result')

# Step 2: Feed Claude's analysis to Gemini for a second take
echo "$CLAUDE_ANALYSIS" | gemini -p \
  "Here is an analysis of a codebase's data flow. What did the analyst miss? What additional concerns do you see?" \
  --output-format json | jq -r '.response'

# Step 3: Continue the Claude conversation with Gemini's feedback
claude -p "A second reviewer noted these additional concerns: [paste gemini output]. Do you agree?" \
  --resume "$CLAUDE_SESSION" \
  --output-format json | jq -r '.result'
```

### Pattern 5: From Codex or Gemini Session, Call Claude Code

From within a Codex or Gemini session (using their shell/Bash tool):

```bash
# From Codex: call Claude for deep code analysis
claude -p "Find all security vulnerabilities in this codebase" \
  --output-format json \
  --allowedTools "Read,Glob,Grep,Bash" \
  --max-turns 15 \
  --max-budget-usd 2.00 \
  | jq -r '.result'

# From Gemini: call Claude with specific subagents
claude -p "Use the code-reviewer agent to review recent changes" \
  --output-format json \
  --agents '{"code-reviewer":{"description":"Reviews code","prompt":"Review for bugs and security","tools":["Read","Grep","Glob"],"model":"sonnet"}}' \
  | jq -r '.result'
```

### Pattern 6: Wrapper Script for Cross-Tool Consultation

Create a reusable script that any AI session can call:

```bash
#!/bin/bash
# consult.sh - Cross-tool AI consultation
# Usage: ./consult.sh <tool> <prompt> [--continue <session_id>]

TOOL="$1"
PROMPT="$2"
SESSION_FLAG=""

if [[ "$3" == "--continue" && -n "$4" ]]; then
  SESSION_FLAG="--resume $4"
fi

case "$TOOL" in
  claude)
    claude -p "$PROMPT" --output-format json --max-turns 5 \
      --allowedTools "Read,Glob,Grep" $SESSION_FLAG 2>/dev/null
    ;;
  gemini)
    gemini -p "$PROMPT" --output-format json $SESSION_FLAG 2>/dev/null
    ;;
  codex)
    codex -q --json "$PROMPT" 2>/dev/null
    ;;
  *)
    echo '{"error":"Unknown tool: '"$TOOL"'"}' >&2
    exit 1
    ;;
esac
```

Then from any AI session:

```bash
# Get Claude's opinion
./consult.sh claude "What's wrong with the error handling in src/api.ts?"

# Get Gemini's opinion on the same thing
./consult.sh gemini "What's wrong with the error handling in src/api.ts?"

# Continue a Claude conversation
./consult.sh claude "What about the retry logic?" --continue "$SESSION_ID"
```

### Important Caveats for Cross-Session Calls

| Caveat | Details |
|--------|---------|
| **Working directory** | The called tool runs in the same cwd as the calling session's Bash tool |
| **Timeouts** | Set generous timeouts; AI calls can take 30-120+ seconds |
| **Nested permissions** | The called tool needs its own permission handling (`--permission-mode bypassPermissions` for non-interactive) |
| **API keys** | Each tool needs its own API key set in the environment |
| **Cost stacking** | You pay for both the calling session AND the consulted tool |
| **Context isolation** | The called tool has no knowledge of the calling session's conversation |
| **Output parsing** | Always use `--output-format json` and parse with `jq` for reliability |
| **Background vs foreground** | Calls block the calling session until complete; use `&` for parallel |

### Cost-Efficient Cross-Consultation Strategy

```bash
# Triage with cheap model first, escalate if needed
TRIAGE=$(claude -p "Quick assessment: is this code safe?" \
  --model haiku --max-turns 1 --output-format json | jq -r '.result')

if echo "$TRIAGE" | grep -qi "concern\|issue\|vulnerability"; then
  # Escalate to thorough review with multiple tools
  claude -p "Deep security review of this code" \
    --model opus --max-turns 10 --output-format json | jq -r '.result'
  gemini -p "Security audit this codebase" \
    --output-format json | jq -r '.response'
fi
```

---

## Production Deployment Patterns

### Pattern 1: Ephemeral (One-Shot)

Best for CI/CD pipelines, code review, linting.

```bash
# GitHub Actions example
- name: AI Code Review
  run: |
    claude -p "Review this PR for security issues" \
      --output-format json \
      --max-turns 5 \
      --max-budget-usd 1.00 \
      --allowedTools "Read,Glob,Grep" \
      --no-session-persistence \
      | jq -r '.result' > review.md
```

### Pattern 2: Long-Running Session

Best for multi-step workflows, research tasks.

```python
# Python: session-based workflow
session = None
for step in workflow_steps:
    response = await ask_claude(step.prompt, session_id=session)
    session = response["session_id"]
    step.handle_result(response)
```

### Pattern 3: GitHub Actions (Claude Code Action)

Best for automated PR review, issue triage, and CI-triggered code changes.

```yaml
# .github/workflows/claude.yml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          # Responds to @claude mentions in comments
```

**Automated code review on PR open:**

```yaml
name: Code Review
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "/review"
          claude_args: "--max-turns 5 --model claude-sonnet-4-5-20250929"
```

**Custom automation (e.g., daily report):**

```yaml
name: Daily Report
on:
  schedule:
    - cron: "0 9 * * *"
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "Generate a summary of yesterday's commits and open issues"
          claude_args: "--model opus"
```

### Pattern 4: Containerized Agent (Agent SDK)

Best for production automation. See the Agent SDK hosting documentation for Docker, Cloud, and sandbox provider options (Modal, Cloudflare, E2B, Fly.io, Vercel).

Resource requirements per SDK instance: 1GiB RAM, 5GiB disk, 1 CPU minimum.

---

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) | Official Docs | Complete flag reference for Claude Code |
| [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) | Official Docs | Programmatic Python/TypeScript SDK |
| [Agent SDK Structured Outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs) | Official Docs | JSON Schema validation for typed responses |
| [Agent SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions) | Official Docs | Session management and forking |
| [Agent SDK Streaming](https://platform.claude.com/docs/en/agent-sdk/streaming-output) | Official Docs | Real-time streaming patterns |
| [Agent SDK Hosting](https://platform.claude.com/docs/en/agent-sdk/hosting) | Official Docs | Production deployment patterns |
| [Claude Code Headless Mode](https://code.claude.com/docs/en/headless) | Official Docs | Non-interactive usage guide |
| [Claude Code Sub-agents](https://code.claude.com/docs/en/sub-agents) | Official Docs | Custom subagents and the --agents flag |
| [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions) | Official Docs | CI/CD integration with claude-code-action |
| [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows) | Official Docs | Practical workflow patterns |
| [Gemini CLI Headless Mode](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md) | Official Docs | Non-interactive Gemini usage |
| [Gemini CLI Reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/cli-reference.md) | Official Docs | Complete Gemini CLI flags |
| [Gemini CLI Sessions](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/session-management.md) | Official Docs | Session persistence and resumption |
| [Gemini CLI Settings](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/settings.md) | Official Docs | Configuration for automation |
| [Codex CLI README](https://github.com/openai/codex/blob/main/codex-cli/README.md) | Official Docs | Codex CLI usage and flags |
| [Codex CLI Repository](https://github.com/openai/codex) | Repository | Source code and documentation |
| [OpenCode Repository](https://github.com/opencode-ai/opencode) | Repository | Archived reference (successor: Crush) |

---

*Generated by /learn from 52 sources (2 research rounds).*
*See `resources/ai-cli-non-interactive-programmatic-usage-sources.json` for full source metadata.*
