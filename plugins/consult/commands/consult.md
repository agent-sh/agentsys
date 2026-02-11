---
name: consult
description: Consult another AI CLI tool for a second opinion. Use when you want to cross-check ideas, get alternative approaches, or validate decisions with Gemini, Codex, Claude, OpenCode, or Copilot.
codex-description: 'Use when user asks to "consult gemini", "ask codex", "get second opinion", "cross-check with claude", "consult another AI", "ask opencode", "copilot opinion". Queries another AI CLI tool and returns the response.'
argument-hint: "[question] [--tool=gemini|codex|claude|opencode|copilot] [--effort=low|medium|high|max] [--model=MODEL] [--context=diff|file=PATH|none] [--continue]"
allowed-tools: Skill, Bash(git:*), Bash(claude:*), Bash(gemini:*), Bash(codex:*), Bash(opencode:*), Bash(copilot:*), Bash(where.exe:*), Bash(which:*), Read, Write, AskUserQuestion
---

# /consult - Cross-Tool AI Consultation

You are executing the /consult command. Your job is to consult another AI CLI tool, get its response, and present the results to the user.

## Constraints

- NEVER expose API keys in commands or output
- NEVER run with permission-bypassing flags (`--dangerously-skip-permissions`, `bypassPermissions`)
- MUST use safe-mode defaults (`-a suggest` for Codex, `--allowedTools "Read,Glob,Grep"` for Claude)
- MUST enforce 120s timeout on all tool executions
- MUST validate `--tool` against allow-list: gemini, codex, claude, opencode, copilot (reject all others)
- MUST validate `--context=file=PATH` is within the project directory (reject absolute paths outside cwd)
- MUST quote all user-provided values in shell commands to prevent injection
- NEVER execute tools the user has not explicitly requested

## Arguments

Parse from $ARGUMENTS:

- **question**: What to ask the consulted tool (required unless --continue)
- **--tool**: Target tool: `gemini`, `codex`, `claude`, `opencode`, `copilot` (interactive picker if omitted)
- **--effort**: Thinking effort: `low`, `medium`, `high`, `max` (interactive picker if omitted)
- **--model**: Specific model name (overrides effort-based selection). Free text.
- **--context**: Auto-include context: `diff` (git diff), `file=PATH` (attach specific file), `none` (default)
- **--continue**: Continue last consultation session, or `--continue=SESSION_ID` for specific session

## Execution

### Phase 1: Parse Arguments

Extract these values from `$ARGUMENTS`:

1. Look for `--tool=VALUE` or `--tool VALUE` where VALUE MUST be one of: gemini, codex, claude, opencode, copilot (reject others)
2. Look for `--effort=VALUE` or `--effort VALUE` where VALUE MUST be one of: low, medium, high, max
3. Look for `--model=VALUE` or `--model VALUE` (any string, including quoted strings like `"my model"`)
4. Look for `--context=VALUE` where VALUE is: diff, file=PATH, or none
5. Look for `--continue` (optionally `--continue=SESSION_ID`)
6. Remove all matched flags (including their values) from `$ARGUMENTS`. Handle quoted flag values (e.g., `--model "gpt 4"`) by removing the entire quoted string. Everything remaining is the **question**.

If no question text and no `--continue` flag found, show:
```
[ERROR] Usage: /consult "your question" [--tool=gemini|codex|claude|opencode|copilot] [--effort=low|medium|high|max]
```

### Phase 2: Interactive Parameter Selection

Resolve missing parameters interactively. If ALL flags are provided, skip directly to Phase 3.

#### Step 2a: Handle --continue

If `--continue` is present:
1. Read the session file at `{AI_STATE_DIR}/consult/last-session.json` (where AI_STATE_DIR defaults to `.claude`)
2. If the file exists, restore the saved tool, session_id, and model from it
3. If the file does not exist, show `[WARN] No previous session found` and proceed as a fresh consultation

#### Step 2b: Tool Selection (if no --tool)

Detect which tools are installed by running all 5 checks **in parallel** via Bash:

- `where.exe <tool> 2>nul && echo FOUND || echo NOTFOUND` (Windows)
- `which <tool> 2>/dev/null && echo FOUND || echo NOTFOUND` (Unix)

