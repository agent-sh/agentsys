# How to Use - Complete Guide

**From installation to your first successful deployment in 5 minutes.**

---

## Part 1: Installation (30 seconds)

### Two Command Install

```bash
# Step 1: Add the marketplace
claude plugin marketplace add avifenesh/awsome-slash

# Step 2: Install the plugin
claude plugin install awsome-slash@awsome-slash
```

**That's it!** The plugin is now installed.

### Verify

```bash
# Commands are available - type / in Claude Code
```

You should see `awsome-slash` listed.

---

## Part 2: First Command (1 minute)

### Open Claude in Your Project

```bash
cd ~/your-project  # Any git repository
claude
```

### See Available Commands

In Claude Code chat:
```
/help
```

You'll see:
```
Available Commands:
- /deslop-around - Cleanup AI slop
- /next-task - Master workflow orchestrator
- /project-review - Multi-agent code review
- /ship - Complete PR workflow (commit to production)
```

### Try Your First Command

```
/deslop-around report
```

Claude will:
1. Detect your project type
2. Scan for code slop (console.log, TODOs, etc.)
3. Show you what it found
4. Ask if you want to fix it

**Output Example:**
```
Detected: Node.js project (React)

Found 7 issues:
1. src/App.js:15 - console.log("user data")
2. src/App.js:42 - // TODO: Add validation
3. src/utils.js:8 - console.log("debug info")
...

Would you like to apply fixes?
```

---

## Part 3: Understanding Commands (2 minutes)

### Command Categories

**1. Cleanup & Maintenance**
- `/deslop-around` - Remove debugging code, old TODOs

**2. Planning & Prioritization**
- `/next-task` - See what to work on next from GitHub issues

**3. Quality & Review**
- `/project-review` - Get AI code review with specialized agents

**4. Shipping & Deployment**
- `/ship` - Complete workflow: commit → PR → CI → merge → deploy

### When to Use Each

**Starting Your Day:**
```
/next-task
# Shows prioritized tasks from GitHub issues
```

**Before Committing:**
```
/deslop-around apply
# Cleans up debugging code
```

**Before Creating PR:**
```
/project-review
# Catches issues early
```

**Ready to Deploy:**
```
/ship
# Handles everything: PR, CI, merge, deploy, validate
```

**Reviewing Code:**
```
/project-review
# Multi-agent code review with specialized agents
```

---

## Part 4: Real Usage Example (2 minutes)

### Scenario: You just finished a feature

**Step 1: Clean up your code**
```
You: /deslop-around apply

Claude:
✓ Removed 3 console.log statements
✓ Removed 2 old TODO comments
✓ Fixed empty catch block
✓ Tests still pass
```

**Step 2: Get code review**
```
You: /project-review --quick

Claude:
Detected: React + TypeScript
Running quick security and quality review...

Found 1 issue:
- src/api.ts:45 [HIGH] Missing error handling

Would you like me to fix it?

You: Yes

Claude: ✓ Fixed! Added try-catch with proper error handling
```

**Step 3: Ship it!**
```
You: /ship

Claude:
Phase 1: ✓ Committed changes
Phase 2: ✓ Created PR #156
Phase 3: ✓ CI passed (2m 34s)
Phase 4: ✓ Review agents approved
Phase 5: ✓ Merged to main
Phase 6: ✓ Deployed to development
Phase 7: ✓ Deployed to production
✓ Feature is live!

Total time: 8 minutes
```

**Done!** Your feature is in production with validation.

---

## Part 5: Understanding What Happens

### What `/ship` Actually Does

1. **Commits your changes** with generated message
2. **Creates PR** with description
3. **Waits for CI** (GitHub Actions, GitLab CI, etc.)
4. **Runs review agents** (code quality, security, tests)
5. **Merges PR** after approval
6. **Deploys to dev** (if you have multi-branch)
7. **Validates dev** (health checks, smoke tests)
8. **Deploys to production** (if you have stable branch)
9. **Validates production** (with automatic rollback if issues)
10. **Cleans up** (branches, worktrees)

### What You DON'T Need to Do

❌ Manually commit
❌ Write PR description
❌ Wait and watch CI
❌ Manually merge
❌ Manually deploy
❌ Check deployment health
❌ Clean up branches

✅ **Just type `/ship`** and it handles everything!

---

## Part 6: Command Options

### `/deslop-around`

```bash
/deslop-around                 # Report mode (safe, no changes)
/deslop-around apply           # Fix issues automatically
/deslop-around apply src/ 10   # Fix 10 issues in src/ only
```

### `/next-task`

```bash
/next-task                     # Top 5 prioritized tasks
/next-task bug                 # Only bugs
/next-task --implement         # Start implementing selected task
```

### `/project-review`

```bash
/project-review                # Full multi-agent review
/project-review --quick        # Single-pass review
/project-review --domain security  # Security review only
```

### `/ship`

```bash
/ship                          # Full workflow
/ship --dry-run                # Preview without executing
/ship --strategy rebase        # Use rebase instead of squash
```

