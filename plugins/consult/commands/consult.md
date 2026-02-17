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
- **--model**: Specific model name (interactive picker if omitted). Free text.
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

MUST resolve ALL missing parameters interactively before Phase 3. ONLY skip this phase if ALL of --tool, --effort, AND --model are explicitly provided by the user in $ARGUMENTS. Do NOT silently default any parameter.

#### Step 2a: Handle --continue

If `--continue` is present:
1. Read the session file at `{AI_STATE_DIR}/consult/last-session.json`

   Platform state directory:
   - Claude Code: `.claude/`
   - OpenCode: `.opencode/`
   - Codex CLI: `.codex/`
2. If the file exists, restore the saved tool, session_id, and model from it
3. If the file does not exist, show `[WARN] No previous session found` and proceed as a fresh consultation

#### Step 2b: Batch Selection (tool + effort)

First, detect which tools are installed by running all 5 checks **in parallel** via Bash:

- `where.exe <tool> 2>nul && echo FOUND || echo NOTFOUND` (Windows)
- `which <tool> 2>/dev/null && echo FOUND || echo NOTFOUND` (Unix)

Check for: claude, gemini, codex, opencode, copilot.

If zero tools are installed: `[ERROR] No AI CLI tools found. Install at least one: npm i -g @anthropic-ai/claude-code, npm i -g @openai/codex, npm i -g opencode-ai`

Then use a SINGLE AskUserQuestion call to ask all missing parameters at once. Include only the questions for parameters NOT already provided in $ARGUMENTS:

```
AskUserQuestion:
  questions:
    - header: "AI Tool"                          # SKIP if --tool provided
      question: "Which AI tool should I consult?"
      multiSelect: false
      options (only if installed):
        - label: "Claude"       description: "Deep code reasoning"
        - label: "Gemini"       description: "Fast multimodal analysis"
        - label: "Codex"        description: "Agentic coding"
        - label: "OpenCode"     description: "Flexible model choice"
        - label: "Copilot"      description: "GitHub-integrated AI"

    - header: "Effort"                           # SKIP if --effort provided
      question: "What thinking effort level?"
      multiSelect: false
      options:
        - label: "Medium (Recommended)"  description: "Balanced speed and quality"
        - label: "Low"                   description: "Fast, minimal reasoning"
        - label: "High"                  description: "Thorough analysis"
        - label: "Max"                   description: "Maximum reasoning depth"
```

Map tool choice to lowercase: "Claude" -> "claude", "Codex" -> "codex", etc.
Map effort choice: "Medium (Recommended)" -> "medium", "Low" -> "low", "High" -> "high", "Max" -> "max".

IMPORTANT: Do NOT skip any missing parameter. Do NOT silently default --effort to "medium" or --tool to any value. Present pickers for ALL unresolved parameters.

#### Step 2c: Model Selection (MUST ask if no --model)

After tool is resolved (from Step 2b or $ARGUMENTS), present a model picker with options specific to the selected tool. The user can always type a custom model name via the "Other" option.

**For Claude:**
```
AskUserQuestion:
  questions:
    - header: "Model"
      question: "Which Claude model?"
      multiSelect: false
      options:
        - label: "sonnet (Recommended)"  description: "Sonnet 4.5 - balanced speed and intelligence"
        - label: "opus"                  description: "Opus 4.6 - most capable, adaptive thinking"
        - label: "haiku"                 description: "Haiku 4.5 - fastest, lightweight"
```

**For Gemini:**
```
AskUserQuestion:
  questions:
    - header: "Model"
      question: "Which Gemini model?"
      multiSelect: false
      options:
        - label: "gemini-3-pro"          description: "Most capable, strong reasoning"
        - label: "gemini-3-flash"        description: "Fast, 78% SWE-bench"
        - label: "gemini-2.5-pro"        description: "Previous gen pro model"
        - label: "gemini-2.5-flash"      description: "Previous gen flash model"
```