Check for: claude, gemini, codex, opencode, copilot.

Then use AskUserQuestion with **only the installed tools** as options:

```
AskUserQuestion:
  header: "AI Tool"
  question: "Which AI tool should I consult?"
  multiSelect: false
  options (only if installed):
    - label: "Claude"       description: "Deep code reasoning"
    - label: "Gemini"       description: "Fast multimodal analysis"
    - label: "Codex"        description: "Agentic coding"
    - label: "OpenCode"     description: "Flexible model choice"
    - label: "Copilot"      description: "GitHub-integrated AI"
```

If zero tools are installed: `[ERROR] No AI CLI tools found. Install at least one: npm i -g @anthropic-ai/claude-code, npm i -g @openai/codex, npm i -g opencode-ai`

Map the user's choice to lowercase: "Claude" -> "claude", "Codex" -> "codex", etc.

#### Step 2c: Effort Selection (if no --effort)

```
AskUserQuestion:
  header: "Effort"
  question: "What thinking effort level?"
  multiSelect: false
  options:
    - label: "Medium (Recommended)"  description: "Balanced speed and quality"
    - label: "Low"                   description: "Fast, minimal reasoning"
    - label: "High"                  description: "Thorough analysis"
    - label: "Max"                   description: "Maximum reasoning depth"
```

Map the user's choice: "Medium (Recommended)" -> "medium", "Low" -> "low", "High" -> "high", "Max" -> "max".

### Phase 3: Invoke Consult Skill

With all parameters resolved (tool, effort, question, and optionally model, context, continue), invoke the `consult` skill using the Skill tool:

```
Skill: consult
Args: "<question>" --tool=<tool> --effort=<effort> [--model=<model>] [--context=<context>] [--continue=<session_id>]
```

The skill handles the full consultation lifecycle: it resolves the model from the effort level, builds the CLI command, packages any context, executes the command via Bash with a 120-second timeout, and returns the result between `=== CONSULT_RESULT ===` markers.

### Phase 4: Parse Skill Output

The skill returns structured JSON between `=== CONSULT_RESULT ===` and `=== END_RESULT ===` markers containing: `tool`, `model`, `effort`, `duration_ms`, `response`, `session_id`, and `continuable`.

### Phase 5: Present Results

After the CLI command completes, extract the response text using the skill's provider-specific parsing method. Then display:

```markdown
[OK] Consultation Complete

**Tool**: {name of tool used} ({model name used})
**Effort**: {effort level}
**Duration**: {duration_ms}ms

### Response

{the consulted tool's response text}

### Session

{for Claude/Gemini only: "Session: {session_id} - use `/consult --continue` to resume"}
```

Save session state for continuable tools (Claude, Gemini) to `{AI_STATE_DIR}/consult/last-session.json`.

On failure: `[ERROR] Consultation Failed: {specific error message}`

## Error Handling

| Error | Output |
|-------|--------|
| No question provided | `[ERROR] Usage: /consult "your question" [--tool=gemini\|codex\|claude\|opencode\|copilot] [--effort=low\|medium\|high\|max]` |
| Tool not installed | `[ERROR] {tool} is not installed. Install with: {install command from skill}` |
| Tool execution fails | `[ERROR] {tool} failed: {error}. Try a different tool with --tool=<other>` |
| Timeout (>120s) | `[ERROR] {tool} timed out after 120s. Try --effort=low for faster response` |
| No tools available | `[ERROR] No AI CLI tools found. Install: npm i -g @anthropic-ai/claude-code` |
| Session not found | `[WARN] No previous session found. Starting fresh consultation.` |
| API key missing | `[ERROR] {tool} requires API key. Set {env var} (see skill for details)` |

## Example Usage

```bash
/consult "Is this the right approach for error handling?" --tool=gemini --effort=high
/consult "Review this function for performance issues" --tool=codex
/consult "What alternative patterns would you suggest?" --tool=claude --effort=max
/consult "Suggest improvements" --tool=opencode --model=github-copilot/claude-opus-4-6
/consult "Continue from where we left off" --continue
/consult "Explain this error" --context=diff --tool=gemini
/consult "Review this file" --context=file=src/index.js --tool=claude
```
