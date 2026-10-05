---
name: enhance-hooks
description: "Use when reviewing hook configurations and hook scripts for safety, correct exit codes and output, timeouts, and matcher scope."
version: 5.2.0
argument-hint: "[path] [--fix]"
---

# enhance-hooks

Hooks run automatically, often on every tool call, with the user's permissions. A bad hook either blocks legitimate work, fails open on the thing it was meant to stop, or slows every step. Input (`$ARGUMENTS`): a path (default `.`), `--fix`, `--verbose`.

Hooks live in `hooks` blocks of `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`, plugin `hooks/hooks.json`, and skill or agent frontmatter, plus the scripts they call.

## Run the analyzer

```bash
node -e 'const a=require(process.argv[1]); console.log(JSON.stringify(a.analyzeAllHooks(process.argv[2]), null, 2))' \
  "$HOME/.agentsys/plugins/enhance/lib/enhance/hook-analyzer.js" "<path>"
```

The analyzer only checks frontmatter on hook markdown files. The script and config review below is yours.

## Check facts against the current reference

Hook events, hook types (command, http, prompt, agent, MCP tool), which events support which types, matcher rules, and output fields change between harness releases. Before flagging a config as invalid, check the harness's current hooks reference (for Claude Code: https://code.claude.com/docs/en/hooks). If you cannot check, report the doubt as MEDIUM, not HIGH. For example, prompt hooks are no longer limited to `Stop` and `SubagentStop`.

## What to check

**Safety (HIGH).** Scripts that parse tool input and then run it: `eval` of input, unquoted variables, `curl | sh`. Destructive commands inside a hook (`rm -rf`, `git reset --hard`, `git push --force`) without a guard. Secrets in the script or config. A guard hook that fails open: if parsing fails, a security hook should block, not allow.

**Exit codes and output (HIGH).** For command hooks, exit 0 is success, exit 2 blocks and feeds stderr back, other codes are non-blocking errors. A script meant to block that exits 1 does not block. JSON output must be valid and use field names the event supports.

**Scripts (MEDIUM).** `set -euo pipefail` or equivalent, `jq` failures handled, paths from `$CLAUDE_PROJECT_DIR` or the plugin root instead of hardcoded home paths.

**Cost and timeouts (MEDIUM).** Hooks on `PreToolUse` or `PostToolUse` run on every matching call, so they should be fast. Network calls need an explicit timeout. A broad matcher (`*`) on a slow hook needs a reason.

**Right event (MEDIUM).** Blocking belongs before the action; a `PostToolUse` hook cannot undo what already ran.

**Blocking patterns (MEDIUM).** A block rule that is too broad (`grep rm` blocks `rm tmp.txt`) trains users to disable the hook. Suggest a precise pattern.

## Fix

With `--fix`, apply HIGH certainty auto-fixes only: add `set -euo pipefail` to a bash hook that lacks it, change a blocking `exit 1` to `exit 2` when the script's intent to block is clear, add missing frontmatter fields to hook markdown. Never change what a hook allows or blocks.

## Output

```markdown
## Hook Analysis: <name>
File: <path> | Event: <event> | Type: <type>

| Issue | Fix | Certainty |
|---|---|---|
```

When called by an enhancer agent, return the findings JSON that agent specifies instead.
