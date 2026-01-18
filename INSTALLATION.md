# Installation Guide

How to install and use awesome-slash in Claude Code.

---

## Option 1: npm (Recommended)

The easiest way to install:

```bash
npm install awesome-slash
```

For Claude Code specifically:

```bash
# Install via npm
claude plugin add npm:awesome-slash
```

---

## Option 2: Install from GitHub

Claude Code installs plugins through marketplaces. Add the repository as a marketplace, then install:

```bash
# Step 1: Add the marketplace
claude plugin marketplace add avifenesh/awesome-slash

# Step 2: Install the plugin
claude plugin install awesome-slash@awesome-slash
```

**Or using full URL:**
```bash
# Step 1: Add marketplace with full URL
claude plugin marketplace add https://github.com/avifenesh/awesome-slash

# Step 2: Install the plugin
claude plugin install awesome-slash@awesome-slash
```

That's it! Claude will:
1. Add the marketplace to your configuration
2. Download the plugin
3. Make commands available immediately (no restart needed)

**Verify installation:**
```bash
# List installed plugins
# Commands are available - type / in Claude Code

# You should see "awesome-slash"
```

---

## Option 3: Install from Claude Marketplace (Coming Soon)

Once published to the Claude marketplace:

```bash
claude plugin install awesome-slash
```

Or via Claude Web Interface:
1. Go to Claude Settings
2. Navigate to "Plugins"
3. Search for "awesome-slash"
4. Click "Install"

---

## Option 4: Manual Installation (Advanced)

If you prefer manual control:

### Clone and Link
```bash
# Clone to your preferred location
git clone https://github.com/avifenesh/awesome-slash.git ~/awesome-slash

# Create Claude plugins directory
mkdir -p ~/.claude/plugins

# Create symlink
ln -s ~/awesome-slash ~/.claude/plugins/awesome-slash
```

### Set Environment Variable (Optional)

Add to ~/.bashrc or ~/.zshrc:
```bash
export CLAUDE_PLUGIN_ROOT="$HOME/.claude/plugins/awesome-slash"
```

### Restart Claude Code
```bash
# Restart Claude to load the plugin
claude restart
```

---

## Verify Installation

### Check Plugin is Loaded

In Claude Code, type:
```
/help
```

You should see the 5 commands listed:
- `/deslop-around` - Cleanup AI slop
- `/next-task` - Master workflow orchestrator
- `/project-review` - Multi-agent code review
- `/ship` - Complete PR workflow (commit to production)

### Test Platform Detection

In any project directory with Claude Code:
```
Can you detect what type of project this is?
```

Claude should be able to run the platform detection and tell you about your project.

---

## Prerequisites

### Required Tools
- **Git** - Version control (required for all commands)
- **GitHub CLI (gh)** - Required for `/ship`
  ```bash
  # Install GitHub CLI
  # macOS:
  brew install gh

  # Windows:
  winget install GitHub.cli

  # Linux:
  # See https://cli.github.com/manual/installation

  # Then authenticate:
  gh auth login
  ```

### Optional Tools (for specific features)
- **Node.js** - For Node.js projects
- **Python** - For Python projects
- **Rust/Cargo** - For Rust projects
- **Go** - For Go projects
- **Railway CLI** - For Railway deployments
- **Vercel CLI** - For Vercel deployments
- **Netlify CLI** - For Netlify deployments

### Check Your Tools

Run this to see what you have:
```bash
node ~/.claude/plugins/awesome-slash/lib/platform/verify-tools.js
```

This will show all detected tools and their versions.

---

## Configuration

### No Configuration Needed! 🎉

This plugin uses **zero-configuration** - it auto-detects everything:
- ✅ Project type (Node.js, Python, Rust, Go)
- ✅ CI platform (GitHub Actions, GitLab CI, CircleCI, Jenkins)
- ✅ Deployment platform (Railway, Vercel, Netlify, Fly.io)
- ✅ Branch strategy (single-branch or multi-branch)
- ✅ Available tools

Everything "just works" based on your project structure!

### Optional: Custom Settings

If you want to customize behavior, you can create a `.claude.config.json` in your project:

```json
{
  "awesome-slash": {
    "deslop-around": {
      "defaultMode": "report",
      "maxChanges": 5
    },
    "next-task": {
      "defaultFilter": null,
      "includeBlocked": false
    },
    "ship": {
      "defaultStrategy": "squash",
      "skipTests": false
    }
  }
}
```

But this is **completely optional** - commands work great with defaults!

---

## Usage

### Basic Command Usage

Once installed, use commands in any git repository:

#### In Claude Code Chat:
```
/deslop-around
```

Claude will execute the command and:
1. Detect your project configuration
2. Run the command logic
3. Show you results
4. Make changes if appropriate

### Example Session

```
You: /deslop-around

Claude: I'll analyze your codebase for slop...

*Runs platform detection*
*Searches for console.log, TODO, etc.*

Found 5 issues:
1. src/app.js:10 - console.log("debug")
2. src/app.js:15 - // TODO: fix this
3. src/utils.js:5 - console.log("test")
4. src/api.js:20 - // FIXME: hardcoded
5. src/api.js:35 - empty catch block

Would you like me to fix these? (apply mode)
```

