---
name: consult
description: "Cross-tool AI consultation. Use when user asks to 'consult gemini', 'ask codex', 'get second opinion', 'cross-check with claude', 'consult another AI', 'ask opencode', 'copilot opinion', or wants a second opinion from a different AI tool."
version: 1.0.0
argument-hint: "[question] [--tool=gemini|codex|claude|opencode|copilot] [--effort=low|medium|high|max] [--model=MODEL] [--context=diff|file|none] [--continue]"
---

# consult

Cross-tool AI consultation: query another AI CLI tool and return the response.

## Parse Arguments

```javascript
const args = '$ARGUMENTS';

const toolMatch = args.match(/--tool=(gemini|codex|claude|opencode|copilot)/);
const effortMatch = args.match(/--effort=(low|medium|high|max)/);
const modelMatch = args.match(/--model=(\S+)/);
const contextMatch = args.match(/--context=(diff|file|none)/);
const continueMatch = args.match(/--continue(?:=(\S+))?/);

const tool = toolMatch ? toolMatch[1] : null;
const effort = effortMatch ? effortMatch[1] : 'medium';
const model = modelMatch ? modelMatch[1] : null;
const context = contextMatch ? contextMatch[1] : 'none';
const continueSession = continueMatch ? (continueMatch[1] || true) : false;

const question = args
  .replace(/--tool=\S+/g, '')
  .replace(/--effort=\S+/g, '')
  .replace(/--model=\S+/g, '')
  .replace(/--context=\S+/g, '')
  .replace(/--continue(?:=\S+)?/g, '')
  .trim();
```

## Provider Configurations

### Claude

```
Command: claude -p "QUESTION" --output-format json --model MODEL --max-turns TURNS --allowedTools "Read,Glob,Grep"
Session resume: --resume SESSION_ID
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
Command: gemini -p "QUESTION" --output-format json -m MODEL
Session resume: --resume SESSION_ID
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
Command: codex -q "QUESTION" --json -m MODEL -a suggest -c model_reasoning_effort="LEVEL"
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
Command: opencode run "QUESTION" --format json --model MODEL --variant VARIANT
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

## Command Building

Given the parsed arguments, build the complete CLI command:

### Step 1: Resolve Model

If `--model` is specified, use it directly. Otherwise, use the effort-based model from the table above.

### Step 2: Build Command String

**Claude**:
```bash
claude -p "QUESTION" --output-format json --model MODEL --max-turns TURNS --allowedTools "Read,Glob,Grep"
```
If continuing: append `--resume SESSION_ID`

**Gemini**:
```bash
gemini -p "QUESTION" --output-format json -m MODEL
```
If continuing: append `--resume SESSION_ID`

**Codex**:
```bash
codex -q "QUESTION" --json -m MODEL -a suggest -c model_reasoning_effort="LEVEL"
```

**OpenCode**:
```bash
opencode run "QUESTION" --format json --model MODEL --variant VARIANT
```
If max effort: append `--thinking`

**Copilot**:
```bash
copilot -p "QUESTION"
```

### Step 3: Context Packaging

If `--context=diff`:
```bash
DIFF=$(git diff 2>/dev/null)
QUESTION="Context (git diff):\n${DIFF}\n\nQuestion: ${ORIGINAL_QUESTION}"
```

If `--context=file`:
Read the file content and prepend to question.

### Step 4: Shell Escaping

Escape the question for safe shell execution:
- Replace `"` with `\"`
- Replace `$` with `\$`
- Replace backticks with `\``
- Wrap in double quotes

## Provider Detection

Cross-platform tool detection:

```bash
# Windows
where.exe claude 2>nul && echo "claude:available" || echo "claude:missing"
where.exe gemini 2>nul && echo "gemini:available" || echo "gemini:missing"
where.exe codex 2>nul && echo "codex:available" || echo "codex:missing"
where.exe opencode 2>nul && echo "opencode:available" || echo "opencode:missing"
where.exe copilot 2>nul && echo "copilot:available" || echo "copilot:missing"

# Unix
which claude 2>/dev/null && echo "claude:available" || echo "claude:missing"
which gemini 2>/dev/null && echo "gemini:available" || echo "gemini:missing"
which codex 2>/dev/null && echo "codex:available" || echo "codex:missing"
which opencode 2>/dev/null && echo "opencode:available" || echo "opencode:missing"
which copilot 2>/dev/null && echo "copilot:available" || echo "copilot:missing"
```

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
  "raw_output": {},
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
| Tool not installed | Return install instructions |
| Tool execution timeout | Return `"response": "Timeout after 120s"` |
| JSON parse error | Return raw text as response |
| Empty output | Return `"response": "No output received"` |
| Session file missing | Proceed without session resume |
| API key missing | Return tool-specific env var instructions |

## Integration

This skill is invoked by:
- `consult-agent` for `/consult` command
- Can be invoked directly: `Skill('consult', '"question" --tool=gemini --effort=high')`
