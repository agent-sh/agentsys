# Manual Testing Guide

How to manually test the awsome-slash commands in your own projects.

---

## Prerequisites

1. **Claude Code CLI** installed
2. **Git** installed and configured
3. **GitHub CLI (gh)** installed and authenticated
4. A test project (or create one)

---

## Installation

### Option 1: Test Locally (Recommended for Testing)

```bash
# Clone this repository
cd ~/
git clone https://github.com/avifenesh/awsome-slash.git

# Link it as a local plugin
# Method depends on Claude Code plugin system
# Check Claude Code docs for local plugin installation
```

### Option 2: Install from GitHub

```bash
# If Claude Code supports GitHub plugins
claude plugin install avifenesh/awsome-slash
```

### Option 3: Manual Copy

```bash
# Copy to Claude Code plugins directory
cp -r awsome-slash ~/.claude/plugins/awsome-slash
```

---

## Test 1: Infrastructure Verification

### Test Platform Detection

```bash
# In any project directory
node /path/to/awsome-slash/lib/platform/detect-platform.js
```

**Expected Output**:
```json
{
  "ci": "github-actions" or null,
  "deployment": "vercel" or null,
  "projectType": "nodejs" or "python" or "rust" or "go",
  "packageManager": "npm" or "pnpm" or null,
  "branchStrategy": "single-branch" or "multi-branch",
  "mainBranch": "main" or "master",
  "hasPlanFile": true or false,
  "hasTechDebtFile": true or false
}
```

**Validation**:
- ✅ Detects your project type correctly
- ✅ Detects CI platform if you have `.github/workflows`, `.gitlab-ci.yml`, etc.
- ✅ Detects deployment if you have `vercel.json`, `railway.json`, etc.

### Test Tool Verification

```bash
node /path/to/awsome-slash/lib/platform/verify-tools.js
```

**Expected Output**: JSON with available tools (git, gh, node, npm, python, cargo, etc.)

**Validation**:
- ✅ Shows `"available": true` for tools you have installed
- ✅ Shows version numbers
- ✅ Shows `"available": false` for missing tools

---

## Test 2: Pattern Libraries

### Test Slop Patterns

```bash
# Create a test file with some slop
cat > test-slop.js << 'EOF'
function test() {
  console.log("Debug message");  // Should be detected
  // TODO: Fix this later
  const API_KEY = "secret123";  // Hardcoded secret
}
EOF

# Search for slop
git add test-slop.js
git grep -n "console\.log"
git grep -n "TODO"
```

**Expected**: Finds console.log, TODO, and potentially the hardcoded secret

### Test Review Patterns

```bash
# Load patterns library
node -e "
const patterns = require('./lib/patterns/review-patterns.js');
console.log('Frameworks:', patterns.getAvailableFrameworks());
console.log('React patterns:', Object.keys(patterns.getPatternsForFramework('react')));
"
```

**Expected**:
```
Frameworks: [ 'react', 'vue', 'angular', 'django', 'fastapi', 'rust', 'go', 'express' ]
React patterns: [ 'hooks_rules', 'state_management', 'performance', 'common_mistakes' ]
```

---

## Test 3: Commands in Claude Code

### Setup Test Project

```bash
# Create a test project
mkdir ~/test-project
cd ~/test-project
git init
git checkout -b feature/test-command

# Create some files with intentional issues
cat > app.js << 'EOF'
function app() {
  console.log("Starting app");  // Debug code
  // TODO: Add error handling
  return true;
}
EOF

git add app.js
git commit -m "Add test file"
```

---

## Test Command 1: `/deslop-around`

### Test in Report Mode (Safe - No Changes)

**In Claude Code:**
```
/deslop-around report
```

**Expected Behavior**:
1. ✅ Detects project type
2. ✅ Scans for slop (console.log, TODO, etc.)
3. ✅ Shows top 10 slop hotspots
4. ✅ Provides cleanup plan
5. ✅ Does NOT modify files

**Manual Verification**:
```bash
# Check that files are unchanged
git status
# Should show "nothing to commit, working tree clean"
```

### Test in Apply Mode (Makes Changes)

**In Claude Code:**
```
/deslop-around apply . 3
```

**Expected Behavior**:
1. ✅ Removes console.log statements
2. ✅ Removes old TODOs
3. ✅ Fixes up to 3 issues
4. ✅ Runs tests if available
5. ✅ Shows verification results

