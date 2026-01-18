# Installation Guide

Complete installation instructions for awesome-slash across all supported platforms.

---

## Quick Install (30 seconds)

### npm (Recommended)

```bash
npm install awesome-slash
```

### Claude Code

```bash
# Option 1: npm (recommended)
claude plugin add npm:awesome-slash

# Option 2: GitHub marketplace
claude plugin marketplace add avifenesh/awesome-slash
claude plugin install awesome-slash@awesome-slash

# Option 3: Local clone
git clone https://github.com/avifenesh/awesome-slash.git
./scripts/install/claude.sh
```

### OpenCode

```bash
npm install awesome-slash
# or
git clone https://github.com/avifenesh/awesome-slash.git
cd awesome-slash
./scripts/install/opencode.sh
```

### Codex CLI

```bash
npm install awesome-slash
# or
git clone https://github.com/avifenesh/awesome-slash.git
cd awesome-slash
./scripts/install/codex.sh
```

---

## Verify Installation

In Claude Code, type:

```
/help
```

You should see commands listed:
- `/deslop-around` - Cleanup AI slop
- `/next-task` - Master workflow orchestrator
- `/project-review` - Multi-agent code review
- `/ship` - Complete PR workflow

### Test Platform Detection

In any project directory:

```
Can you detect what type of project this is?
```

Claude will run platform detection and report your project configuration.

---

## Prerequisites

### Required for All Commands

- **Git** - Version control
  ```bash
  git --version  # Should show version
  ```

### Required for `/ship`

- **GitHub CLI (gh)** - For PR operations
  ```bash
  # Install
  # macOS:
  brew install gh
  
  # Windows:
  winget install GitHub.cli
  
  # Linux:
  # See https://cli.github.com/manual/installation
  
  # Authenticate:
  gh auth login
  
  # Verify:
  gh auth status
  ```

### Optional Tools (Auto-Detected)

These are detected automatically if present:
- **Node.js** - For Node.js projects
- **Python** - For Python projects
- **Rust/Cargo** - For Rust projects
- **Go** - For Go projects
- **Railway CLI** - For Railway deployments
- **Vercel CLI** - For Vercel deployments
- **Netlify CLI** - For Netlify deployments

### Check Your Tools

```bash
node ~/.claude/plugins/awesome-slash/lib/platform/verify-tools.js
```

---

## Advanced Installation Options

### Manual Installation (Advanced)

If you prefer manual control:

```bash
# Clone to your preferred location
git clone https://github.com/avifenesh/awesome-slash.git ~/awesome-slash

# Create Claude plugins directory
mkdir -p ~/.claude/plugins

# Create symlink
ln -s ~/awesome-slash ~/.claude/plugins/awesome-slash
```

Optional: Add to `~/.bashrc` or `~/.zshrc`:

```bash
export CLAUDE_PLUGIN_ROOT="$HOME/.claude/plugins/awesome-slash"
```

### Install from Claude Marketplace (Coming Soon)

Once published to the Claude marketplace:

```bash
claude plugin install awesome-slash
```

---

## Configuration

### Zero Configuration! 🎉

This plugin auto-detects everything:
- ✅ Project type (Node.js, Python, Rust, Go)
- ✅ CI platform (GitHub Actions, GitLab CI, CircleCI, Jenkins)
- ✅ Deployment platform (Railway, Vercel, Netlify, Fly.io)
- ✅ Branch strategy (single-branch or multi-branch)
- ✅ Available tools

Everything "just works" based on your project structure!

### Optional: Custom Settings

Create `.claude.config.json` in your project:

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

---

## Updating

### From npm

```bash
npm update awesome-slash
```

### From Marketplace

```bash
claude plugin update awesome-slash
```

### Local Installation

```bash
cd ~/.claude/plugins/awesome-slash
git pull origin main
```

---

## Uninstalling

### From npm

```bash
npm uninstall awesome-slash
```

### From Marketplace

```bash
claude plugin uninstall awesome-slash
```

### Local Installation

```bash
rm -rf ~/.claude/plugins/awesome-slash
# Remove CLAUDE_PLUGIN_ROOT from shell config if set
```

---

## Troubleshooting

### Commands Don't Appear

**Problem**: Commands don't show in `/help`

**Solutions**:
1. Check installation:
   ```bash
   ls -la ~/.claude/plugins/awesome-slash
   ```

2. Verify environment:
   ```bash
   echo $CLAUDE_PLUGIN_ROOT
   ```

3. Restart Claude Code completely

4. Check logs:
   ```bash
   cat ~/.claude/logs/latest.log
   ```

### "Module not found" Errors

**Solution**:
```bash
export CLAUDE_PLUGIN_ROOT="$HOME/.claude/plugins/awesome-slash"
ls -la $CLAUDE_PLUGIN_ROOT/lib/
```

### "GitHub CLI not found"

**Solution**:
```bash
brew install gh  # macOS
winget install GitHub.cli  # Windows

gh auth login
gh auth status
```

### "Plugin not found"

**Solution**: Use full GitHub URL:
```bash
claude plugin install https://github.com/avifenesh/awesome-slash
```

### Platform Detection Issues

**Problem**: Project type not detected correctly

**Solution**:
```bash
node $CLAUDE_PLUGIN_ROOT/lib/platform/detect-platform.js
```

Check for marker files:
- `package.json` for Node.js
- `requirements.txt` or `pyproject.toml` for Python
- `Cargo.toml` for Rust
- `go.mod` for Go

### Commands Are Slow

This is normal for some commands:
- `/ship`: 5-15 minutes (includes CI wait time)
- `/project-review`: 2-5 minutes (thorough analysis)
- `/next-task`: 10-30 minutes (full workflow with review)
- `/deslop-around`: 30-60 seconds (scans codebase)

These times include external operations (CI, deployments, etc.)

---

## Quick Test (5 Minutes)

### 1. Test Infrastructure

```bash
git clone https://github.com/avifenesh/awesome-slash.git
cd awesome-slash
node lib/platform/detect-platform.js
```

Expected output:
```json
{
  "projectType": "nodejs",
  "branchStrategy": "single-branch",
  "mainBranch": "main"
}
```

### 2. Test Pattern Libraries

```bash
node -e "
const slop = require('./lib/patterns/slop-patterns.js');
const review = require('./lib/patterns/review-patterns.js');
console.log('✓ Slop patterns:', Object.keys(slop.slopPatterns).length);
console.log('✓ Review frameworks:', review.getAvailableFrameworks().length);
"
```

Expected:
```
✓ Slop patterns: 18
✓ Review frameworks: 8
```

### 3. Test Your First Command

```bash
cd your-project/
claude
> /deslop-around report
```

---

## Getting Help

- **GitHub Issues**: https://github.com/avifenesh/awesome-slash/issues
- **Discussions**: https://github.com/avifenesh/awesome-slash/discussions

```bash
gh issue create --repo avifenesh/awesome-slash \
  --title "Bug: [description]" \
  --body "Detailed description with steps to reproduce"
```

---

## Success Checklist

After installation:

- [ ] See commands in `/help`
- [ ] Run `/deslop-around report` successfully
- [ ] Platform detection works
- [ ] Project type detected correctly
- [ ] GitHub CLI works (for `/ship`)

**You're ready to use awesome-slash!** 🚀