---

## Part 7: Tips for Success

### Tip 1: Start Small

Don't start with `/ship` on your production app!

**Try this order:**
1. ✅ `/deslop-around report` - Just look, no changes
2. ✅ `/next-task` - See task prioritization
3. ✅ `/deslop-around apply` - Make safe changes
4. ✅ `/project-review --quick` - Quick feedback
5. ✅ `/ship --dry-run` - Preview the workflow
6. ✅ `/ship` - Full deployment

### Tip 2: Let Claude Explain

```
You: Can you explain what /ship will do in my project?

Claude: *analyzes your project*
I see you have:
- GitHub Actions CI
- Railway deployment
- Single-branch workflow (main only)

Here's what /ship will do:
1. Commit your changes
2. Create PR to main
3. Wait for GitHub Actions
4. Run code review
5. Merge to main
6. Railway will auto-deploy
7. Validate deployment

Since you don't have a stable branch, it will skip
the multi-branch workflow.
```

### Tip 3: Combine Commands

```
You: Can you run /deslop-around, then /project-review, then /ship?

Claude:
Sure! I'll run them in sequence:

1. First, cleaning up code slop...
   ✓ Removed 5 issues

2. Now running code review...
   ✓ Found 2 issues, fixing them...
   ✓ All clear

3. Now shipping to production...
   ✓ Complete!

Your code is cleaned, reviewed, and deployed!
```

### Tip 4: Use in Team Workflow

**For Your PRs:**
```
/deslop-around → /project-review → /ship
```

**For Planning:**
```
/next-task → pick task → /next-task --implement
```

---

## Part 8: Prerequisites Check

### Required for All Commands

```bash
# Git must be installed
git --version

# Must be in a git repository
cd your-project/
git status
```

### Required for /ship

```bash
# Install GitHub CLI
brew install gh  # macOS
winget install GitHub.cli  # Windows

# Authenticate
gh auth login

# Verify
gh auth status
```

### Optional (Auto-detected)

- **CI Platform**: GitHub Actions, GitLab CI, CircleCI, Jenkins
- **Deployment**: Railway, Vercel, Netlify, Fly.io
- **Tests**: npm test, pytest, cargo test, go test

Commands adapt based on what you have!

---

## Part 9: Troubleshooting

### "Command not found"

**Problem**: `/deslop-around` doesn't work

**Solution**:
```bash
# Verify plugin is installed
# Commands are available - type / in Claude Code

# If not listed, reinstall
claude plugin install https://github.com/avifenesh/awsome-slash

# Restart Claude
exit
claude
```

### "GitHub CLI not found"

**Problem**: `/ship` fails

**Solution**:
```bash
# Install gh CLI
brew install gh

# Authenticate
gh auth login

# Try again
```

### "Can't detect project type"

**Problem**: Shows "unknown" project

**Solution**: Make sure you have marker files:
- `package.json` for Node.js
- `requirements.txt` or `pyproject.toml` for Python
- `Cargo.toml` for Rust
- `go.mod` for Go

### Commands are slow

**This is normal!**
- `/ship`: 5-15 min (includes CI wait)
- `/project-review`: 2-5 min (thorough analysis)
- `/next-task`: 10-30 min (full workflow with review)
- `/deslop-around`: 30-60 sec

---

## Part 10: What Makes This Plugin Special

### Zero Configuration

No setup files. No config. Just install and use.

```bash
# Other tools:
npm init
npm install --save-dev tool
echo "config" > .toolrc
# ... 10 more steps

# This plugin:
claude plugin install avifenesh/awsome-slash
# Done!
```

### Auto-Adapts to Your Project

- Detects: Node.js, Python, Rust, Go
- Detects: GitHub Actions, GitLab CI, CircleCI, Jenkins
- Detects: Railway, Vercel, Netlify, Fly.io
- Detects: Single or multi-branch workflow
- Uses what you have, skips what you don't

### Evidence-Based

Every finding includes:
- File path and line number
- Actual code quote
- Specific fix suggestion
- Why it matters

No vague suggestions!

### Comprehensive Validation

- Runs tests
- Checks types (if TypeScript/etc.)
- Validates deployments
- Monitors errors
- **Automatic rollback** if production fails

---

## Summary: Start Using Now

```bash
# 1. Install (30 seconds)
claude plugin marketplace add avifenesh/awsome-slash
claude plugin install awsome-slash@awsome-slash

# 2. Verify (10 seconds)
# Commands are available - type / in Claude Code

# 3. Try it (1 minute)
cd your-project/
claude
> /deslop-around report

# 4. Use it for real (ongoing)
> /next-task              # What to work on
> /deslop-around apply    # Clean up
> /project-review         # Get feedback
> /ship                   # Deploy to production
```

**Total time to first command: 2 minutes** ⏱️

**Total time to production deployment: 10 minutes** 🚀

---

**You're ready! Start with `/deslop-around report` and see what it finds.**

For more examples, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)
