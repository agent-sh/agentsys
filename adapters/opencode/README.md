# agentsys for OpenCode

Professional-grade slash commands adapted for OpenCode.

## Quick Install

```bash
npm install -g agentsys
agentsys --tool opencode
```

## Prerequisites

- **OpenCode** - Install from [opencode.ai](https://opencode.ai)
- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org)
- **Git** - Download from [git-scm.com](https://git-scm.com)
- **GitHub CLI (`gh`)** - For PR commands (install: `brew install gh` or see [cli.github.com](https://cli.github.com))

## Available Commands

### `/deslop` - AI Slop Cleanup

Remove debugging code, old TODOs, and other AI slop.

```bash
opencode
> /deslop
> /deslop apply
> /deslop apply src/
```

**What it does:**
- Scans for console.logs, print statements, old TODOs
- Generates report or auto-applies fixes
- Runs verification tests
- Preserves functionality with minimal diffs

---

### `/foreman` - GitHub Issue Queue

Work a repo's open issues as a task queue.

```bash
opencode
> /foreman status
> /foreman stats
```

**What it does:**
- `status` and `stats` read the queue, claims, capacity and Revuto rounds live from GitHub
- The CLI (`node ~/.agentsys/plugins/foreman/scripts/foreman.js`) runs `pick`, `claim`, `brief`, `findings` and `land` on OpenCode too
- The full loop spawns Claude Code worktree subagents, so it runs end to end only in Claude Code

**Requires:** Node.js 22+, Git, GitHub CLI (`gh`), `waitfor`

---


## OpenCode-Specific Features

OpenCode provides additional features you can combine with agentsys commands:

### File Includes with `@`

Include file contents in your prompt:

```bash
opencode
> /deslop @src/main.py @tests/test_main.py
```

This adds the file contents to the context before the scan.

### Bash Output with `!`

Include bash command output:

```bash
opencode
> /deslop apply !git diff --name-only
```

This runs `git diff --name-only` and includes the output in the prompt.

### Combined Usage

```bash
opencode
> /learn @NOTES.md !git log --oneline -20 websocket reconnect strategies
```

Researches the topic with your notes and the recent commits in context.

---

## Installation Details

The installer:
1. Writes each plugin command to `~/.config/opencode/commands/` with path adjustments (model specs stripped unless `--no-strip`)
2. Writes plugin agents to `~/.config/opencode/agents/` and skills to `~/.config/opencode/skills/`
3. Copies the shared library to `~/.config/opencode/commands/lib/`
4. Installs the native plugin `~/.config/opencode/plugins/agentsys.ts` (auto-thinking selection, workflow enforcement, session compaction)

`$XDG_CONFIG_HOME/opencode` replaces `~/.config/opencode` when `XDG_CONFIG_HOME` is set.

### File Structure

```
~/.config/opencode/
├── commands/
│   ├── deslop.md
│   ├── foreman.md
│   └── lib/
│       ├── platform/
│       ├── patterns/
│       └── utils/
├── agents/
├── skills/
└── plugins/agentsys.ts
```

---

## Usage Examples

### Clean up with file filter
```bash
opencode
> /deslop apply @src/app.js

# Changeset 1/3: Remove console.log statements
# - src/app.js: Removed 3 console.log calls
# [OK] Tests passed
```

### Check the issue queue
```bash
opencode
> /foreman status

# Counts by label, live claims and host capacity, read from GitHub
```

---

## Platform Support

### Auto-Detected CI Platforms
GitHub Actions · GitLab CI · CircleCI · Jenkins · Travis CI

### Auto-Detected Deployment Platforms
Railway · Vercel · Netlify · Fly.io · Platform.sh · Render

### Auto-Detected Project Types
Node.js · Python · Rust · Go · Java

---

## Updating

To update commands:

```bash
npm install -g agentsys@latest
agentsys --tool opencode
```

---

## Troubleshooting

### Commands not showing up
1. Restart OpenCode TUI
2. Check installation: `ls ~/.config/opencode/commands/`
3. Re-run installer

### Commands only work in TUI

Currently, OpenCode slash commands are only available in the TUI (Terminal User Interface), not from the CLI directly. Feature request exists to add CLI support.

### Path errors
Re-run installer to fix path substitutions:
```bash
agentsys --tool opencode
```

### Node.js not found
Ensure Node.js 18+ is installed:
```bash
node --version  # Should be v18.0.0 or higher
```

### GitHub CLI authentication
```bash
gh auth login
gh auth status
```

---

## Differences from Claude Code

| Feature | Claude Code | OpenCode |
|---------|-------------|----------|
| Installation | Marketplace | Manual script |
| Updates | Automatic | Re-run installer |
| File Includes | Built-in | `@filename` syntax |
| Bash Output | Built-in | `!command` syntax |
| Multi-agent | Full support | May vary |

---

## Support

- **Repository**: https://github.com/agent-sh/agentsys
- **Issues**: https://github.com/agent-sh/agentsys/issues
- **OpenCode Docs**: https://opencode.ai/docs

---

## Resources

- [OpenCode Commands](https://opencode.ai/docs/commands/)
- [OpenCode CLI](https://opencode.ai/docs/cli/)
- [agentsys Main README](../../README.md)
- [Multi-Tool Adapters](../README.md)

---

Made for the OpenCode community