**For Codex:**
```
AskUserQuestion:
  questions:
    - header: "Model"
      question: "Which Codex model?"
      multiSelect: false
      options:
        - label: "gpt-5.3-codex"        description: "Latest, most capable coding model"
        - label: "gpt-5.2-codex"        description: "Strong coding model"
        - label: "gpt-5.2"              description: "General purpose GPT-5.2"
        - label: "gpt-5-codex-mini"     description: "Cost-effective, 4x more usage"
```

**For OpenCode:**
```
AskUserQuestion:
  questions:
    - header: "Model"
      question: "Which model? (type via Other for paid: anthropic/claude-opus-4-6, openai/gpt-5.3-codex)"
      multiSelect: false
      options:
        - label: "opencode/big-pickle"             description: "Free - Zen stealth model, 200K context"
        - label: "opencode/minimax-m2.1-free"      description: "Free - 230B MoE, strong multilingual coding"
        - label: "opencode/kimi-k2.5-free"         description: "Free - 1T multimodal, strong coding and agentic"
        - label: "opencode/trinity-large-preview"  description: "Free - 400B sparse MoE by Arcee AI, 512K context"
```

**For Copilot:**
```
AskUserQuestion:
  questions:
    - header: "Model"
      question: "Which Copilot model?"
      multiSelect: false
      options:
        - label: "claude-sonnet-4-5"        description: "Default Copilot model"
        - label: "claude-opus-4-6"          description: "Most capable Claude model"
        - label: "gpt-5.3-codex"              description: "OpenAI GPT-5.3 Codex"
        - label: "gemini-3-pro"             description: "Google Gemini 3 Pro"
```

Map the user's choice to the model string (strip " (Recommended)" suffix if present). Pass the selected model to the skill via `--model`.

IMPORTANT: Do NOT skip this step. Do NOT silently use a default model. If --model was not explicitly provided in $ARGUMENTS, you MUST present this picker. The model lists above are current as of Feb 2026 - the user may type any model name supported by their tool via the "Other" option.

### Phase 3: Invoke Consult Skill

With all parameters resolved (tool, effort, model, question, and optionally context, continue), invoke the `consult` skill using the Skill tool:

```
Skill: consult
Args: "[question]" --tool=[tool] --effort=[effort] --model=[model] [--context=[context]] [--continue=[session_id]]

Example: "Is this the right approach?" --tool=gemini --effort=high --model=gemini-3-pro
```

The skill handles the full consultation lifecycle: it resolves the model from the effort level, builds the CLI command, packages any context, executes the command via Bash with a 120-second timeout, and returns a plain JSON result.

### Phase 4: Parse Skill Output

The skill returns a plain JSON object containing: `tool`, `model`, `effort`, `duration_ms`, `response`, `session_id`, and `continuable`. Parse the JSON directly from the skill output.

### Phase 5: Present Results

After parsing the JSON, format and display the result as human-friendly text:

```
Tool: {tool}, Model: {model}, Effort: {effort}, Duration: {duration_ms}ms.

The results of the consultation are:
{response}
```

For continuable tools with a session_id (Claude, Gemini, OpenCode), display: `Session: {session_id} - use /consult --continue to resume`
For Codex (context-based continuation, no session_id), display: `Use /consult --continue to continue this conversation (prior context will be prepended)`

Save session state for continuable tools (Claude, Gemini, Codex, OpenCode) to `{AI_STATE_DIR}/consult/last-session.json`.

Platform state directory:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`

On failure: `[ERROR] Consultation Failed: {specific error message}`

## Error Handling

| Error | Output |
|-------|--------|
| No question provided | `[ERROR] Usage: /consult "your question" [--tool=gemini\|codex\|claude\|opencode\|copilot] [--effort=low\|medium\|high\|max]` |
| Tool not installed | `[ERROR] {tool} is not installed. Install with: {install command from skill}` |
| Tool execution fails | `[ERROR] {tool} failed: {error}. Try a different tool with --tool=[other]` |
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
