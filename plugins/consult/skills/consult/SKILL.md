---
name: consult
description: "Cross-tool AI consultation. Use when user asks to 'consult gemini', 'ask codex', 'get second opinion', 'cross-check with claude', 'consult another AI', 'ask opencode', 'copilot opinion', or wants a second opinion from a different AI tool."
version: 1.0.0
argument-hint: "[question] [--tool] [--effort]"
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

| Effort | Model |
|--------|-------|
| low | gemini-2.5-flash |
| medium | gemini-3-flash-preview |
| high | gemini-3-pro-preview |
| max | gemini-3-pro-preview |

**Parse output**: `JSON.parse(stdout).response`
**Continuable**: Yes (via `--resume`)

### Codex

```
Command: codex -q "QUESTION" --json -m "MODEL" -a suggest -c model_reasoning_effort="LEVEL"
```

| Effort | Model | Reasoning |
|--------|-------|-----------|
| low | gpt-5.1-codex-mini | low |
| medium | gpt-5.2-codex | medium |
| high | gpt-5.3-codex | high |
| max | gpt-5.3-codex | xhigh |

**Parse output**: `JSON.parse(stdout).message` or raw text
**Continuable**: No

### OpenCode

```
Command: opencode run "QUESTION" --format json --model "MODEL" --variant "VARIANT"
With thinking: add --thinking flag
```

| Effort | Model | Variant |
|--------|-------|---------|
| low | glm-4.7 | low |
| medium | github-copilot/claude-opus-4-6 | medium |
| high | github-copilot/claude-opus-4-6 | high |
| max | github-copilot/gpt-5.3-codex | high + --thinking |

**Parse output**: Parse JSON events from stdout, extract final text response
**Continuable**: No

### Copilot

```
Command: copilot -p "QUESTION"
```

| Effort | Notes |
|--------|-------|
| all | No model or effort control available |

**Parse output**: Raw text from stdout
**Continuable**: No

## Input Validation

Before building commands, validate all user-provided arguments:

- **--tool**: MUST be one of: gemini, codex, claude, opencode, copilot. Reject all other values.
- **--effort**: MUST be one of: low, medium, high, max. Default to medium.
- **--model**: Allow any string, but quote it in the command.
- **--context=file=PATH**: MUST resolve within the current project directory. Reject absolute paths outside cwd and paths containing `..` that escape the project root.

## Command Building

Given the parsed arguments, build the complete CLI command. All user-provided values MUST be quoted in the shell command to prevent injection.

### Step 1: Resolve Model

If `--model` is specified, use it directly. Otherwise, use the effort-based model from the provider table above.

### Step 2: Build Command String

Use the command template from the provider's configuration section. Substitute QUESTION, MODEL, TURNS, LEVEL, and VARIANT with resolved values.

If continuing a session (Claude or Gemini): append `--resume SESSION_ID`.
If OpenCode at max effort: append `--thinking`.

### Step 3: Context Packaging

If `--context=diff`: Run `git diff 2>/dev/null` and prepend output to the question.
If `--context=file=PATH`: Read the specified file and prepend its content to the question.

### Step 4: Shell Escaping

Escape ALL user-provided values (question, model, session ID) for safe shell execution:
- Replace `"` with `\"`
- Replace `$` with `\$` (Unix) or leave as-is (Windows cmd)
- Replace backticks with `\``
- Wrap in double quotes

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

`AI_STATE_DIR` uses the platform state directory. See State Files section in project memory for platform defaults.

### Load Session

For `--continue`, read the session file and restore:
- tool (from saved state)
- session_id (for --resume flag)
- model (reuse same model)

If session file not found, warn and proceed as fresh consultation.

## Output Format

Return structured JSON between markers:

```
=== CONSULT_RESULT ===
{
  "tool": "gemini",
  "model": "gemini-3-pro-preview",
  "effort": "high",
  "duration_ms": 12300,
  "response": "The AI's response text here...",
  "session_id": "abc-123",
  "continuable": true
}
=== END_RESULT ===
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
