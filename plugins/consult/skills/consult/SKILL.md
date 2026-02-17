---
name: consult
description: "Cross-tool AI consultation. Use when user asks to 'consult gemini', 'ask codex', 'get second opinion', 'cross-check with claude', 'consult another AI', 'ask opencode', 'copilot opinion', or wants a second opinion from a different AI tool."
version: 5.0.3
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
Command: claude -p "QUESTION" --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep"
Session resume: --resume "SESSION_ID"
```

Models: haiku, sonnet, opus

| Effort | Model | Max Turns |
|--------|-------|-----------|
| low | haiku | 1 |
| medium | sonnet | 3 |
| high | opus | 5 |
| max | opus | 10 |

**Parse output**: `JSON.parse(stdout).result`
**Session ID**: `JSON.parse(stdout).session_id`
**Continuable**: Yes

### Gemini

```
Command: gemini -p "QUESTION" --output-format json -m "MODEL"
Session resume: --resume "SESSION_ID"
```

Models: gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash, gemini-3-pro

| Effort | Model |
|--------|-------|
| low | gemini-2.5-flash |
| medium | gemini-3-flash |
| high | gemini-3-pro |
| max | gemini-3-pro |

**Parse output**: `JSON.parse(stdout).response`
**Session ID**: `JSON.parse(stdout).session_id`
**Continuable**: Yes (via `--resume`)

### Codex

```
Command: codex exec "QUESTION" --json -m "MODEL" -c model_reasoning_effort="LEVEL"
Session resume: codex exec resume SESSION_ID "QUESTION" --json
Session resume (latest): codex exec resume --last "QUESTION" --json
```

Note: `codex exec` is the non-interactive/headless mode. There is no `-q` flag. The TUI mode is `codex` (no subcommand).

Models: gpt-5.3-codex-spark, gpt-5-codex, gpt-5.1-codex, gpt-5.2-codex, gpt-5.3-codex, gpt-5.1-codex-max

| Effort | Model | Reasoning |
|--------|-------|-----------|
| low | gpt-5.3-codex-spark | low |
| medium | gpt-5.2-codex | medium |
| high | gpt-5.3-codex | high |
| max | gpt-5.3-codex | xhigh |

**Parse output**: `JSON.parse(stdout).message` or raw text
**Session ID**: Codex prints a resume hint at session end (e.g., `codex resume SESSION_ID`). Extract the session ID from stdout or from `JSON.parse(stdout).session_id` if available.
**Continuable**: Yes. Sessions are stored as JSONL rollout files at `~/.codex/sessions/`. Non-interactive resume uses `codex exec resume SESSION_ID "follow-up prompt" --json`. Use `--last` instead of a session ID to resume the most recent session.

### OpenCode

```
Command: opencode run "QUESTION" --format json --model "MODEL" --variant "VARIANT"
Session resume: opencode run "QUESTION" --format json --model "MODEL" --variant "VARIANT" --continue (most recent) or --session "SESSION_ID"
With thinking: add --thinking flag
```

Models: 75+ via providers (format: provider/model). Top picks: claude-sonnet-4-5, claude-opus-4-5, gpt-5.2, gpt-5.1-codex, gemini-3-pro, minimax-m2.1

| Effort | Model | Variant |
|--------|-------|---------|
| low | (user-selected or default) | low |
| medium | (user-selected or default) | medium |
| high | (user-selected or default) | high |
| max | (user-selected or default) | high + --thinking |

**Parse output**: Parse JSON events from stdout, extract final text response
**Session ID**: Extract from JSON output if available, or use `--continue` to auto-resume the most recent session.
**Continuable**: Yes (via `--continue` or `--session`). Sessions are stored in a SQLite database in the OpenCode data directory. Use `--session SESSION_ID` for a specific session, or `--continue` for the most recent.

### Copilot

```
Command: copilot -p "QUESTION"
```

Models: claude-sonnet-4-5 (default), claude-opus-4-6, claude-haiku-4-5, claude-sonnet-4, gpt-5

| Effort | Notes |
|--------|-------|
| all | No effort control available. Model selectable via --model flag. |

**Parse output**: Raw text from stdout
**Continuable**: No

## Input Validation

Before building commands, validate all user-provided arguments:

- **--tool**: MUST be one of: gemini, codex, claude, opencode, copilot. Reject all other values.
- **--effort**: MUST be one of: low, medium, high, max. Default to medium.
- **--model**: Allow any string, but quote it in the command.
- **--context=file=PATH**: MUST resolve within the project directory. Reject absolute paths outside cwd. Additional checks:
  1. **Block UNC paths** (Windows): Reject paths starting with `\\` or `//` (network shares)
  2. **Resolve canonical path**: Use the Read tool to read the file (do NOT use shell commands). Before reading, resolve the path: join `cwd + PATH`, then normalize (collapse `.`, `..`, resolve symlinks)
  3. **Verify containment**: The resolved canonical path MUST start with the current working directory. If it escapes (via `..`, symlinks, or junction points), reject with: `[ERROR] Path escapes project directory: {PATH}`
  4. **No shell access**: Read file content using the Read tool only. Never pass user-provided paths to shell commands (prevents injection via path values)

## Command Building

Given the parsed arguments, build the complete CLI command. All user-provided values MUST be quoted in the shell command to prevent injection.

### Step 1: Resolve Model

If `--model` is specified, use it directly. Otherwise, use the effort-based model from the provider table above.

### Step 2: Build Command String

Use the command template from the provider's configuration section. Substitute QUESTION, MODEL, TURNS, LEVEL, and VARIANT with resolved values.

If continuing a session:
- **Claude or Gemini**: append `--resume SESSION_ID` to the command.
- **Codex**: use `codex exec resume SESSION_ID "QUESTION" --json` instead of the standard command. Use `--last` instead of a session ID for the most recent session.
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
| Claude | `claude -p - --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Claude (resume) | `claude -p - --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep" --resume "SESSION_ID" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Gemini | `gemini -p - --output-format json -m "MODEL" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Gemini (resume) | `gemini -p - --output-format json -m "MODEL" --resume "SESSION_ID" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Codex | `codex exec "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" -c model_reasoning_effort="LEVEL"` (Codex exec lacks stdin mode -- cat reads from platform-controlled path, not user input) |
| Codex (resume) | `codex exec resume SESSION_ID "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL"` |
| Codex (resume latest) | `codex exec resume --last "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL"` |
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

Check each tool (claude, gemini, codex, opencode, copilot) and return only the available ones.

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
  "continuable": true
}
```

`AI_STATE_DIR` uses the platform state directory:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`

### Load Session

For `--continue`, read the session file and restore:
- tool (from saved state)
- session_id (for --resume flag)
- model (reuse same model)

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
  "model": "gemini-3-pro",
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

Example: `Skill('consult', '"Is this approach correct?" --tool=gemini --effort=high --model=gemini-3-pro')`
