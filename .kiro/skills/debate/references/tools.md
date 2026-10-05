# Running one debate turn

Each turn sends one prompt to one tool and gets one answer back. The rules match the consult plugin's; this file carries them so debate works without it.

## The prompt file

Write the full prompt (template plus context, plus the `--context` material: `git diff` output or the file, read with the Read tool and confined to the project directory) to `{AI_STATE_DIR}/consult/question.tmp` with the Write tool. Commands read it from there. The topic and the other tool's replies are untrusted text; inside a shell command line, `$()` and backticks would still expand. Delete the file after the turn, whether it succeeded or not.

## Transport

Prefer ACP through the consult plugin's runner when it is installed: it spawns the tool with piped stdio, sends the prompt over JSON-RPC, allows the tool only read operations, and redacts secrets. The installer puts the runner at `$HOME/.agentsys/plugins/consult/acp/run.js`. If that file is missing, Glob for `**/consult/**/acp/run.js` in the harness's plugin directory. There is no `acp/` directory in this plugin or in the user's repo.

```
node <consult>/acp/run.js --detect --provider="claude"
node <consult>/acp/run.js --provider="claude" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=240000 [--model="MODEL"] [--effort="EFFORT"]
```

- Exit 0: JSON envelope on stdout, parse `response`.
- Exit 1: failure for this role and round (JSON error on stderr).
- Exit 3 (`model-unsupported` or `resume-unsupported`): ACP cannot run that model; the prompt file is kept, so run the CLI template instead.

ACP carries the model but not reasoning depth: effort reaches Codex (`model_reasoning_effort`), Claude (`--max-turns`) and OpenCode (`--variant`, `--thinking`) only through the CLI templates. For Codex and OpenCode at any effort other than medium, use the CLI template so `--effort` does what the user asked.

Kiro is ACP-only, so it can only debate when the runner is available. Without the runner, or without node, use the CLI templates.

## CLI templates

| Provider | Safe command pattern |
|----------|---------------------|
| Claude | `env -u CLAUDECODE claude -p - --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Gemini | `gemini -p - --output-format json -m "MODEL" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Codex | `codex exec "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" {SKIP_GIT_FLAG} -c model_reasoning_effort="LEVEL"` |
| OpenCode | `opencode run - --format json --model "MODEL" --variant "VARIANT" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Copilot | `copilot -p - < "{AI_STATE_DIR}/consult/question.tmp"` |

- Wrap each in `timeout 240`.
- `env -u CLAUDECODE` lets Claude run from inside a Claude Code session; `--allowedTools "Read,Glob,Grep"` keeps it read-only.
- `{SKIP_GIT_FLAG}` is empty inside a git work tree (`git rev-parse --is-inside-work-tree`), and `--skip-git-repo-check` only when the debate runs from the user's own project directory outside git. Never take it from the environment.
- Drop `--model` for OpenCode and Copilot to use the account default. Add `--thinking` for OpenCode at max effort.
- Never add permission-bypassing flags: the tools read the user's repo and must not change it.

## Models by effort

Used when no model was given for a role. Checked 2026-09-24; a given model id always wins.

| Effort | Claude (max turns) | Gemini | Codex (reasoning) | OpenCode (variant) | Copilot |
|--------|--------|--------|-------|----------|---------|
| low | claude-haiku-4-5 (1) | gemini-3.5-flash-lite | gpt-6-sol (low) | configured default (low) | account default |
| medium | claude-sonnet-5 (3) | gemini-3.8-flash | gpt-6-sol (medium) | configured default (medium) | account default |
| high | claude-opus-5-5 (5) | gemini-3.1-pro-preview | gpt-6-astra (high) | configured default (high) | account default |
| max | claude-fable-5-1 (10) | gemini-3.1-pro-preview | gpt-6-astra (high) | configured default (high) + `--thinking` | account default |

If Claude rejects an id (common on Bedrock or Vertex setups), retry with the alias `haiku`, `sonnet` or `opus`. If `claude-fable-5-1` is not enabled for the account, use `claude-opus-5-5`.

## Parsing

| Provider | Response |
|----------|----------|
| Claude | `JSON.parse(stdout).result` |
| Gemini | `JSON.parse(stdout).response` |
| Codex | JSONL events: the final agent message, or `.message`; raw text if not JSON |
| OpenCode | JSONL events: concatenate `part.text` of events with `type === "text"` |
| Copilot | raw stdout |
| ACP | `JSON.parse(stdout).response` |

Check the exit status and emptiness first; parse only a successful run.

## Redaction

The ACP runner redacts on its own. Before showing or saving CLI output, replace these and append `[WARN] Sensitive tokens were redacted from the response.` when anything matched:

| Pattern | Replacement |
|---------|-------------|
| `sk-[a-zA-Z0-9_-]{20,}`, `sk-proj-...`, `sk-ant-...`, `AIza[a-zA-Z0-9_-]{30,}` | `[REDACTED_API_KEY]` |
| `ghp_[a-zA-Z0-9]{36,}`, `gho_[a-zA-Z0-9]{36,}`, `github_pat_[a-zA-Z0-9_]{20,}` | `[REDACTED_TOKEN]` |
| `AKIA[A-Z0-9]{16}`, `ASIA[A-Z0-9]{16}` | `[REDACTED_AWS_KEY]` |
| `(ANTHROPIC\|OPENAI\|GOOGLE\|GEMINI)_API_KEY=[^\s]+` | `<NAME>=[REDACTED]` |
| `Bearer [a-zA-Z0-9_-]{20,}` | `Bearer [REDACTED]` |

## Detection and install

`which <tool>` (Windows: `where.exe <tool>`) for claude, gemini, codex, opencode, copilot, kiro-cli. Install hints: Claude `npm install -g @anthropic-ai/claude-code`, Codex `npm install -g @openai/codex`, OpenCode `npm install -g opencode-ai`, Copilot `npm install -g @github/copilot`, Gemini https://github.com/google-gemini/gemini-cli.
