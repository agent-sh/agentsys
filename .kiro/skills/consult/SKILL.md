---
name: consult
description: "Cross-tool AI consultation. Use when user asks to 'consult gemini', 'ask codex', 'get second opinion', 'cross-check with claude', 'consult another AI', 'ask opencode', 'copilot opinion', or wants a second opinion from a different AI tool."
version: 5.1.0
argument-hint: "[question] [--tool] [--effort] [--model] [--context] [--continue]"
---

# consult

Cross-tool AI consultation: query another AI CLI tool and return the response.

## When to Use

Invoke this skill when:
- User wants a second opinion from a different AI tool
- User asks to consult, ask, or cross-check with gemini/codex/claude/opencode/copilot
- User needs to compare responses across AI tools
- User wants to validate a decision with an external AI

## Arguments

Parse from `$ARGUMENTS`:

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--tool` | gemini, codex, claude, opencode, copilot | (picker) | Target tool |
| `--effort` | low, medium, high, max | medium | Thinking effort level |
| `--model` | any model name | (from effort) | Override model selection |
| `--context` | diff, file=PATH, none | none | Auto-include context |
| `--continue` | (flag) or SESSION_ID | false | Resume previous session |

Question text is everything in `$ARGUMENTS` except the flags above.

## Provider Configurations

### Claude

```
Command: env -u CLAUDECODE claude -p "QUESTION" --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep"
Session resume: --resume "SESSION_ID"
```

Models: claude-haiku-4-5, claude-sonnet-5, claude-opus-5-5, claude-fable-5-1

| Effort | Model | Max Turns |
|--------|-------|-----------|
| low | claude-haiku-4-5 | 1 |
| medium | claude-sonnet-5 | 3 |
| high | claude-opus-5-5 | 5 |
| max | claude-opus-5-5 | 10 |

**Parse output**: `JSON.parse(stdout).result`
**Session ID**: `JSON.parse(stdout).session_id`
**Continuable**: Yes
**ACP adapter**: `npx -y @anthropic-ai/claude-code-acp` (see ACP Transport section)

### Gemini

```
Command: gemini -p "QUESTION" --output-format json -m "MODEL"
Session resume: --resume "SESSION_ID"
```

Models: gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview, gemini-3-pro-preview, gemini-3.1-pro-preview

| Effort | Model |
|--------|-------|
| low | gemini-3-flash-preview |
| medium | gemini-3-flash-preview |
| high | gemini-3.1-pro-preview |
| max | gemini-3.1-pro-preview |

**Parse output**: `JSON.parse(stdout).response`
**Session ID**: `JSON.parse(stdout).session_id`
**Continuable**: Yes (via `--resume`)
**ACP adapter**: `gemini` (native ACP - Gemini CLI is ACP-compatible)

### Codex

```
Command: codex exec "QUESTION" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"
Session resume: codex exec resume "SESSION_ID" "QUESTION" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"
Session resume (latest): codex exec resume --last "QUESTION" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"
```

Note: `codex exec` is the non-interactive/headless mode. There is no `-q` flag. The TUI mode is `codex` (no subcommand).
`{SKIP_GIT_FLAG}` is resolved by the trust gate in Command Building Step 1b:
- inside trusted git repo: empty string
- trusted non-repo execution: `--skip-git-repo-check`

Models: gpt-6-sol, gpt-6-astra

| Effort | Model | Reasoning |
|--------|-------|-----------|
| low | gpt-6-sol | low |
| medium | gpt-6-sol | medium |
| high | gpt-6-astra | high |
| max | gpt-6-astra | max |

**Parse output**: `JSON.parse(stdout).message` or raw text
**Session ID**: Codex prints a resume hint at session end (e.g., `codex resume SESSION_ID`). Extract the session ID from stdout or from `JSON.parse(stdout).session_id` if available.
**Continuable**: Yes. Sessions are stored as JSONL rollout files at `~/.codex/sessions/`. Non-interactive resume uses `codex exec resume "SESSION_ID" "follow-up prompt" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"`. Use `--last` instead of a session ID to resume the most recent session.
**ACP adapter**: `npx -y @zed-industries/codex-acp` (see ACP Transport section)