```
You: Yes, fix them

Claude: Applying fixes...
*Removes console.logs*
*Removes old TODOs*
*Adds logging to empty catch*

✓ Fixed 5 issues
✓ Tests still pass
✓ Changes committed

Ready to ship!
```

---

## Command Reference

### `/deslop-around [report|apply] [scope] [max-changes]`

Cleans up AI slop in your codebase.

**Examples:**
```
/deslop-around                    # Report mode, show what would be fixed
/deslop-around apply              # Apply fixes
/deslop-around apply src/ 10      # Fix up to 10 issues in src/
```

### `/next-task [filter] [--include-blocked] [--implement]`

Prioritizes tasks from GitHub Issues, Linear, and PLAN.md.

**Examples:**
```
/next-task                        # Show top 5 prioritized tasks
/next-task bug                    # Show only bug tasks
/next-task --implement            # Start implementing selected task
```

### `/project-review [scope] [--domain] [--quick]`

Multi-agent code review with specialized agents.

**Examples:**
```
/project-review                   # Full review with all agents
/project-review --domain security # Security review only
/project-review --quick           # Quick single-pass review
```

### `/ship [--strategy] [--skip-tests] [--dry-run]`

Complete PR workflow from commit to production.

**Examples:**
```
/ship                             # Full workflow
/ship --dry-run                   # Show what would happen
/ship --strategy rebase           # Use rebase instead of squash
```

---

## Updating the Plugin

### From Marketplace (Future)
```bash
claude plugin update awesome-slash
```

### Local Installation
```bash
cd ~/.claude/plugins/awesome-slash
git pull origin main

# Restart Claude Code
```

---

## Uninstalling

### From Marketplace (Future)
```bash
claude plugin uninstall awesome-slash
```

### Local Installation
```bash
# Remove symlink or directory
rm -rf ~/.claude/plugins/awesome-slash

# Remove from shell config
# Delete the CLAUDE_PLUGIN_ROOT line from ~/.bashrc or ~/.zshrc

# Restart Claude Code
```

---

## Troubleshooting

### Commands Don't Appear

**Problem**: Commands don't show up in `/help`

**Solutions**:
1. Check installation path:
   ```bash
   ls -la ~/.claude/plugins/awesome-slash
   ```

2. Verify CLAUDE_PLUGIN_ROOT is set:
   ```bash
   echo $CLAUDE_PLUGIN_ROOT
   ```

3. Restart Claude Code completely

4. Check Claude Code logs:
   ```bash
   cat ~/.claude/logs/latest.log
   ```

### "Module not found" Errors

**Problem**: Commands fail with module errors

**Solution**:
```bash
# Make sure CLAUDE_PLUGIN_ROOT points to correct location
export CLAUDE_PLUGIN_ROOT="$HOME/.claude/plugins/awesome-slash"

# Verify files exist
ls -la $CLAUDE_PLUGIN_ROOT/lib/
```

### "GitHub CLI not found"

**Problem**: `/ship` fails with GitHub CLI error

**Solution**:
```bash
# Install GitHub CLI
brew install gh  # macOS
winget install GitHub.cli  # Windows

# Authenticate
gh auth login

# Verify
gh auth status
```

### Platform Detection Issues

**Problem**: Project type not detected correctly

**Solution**:
```bash
# Run detection manually to debug
node $CLAUDE_PLUGIN_ROOT/lib/platform/detect-platform.js

# Check if you have the right marker files:
# - package.json for Node.js
# - requirements.txt for Python
# - Cargo.toml for Rust
# - go.mod for Go
```

### Commands Are Slow

**Problem**: Commands take a long time

**Explanation**: This is normal for some commands:
- `/ship`: 5-15 minutes (includes CI wait time)
- `/project-review`: 2-5 minutes (thorough analysis)
- `/next-task`: 10-30 minutes (full workflow with review)
- `/deslop-around`: 30-60 seconds (scans codebase)

These times include external operations (CI, deployments, etc.)

---

## Getting Help

### Documentation
- [README.md](./README.md) - Overview and features
- [MANUAL_TESTING.md](./MANUAL_TESTING.md) - Detailed testing guide
- [QUICKSTART.md](./QUICKSTART.md) - 5-minute quick start
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guide

### Support
- **GitHub Issues**: https://github.com/avifenesh/awesome-slash/issues
- **Discussions**: https://github.com/avifenesh/awesome-slash/discussions

### Report Bugs
```bash
gh issue create --repo avifenesh/awesome-slash \
  --title "Bug: [description]" \
  --body "Detailed description with steps to reproduce"
```

---

## What's Next?

After installation, try these commands in order:

1. **Start simple**: `/deslop-around report` - See what slop exists
2. **Check tasks**: `/next-task` - See what to work on
3. **Get feedback**: `/project-review --quick` - Quick code review
4. **Ship it**: `/ship` - When ready to create PR

Each command builds on the previous one naturally!

---

## Success Checklist

After installation, you should be able to:

- [ ] ✅ See commands in `/help`
- [ ] ✅ Run `/deslop-around report` successfully
- [ ] ✅ Run platform detection
- [ ] ✅ See your project type detected correctly
- [ ] ✅ Commands adapt to your project structure
- [ ] ✅ GitHub integration works (if you have gh CLI)

If all checked, you're ready to use the plugin! 🚀

---

**Enjoy using awesome-slash!**

If you find it useful, please ⭐ star the repository on GitHub!
