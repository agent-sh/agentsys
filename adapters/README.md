# Multi-Tool Adapters

This directory contains adapters for using agentsys commands with different AI coding tools.

## Supported Tools

### Claude Code (Native)
The primary target. Install via marketplace:
```bash
claude plugin marketplace add agent-sh/agentsys
# Install specific plugins (e.g., next-task, ship, enhance)
claude plugin install next-task@agentsys
claude plugin install ship@agentsys
```

See main [README.md](../README.md) for details.

---

### Codex CLI
OpenAI's Codex command-line interface.

**Installation:**
```bash
git clone https://github.com/agent-sh/agentsys.git
cd agentsys
./adapters/codex/install.sh
```

**Usage:**
```bash
codex
> /deslop
> /next-task
> /ship
```

**Documentation**: [adapters/codex/README.md](./codex/README.md)

---

### OpenCode
Open-source AI coding assistant.

**Installation:**
```bash
git clone https://github.com/agent-sh/agentsys.git
cd agentsys
./adapters/opencode/install.sh
```

**Usage:**
```bash
opencode
> /deslop
> /next-task bug
> /ship --strategy rebase
```

**Documentation**: [adapters/opencode/README.md](./opencode/README.md)

---

## Architecture

All three tools use **markdown-based slash commands**, making adaptation straightforward:

```
Source: plugins/*/commands/*.md
         ↓
Adapters: Copy + path variable substitution
         ↓
Install: Tool-specific command directory
```

### Path Variable Substitution

Commands reference shared libraries using path variables:

**Claude Code:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/lib/platform/detect-platform.js
```

**Codex CLI:**
```bash
node ~/.codex/agentsys/lib/platform/detect-platform.js
```

**OpenCode:**
```bash
node ~/.config/opencode/commands/lib/platform/detect-platform.js
```

Installers automatically handle these substitutions.

---

## Feature Compatibility

| Feature | Claude Code | Codex CLI | OpenCode |
|---------|-------------|-----------|----------|
| Platform Detection | Yes | Yes | Yes |
| Git Operations | Yes | Yes | Yes |
| CI/CD Detection | Yes | Yes | Yes |
| GitHub CLI Integration | Yes | Yes | Yes |
| Multi-agent Workflows | Yes | Varies | Varies |
| File Includes | Yes | Yes | Yes (@filename) |
| Bash Command Output | Yes | Yes | Yes (!command) |

**Legend:**
- Yes = Full support
- Varies = Partial support (may vary by tool version)
- No = Not supported

---

## Commands Compatibility

| Command | Claude Code | Codex CLI | OpenCode | Notes |
|---------|-------------|-----------|----------|-------|
| `/deslop` | Yes | Yes | Yes | Pure bash, 100% compatible |
| `/next-task` | Yes | Yes | Yes | Requires `gh` CLI |
| `/audit-project` | Yes | Partial | Partial | Multi-agent may differ |
| `/ship` | Yes | Partial | Partial | CI/CD works, agents may vary |

---

## Installation Comparison

### Claude Code
```bash
# Via marketplace (easiest)
claude plugin marketplace add agent-sh/agentsys
claude plugin install next-task@agentsys
```

**Pros:**
- Official marketplace
- Automatic updates
- Per-plugin installation

**Cons:**
- Claude-only

### Codex CLI
```bash
# Via installer script
./adapters/codex/install.sh
```

**Pros:**
- One-command installation
- All commands at once
- Easy updates (re-run installer)

**Cons:**
- Requires git clone first
- Manual updates

### OpenCode
```bash
# Via installer script
./adapters/opencode/install.sh
```

**Pros:**
- One-command installation
- OpenCode-specific features (@, !)
- Easy updates (re-run installer)

**Cons:**
- Requires git clone first
- Manual updates

---

## Prerequisites

All tools require:
- **Git** - Version control
- **Node.js 18+** - For platform detection scripts
- **GitHub CLI (`gh`)** - For PR-related commands (`/ship`)

Optional (enables additional features):
- Railway CLI, Vercel CLI, Netlify CLI - For deployment detection
- Linear integration - For `/next-task`

---

## Updating Commands

### Claude Code
Automatic via marketplace updates.

### Codex CLI & OpenCode
```bash
cd /path/to/agentsys
git pull origin main
./adapters/codex/install.sh    # Or ./adapters/opencode/install.sh
```

---

## Troubleshooting

### Command not found
**Codex CLI:**
- Check `~/.codex/skills/*/SKILL.md`
- Restart Codex CLI

**OpenCode:**
- Check `~/.config/opencode/commands/`
- Restart OpenCode TUI

### Path errors in commands
Re-run the installer to fix path substitutions:
```bash
./adapters/[tool]/install.sh
```

### Node.js errors
Ensure Node.js 18+ is installed:
```bash
node --version  # Should be v18.0.0 or higher
```

### GitHub CLI errors
Install and authenticate:
```bash
gh auth login
```

---

## Contributing

Found a bug or want to add support for another tool?

1. Open an issue: https://github.com/agent-sh/agentsys/issues
2. Submit a PR with:
   - New adapter directory: `adapters/[tool-name]/`
   - Installation script: `install.sh`
   - Documentation: `README.md`
   - Update this file

---

## Resources

- [Claude Code Documentation](https://code.claude.com/docs)
- [Codex CLI Documentation](https://developers.openai.com/codex/cli)
- [OpenCode Documentation](https://opencode.ai/docs)
- [agentsys Repository](https://github.com/agent-sh/agentsys)

---

Made for the AI coding tools community