**Manual Verification**:
```bash
# Check what changed
git diff

# Verify specific fixes
grep -n "console.log" app.js  # Should find none
```

---

## Test Command 2: `/next-task`

### Prerequisites

1. Create some GitHub issues in your test repo:
```bash
gh issue create --title "Add user login" --body "Implement login functionality"
gh issue create --title "Fix timeout bug" --body "Users reporting timeouts"
```

2. Optionally create PLAN.md:
```bash
cat > PLAN.md << 'EOF'
# Project Plan

## TODO
- [ ] Add user login
- [ ] Fix timeout bug
- [ ] Add tests
EOF
git add PLAN.md
git commit -m "Add plan"
```

### Test the Command

**In Claude Code:**
```
/next-task
```

**Expected Behavior**:
1. ✅ Fetches GitHub issues
2. ✅ Reads PLAN.md if exists
3. ✅ Searches codebase to verify tasks aren't done
4. ✅ Prioritizes tasks (by priority, blockers, effort)
5. ✅ Shows top 5 tasks with evidence
6. ✅ Provides file paths and reasoning

**Manual Verification**:
```bash
# Verify issues exist
gh issue list

# Check that recommended task makes sense
# based on project state
```

### Test with Filter

**In Claude Code:**
```
/next-task bug
```

**Expected**: Only shows bug-labeled issues

---

## Test Command 3: `/project-review`

### Prerequisites

Create a project with various issues:

```bash
# Create files with different issue types
cat > security-issue.js << 'EOF'
function getUser(id) {
  // SQL injection vulnerability
  const query = `SELECT * FROM users WHERE id = ${id}`;
  return db.query(query);
}
EOF

cat > performance-issue.js << 'EOF'
function processItems(items) {
  // Inefficient nested loops - O(n²)
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      console.log(items[i], items[j]);
    }
  }
}
EOF

git add *.js
git commit -m "Add files with issues"
```

### Test the Command

**In Claude Code:**
```
/project-review
```

**Expected Behavior**:
1. ✅ Detects project type and framework
2. ✅ Launches specialized agents (security, performance, etc.)
3. ✅ Finds issues with file:line references
4. ✅ Provides severity (critical/high/medium/low)
5. ✅ Suggests specific fixes
6. ✅ Iterates until issues resolved (max 5 rounds)
7. ✅ Creates/updates TECHNICAL_DEBT.md

**Manual Verification**:
```bash
# Check for TECHNICAL_DEBT.md
cat TECHNICAL_DEBT.md

# Verify fixes were applied
git diff

# Check that specific issues were addressed
grep -n "SQL" security-issue.js  # Should be fixed
```

### Test with Domain Filter

**In Claude Code:**
```
/project-review --domain security
```

**Expected**: Only security review, faster execution

---

## Test Command 4: `/ship`

### Prerequisites

1. **Clean working directory**:
```bash
git status  # Should be clean
```

2. **On a feature branch**:
```bash
git checkout -b feature/test-ship
```

3. **Make some changes**:
```bash
echo "console.log('test');" >> app.js
git add app.js
# Don't commit yet - /ship will do it
```

4. **GitHub CLI authenticated**:
```bash
gh auth status
```

### Test the Command (Dry Run First)

**In Claude Code:**
```
/ship --dry-run
```

**Expected Behavior**:
1. ✅ Shows what would happen
2. ✅ Lists all phases
3. ✅ Shows detected CI/deployment platforms
4. ✅ Does NOT make any changes

**Manual Verification**:
```bash
git log -1  # Should be unchanged
gh pr list  # Should not show new PR
```

### Test the Command (Real Run)

**In Claude Code:**
```
/ship
```

**Expected Behavior**:
1. ✅ Commits current changes
2. ✅ Creates PR
3. ✅ Waits for CI to pass
4. ✅ Runs review agents (code-reviewer, silent-failure-hunter, test-analyzer)
5. ✅ Merges PR after approval
6. ✅ Deploys to development (if multi-branch)
7. ✅ Validates deployment
8. ✅ Deploys to production (if multi-branch)
9. ✅ Provides completion report with URLs