### OpenCode

```
Command: opencode run "QUESTION" --format json --model "MODEL" --variant "VARIANT"
Session resume: opencode run "QUESTION" --format json --model "MODEL" --variant "VARIANT" --continue (most recent) or --session "SESSION_ID"
With thinking: add --thinking flag
```

Models: 75+ via providers (format: `provider/model`). Key providers: `opencode/` (free), `github-copilot/`, `amazon-bedrock/`, `google/`. Examples: `github-copilot/gemini-3.1-pro-preview`, `opencode/big-pickle`, `amazon-bedrock/anthropic.claude-opus-4-6-v1`. Run `opencode models` to list all.

Free models: `opencode/big-pickle`, `opencode/gpt-5-nano`, `opencode/minimax-m2.5-free`, `opencode/trinity-large-preview-free`

| Effort | Model | Variant |
|--------|-------|---------|
| low | (user-selected or default) | low |
| medium | (user-selected or default) | medium |
| high | (user-selected or default) | high |
| max | (user-selected or default) | high + --thinking |

**Parse output**: OpenCode outputs newline-delimited JSON events. Each line is a JSON object with a `type` field. Extract the response text from events where `type === "text"` - the text is in `part.text` (NOT `part.content`). Concatenate all `part.text` values from `type: "text"` events. Event types: `step_start`, `tool_use`, `text`, `step_finish`. The `sessionID` is in every event's top-level `sessionID` field.

**Session ID**: Available in every event as `event.sessionID` (e.g., `ses_xxxxx`). Use `--session SESSION_ID` to resume.
**Continuable**: Yes (via `--continue` or `--session`). Sessions are stored in a SQLite database in the OpenCode data directory. Use `--session SESSION_ID` for a specific session, or `--continue` for the most recent.
**ACP adapter**: `opencode acp` (see ACP Transport section)

### Copilot

```
Command: copilot -p "QUESTION"
```

Models: claude-sonnet-4-6 (default), claude-opus-4-6, claude-haiku-4-5, gpt-5

| Effort | Notes |
|--------|-------|
| all | No effort control available. Model selectable via --model flag. |

**Parse output**: Raw text from stdout
**Continuable**: No
**ACP adapter**: `copilot --acp --stdio` (see ACP Transport section)

### Kiro

```
ACP-only provider. No CLI mode for external consultation.
Command: node acp/run.js --provider="kiro" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=120000
```

Kiro is available only via ACP transport. It requires `kiro-cli` on PATH.

**Parse output**: Via ACP runner (`JSON.parse(stdout)`)
**Continuable**: No
**ACP adapter**: `kiro-cli acp` (native ACP)

## Input Validation

Before building commands, validate all user-provided arguments:

- **--tool**: MUST be one of: gemini, codex, claude, opencode, copilot, kiro. Reject all other values.
- **--effort**: MUST be one of: low, medium, high, max. Default to medium.
- **--model**: Allow any string, but quote it in the command.
- **--continue=SESSION_ID**: If provided, SESSION_ID MUST match `^(?!-)[A-Za-z0-9._:-]+$`. Reject values that contain spaces, leading dashes, or shell metacharacters.
- **--context=file=PATH**: MUST resolve within the project directory. Reject absolute paths outside cwd. Additional checks:
  1. **Block UNC paths** (Windows): Reject paths starting with `\\` or `//` (network shares)
  2. **Resolve canonical path**: Use the Read tool to read the file (do NOT use shell commands). Before reading, resolve the path: join `cwd + PATH`, then normalize (collapse `.`, `..`, resolve symlinks)
  3. **Verify containment**: The resolved canonical path MUST start with the current working directory. If it escapes (via `..`, symlinks, or junction points), reject with: `[ERROR] Path escapes project directory: {PATH}`
  4. **No shell access**: Read file content using the Read tool only. Never pass user-provided paths to shell commands (prevents injection via path values)

## Command Building

Given the parsed arguments, build the complete CLI command. All user-provided values MUST be quoted in the shell command to prevent injection.

