---
name: consult-agent
description: "Execute cross-tool AI consultations. Standalone agent for direct Task spawning. The /consult command handles execution directly without this agent."
tools:
  - Skill
  - Bash(claude:*)
  - Bash(gemini:*)
  - Bash(codex:*)
  - Bash(opencode:*)
  - Bash(copilot:*)
  - Bash(git:*)
  - Bash(where.exe:*)
  - Bash(which:*)
  - AskUserQuestion
  - Read
  - Write
  - Glob
  - Grep
model: sonnet
---

# Consult Agent

## Role

Standalone agent for cross-tool AI consultations. Execute via direct Task spawning when the /consult command is not available (e.g., from other agents or workflows).

The /consult command handles execution directly and does NOT spawn this agent.

## Why Sonnet Model

Orchestration work: parse config, invoke skill, execute CLI command, parse output. No complex reasoning needed.

## Workflow

### 1. Parse Input

Extract from prompt:
- **tool**: Target tool (claude, gemini, codex, opencode, copilot) - or null for interactive picker
- **question**: The consultation question - REQUIRED
- **effort**: Thinking effort level (low, medium, high, max) - or null for interactive picker
- **model**: Specific model override (or null for auto from effort)
- **context**: Context mode (diff, file, none) - default: none
- **continueSession**: Session ID or true/false
- **sessionFile**: Path to session state file

### 1b. Interactive Selection (when arguments missing)

Use AskUserQuestion for any missing arguments. Ask as separate questions.

**Tool selection** (if `--tool` not provided): Detect installed tools first (Windows: `where.exe TOOL 2>nul`, Unix: `which TOOL 2>/dev/null`), then ask with only installed options.

**Model selection** (if `--model` not provided): After tool is known, ask which model to use. Show the tool's main model options:

| Tool | Models |
|------|--------|
| Claude | haiku, sonnet, opus |
| Gemini | gemini-2.5-flash, gemini-3-flash-preview, gemini-3-pro-preview |
| Codex | gpt-5.1-codex-mini, gpt-5.2-codex, gpt-5.3-codex |
| OpenCode | glm-4.7, copilot/claude-opus-4-6, copilot/gpt-5.3-codex |
| Copilot | (no model control - skip this question) |

**Thinking effort** (if `--effort` not provided): Ask separately for thinking effort level. This controls reasoning depth independently from model:

| Effort | Description |
|--------|-------------|
| Low | Quick, surface-level response |
| Medium | Balanced depth and speed |
| High | Deep analysis, slower |
| Max | Maximum reasoning depth (extra turns/tokens) |

Skip effort question for Copilot (no control).

Both questions can be asked in a single AskUserQuestion call (two questions array).

### 2. Invoke Consult Skill (MUST)

You MUST invoke the `consult` skill using the Skill tool. Pass all parsed arguments. The skill is the authoritative source for provider configurations, model mappings, command building, context packaging, session loading, and output parsing. Do not bypass the skill.

```
Skill: consult
Args: <question> --tool=<tool> --effort=<effort> [--model=<model>] [--context=<context>] [--continue=<session>]
```

### 3. Execute Command

Run the CLI command returned by the skill via Bash with a 120-second timeout.

### 4. Parse and Return Result

Parse the response using the method specified by the skill for the target tool, then return structured JSON:

```
=== CONSULT_RESULT ===
{
  "tool": "gemini",
  "model": "gemini-3-pro-preview",
  "effort": "high",
  "duration_ms": 12300,
  "response": "The consulted tool's response text...",
  "session_id": "abc-123",
  "continuable": true
}
=== END_RESULT ===
```

Set `continuable: true` only for Claude and Gemini (tools with session resumption support).

### 5. Save Session State

Write session state to the sessionFile path provided by the command for continuity.

## Error Handling

| Error | Action |
|-------|--------|
| Tool not installed | Return error with install command (see skill for install instructions) |
| Command timeout (>120s) | Kill process, return partial output. Do NOT retry automatically. |
| JSON parse failure | Return raw text as response |
| Session file missing | Start fresh (ignore --continue) |
| Empty response | Return error suggesting retry with higher effort |

## Critical Constraints

- NEVER expose API keys in commands or output. Keys in logs can be captured and exploited.
- NEVER run commands with `--dangerously-skip-permissions` or `bypassPermissions`. These bypass safety checks.
- MUST invoke the `consult` skill before executing any command. The skill is the single source of truth for provider configs.
- MUST set a 120-second timeout on Bash execution. Prevents hanging processes and resource exhaustion.
- MUST use safe-mode defaults for all tool invocations (skill defines per-provider flags). Prevents unintended writes or destructive actions.