**Manual Verification**:
```bash
# Check commit was created
git log -1

# Check PR was created
gh pr list

# Check PR was merged
gh pr view <number>

# Check branch is on main
git branch --show-current  # Should be "main"
```

---

## Common Issues & Troubleshooting

### Issue: "GitHub CLI not found"

**Solution**:
```bash
# Install GitHub CLI
# macOS:
brew install gh

# Windows:
winget install GitHub.cli

# Then authenticate:
gh auth login
```

### Issue: "Module not found" errors

**Solution**:
```bash
# Make sure you're running from correct directory
cd /path/to/awsome-slash

# Or use absolute paths
node /full/path/to/awsome-slash/lib/platform/detect-platform.js
```

### Issue: Commands don't work in Claude Code

**Solution**:
1. Check plugin is installed correctly
2. Restart Claude Code
3. Check Claude Code logs for errors
4. Verify you're in a git repository: `git status`

### Issue: "No issues found" in /next-task

**Solution**:
```bash
# Create some test issues
gh issue create --title "Test issue" --body "Test description"
```

### Issue: CI not detected

**Solution**:
```bash
# Make sure you have CI config files
ls -la .github/workflows/  # For GitHub Actions
ls -la .gitlab-ci.yml      # For GitLab CI
ls -la .circleci/config.yml # For CircleCI
```

---

## Validation Checklist

After testing all commands, verify:

- [ ] ✅ Platform detection works on your project
- [ ] ✅ Tool verification shows correct tools
- [ ] ✅ `/deslop-around` finds and fixes slop
- [ ] ✅ `/next-task` lists prioritized tasks
- [ ] ✅ `/project-review` finds real issues
- [ ] ✅ `/ship` creates PR and merges successfully
- [ ] ✅ All commands respect your project structure
- [ ] ✅ All commands handle errors gracefully
- [ ] ✅ No false positives in detection/review

---

## Advanced Testing

### Test on Different Project Types

1. **Node.js/React project**:
```bash
cd ~/react-app
/project-review
```

2. **Python/Django project**:
```bash
cd ~/django-app
/deslop-around
```

3. **Rust project**:
```bash
cd ~/rust-app
/next-task
```

4. **Go project**:
```bash
cd ~/go-app
/ship
```

### Test with Different CI Platforms

1. **GitHub Actions**: Test in repo with `.github/workflows/`
2. **GitLab CI**: Test in repo with `.gitlab-ci.yml`
3. **CircleCI**: Test in repo with `.circleci/config.yml`

### Test Multi-Branch Workflow

```bash
# Create stable branch
git checkout -b stable
git push -u origin stable

# Create railway.json with multi-env
cat > railway.json << 'EOF'
{
  "environments": {
    "development": { "branch": "main" },
    "production": { "branch": "stable" }
  }
}
EOF

git add railway.json
git commit -m "Add multi-env config"
git checkout main

# Now test /ship - should detect multi-branch
/ship
```

---

## Performance Testing

### Measure Detection Speed

```bash
time node lib/platform/detect-platform.js
# Should be < 100ms

time node lib/platform/verify-tools.js
# Should be < 200ms
```

### Measure Command Execution

Track time for each command:
- `/deslop-around`: ~30-60 seconds (depending on repo size)
- `/next-task`: ~10-30 minutes (full workflow with review)
- `/project-review`: ~2-5 minutes (depending on repo size and issues found)
- `/ship`: ~5-15 minutes (including CI wait time)

---

## Reporting Issues

If you find bugs during manual testing:

1. **Check logs**:
```bash
# Claude Code logs location
~/.claude/logs/
```

2. **Gather information**:
   - Command used
   - Expected behavior
   - Actual behavior
   - Error messages
   - Project type
   - OS and versions

3. **Report on GitHub**:
```bash
gh issue create --repo avifenesh/awsome-slash \
  --title "Bug: Command X failed with Y" \
  --body "Detailed description here"
```

---

## Success Criteria

Your manual testing is successful if:

✅ All 5 commands execute without errors
✅ Platform detection is accurate for your project
✅ Slop detection finds real issues (not false positives)
✅ Task prioritization makes sense
✅ Code review finds legitimate issues
✅ PR workflow completes end-to-end
✅ No data loss or corruption
✅ Commands adapt to your project structure

---

**Happy Testing!** 🚀

If you encounter any issues or have questions, open an issue on GitHub.