### Step 1: Resolve Model

If `--model` is specified, use it directly. Otherwise, use the effort-based model from the provider table above.

### Step 1b: Trust Gate for Codex `--skip-git-repo-check`

Before using any Codex template, resolve `{SKIP_GIT_FLAG}` with this gate:

1. Verify the consultation is running from the current project working directory (the same workspace where `/consult` was invoked), not an arbitrary external path.
2. Verify the resolved active tool is Codex (flag, NLP, picker, or restored `--continue` session).
3. Run `git rev-parse --is-inside-work-tree` in the current working directory:
   - if true: set `{SKIP_GIT_FLAG}` to empty string
   - if false and checks 1-2 passed: set `{SKIP_GIT_FLAG}` to `--skip-git-repo-check`
4. If checks 1-2 fail, reject execution with `[ERROR] Refusing Codex --skip-git-repo-check outside trusted working directory`.

Codex templates in this skill assume this trust gate has already passed.

### Step 2: Build Command String

Use the command template from the provider's configuration section. Substitute QUESTION, MODEL, TURNS, LEVEL, VARIANT, and SKIP_GIT_FLAG with resolved literal values.
`{SKIP_GIT_FLAG}` MUST be set by Step 1b only. Do not read `SKIP_GIT_FLAG` from inherited shell environment.

If continuing a session:
- **Claude or Gemini**: append `--resume "SESSION_ID"` to the command.
- **Codex**: use `codex exec resume "SESSION_ID" "QUESTION" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` instead of the standard command. Use `--last` instead of a session ID for the most recent session.
- **OpenCode**: append `--session SESSION_ID` to the command. If no session_id is saved, use `--continue` instead (resumes most recent session).
If OpenCode at max effort: append `--thinking`.

### Step 3: Context Packaging

If `--context=diff`: Run `git diff 2>/dev/null` and prepend output to the question.
If `--context=file=PATH`: Read the file using the Read tool and prepend its content to the question.

### Step 4: Safe Question Passing

User-provided question text MUST NOT be interpolated into shell command strings. Shell escaping is insufficient -- `$()`, backticks, and other expansion sequences can execute arbitrary commands even inside double quotes.

**Required approach -- pass question via stdin or temp file:**

1. **Write the question** to a temporary file using the Write tool (e.g., `{AI_STATE_DIR}/consult/question.tmp`)

   Platform state directory:
   - Claude Code: `.claude/`
   - OpenCode: `.opencode/`
   - Codex CLI: `.codex/`
2. **Build the command** using the temp file as input instead of inline text:

| Provider | Safe command pattern |
|----------|---------------------|
| Claude | `env -u CLAUDECODE claude -p - --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Claude (resume) | `env -u CLAUDECODE claude -p - --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep" --resume "SESSION_ID" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Gemini | `gemini -p - --output-format json -m "MODEL" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Gemini (resume) | `gemini -p - --output-format json -m "MODEL" --resume "SESSION_ID" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Codex | `codex exec "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` (Codex exec lacks stdin mode -- cat reads from platform-controlled path, not user input) |
| Codex (resume) | `codex exec resume "SESSION_ID" "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` |
| Codex (resume latest) | `codex exec resume --last "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` |
| OpenCode | `opencode run - --format json --model "MODEL" --variant "VARIANT" < "{AI_STATE_DIR}/consult/question.tmp"` |
| OpenCode (resume by ID) | `opencode run - --format json --model "MODEL" --variant "VARIANT" --session "SESSION_ID" < "{AI_STATE_DIR}/consult/question.tmp"` |
| OpenCode (resume latest) | `opencode run - --format json --model "MODEL" --variant "VARIANT" --continue < "{AI_STATE_DIR}/consult/question.tmp"` |
| Copilot | `copilot -p - < "{AI_STATE_DIR}/consult/question.tmp"` |

3. **Delete the temp file** after the command completes (success or failure). Always clean up to prevent accumulation.

**Model and session ID values** are controlled strings (from pickers or saved state) and safe to quote directly in the command. Only the question contains arbitrary user text and requires the temp file approach. The temp file path (`{AI_STATE_DIR}/consult/question.tmp`) uses a platform-controlled directory and fixed filename -- no user input in the path.

