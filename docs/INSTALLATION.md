# Installation Guide

One codebase works across three platforms—Claude Code, OpenCode, and Codex CLI. Install once, get the same workflows everywhere. State files adapt automatically to each platform's conventions.

---

## Quick Navigation

| Section | Jump to |
|---------|---------|
| [Claude Code](#claude-code-recommended) | Marketplace install (easiest) |
| [npm Install](#all-platforms-npm-global-install) | Works for all platforms |
| [Alternative Methods](#alternative-installation-methods) | Local dev, manual |
| [Verify Installation](#verify-installation) | Check it worked |
| [Prerequisites](#prerequisites) | What you need first |
| [Troubleshooting](#troubleshooting) | Common issues |

---

## Claude Code (Recommended)

Add the marketplace and install plugins directly in Claude Code:

```bash
/plugin marketplace add agent-sh/agentsys
/plugin install next-task@agentsys
/plugin install ship@agentsys
/plugin install deslop@agentsys
/plugin install audit-project@agentsys
/plugin install drift-detect@agentsys
/plugin install repo-map@agentsys
/plugin install enhance@agentsys
/plugin install perf@agentsys
/plugin install sync-docs@agentsys
/plugin install learn@agentsys
/plugin install consult@agentsys
/plugin install debate@agentsys
```

**Scopes** (optional):
```bash
# User scope (default) - available in all projects
/plugin install next-task@agentsys

# Project scope - shared with team
/plugin install next-task@agentsys --scope project
```

---

## All Platforms (npm Global Install)

Interactive installer for Claude Code, OpenCode, and Codex CLI:

```bash
npm install -g agentsys@latest
agentsys
```

Select one or more platforms when prompted:
```
Which platforms do you want to install for?

  1) Claude Code
  2) OpenCode
  3) Codex CLI

Your selection: 1 2
```

### Non-Interactive Installation

Use flags for CI/scripts or when you know what you want:

```bash
# Single tool
agentsys --tool claude
agentsys --tool opencode
agentsys --tool codex

# Multiple tools
agentsys --tools "claude,opencode"
agentsys --tools claude,opencode,codex
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--tool <name>` | Install for single tool (claude, opencode, codex) |
| `--tools <list>` | Install for multiple tools (comma-separated) |
| `--development`, `--dev` | Development mode: install directly to ~/.claude/plugins |
| `--no-strip`, `-ns` | Include model specifications (stripped by default) |
| `--remove` | Remove local installation |
| `--version`, `-v` | Show version |
| `--help`, `-h` | Show help |

### Model Stripping

By default, model specifications (sonnet/opus/haiku) are stripped from agents when installing for OpenCode. This prevents errors when the target platform doesn't have the same model mappings configured.

Use `--no-strip` or `-ns` to include models if your OpenCode setup has proper model aliases.

**Commands:**
```bash
npm update -g agentsys       # Update
npm uninstall -g agentsys    # Remove npm package
agentsys --remove            # Clean up configs
```

---

## Alternative Installation Methods

### Development Mode (Claude Code)

For testing RC versions or local changes, use development mode:

```bash
agentsys --development
```

This bypasses the marketplace and installs plugins directly to `~/.claude/plugins/`. To revert to the marketplace version:

```bash
rm -rf ~/.claude/plugins/*@agentsys
agentsys --tool claude
```

### Local Development (Plugin Directory)

For testing or development, load plugins directly:

```bash
git clone https://github.com/agent-sh/agentsys.git
claude --plugin-dir ./agentsys/plugins/next-task
```

### Quick Dev Install (Contributors)

For contributors: install to all tools at once from local source:

```bash
node scripts/dev-install.js           # Install to all tools
node scripts/dev-install.js claude    # Install to Claude only
node scripts/dev-install.js --clean   # Remove all installations
```

This script uses local source files (not npm package), installs Claude in development mode, and strips models from OpenCode agents.

### OpenCode / Codex CLI

Use the npm installer (recommended):

```bash
npm install -g agentsys@latest
agentsys
```

Select your platform when prompted. The installer configures:

| Platform | Config Location | State Directory |
|----------|-----------------|-----------------|
| Claude Code | Marketplace | `.claude/` |
| OpenCode | `~/.config/opencode/` | `.opencode/` |
| Codex CLI | `~/.codex/` | `.codex/` |

> **Note:** Codex uses `$` prefix for skills (e.g., `$next-task` instead of `/next-task`).

---

## Verify Installation

### Claude Code

```bash
/help
```

You should see commands:
- `/next-task` - Master workflow orchestrator
- `/ship` - Complete PR workflow
- `/deslop` - AI slop cleanup
- `/audit-project` - Multi-agent code review
- `/drift-detect` - Plan drift detection
- `/repo-map` - AST repo map generation
- `/enhance` - Enhancement analyzer suite
- `/perf` - Performance investigation workflow
- `/sync-docs` - Documentation sync
- `/learn` - Topic research and learning guides
- `/consult` - Cross-tool AI consultation
- `/debate` - Structured AI dialectic with verdict

### OpenCode / Codex

Type the command name and it should be recognized:
- `/next-task` (OpenCode) or `$next-task` (Codex)

### Local Repo Diagnostics (optional)

If you're running from the repo, you can verify platform detection and tool availability:

```bash
npm run detect   # Platform detection (CI, deploy, project type)
npm run verify   # Tool availability + versions
```

---

## Prerequisites

### Required

- **Git** - Version control
  ```bash
  git --version
  ```

- **Node.js 18+** - For library functions

### Recommended (Repo Map)

- **ast-grep (`sg`)** - Required for `/repo-map` generation. Install upfront for the best experience.

### Required for GitHub Workflows

- **GitHub CLI (`gh`)** - For PR operations and issue discovery
  ```bash
  # Install
  brew install gh        # macOS
  winget install GitHub.cli  # Windows

  # Authenticate
  gh auth login

  # Verify
  gh auth status
  ```

### Optional (Auto-Detected)

These tools are detected automatically if present:
- Railway CLI, Vercel CLI, Netlify CLI (for deployments)
- GitLab CLI (`glab`) for GitLab workflows

---

## Managing Plugins

### Update Marketplace

```bash
/plugin marketplace update agentsys
```

### Update Plugins

```bash
/plugin update next-task@agentsys
```

### Disable/Enable

```bash
/plugin disable next-task@agentsys
/plugin enable next-task@agentsys
```

### Uninstall

```bash
/plugin uninstall next-task@agentsys

# Or remove marketplace entirely
/plugin marketplace remove agentsys
```

### Local Installation Update

```bash
cd path/to/agentsys
git pull origin main
```

---

## Troubleshooting

### Commands Don't Appear

1. **Check marketplace is added:**
   ```bash
   /plugin marketplace list
   ```

2. **Check plugin is installed:**
   ```bash
   /plugin list
   ```

3. **Restart Claude Code** after installation

### "Marketplace not found"

The repository must be public or you need authentication:

```bash
# For private repos, ensure gh is authenticated
gh auth status
```

### Plugin Install Fails

Try adding the full GitHub URL:
```bash
/plugin marketplace add https://github.com/agent-sh/agentsys.git
```

### "GitHub CLI not found"

Required for `/ship` and GitHub-based workflows:
```bash
brew install gh  # macOS
winget install GitHub.cli  # Windows

gh auth login
```

---

## Platform-Specific Notes

### Claude Code
- Plugins installed via marketplace are cached locally
- Use `--scope project` to share plugins with your team
- State stored in `.claude/`

### OpenCode
- MCP server provides workflow tools
- Slash commands defined in `~/.config/opencode/commands/`
- State stored in `.opencode/`

### Codex CLI
- Uses `$` prefix instead of `/` for commands
- Skills defined in `~/.codex/skills/`
- State stored in `.codex/`

---

## Getting Help

- **Issues:** https://github.com/agent-sh/agentsys/issues
- **Discussions:** https://github.com/agent-sh/agentsys/discussions

```bash
gh issue create --repo agent-sh/agentsys \
  --title "Installation: [description]" \
  --body "Environment: [Claude Code/OpenCode/Codex], OS: [...]"
```
