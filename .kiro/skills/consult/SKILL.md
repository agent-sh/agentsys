---
name: consult
description: "Use when the user wants a second opinion from another AI CLI: 'consult gemini', 'ask codex', 'cross-check with claude', 'ask opencode', 'copilot opinion'. Runs one question through that tool and returns its answer."
version: 5.2.0
argument-hint: "[question] [--tool] [--effort] [--model] [--context] [--continue]"
---

# consult

Send one question to another AI CLI (Claude, Gemini, Codex, OpenCode, Copilot or Kiro) and bring back its answer, safely: the other tool gets read-only access, the question never touches a shell command line, and secrets in the reply are redacted.

Arguments: `$ARGUMENTS`

| Flag | Values | Default |
|------|--------|---------|
| `--tool` | gemini, codex, claude, opencode, copilot, kiro | see Tool choice |
| `--effort` | low, medium, high, max | medium |
| `--model` | any model id | from effort, in the reference |
| `--context` | diff, file=PATH, none | none |
| `--continue` | flag, or SESSION_ID | off |

The question is everything in `$ARGUMENTS` that is not a flag. Templates, model defaults, parsing and redaction patterns per provider are in [references/providers.md](references/providers.md); `<plugin>` below is this plugin's root, two directories up from this skill.

## Tool choice

Use the tool the user named. If none was named and AskUserQuestion is available, ask, listing only installed tools (`which <tool>`, or `where.exe` on Windows; `kiro-cli` for Kiro). Otherwise pick the first installed tool from codex, gemini, claude, opencode, copilot, kiro that is not the harness you are running in: a second opinion from the same model family adds little. If nothing is installed, stop and give the install hints.

## Input validation

Every value that reaches a command is checked first, because a crafted value would otherwise run in the user's shell:

- **--tool** MUST be one of: gemini, codex, claude, opencode, copilot, kiro.
- **--effort** MUST be one of: low, medium, high, max.
- **--model** must match `^[A-Za-z0-9._:/-]+$`; quote it in the command.
- **--continue=SESSION_ID**: If provided, SESSION_ID MUST match `^(?!-)[A-Za-z0-9._:-]+$`.
- **--context=file=PATH** must resolve (after `..` and symlinks) inside the project directory; reject UNC paths (`\\`, `//`) and anything that escapes with `[ERROR] Path escapes project directory: {PATH}`. Read the file with the Read tool, never through a shell command.

## Running a consultation

1. **Question file.** Write the question, with any context prepended (`git diff` output for `--context=diff`, the file for `--context=file=`), to `{AI_STATE_DIR}/consult/question.tmp` with the Write tool. Commands read it from there. Shell quoting cannot make arbitrary text safe inside a command line: `$()` and backticks still expand.
2. **Transport.** Prefer ACP (except Codex and OpenCode at non-medium effort, where only the CLI carries the effort) when `node <plugin>/acp/run.js --detect --provider=<tool>` succeeds: one runner, read-only permissions, redaction and cleanup built in. Exit 3 from the runner means ACP cannot select that model or resume that session; run the CLI template instead with the same question file. Without node, use the CLI templates.
3. **Codex trust gate** (below) when the tool is Codex.
4. **Run** the safe template with a 120-second limit. Never add permission-bypassing flags (`--dangerously-skip-permissions`, `bypassPermissions`, `--yolo`): the consulted tool reads the user's repo and must not write to it.
5. **Parse, redact, clean up.** Parse per the reference, redact CLI output with the reference patterns, and delete the question file whether the run succeeded or not.

If continuing a session:
- **Claude or Gemini**: append `--resume "SESSION_ID"` to the command.
- **Codex**: use `codex exec resume "SESSION_ID" "QUESTION" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` instead of the standard command. Use `--last` instead of a session ID for the most recent session.
- **OpenCode**: append `--session SESSION_ID`, or `--continue` when no id was saved.

### Step 1b: Trust Gate for Codex `--skip-git-repo-check`

Codex refuses to run outside a git repo unless told to skip the check, and skipping it anywhere else would let a consultation run against an arbitrary directory. Resolve `{SKIP_GIT_FLAG}` like this:

1. Verify the consultation runs from the project working directory where the user invoked it.
2. Verify the resolved active tool is Codex (flag, NLP, picker, or restored `--continue` session).
3. Run `git rev-parse --is-inside-work-tree`:
   - if true: set `{SKIP_GIT_FLAG}` to empty string
   - if false and checks 1-2 passed: set `{SKIP_GIT_FLAG}` to `--skip-git-repo-check`
4. If checks 1-2 fail, stop with `[ERROR] Refusing Codex --skip-git-repo-check outside trusted working directory`.

`{SKIP_GIT_FLAG}` MUST be set by Step 1b only. Do not read `SKIP_GIT_FLAG` from inherited shell environment.

## Sessions

After a successful run, save `{AI_STATE_DIR}/consult/last-session.json` (shape in the reference) with the tool, model, effort, session id, transport and `continuable` (true for Claude, Gemini, Codex, OpenCode). For `--continue`, load it and re-validate before use, because the file is on disk and may have been edited:

- tool must still be in allow-list: gemini, codex, claude, opencode, copilot, kiro
- session_id must match `^(?!-)[A-Za-z0-9._:-]+$`
- model must match `^[A-Za-z0-9._:/-]+$` (reject spaces and shell metacharacters); a `null` model means the provider's configured default, so omit `--model`
- on any failure, reject with `[ERROR] Invalid restored session data` and build no command

No session file: warn and run a fresh consultation.

## Output

Return plain JSON (no markers):

```json
{"tool": "gemini", "model": "gemini-3.1-pro-preview", "effort": "high", "duration_ms": 12300, "response": "...", "session_id": "abc-123", "continuable": true, "transport": "cli"}
```

Errors: tool missing, the install hint; timeout, `"response": "Timeout after 120s"`; unparseable output, the raw text as `response`; empty output, `"response": "No output received"`; missing API key, the tool's environment variable to set.
