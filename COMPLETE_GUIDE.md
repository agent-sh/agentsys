# Complete Guide - Marketplace-Style Usage

Based on official Claude Code documentation.

---

## Installation

### Method 1: Via Terminal (Recommended)

```bash
# Step 1: Add the marketplace
claude plugin marketplace add avifenesh/awsome-slash

# Step 2: Install the plugin
claude plugin install awsome-slash@awsome-slash
```

**That's it!** Commands are immediately available. No restart needed.

### Method 2: Using Plugin Command in Claude

While in Claude Code chat:
```
/plugin marketplace add avifenesh/awsome-slash
/plugin install awsome-slash@awsome-slash
```

### Verify Installation

```bash
# List installed plugins
# Commands are available - type / in Claude Code
```

You should see `awsome-slash`.

---

## Using Commands

Commands are immediately available after installation. Just type them in Claude Code:

### In Any Project Directory

```bash
cd ~/your-project
claude
```

### In Claude Code Chat

```
> /deslop-around
```

Claude will execute the command automatically!

---

## How Commands Work

### Command Files Location

When you install the plugin, command files are placed in:
```
~/.claude/plugins/awsome-slash/commands/
  ├── deslop-around.md
  ├── next-task.md
  ├── project-review.md
  └── ship.md
```

### Command Execution

Each `.md` file becomes a slash command:
- `deslop-around.md` → `/deslop-around`
- `next-task.md` → `/next-task`
- etc.

When you type `/deslop-around`, Claude:
1. Reads the `deslop-around.md` file
2. Executes the instructions in the file
3. Uses the infrastructure (detection, patterns) from the plugin
4. Shows you results

**No restart needed** - commands work immediately!

---

## Complete Workflow Example

### 1. Install Plugin (30 seconds)

```bash
claude plugin install https://github.com/avifenesh/awsome-slash
```

### 2. Open Your Project (10 seconds)

```bash
cd ~/my-app
claude
```

### 3. Use Commands Immediately

**Check what needs cleaning:**
```
> /deslop-around report
```

**Claude's response:**
```
Scanning project for slop...

Detected: Node.js (React) project
Found 5 issues:
1. src/App.js:10 - console.log statement
2. src/App.js:25 - Old TODO (120 days)
...
```

**Clean it up:**
```
> /deslop-around apply
```

**See tasks:**
```
> /next-task
```

**Get review:**
```
> /project-review --quick
```

**Ship to production:**
```
> /ship
```

---

## Understanding Plugin Architecture

### Zero-Configuration Design

The plugin includes:

```
awsome-slash/
├── commands/              # Slash command files
│   ├── deslop-around.md   # → /deslop-around
│   ├── next-task.md       # → /next-task
│   ├── project-review.md  # → /project-review
│   └── ship.md            # → /ship
├── lib/                   # Infrastructure
│   ├── platform/          # Auto-detection
│   │   ├── detect-platform.js
│   │   └── verify-tools.js
│   ├── patterns/          # Pattern libraries
│   │   ├── slop-patterns.js
│   │   └── review-patterns.js
│   └── utils/             # Utilities
│       └── context-optimizer.js
└── .claude-plugin/        # Plugin manifest
    └── plugin.json
```

### Auto-Detection

When you run a command, it automatically detects:
- **Project type**: Node.js, Python, Rust, Go
- **CI platform**: GitHub Actions, GitLab CI, CircleCI, Jenkins
- **Deployment**: Railway, Vercel, Netlify, Fly.io
- **Branch strategy**: Single-branch or multi-branch (dev+prod)

No configuration files needed!

---

## Real Usage Patterns

### Daily Development

**Morning:**
```
> /next-task
# See what to work on today
```

**Before Committing:**
```
> /deslop-around apply
# Clean up debugging code
```

**Before Creating PR:**
```
> /project-review --quick
# Quick quality check
```

**Ready to Ship:**
```
> /ship
# Complete workflow to production
```

### Code Review

**Reviewing Your Own Code:**
```
> /project-review
# Comprehensive multi-agent review
```

### Maintenance

**Weekly Cleanup:**
```
> /deslop-around apply
# Remove accumulated slop
```

**Monthly Audit:**
```
> /project-review --domain security
# Security-focused review
```

---

## Command Reference

### `/deslop-around [mode] [scope] [max-changes]`

Remove code slop: console.logs, TODOs, etc.

**Examples:**
```
/deslop-around                    # Report mode
/deslop-around apply              # Apply fixes
/deslop-around apply src/ 10      # Fix 10 in src/
```

### `/next-task [filter] [flags]`

Prioritize tasks from GitHub Issues.

**Examples:**
```
/next-task                        # Top 5 tasks
/next-task bug                    # Only bugs
/next-task --implement            # Start implementing
```

### `/project-review [scope] [options]`

