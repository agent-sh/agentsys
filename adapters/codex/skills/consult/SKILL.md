---
name: consult
description: "Use when user asks to \"consult gemini\", \"ask codex\", \"get second opinion\", \"cross-check with claude\", \"consult another AI\", \"ask opencode\", \"copilot opinion\", \"ask 3 codex\", \"multi-consult\". Queries another AI CLI tool and returns the response."
---

# /consult - Cross-Tool AI Consultation

You are executing the /consult command. Your job is to parse the user's request (natural language or flags), resolve missing parameters interactively, and execute the consultation.

## Constraints

- NEVER expose API keys in commands or output
- NEVER run with permission-bypassing flags (`--dangerously-skip-permissions`, `bypassPermissions`)
- MUST use safe-mode defaults (`--allowedTools "Read,Glob,Grep"` for Claude, `-c model_reasoning_effort` for Codex)
- MUST enforce 120s timeout on all tool executions
- MUST validate tool names against allow-list: gemini, codex, claude, opencode, copilot (reject all others)
- MUST validate `--context=file=PATH` is within the project directory (reject absolute paths outside cwd)
- MUST quote all user-provided values in shell commands to prevent injection
- NEVER execute tools the user has not explicitly requested

## Execution

### Phase 1: Parse Input (Flags + Natural Language)

Parse `$ARGUMENTS` using both explicit flags and natural language extraction. Flags always take priority over NLP when both provide the same parameter.

#### Step 1a: Extract explicit flags

Look for and remove these flags from `$ARGUMENTS`:

1. `--tool=VALUE` or `--tool VALUE` where VALUE is one of: gemini, codex, claude, opencode, copilot
2. `--effort=VALUE` or `--effort VALUE` where VALUE is one of: low, medium, high, max
3. `--model=VALUE` or `--model VALUE` (any string, including quoted)
4. `--context=VALUE` where VALUE is: diff, file=PATH, or none
5. `--continue` (optionally `--continue=SESSION_ID`)
6. `--count=N` where N is 1-5

Remove all matched flags and their values from `$ARGUMENTS`.

#### Step 1b: Natural language extraction (on remaining text)

After removing flags, parse the remaining text for these patterns:

**Tool extraction** (case-insensitive):
- "with {tool}" (e.g., "with codex") -> tool
- "ask {tool}" (e.g., "ask gemini") -> tool
- "consult {tool}" -> tool
- "{tool} about" (e.g., "codex about") -> tool
- Tool names: claude, gemini, codex, opencode, copilot

**Count extraction**:
- "ask {N} {tool}" (e.g., "ask 3 codex") -> count=N, tool
- "{N} {tool}" (e.g., "3 codex") -> count=N, tool
- "{N} instances" -> count=N
- "few instances" / "multiple" / "several" -> count=ambiguous (ask user in Phase 2)

**Count validation**: After extracting count (from flags or NLP), validate: 1 <= count <= 5. If count < 1 or count > 5, show `[ERROR] Instance count must be 1-5. Got: {count}` and stop.

**Effort extraction**:
- "quick" / "fast" / "brief" -> effort=low
- "thorough" / "deep" / "carefully" / "detailed" -> effort=high
- "maximum" / "max effort" / "exhaustive" -> effort=max

**Question extraction**:
- Text after "about" is the question (e.g., "with codex about my auth approach" -> question="my auth approach")
- If no "about" pattern, everything remaining after removing tool/count/effort markers is the question

**Precedence rule**: Flags from Step 1a always override NLP from Step 1b.

If no question text and no `--continue` flag found after both steps:
```
[ERROR] Usage: /consult "your question" or /consult with gemini about your question
```

### Phase 2: Interactive Parameter Resolution

MUST resolve ALL missing parameters interactively. ONLY skip this phase if ALL required params (tool, effort, model) are resolved AND either a question exists or --continue is present. Do NOT silently default any parameter.

#### Step 2a: Handle --continue

**Note:** `--continue` and `--count > 1` are mutually exclusive. Session resume applies to a single tool session. If both are present, show `[ERROR] Cannot use --continue with --count > 1. Use --continue for single session resume.` and stop.

If `--continue` is present:
1. Read the session file at `{AI_STATE_DIR}/consult/last-session.json`

   Platform state directory:
   - Claude Code: `.claude/`
   - OpenCode: `.opencode/`
   - Codex CLI: `.codex/`
2. If the file exists, restore the saved tool, session_id, and model from it
3. If the file does not exist, show `[WARN] No previous session found` and proceed as a fresh consultation

#### Step 2b: Detect installed tools

