# Quick Install - One Command

## Install awsome-slash in 30 seconds

### Step 1: Add Marketplace

```bash
claude plugin marketplace add avifenesh/awsome-slash
```

**Alternative (with full URL):**
```bash
claude plugin marketplace add https://github.com/avifenesh/awsome-slash
```

### Step 2: Install Plugin

```bash
claude plugin install awsome-slash@awsome-slash
```

### Step 3: Verify Installation

```bash
# Check it's installed
# Commands are available - type / in Claude Code
```

You should see `awsome-slash` in the list.

### Step 3: Test It

```bash
# Open Claude in any project directory
cd your-project/
claude

# In Claude Code chat:
> /help
```

You should see 5 new commands:
- `/deslop-around`
- `/next-task`
- `/project-review`
- `/ship`

### Step 4: Try Your First Command

```bash
# In Claude Code chat:
> /deslop-around report
```

Claude will scan your project for code slop and show what it found!

---

## That's It! 🎉

You're ready to use all 5 commands.

**Next Steps:**
- See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for real examples
- See [INSTALLATION.md](./INSTALLATION.md) for troubleshooting
- See [README.md](./README.md) for full documentation

---

## Prerequisites

Before using the commands, make sure you have:

### Required
- **Git** (for all commands)
  ```bash
  git --version  # Should show version
  ```

### For `/ship` Command
- **GitHub CLI**
  ```bash
  # Install
  # macOS: brew install gh
  # Windows: winget install GitHub.cli
  # Linux: https://cli.github.com/manual/installation

  # Authenticate
  gh auth login

  # Verify
  gh auth status
  ```

---

## Quick Command Reference

Once installed, use these in Claude Code:

```bash
# Clean up debugging code
/deslop-around

# Find what to work on next
/next-task

# Get comprehensive code review
/project-review

# Ship your code to production (commit → PR → CI → merge → deploy)
/ship
```

---

## Troubleshooting

### "Plugin not found"

**Solution**: Use the full GitHub URL:
```bash
claude plugin install https://github.com/avifenesh/awsome-slash
```

### Commands don't appear

**Solution**: Restart Claude Code:
```bash
# Exit Claude
exit

# Start again
claude
```

### "GitHub CLI not found"

**Solution**: Install and authenticate:
```bash
# Install (macOS)
brew install gh

# Authenticate
gh auth login
```

---

## Update Plugin

To get the latest version:

```bash
claude plugin update awsome-slash
```

---

## Uninstall

If needed:

```bash
claude plugin uninstall awsome-slash
```

---

**Total Installation Time: 30 seconds** ⏱️

**Start using immediately!** 🚀