Multi-agent code review.

**Examples:**
```
/project-review                   # Full review
/project-review --quick           # Single pass
/project-review --domain security # Security only
```

### `/ship [options]`

Complete PR workflow to production.

**Examples:**
```
/ship                             # Full workflow
/ship --dry-run                   # Preview
/ship --strategy rebase           # Use rebase
```

---

## Prerequisites

### Required for All Commands

- **Git**: Must be in a git repository
  ```bash
  git --version
  cd your-project/
  git status  # Must show valid git repo
  ```

### Required for /ship

- **GitHub CLI (gh)**: For PR operations
  ```bash
  # Install
  brew install gh              # macOS
  winget install GitHub.cli    # Windows

  # Authenticate
  gh auth login

  # Verify
  gh auth status
  ```

### Optional (Auto-Detected)

Everything else is auto-detected:
- CI platforms (GitHub Actions, etc.)
- Deployment platforms (Railway, etc.)
- Project type (Node.js, Python, etc.)
- Package managers (npm, cargo, etc.)

---

## Troubleshooting

### Commands Don't Appear

**Check installation:**
```bash
# Commands are available - type / in Claude Code
```

If not listed:
```bash
claude plugin install https://github.com/avifenesh/awsome-slash
```

### "GitHub CLI not found"

For `/ship` only:
```bash
brew install gh
gh auth login
```

### "Not a git repository"

```bash
cd /path/to/your/project
git status  # Must show valid repo
```

### Want to See How It Works?

```bash
# View command source
cat ~/.claude/plugins/awsome-slash/commands/deslop-around.md

# View detection logic
node ~/.claude/plugins/awsome-slash/lib/platform/detect-platform.js
```

---

## Update Plugin

```bash
claude plugin update awsome-slash
```

Commands are updated immediately.

---

## Uninstall

```bash
claude plugin uninstall awsome-slash
```

---

## What Makes This Different

### vs. Manual Scripts

**Manual:**
```bash
# Setup
npm install eslint prettier
echo "config" > .eslintrc
echo "more config" > .prettierrc
# ... 10 more steps

# Use
npm run lint
npm run format
git add .
git commit -m "message"
git push
# ... many manual steps
```

**This Plugin:**
```bash
# Setup
claude plugin install avifenesh/awsome-slash

# Use
/ship
# Done! (Handles lint, format, commit, push, PR, CI, merge, deploy, validate)
```

### vs. CI/CD Scripts

**CI/CD:**
- Runs after you push
- Fixed workflows
- No adaptation to project
- No local validation

**This Plugin:**
- Runs before you push
- Adaptive workflows
- Auto-detects everything
- Local + remote validation

### vs. Other Claude Commands

**Other Commands:**
- Fixed behavior
- Single purpose
- Manual setup

**These Commands:**
- Adaptive behavior (detects your setup)
- Multi-purpose (end-to-end workflows)
- Zero configuration

---

## Learn More

### Official Documentation

- **Claude Code Docs**: [code.claude.com/docs/en/slash-commands](https://code.claude.com/docs/en/slash-commands)
- **Plugin System**: [code.claude.com/docs/en/plugins](https://code.claude.com/docs/en/plugins)
- **Claude Code GitHub**: [github.com/anthropics/claude-code](https://github.com/anthropics/claude-code)

### This Plugin

- **USAGE_EXAMPLES.md**: 6 detailed usage examples
- **INSTALLATION.md**: Complete installation guide
- **README.md**: Feature overview
- **GitHub**: [github.com/avifenesh/awsome-slash](https://github.com/avifenesh/awsome-slash)

---

## Support

- **GitHub Issues**: [github.com/avifenesh/awsome-slash/issues](https://github.com/avifenesh/awsome-slash/issues)
- **Discussions**: [github.com/avifenesh/awsome-slash/discussions](https://github.com/avifenesh/awsome-slash/discussions)

---

## Quick Start Checklist

- [ ] Install plugin: `claude plugin install https://github.com/avifenesh/awsome-slash`
- [ ] Verify: `# Commands are available - type / in Claude Code`
- [ ] Open project: `cd your-project && claude`
- [ ] Try first command: `/deslop-around report`
- [ ] Check GitHub CLI (for /ship): `gh auth status`
- [ ] Use in real workflow!

**Total setup time: 1 minute** ⏱️

**Start using immediately!** 🚀

---

## Sources

Based on official documentation:
- [Slash commands - Claude Code Docs](https://code.claude.com/docs/en/slash-commands)
- [Create plugins - Claude Code Docs](https://code.claude.com/docs/en/plugins)
- [GitHub - anthropics/claude-code](https://github.com/anthropics/claude-code)
- [Customize Claude Code with plugins | Claude](https://www.anthropic.com/news/claude-code-plugins)