Run all 5 checks **in parallel** via Bash:

- `where.exe <tool> 2>nul && echo FOUND || echo NOTFOUND` (Windows)
- `which <tool> 2>/dev/null && echo FOUND || echo NOTFOUND` (Unix)

Check for: claude, gemini, codex, opencode, copilot.

If zero tools are installed: `[ERROR] No AI CLI tools found. Install at least one: npm i -g @anthropic-ai/claude-code, npm i -g @openai/codex, npm i -g opencode-ai`

#### Step 2c: Batch selection for missing params

Use a SINGLE request_user_input call to ask all missing parameters at once. Include ONLY questions for parameters NOT already resolved from Phase 1:

```
request_user_input:
> **Codex**: Each question MUST include a unique `id` field (e.g., `id: "q1"`).
  questions:
    - header: "AI Tool"                          # SKIP if tool resolved
      question: "Which AI tool should I consult?"
      options (only if installed):
        - label: "Claude"       description: "Deep code reasoning"
        - label: "Gemini"       description: "Fast multimodal analysis"
        - label: "Codex"        description: "Agentic coding"
        - label: "OpenCode"     description: "Flexible model choice"
        - label: "Copilot"      description: "GitHub-integrated AI"

    - header: "Effort"                           # SKIP if effort resolved
      question: "What thinking effort level?"
      options:
        - label: "Medium (Recommended)"  description: "Balanced speed and quality"
        - label: "Low"                   description: "Fast, minimal reasoning"
        - label: "High"                  description: "Thorough analysis"
        - label: "Max"                   description: "Maximum reasoning depth"

    - header: "Instances"                        # SKIP if count resolved or not hinted
      question: "How many parallel consultations?"
      options:
        - label: "1 (Single)"             description: "Standard single consultation"
        - label: "2 (Compare)"            description: "Two responses to compare"
        - label: "3 (Panel)"              description: "Three perspectives"
        - label: "5 (Full spread)"        description: "Five diverse perspectives"
```

ONLY show the Instances question if:
- The user explicitly mentioned multiple instances (e.g., "few", "multiple", "several")
- The count was set but ambiguous
Do NOT show Instances question for simple single-tool requests. Default count=1 silently when no multi-instance intent detected.

Map tool choice to lowercase: "Claude" -> "claude", "Codex" -> "codex", etc.
Map effort choice: "Medium (Recommended)" -> "medium", "Low" -> "low", etc.
Map count choice: "1 (Single)" -> 1, "2 (Compare)" -> 2, "3 (Panel)" -> 3.

#### Step 2d: Model selection (MUST ask if no --model)

After tool is resolved, present a model picker with options specific to the selected tool. The user can always type a custom model name via the "Other" option.

**For Claude:**
```
request_user_input:
> **Codex**: Each question MUST include a unique `id` field (e.g., `id: "q1"`).
  questions:
    - header: "Model"
      question: "Which Claude model?"
      options:
        - label: "sonnet (Recommended)"  description: "Sonnet 4.5 - balanced speed and intelligence"
        - label: "opus"                  description: "Opus 4.6 - most capable, adaptive thinking"
        - label: "haiku"                 description: "Haiku 4.5 - fastest, lightweight"
```

**For Gemini:**
```
request_user_input:
> **Codex**: Each question MUST include a unique `id` field (e.g., `id: "q1"`).
  questions:
    - header: "Model"
      question: "Which Gemini model?"
      options:
        - label: "gemini-3.1-pro-preview"          description: "Most capable, strong reasoning"
        - label: "gemini-3-flash-preview"  description: "Fast, efficient coding"
        - label: "gemini-2.5-pro"        description: "Previous gen pro model"
        - label: "gemini-2.5-flash"      description: "Previous gen flash model"
```

**For Codex:**
```
request_user_input:
> **Codex**: Each question MUST include a unique `id` field (e.g., `id: "q1"`).
  questions:
    - header: "Model"
      question: "Which Codex model?"
      options:
        - label: "gpt-5.3-codex"        description: "Latest, most capable coding model"
        - label: "gpt-5.2-codex"        description: "Strong coding model"
        - label: "gpt-5.2"              description: "General purpose GPT-5.2"
        - label: "gpt-5.3-codex-spark"   description: "Cost-effective, 4x more usage"
```

