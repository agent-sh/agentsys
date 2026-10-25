# agentsys for Codex CLI

Professional-grade slash commands adapted for OpenAI's Codex CLI.

## Quick Install

```bash
npm install -g agentsys
agentsys --tool codex
```

## Prerequisites

- **Codex CLI** - Install from [developers.openai.com/codex/cli](https://developers.openai.com/codex/cli)
- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org)
- **Git** - Download from [git-scm.com](https://git-scm.com)
- **GitHub CLI (`gh`)** - For PR commands (install: `brew install gh` or see [cli.github.com](https://cli.github.com))

## Available Commands

### `$deslop` - AI Slop Cleanup

Remove debugging code, old TODOs, and other AI slop.

```bash
codex
> $deslop
> $deslop apply
> $deslop apply src/ 10
```

**What it does:**
- Scans for console.logs, print statements, old TODOs
- Generates report or auto-applies fixes
- Runs verification tests
- Preserves functionality with minimal diffs

---

### `$foreman` - GitHub Issue Queue

Work a repo's open issues as a task queue.

```bash
codex
> $foreman status
> $foreman stats
```

**What it does:**
- `status` and `stats` read the queue, claims, capacity and Revuto rounds live from GitHub
- The CLI (`node ~/.agentsys/plugins/foreman/scripts/foreman.js`) runs `pick`, `claim`, `brief`, `findings` and `land` on Codex too
- The full loop spawns Claude Code worktree subagents, so it runs end to end only in Claude Code

**Requires:** Node.js 22+, Git, GitHub CLI (`gh`), `waitfor`

---

## Installation Details

The installer:
1. Writes each plugin command to `~/.codex/skills/<command>/SKILL.md`, with Codex frontmatter and plugin paths pointing at `~/.agentsys/plugins/<plugin>/`
2. Copies each plugin skill directory whole to `~/.codex/skills/<skill>/` (`references/`, `scripts/`), unless a command already has that name
3. Leaves the plugins themselves, with their `lib/` and `scripts/`, in `~/.agentsys/plugins/`

### File Structure

```
~/.codex/skills/
├── ship/SKILL.md               # from commands/ship.md
├── ...
├── drift-analysis/             # a plugin skill directory
│   ├── SKILL.md
│   └── references/
└── ...

~/.agentsys/plugins/<plugin>/   # what the skills point at
```

---

## Usage Examples

### Clean up debugging code
```bash
codex
> $deslop apply

# Changeset 1/5: Remove console.log statements
# - src/app.js: Removed 3 console.log calls
# [OK] Tests passed
#
# Summary: 5 files changed, 23 lines deleted
```

### Ship a feature
```bash
# Make your changes
git add .

codex
> $ship

# [OK] Commits with AI message
# [OK] Creates PR with context
# [OK] Waits for CI
# [OK] Reviews code
# [OK] Merges to main
# [OK] Deploys and validates
```

---

## Codex-Specific Notes

### Custom Prompt Integration

These commands integrate with Codex's custom prompt system. You can also create shortcuts by adding to your Codex config.

### Multi-Agent Differences

Codex CLI may handle multi-agent workflows differently than Claude Code. Commands will adapt to available capabilities.

### Built-in Commands

Use alongside Codex's built-in commands:
- `/diff` - View Git diff
- `/review` - Codex's native review
- `/compact` - Summarize conversation
- `/model` - Switch models

agentsys commands complement these.

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
agentsys --tool codex
```

---

## Troubleshooting

### Commands not showing up
1. Restart Codex CLI
2. Check installation: `ls ~/.codex/skills/`
3. Re-run installer

### Path errors
Re-run installer to fix path substitutions:
```bash
agentsys --tool codex
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

## Support

- **Repository**: https://github.com/agent-sh/agentsys
- **Issues**: https://github.com/agent-sh/agentsys/issues
- **Codex CLI Docs**: https://developers.openai.com/codex/cli

---

## Resources

- [Codex CLI Slash Commands](https://developers.openai.com/codex/cli/slash-commands/)
- [Custom Prompts](https://developers.openai.com/codex/custom-prompts/)
- [agentsys Main README](../../README.md)
- [Multi-Tool Adapters](../README.md)

---

Made for the Codex CLI community
