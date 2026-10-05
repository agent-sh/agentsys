# consult provider reference

Command templates, model defaults, output parsing and session details per provider. `{AI_STATE_DIR}` is the platform state directory: `.claude/` (Claude Code), `.opencode/` (OpenCode), `.codex/` (Codex CLI). `QUESTION` never appears inline in a shell command: the question is always in `{AI_STATE_DIR}/consult/question.tmp` (see SKILL.md).

## Models by effort

Used when `--model` is not given. Model ids checked against each vendor's docs on 2026-09-24; they change, so a user's `--model` always wins.

| Effort | Claude (max turns) | Gemini | Codex (reasoning) | OpenCode (variant) | Copilot | Kiro |
|--------|--------|--------|-------|----------|---------|------|
| low | claude-haiku-4-5 (1) | gemini-3.5-flash-lite | gpt-6-sol (low) | configured default (low) | Copilot default | n/a |
| medium | claude-sonnet-5 (3) | gemini-3.8-flash | gpt-6-sol (medium) | configured default (medium) | Copilot default | n/a |
| high | claude-opus-5-5 (5) | gemini-3.1-pro-preview | gpt-6-astra (high) | configured default (high) | Copilot default | n/a |
| max | claude-fable-5-1 (10) | gemini-3.1-pro-preview | gpt-6-astra (high) | configured default (high) + `--thinking` | Copilot default | n/a |

- Claude: if the CLI rejects the id ("invalid model identifier", common on Bedrock or Vertex setups), retry once with the alias Claude Code resolves for every provider: `haiku`, `sonnet`, `opus`. If `claude-fable-5-1` is not enabled for the account, use `claude-opus-5-5`.
- OpenCode takes `provider/model` ids (`opencode models` lists them). Without `--model` it uses the user's configured default.
- Copilot has no effort control. It takes `--model` with Copilot's own ids; without one it uses the account default.
- Kiro has no model selection.

Picker options when the user should choose a model: Claude `claude-sonnet-5`, `claude-opus-5-5`, `claude-fable-5-1`, `claude-haiku-4-5`; Gemini `gemini-3.8-flash`, `gemini-3.1-pro-preview`, `gemini-3.5-flash-lite`; Codex `gpt-6-sol`, `gpt-6-astra`; OpenCode and Copilot: the configured default, or a typed id.

## CLI templates

Base forms, for reference (never run with `QUESTION` inline):

```
Command: env -u CLAUDECODE claude -p "QUESTION" --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep"
Command: gemini -p "QUESTION" --output-format json -m "MODEL"
Command: codex exec "QUESTION" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"
Session resume: codex exec resume "SESSION_ID" "QUESTION" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"
Session resume (latest): codex exec resume --last "QUESTION" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"
Command: opencode run "QUESTION" --format json --model "MODEL" --variant "VARIANT"
Command: copilot -p "QUESTION"
```

`codex exec` is the headless mode; there is no `-q` flag. Codex non-interactive resume uses `codex exec resume "SESSION_ID" "follow-up prompt" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"`, or `--last` for the most recent session.

Safe forms, the ones to run:

| Provider | Safe command pattern |
|----------|---------------------|
| Claude | `env -u CLAUDECODE claude -p - --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Claude (resume) | `env -u CLAUDECODE claude -p - --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep" --resume "SESSION_ID" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Gemini | `gemini -p - --output-format json -m "MODEL" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Gemini (resume) | `gemini -p - --output-format json -m "MODEL" --resume "SESSION_ID" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Codex | `codex exec "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` |
| Codex (resume) | `codex exec resume "SESSION_ID" "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` |
| Codex (resume latest) | `codex exec resume --last "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` |
| OpenCode | `opencode run - --format json --model "MODEL" --variant "VARIANT" < "{AI_STATE_DIR}/consult/question.tmp"` |
| OpenCode (resume by ID) | `opencode run - --format json --model "MODEL" --variant "VARIANT" --session "SESSION_ID" < "{AI_STATE_DIR}/consult/question.tmp"` |
| OpenCode (resume latest) | `opencode run - --format json --model "MODEL" --variant "VARIANT" --continue < "{AI_STATE_DIR}/consult/question.tmp"` |
| Copilot | `copilot -p - < "{AI_STATE_DIR}/consult/question.tmp"` |

Codex has no stdin prompt mode, so its templates read the file with `cat` inside double quotes: the output becomes one argument and is not re-parsed by the shell. Drop `--model "MODEL"` for OpenCode or Copilot when using the configured default. Add `--thinking` for OpenCode at max effort. Wrap every CLI command in `timeout 120`; where `timeout` is missing (some macOS setups), run it in the background and kill it after 120 seconds.