**For OpenCode:**
```
request_user_input:
> **Codex**: Each question MUST include a unique `id` field (e.g., `id: "q1"`).
  questions:
    - header: "Model"
      question: "Which model? (type via Other for paid: anthropic/claude-opus-4-6, openai/gpt-5.3-codex)"
      options:
        - label: "opencode/big-pickle"             description: "Free - Zen stealth model, 200K context"
        - label: "opencode/minimax-m2.1-free"      description: "Free - 230B MoE, strong multilingual coding"
        - label: "opencode/kimi-k2.5-free"         description: "Free - 1T multimodal, strong coding and agentic"
        - label: "opencode/trinity-large-preview"  description: "Free - 400B sparse MoE by Arcee AI, 512K context"
```

**For Copilot:**
```
request_user_input:
> **Codex**: Each question MUST include a unique `id` field (e.g., `id: "q1"`).
  questions:
    - header: "Model"
      question: "Which Copilot model?"
      options:
        - label: "claude-sonnet-4-5"        description: "Default Copilot model"
        - label: "claude-opus-4-6"          description: "Most capable Claude model"
        - label: "gpt-5.3-codex"            description: "OpenAI GPT-5.3 Codex"
        - label: "gemini-3.1-pro-preview"           description: "Google Gemini 3.1 Pro"
```

Map the user's choice to the model string (strip " (Recommended)" suffix if present).

IMPORTANT: Do NOT skip model selection. Do NOT silently use a default model. If --model was not explicitly provided, you MUST present this picker.

### Phase 3: Execute Consultation

With all parameters resolved (tool, effort, model, question, count, and optionally context/continue):

#### Single instance (count=1, the default)

Invoke the `consult` skill directly using the Skill tool:

```
Skill: consult
Args: "[question]" --tool=[tool] --effort=[effort] --model=[model] [--context=[context]] [--continue=[session_id]]

Example: "Is this the right approach?" --tool=gemini --effort=high --model=gemini-3.1-pro-preview
```

The skill handles the full consultation lifecycle: model resolution, command building, context packaging, execution with 120s timeout, and returns a plain JSON result.

#### Multi-instance (count > 1)

Spawn the `consult:consult-agent` via the Task tool with all resolved parameters:

```
Task:
  subagent_type: "consult:consult-agent"
  prompt: |
    Execute a multi-instance consultation with these pre-resolved parameters:
    - tool: [tool]
    - model: [model]
    - effort: [effort]
    - question: [question]
    - count: [count]
    - context: [context or none]

    Run [count] parallel consultations with the same tool and parameters.
    Return all responses formatted with numbered headers and a brief synthesis.
```

The agent handles parallel execution, temp file management, result parsing, and synthesis.

### Phase 4: Present Results

#### Single instance

Parse the skill's plain JSON output and display:

```
Tool: {tool}, Model: {model}, Effort: {effort}, Duration: {duration_ms}ms.

The results of the consultation are:
{response}
```

For continuable tools (Claude, Gemini, Codex, OpenCode), display: `Session: {session_id} - use /consult --continue to resume`

Save session state to `{AI_STATE_DIR}/consult/last-session.json`.

#### Multi-instance

Display the agent's formatted output directly. The agent returns numbered responses with a synthesis section.

On failure: `[ERROR] Consultation Failed: {specific error message}`

## Error Handling

| Error | Output |
|-------|--------|
| No question provided | `[ERROR] Usage: /consult "your question" or /consult with gemini about your question` |
| Tool not installed | `[ERROR] {tool} is not installed. Install with: {install command from skill}` |
| Tool execution fails | `[ERROR] {tool} failed: {error}. Try a different tool with --tool=[other]` |
| Timeout (>120s) | `[ERROR] {tool} timed out after 120s. Try --effort=low for faster response` |
| No tools available | `[ERROR] No AI CLI tools found. Install: npm i -g @anthropic-ai/claude-code` |
| Session not found | `[WARN] No previous session found. Starting fresh consultation.` |
| API key missing | `[ERROR] {tool} requires API key. Set {env var} (see skill for details)` |
| Count out of range | `[ERROR] Instance count must be 1-5. Got: {count}` |
| Multi-instance partial failure | Show successful responses, note failures |

## Example Usage

```bash
# Natural language (NLP parsing)
/consult with codex about my auth approach
/consult ask 3 codex about this design
/consult gemini should I use redis or postgres
/consult thoroughly ask claude about error handling
/consult codex few instances about performance

# Explicit flags (backward compatible)
/consult "Is this the right approach?" --tool=gemini --effort=high
/consult "Review this function" --tool=codex --count=3
/consult "Suggest improvements" --tool=opencode --model=github-copilot/claude-opus-4-6
/consult --continue
/consult "Explain this error" --context=diff --tool=gemini
/consult "Review this file" --context=file=src/index.js --tool=claude

# Mixed (flags + natural language)
/consult with gemini --effort=max about database schema design
```
