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
> /deslop apply src/ 10
```

**What it does:**
- Scans for console.logs, print statements, old TODOs
- Generates report or auto-applies fixes
- Runs verification tests
- Preserves functionality with minimal diffs

---

### `/audit-project` - Multi-Agent Code Review

Comprehensive review with specialized AI agents.

```bash
opencode
> /audit-project
> /audit-project --recent
> /audit-project --domain security
> /audit-project --resume
```

**What it does:**
- Deploys 10 specialized agents
- Adapts to your tech stack
- Finds bugs, security issues, performance problems
- Iterates until no open issues remain

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
> /audit-project @src/main.py @tests/test_main.py
```

This adds the file contents to the context before running the review.

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
> /drift-detect @PLAN.md !git log --oneline -20
```

Compares PLAN.md with the recent commits.

---

## Installation Details

The installer:
1. Creates `~/.config/opencode/commands/`
2. Copies command files with path adjustments
3. Installs shared libraries (platform detection, patterns)
4. Creates environment setup scripts

### File Structure

```
~/.config/opencode/commands/
├── deslop.md
├── audit-project.md
├── lib/
│   ├── platform/
│   │   ├── detect-platform.js
│   │   └── verify-tools.js
│   ├── patterns/
│   │   ├── review-patterns.js
│   │   └── slop-patterns.js
│   └── utils/
│       └── context-optimizer.js
├── env.sh
└── README.md
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

### Review specific files
```bash
opencode
> /audit-project @src/auth.py @src/api.py

# Iteration 1: Found 4 issues (2 critical, 2 high)
# [OK] Fixed SQL injection in auth.py:45
# [OK] Fixed race condition in api.py:123
```

### Gate a branch after a diff review
```bash
opencode
> !git diff
> /prepare-delivery

# (reviews the diff you just displayed, then runs the pre-ship gates; never pushes)
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