Resume flags: Claude and Gemini `--resume "SESSION_ID"`; Codex `codex exec resume`; OpenCode `--session "SESSION_ID"` (or `--continue` for the latest). Copilot and Kiro cannot resume.

## Parsing output

| Provider | Response | Session id |
|----------|----------|------------|
| Claude | `JSON.parse(stdout).result` | `.session_id` |
| Gemini | `JSON.parse(stdout).response` | `.session_id` |
| Codex | JSONL events; the final agent message, or `.message`; raw text if not JSON | `session_id` from the events or the `codex resume <id>` hint |
| OpenCode | JSONL events: concatenate `part.text` of events with `type === "text"` (not `part.content`) | `sessionID` on every event |
| Copilot | raw stdout | none |
| ACP (any) | `JSON.parse(stdout).response` | `.session_id` |

## ACP transport

`acp/run.js` (plugin root) runs a consultation over the Agent Client Protocol: JSON-RPC over stdio, same output envelope as the CLI path, read-only tool permissions, redaction built in, and it deletes the question file when done.

| Provider | ACP Command | Type | Detection |
|----------|-------------|------|-----------|
| Claude | `npx -y @anthropic-ai/claude-code-acp` | adapter | npx available |
| Gemini | `gemini` (native ACP) | native | gemini available |
| Codex | `npx -y @zed-industries/codex-acp` | adapter | npx available |
| Copilot | `copilot --acp --stdio` | native | copilot available |
| Kiro | `kiro-cli acp` | native | kiro-cli available |
| OpenCode | `opencode acp` | native | opencode available |

```
node <plugin>/acp/run.js --detect --provider="PROVIDER"
node <plugin>/acp/run.js --provider="PROVIDER" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=120000 [--model="MODEL"] [--session-id="SESSION_ID"] [--effort="EFFORT"]
```

- `--detect` exits 0 with `{"acp_available": true}` or 1 with a `reason`.
- `--model` selects the model through the session's `model` config option (or the older `session/set_model`). The envelope's `model` is what actually ran, or `null` for the provider's configured default.
- `--session-id` resumes with `session/load` when the agent supports it.
- Exit 3 with `"code": "model-unsupported"` or `"resume-unsupported"` means ACP cannot do this request; the question file is kept, so run the CLI template instead. Exit 1 is a real failure.
- `--effort` is recorded in the envelope only; ACP carries the model but not reasoning depth. For Codex and OpenCode at any effort other than medium, use the CLI template so the effort reaches `model_reasoning_effort` or `--variant`.

Kiro is ACP-only: it has no CLI mode for consultation.

## Session file

`{AI_STATE_DIR}/consult/last-session.json`:

```json
{"tool": "claude", "model": "claude-opus-5-5", "effort": "high", "session_id": "abc-123", "timestamp": "2026-09-24T12:00:00Z", "question": "original question", "continuable": true, "transport": "acp"}
```

`transport` is `acp` or `cli`; resume with the same one (absent means `cli`).

## Redaction

`acp/run.js` redacts on its own. For CLI output, replace these before showing or saving a response, and append `[WARN] Sensitive tokens were redacted from the response.` when anything matched:

| Pattern | Replacement |
|---------|-------------|
| `sk-[a-zA-Z0-9_-]{20,}`, `sk-proj-...`, `sk-ant-...`, `AIza[a-zA-Z0-9_-]{30,}` | `[REDACTED_API_KEY]` |
| `ghp_[a-zA-Z0-9]{36,}`, `gho_[a-zA-Z0-9]{36,}`, `github_pat_[a-zA-Z0-9_]{20,}` | `[REDACTED_TOKEN]` |
| `AKIA[A-Z0-9]{16}`, `ASIA[A-Z0-9]{16}` | `[REDACTED_AWS_KEY]` |
| `(ANTHROPIC\|OPENAI\|GOOGLE\|GEMINI)_API_KEY=[^\s]+` | `<NAME>=[REDACTED]` |
| `Bearer [a-zA-Z0-9_-]{20,}` | `Bearer [REDACTED]` |

## Install hints

| Tool | Install |
|------|---------|
| Claude | `npm install -g @anthropic-ai/claude-code` |
| Gemini | see https://github.com/google-gemini/gemini-cli |
| Codex | `npm install -g @openai/codex` |
| OpenCode | `npm install -g opencode-ai` or `brew install anomalyco/tap/opencode` |
| Copilot | `npm install -g @github/copilot` |
| Kiro | `kiro-cli`, see https://kiro.dev |