## Provider Detection

Cross-platform tool detection:

- **Windows**: `where.exe TOOL 2>nul` -- returns 0 if found
- **Unix**: `which TOOL 2>/dev/null` -- returns 0 if found

Check each tool (claude, gemini, codex, opencode, copilot, kiro) and return only the available ones.

## ACP Transport

ACP (Agent Client Protocol) is an alternative transport to CLI subprocess invocation. When available, ACP provides structured JSON-RPC 2.0 communication, session persistence, and streaming responses via a universal protocol supported by all major AI coding tools.

### ACP Provider Adapters

| Provider | ACP Command | Type | Detection |
|----------|-------------|------|-----------|
| Claude | `npx -y @anthropic-ai/claude-code-acp` | adapter | npx available |
| Gemini | `gemini` (native ACP) | native | gemini available |
| Codex | `npx -y @zed-industries/codex-acp` | adapter | npx available |
| Copilot | `copilot --acp --stdio` | native | copilot available |
| Kiro | `kiro-cli acp` | native | kiro-cli available |
| OpenCode | `opencode acp` | native | opencode available |

### Transport Selection

1. Check ACP availability for the target provider (see ACP Detection below)
2. If ACP available: use ACP transport (preferred - standardized protocol, session persistence)
3. If ACP unavailable: fall back to CLI transport (existing behavior above)

The output envelope is identical regardless of transport. Downstream consumers (session management, debate orchestrator, output parsing) are transport-agnostic.

### ACP Command Template

All ACP providers use the same command pattern via the ACP runner script:

```
node acp/run.js --provider="PROVIDER" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=TIMEOUT_MS [--model="MODEL"] [--session-id="SESSION_ID"]
```

| Provider | ACP Safe Command Pattern |
|----------|------------------------|
| Claude | `node acp/run.js --provider="claude" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=120000 --model="MODEL"` |
| Gemini | `node acp/run.js --provider="gemini" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=120000 --model="MODEL"` |
| Codex | `node acp/run.js --provider="codex" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=120000 --model="MODEL"` |
| OpenCode | `node acp/run.js --provider="opencode" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=120000 --model="MODEL"` |
| Copilot | `node acp/run.js --provider="copilot" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=120000` |
| Kiro | `node acp/run.js --provider="kiro" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=120000` |

**Parse output**: Same as CLI transport - `JSON.parse(stdout)`. The ACP runner outputs the same envelope format.
**Session ID**: From `JSON.parse(stdout).session_id` (ACP session ID)
**Resume**: Pass `--session-id="SESSION_ID"` flag on the ACP command
**Continuable**: Claude, Gemini, Codex, OpenCode (yes). Copilot, Kiro (no).

### ACP Detection

Run ACP detection alongside CLI detection. For each provider:

```bash
node acp/run.js --detect --provider="PROVIDER"
```

Returns on success (exit 0):
```json
{"provider": "claude", "acp_available": true, "name": "Claude"}
```

Returns on failure (exit 1):
```json
{"provider": "claude", "acp_available": false, "name": "Claude", "reason": "npx not found on PATH"}
```

**Kiro note**: Kiro is ACP-only - it has no CLI mode for external consultation. It only appears as available when `kiro-cli` is on PATH and ACP detection succeeds.

## Session Management

### Save Session

After successful consultation, save to `{AI_STATE_DIR}/consult/last-session.json`:

```json
{
  "tool": "claude",
  "model": "opus",
  "effort": "high",
  "session_id": "abc-123-def-456",
  "timestamp": "2026-02-10T12:00:00Z",
  "question": "original question text",
  "continuable": true,
  "transport": "acp"
}
```

The `transport` field is `"acp"` or `"cli"`. When resuming a session with `--continue`, use the same transport that created it. If the field is absent, assume `"cli"` (backward compatible).

`AI_STATE_DIR` uses the platform state directory:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`

### Load Session

For `--continue`, read the session file and restore:
- tool (from saved state)
- session_id (for --resume flag)
- model (reuse same model)

Before using restored values, re-validate them:
- tool must still be in allow-list: gemini, codex, claude, opencode, copilot, kiro
- session_id must match `^(?!-)[A-Za-z0-9._:-]+$`
- model must match `^[A-Za-z0-9._:/-]+$` (reject spaces and shell metacharacters)
- if either check fails, reject with `[ERROR] Invalid restored session data` and do not build a command

If session file not found, warn and proceed as fresh consultation.

## Output Sanitization

Before including any consulted tool's response in the output, scan the response text and redact matches for these patterns:

| Pattern | Description | Replacement |
|---------|-------------|-------------|
| `sk-[a-zA-Z0-9_-]{20,}` | Anthropic API keys | `[REDACTED_API_KEY]` |
| `sk-proj-[a-zA-Z0-9_-]{20,}` | OpenAI project keys | `[REDACTED_API_KEY]` |
| `sk-ant-[a-zA-Z0-9_-]{20,}` | Anthropic API keys (ant prefix) | `[REDACTED_API_KEY]` |
| `AIza[a-zA-Z0-9_-]{30,}` | Google API keys | `[REDACTED_API_KEY]` |
| `ghp_[a-zA-Z0-9]{36,}` | GitHub personal access tokens | `[REDACTED_TOKEN]` |
| `gho_[a-zA-Z0-9]{36,}` | GitHub OAuth tokens | `[REDACTED_TOKEN]` |
| `github_pat_[a-zA-Z0-9_]{20,}` | GitHub fine-grained PATs | `[REDACTED_TOKEN]` |
| `ANTHROPIC_API_KEY=[^\s]+` | Key assignment in env output | `ANTHROPIC_API_KEY=[REDACTED]` |
| `OPENAI_API_KEY=[^\s]+` | Key assignment in env output | `OPENAI_API_KEY=[REDACTED]` |
| `GOOGLE_API_KEY=[^\s]+` | Key assignment in env output | `GOOGLE_API_KEY=[REDACTED]` |
| `GEMINI_API_KEY=[^\s]+` | Key assignment in env output | `GEMINI_API_KEY=[REDACTED]` |
| `AKIA[A-Z0-9]{16}` | AWS access keys | `[REDACTED_AWS_KEY]` |
| `ASIA[A-Z0-9]{16}` | AWS session tokens | `[REDACTED_AWS_KEY]` |
| `Bearer [a-zA-Z0-9_-]{20,}` | Authorization headers | `Bearer [REDACTED]` |

Apply redaction to the full response text before inserting into the result JSON. If any redaction occurs, append a note: `[WARN] Sensitive tokens were redacted from the response.`

## Output Format

Return a plain JSON object to stdout (no markers or wrappers):

```json
{
  "tool": "gemini",
  "model": "gemini-3.1-pro-preview",
  "effort": "high",
  "duration_ms": 12300,
  "response": "The AI's response text here...",
  "session_id": "abc-123",
  "continuable": true
}
```

## Install Instructions

When a tool is not found, return these install commands:

| Tool | Install |
|------|---------|
| Claude | `npm install -g @anthropic-ai/claude-code` |
| Gemini | See https://gemini.google.com/cli for install instructions |
| Codex | `npm install -g @openai/codex` |
| OpenCode | `npm install -g opencode-ai` or `brew install anomalyco/tap/opencode` |
| Copilot | `gh extension install github/copilot-cli` |

## Error Handling

| Error | Response |
|-------|----------|
| Tool not installed | Return install instructions from table above |
| Tool execution timeout | Return `"response": "Timeout after 120s"` |
| JSON parse error | Return raw text as response |
| Empty output | Return `"response": "No output received"` |
| Session file missing | Proceed without session resume |
| API key missing | Return tool-specific env var instructions |

## Integration

This skill is invoked by:
- `consult-agent` for `/consult` command
- Direct invocation: `Skill('consult', '"question" --tool=gemini --effort=high')`

Example: `Skill('consult', '"Is this approach correct?" --tool=gemini --effort=high --model=gemini-3.1-pro-preview')`
