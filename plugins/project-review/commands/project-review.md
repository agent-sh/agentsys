---
description: Multi-agent code review with iterative improvement
argument-hint: "[scope] [--recent] [--domain AGENT] [--quick] [--create-tech-debt]"
---

# /project-review - Multi-Agent Code Review

Comprehensive code review using specialized AI agents with iterative improvement until zero issues remain.

## Arguments

Parse from $ARGUMENTS:
- **Scope**: Path to review (default: `.`) or `--recent` (last 5 commits only)
- **--domain AGENT**: Review with specific agent only (e.g., `--domain security`)
- **--quick**: Single pass, no iteration (fast feedback)
- **--create-tech-debt**: Force create/update TECHNICAL_DEBT.md

## Pre-Context: Platform & Tech Stack Detection

```bash
# Detect platform and project type
PLATFORM=$(node ${CLAUDE_PLUGIN_ROOT}/lib/platform/detect-platform.js)
TOOLS=$(node ${CLAUDE_PLUGIN_ROOT}/lib/platform/verify-tools.js)

# Extract platform info
PROJECT_TYPE=$(echo $PLATFORM | jq -r '.projectType')
PACKAGE_MGR=$(echo $PLATFORM | jq -r '.packageManager')
HAS_TECH_DEBT=$(echo $PLATFORM | jq -r '.hasTechDebtFile')

# Detect framework for specialized patterns
FRAMEWORK="unknown"
if [ "$PROJECT_TYPE" = "nodejs" ]; then
  if jq -e '.dependencies.react' package.json > /dev/null 2>&1; then
    FRAMEWORK="react"
  elif jq -e '.dependencies.vue' package.json > /dev/null 2>&1; then
    FRAMEWORK="vue"
  elif jq -e '.dependencies."@angular/core"' package.json > /dev/null 2>&1; then
    FRAMEWORK="angular"
  elif jq -e '.dependencies.express' package.json > /dev/null 2>&1; then
    FRAMEWORK="express"
  fi
elif [ "$PROJECT_TYPE" = "python" ]; then
  if grep -q "django" requirements.txt 2>/dev/null || grep -q "django" pyproject.toml 2>/dev/null; then
    FRAMEWORK="django"
  elif grep -q "fastapi" requirements.txt 2>/dev/null || grep -q "fastapi" pyproject.toml 2>/dev/null; then
    FRAMEWORK="fastapi"
  fi
elif [ "$PROJECT_TYPE" = "rust" ]; then
  FRAMEWORK="rust"
elif [ "$PROJECT_TYPE" = "go" ]; then
  FRAMEWORK="go"
fi

# Determine test command
TEST_CMD="echo 'No tests configured'"
if [ "$PROJECT_TYPE" = "nodejs" ]; then
  if jq -e '.scripts.test' package.json > /dev/null 2>&1; then
    TEST_CMD="${PACKAGE_MGR} test"
  fi
elif [ "$PROJECT_TYPE" = "python" ]; then
  if command -v pytest >/dev/null 2>&1; then
    TEST_CMD="pytest"
  fi
elif [ "$PROJECT_TYPE" = "rust" ]; then
  TEST_CMD="cargo test"
elif [ "$PROJECT_TYPE" = "go" ]; then
  TEST_CMD="go test ./..."
fi

# Determine lint command
LINT_CMD=""
if [ "$PROJECT_TYPE" = "nodejs" ]; then
  if jq -e '.scripts.lint' package.json > /dev/null 2>&1; then
    LINT_CMD="${PACKAGE_MGR} run lint"
  elif [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
    LINT_CMD="npx eslint ."
  fi
elif [ "$PROJECT_TYPE" = "python" ]; then
  if command -v ruff >/dev/null 2>&1; then
    LINT_CMD="ruff check ."
  elif command -v pylint >/dev/null 2>&1; then
    LINT_CMD="pylint **/*.py"
  fi
elif [ "$PROJECT_TYPE" = "rust" ]; then
  LINT_CMD="cargo clippy"
elif [ "$PROJECT_TYPE" = "go" ]; then
  LINT_CMD="go vet ./..."
fi

# Determine build command
BUILD_CMD=""
if [ "$PROJECT_TYPE" = "nodejs" ]; then
  if jq -e '.scripts.build' package.json > /dev/null 2>&1; then
    BUILD_CMD="${PACKAGE_MGR} run build"
  fi
elif [ "$PROJECT_TYPE" = "rust" ]; then
  BUILD_CMD="cargo build"
elif [ "$PROJECT_TYPE" = "go" ]; then
  BUILD_CMD="go build ./..."
fi
```

## Phase 1: Context Gathering + Agent Specialization

### Gather Context

```bash
# Count files for complexity assessment
FILE_COUNT=$(git ls-files | wc -l)

# Check for test files
TEST_FILES=$(git ls-files | grep -E '(test|spec)\.' | wc -l)
HAS_TESTS=$( [ "$TEST_FILES" -gt 0 ] && echo "true" || echo "false" )

# Check for database indicators
HAS_DB="false"
if grep -rq -E "(Sequelize|Prisma|TypeORM|SQLAlchemy|diesel)" . 2>/dev/null; then
  HAS_DB="true"
fi

# Check for API indicators
HAS_API="false"
if grep -rq -E "(express|fastify|axum|gin|chi|@nestjs)" . 2>/dev/null; then
  HAS_API="true"
fi

# Check for CI/CD
HAS_CICD="false"
if [ -d ".github/workflows" ] || [ -f ".gitlab-ci.yml" ] || [ -f ".circleci/config.yml" ]; then
  HAS_CICD="true"
fi
```

### Specialize Agents

Based on detection, activate specialized agents:

**Always Active:**
- `security-expert`: Security vulnerabilities, authentication, authorization, input validation
- `performance-engineer`: Performance bottlenecks, inefficient algorithms, memory leaks

**Conditionally Active:**
- `test-quality-guardian`: Test coverage, test quality, edge cases (if `HAS_TESTS=true`)
- `architecture-reviewer`: Design patterns, code organization, modularity (if `FILE_COUNT > 50`)
- `database-specialist`: Query optimization, N+1 queries, indexes (if `HAS_DB=true`)
- `api-designer`: REST/GraphQL best practices, error handling, versioning (if `HAS_API=true`)
- `frontend-specialist`: Component design, state management, performance (if React/Vue/Angular)
- `devops-reviewer`: CI/CD configuration, deployment, containers (if `HAS_CICD=true`)

**Single Domain Mode:**
If `--domain` specified, activate only that agent.

### Load Framework Patterns

```javascript
// Load review patterns from library
const patterns = require(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/patterns/review-patterns.js`);
const frameworkPatterns = patterns.getPatternsForFramework(FRAMEWORK);

// Pass patterns to agents for specialized review
```

### Output Specialization Summary

```markdown
## Review Configuration

**Project Type**: ${PROJECT_TYPE}
**Framework**: ${FRAMEWORK}
**Files**: ${FILE_COUNT}
**Tests**: ${TEST_FILES} test files

**Active Agents**:
- security-expert (always)
- performance-engineer (always)
- test-quality-guardian (${HAS_TESTS})
- architecture-reviewer (${FILE_COUNT > 50})
- database-specialist (${HAS_DB})
- api-designer (${HAS_API})
- frontend-specialist (${FRAMEWORK in [react,vue,angular]})
- devops-reviewer (${HAS_CICD})

**Framework Patterns Loaded**: ${FRAMEWORK}
```

## Phase 2: Multi-Agent Review (Round 1)

### Review Protocol

Each active agent performs independent review:

1. **File Filtering**: Only review files relevant to agent domain
   - security-expert: Auth, validation, API endpoints, config
   - performance-engineer: Hot paths, algorithms, loops, queries
   - test-quality-guardian: Test files only
   - architecture-reviewer: All source files
   - database-specialist: Models, queries, migrations
   - api-designer: API routes, controllers, handlers
   - frontend-specialist: Components, state management
   - devops-reviewer: CI/CD configs, Dockerfiles, deploy scripts

2. **Pattern Matching**: Apply framework-specific patterns
   ```javascript
   // Example for React frontend-specialist
   if (FRAMEWORK === 'react' && frameworkPatterns) {
     // Check hooks_rules patterns
     // Check state_management patterns
     // Check performance patterns
   }
   ```

3. **Evidence-Based Findings**: Every finding MUST include:
   - **File:Line**: Exact location (e.g., `src/auth/session.ts:42`)
   - **Severity**: critical | high | medium | low
   - **Category**: From agent domain (e.g., "Security: SQL Injection")
   - **Description**: What's wrong and why it matters
   - **Code Quote**: 1-3 lines showing the issue
   - **Suggested Fix**: Specific remediation
   - **Effort Estimate**: small | medium | large

### Example Finding Format

```markdown
### Finding: Unsafe SQL Query
**Agent**: security-expert
**File**: src/api/users.ts:87
**Severity**: critical
**Category**: Security: SQL Injection
**Code**:
```typescript
const query = `SELECT * FROM users WHERE id = ${userId}`;
db.execute(query);
```
**Issue**: Raw SQL concatenation allows SQL injection attacks.
**Fix**: Use parameterized queries:
```typescript
const query = 'SELECT * FROM users WHERE id = ?';
db.execute(query, [userId]);
```
**Effort**: small (5 min)
```

### Multi-Agent Coordination

Use Task tool to launch agents in parallel:

```javascript
// Launch all active agents concurrently
const agents = [];

agents.push(Task({
  subagent_type: "Explore",
  prompt: `You are security-expert. Review ${SCOPE} for security issues. Framework: ${FRAMEWORK}. Apply patterns: ${frameworkPatterns?.security}. Provide findings in evidence-based format.`
}));

agents.push(Task({
  subagent_type: "Explore",
  prompt: `You are performance-engineer. Review ${SCOPE} for performance issues. Framework: ${FRAMEWORK}. Apply patterns: ${frameworkPatterns?.performance}. Provide findings.`
}));

if (HAS_TESTS) {
  agents.push(Task({
    subagent_type: "Explore",
    prompt: `You are test-quality-guardian. Review test files for quality issues. Framework: ${FRAMEWORK}. Check coverage, edge cases, test design.`
  }));
}

// ... launch other conditional agents

// Wait for all agents to complete
// Aggregate findings
```

### Consolidate Findings

After all agents complete:
1. Deduplicate (same file:line from multiple agents)
2. Sort by severity (critical → high → medium → low)
3. Group by file
4. Count total issues per severity

## Phase 3: Tech Debt Documentation

### Check Existing Documentation

```bash
if [ "$HAS_TECH_DEBT" = "true" ]; then
  echo "TECHNICAL_DEBT.md exists, will update"
else
  if [ "$CREATE_TECH_DEBT" = "true" ]; then
    echo "Creating TECHNICAL_DEBT.md"
  else
    # Ask user if they want to create it
    echo "No TECHNICAL_DEBT.md found. Create one?"
  fi
fi
```

### Tech Debt Document Format

```markdown
# Technical Debt

Last updated: $(date -I)
Review by: /project-review

## Summary

**Total Issues**: X
- Critical: Y
- High: Z
- Medium: A
- Low: B

**Estimated Total Effort**: N hours

## Critical Issues (Must Fix)

### [Security] SQL Injection in User API
**File**: src/api/users.ts:87
**Severity**: critical
**Effort**: 5 min
**Description**: Raw SQL concatenation allows injection attacks.
**Fix**: Use parameterized queries.

---

## High Priority

[... grouped by severity]

## Medium Priority

[... grouped by severity]

## Low Priority

[... grouped by severity]

---

## Progress Tracking

- [ ] Issue 1
- [ ] Issue 2
...
```

### Update Strategy

If TECHNICAL_DEBT.md exists:
- Preserve existing issues not found in this review
- Update issues that changed
- Add new issues
- Mark fixed issues as completed (strikethrough)

## Phase 4: Automated Fixes (Round 1)

### Fix Strategy

For each finding, attempt fix:

1. **Auto-fixable** (lint rules, formatting, simple patterns):
   - Use Edit tool to apply fix
   - No user confirmation needed
   - Track as "auto-fixed"

2. **Manual fix** (code logic changes):
   - Use Edit tool to implement suggested fix
   - Explain change clearly
   - Track as "fixed"

3. **Design decision required**:
   - Document in TECHNICAL_DEBT.md
   - Mark as "needs decision"
   - Skip for now

4. **False positive**:
   - Agent validates finding
   - If invalid, remove from list
   - Track as "false positive"

### Fix Prioritization

Fix in order:
1. Critical severity first
2. Then by effort (small → large)
3. Then by file (batch fixes in same file)

### Fix Tracking

```markdown
## Fix Progress

**Round 1**:
- Auto-fixed: X issues
- Manually fixed: Y issues
- Needs decision: Z issues
- False positives: A issues
- Remaining: B issues
```

### Stop Conditions

Stop fixing in Round 1 if:
- All issues fixed
- All remaining issues need design decisions
- 30+ fixes applied (prevent over-fixing)
- Verification fails repeatedly

## Phase 5: Verification + Re-Review

### Run Verification Suite

```bash
# Run tests
if [ -n "$TEST_CMD" ]; then
  echo "Running tests..."
  $TEST_CMD
  TEST_STATUS=$?
else
  echo "No test command available, skipping tests"
  TEST_STATUS=0
fi

# Run linter
if [ -n "$LINT_CMD" ]; then
  echo "Running linter..."
  $LINT_CMD
  LINT_STATUS=$?
else
  echo "No lint command available, skipping linter"
  LINT_STATUS=0
fi

# Run build
if [ -n "$BUILD_CMD" ]; then
  echo "Running build..."
  $BUILD_CMD
  BUILD_STATUS=$?
else
  echo "No build command available, skipping build"
  BUILD_STATUS=0
fi

# Overall verification status
if [ $TEST_STATUS -eq 0 ] && [ $LINT_STATUS -eq 0 ] && [ $BUILD_STATUS -eq 0 ]; then
  VERIFICATION_PASSED="true"
else
  VERIFICATION_PASSED="false"
fi
```

### Handle Verification Failures

If verification fails:
1. Review recent changes (git diff)
2. Identify which fix broke verification
3. Rollback problematic fix: `git restore <file>`
4. Document as "fix caused regression"
5. Continue with remaining fixes

### Re-Review Changed Areas

After fixes applied and verification passed:

1. **Identify Changed Files**:
   ```bash
   CHANGED_FILES=$(git diff --name-only)
   ```

2. **Re-Run Relevant Agents**:
   - Only agents whose domain includes changed files
   - Focus review on changed lines ± 10 lines context

3. **Check for New Issues**:
   - Fixes sometimes introduce new problems
   - Compare new findings to original list
   - Categorize: regression issues vs pre-existing

### Re-Review Output

```markdown
## Re-Review Results (Round 1)

**Changed Files**: X files
**New Issues Found**: Y issues
- Regressions (introduced by fixes): A
- Pre-existing (missed in Round 1): B

**Verification Status**:
- Tests: ✓ Passed / ✗ Failed
- Linter: ✓ Passed / ✗ Failed
- Build: ✓ Passed / ✗ Failed
```

## Phase 6: Iteration Until Zero Issues

### Iteration Logic

```javascript
const MAX_ITERATIONS = 5;
let iteration = 1;
let remainingIssues = [...initialFindings];
let progressHistory = [];

while (iteration <= MAX_ITERATIONS) {
  console.log(`\n## Iteration ${iteration}`);

  // Apply fixes
  const fixResult = applyFixes(remainingIssues);

  // Verify
  const verifyResult = runVerification();
  if (!verifyResult.passed) {
    console.log("Verification failed, rolling back problematic fixes");
    rollbackFailed(fixResult);
  }

  // Re-review
  const reReviewResult = reReview(fixResult.changedFiles);
  remainingIssues = reReviewResult.issues;

  // Track progress
  progressHistory.push({
    iteration,
    fixed: fixResult.fixedCount,
    remaining: remainingIssues.length
  });

  // Termination conditions
  if (remainingIssues.length === 0) {
    console.log("✓ Zero issues remaining, review complete!");
    break;
  }

  // Check for no progress in last 2 iterations
  if (iteration >= 3) {
    const lastTwo = progressHistory.slice(-2);
    if (lastTwo[0].remaining === lastTwo[1].remaining) {
      console.log("No progress in last 2 iterations, stopping");
      break;
    }
  }

  iteration++;
}
```

### Quick Mode

If `--quick` flag provided:
- Skip iteration
- Single pass only
- Provide findings without fixes
- Fast feedback mode

### Iteration Output

```markdown
## Iteration ${N} Summary

**Fixed This Round**: X issues
**Remaining Issues**: Y issues
**Verification**: ✓ Passed / ✗ Failed

**Progress**:
- Round 1: 45 → 30 issues (-15)
- Round 2: 30 → 12 issues (-18)
- Round 3: 12 → 3 issues (-9)
- Round 4: 3 → 0 issues (-3) ✓
```

## Phase 7: Completion Report

### Generate Comprehensive Report

```markdown
# Project Review Complete

**Review Scope**: ${SCOPE}
**Framework**: ${FRAMEWORK}
**Iterations**: ${iteration}
**Duration**: ${duration}

## Summary

**Issues Found**: ${initialCount}
**Issues Fixed**: ${fixedCount}
**Issues Remaining**: ${remainingCount}

**By Severity**:
- Critical: ${criticalFound} → ${criticalFixed} (${criticalRemaining} remaining)
- High: ${highFound} → ${highFixed} (${highRemaining} remaining)
- Medium: ${mediumFound} → ${mediumFixed} (${mediumRemaining} remaining)
- Low: ${lowFound} → ${lowFixed} (${lowRemaining} remaining)

## Agent Performance

### security-expert
- Issues found: X
- Issues fixed: Y
- Top finding: [Description]

### performance-engineer
- Issues found: X
- Issues fixed: Y
- Top finding: [Description]

[... per agent]

## Code Quality Metrics

**Before Review**:
- Test Coverage: X% (if available)
- Lint Warnings: X
- Build Status: ✓/✗

**After Review**:
- Test Coverage: Y% (△ +Z%)
- Lint Warnings: Y (△ -Z)
- Build Status: ✓

## Verification Results

- Tests: ✓ Passed (X tests, Y assertions)
- Linter: ✓ Passed (0 errors, 0 warnings)
- Build: ✓ Passed

## Files Changed

${FILE_COUNT} files modified:
- src/api/users.ts: 3 fixes
- src/auth/session.ts: 2 fixes
- tests/auth.test.ts: 1 fix
[... top 10 files]

## Remaining Issues

${remainingCount} issues need attention:

### Critical Issues
[List of critical issues that couldn't be auto-fixed]

### Design Decisions Required
[Issues that need architectural decisions]

## Technical Debt

${HAS_TECH_DEBT ? "Updated" : "Created"} TECHNICAL_DEBT.md with ${remainingCount} tracked issues.

## Recommendations

1. [Recommendation based on findings]
2. [Recommendation based on findings]
3. [Recommendation based on findings]

## Next Steps

- [ ] Review remaining issues in TECHNICAL_DEBT.md
- [ ] Make design decisions for complex issues
- [ ] Re-run /project-review after architectural changes
- [ ] Consider adding framework-specific linting rules
```

### Success Criteria

Review is successful if:
- ✓ All agents completed review
- ✓ Findings are evidence-based (file:line provided)
- ✓ Critical issues are fixed or documented
- ✓ Verification passes (tests, lint, build)
- ✓ TECHNICAL_DEBT.md updated (if enabled)
- ✓ Completion report generated

### Exit Conditions

Exit with success if:
- Zero issues remaining
- All remaining issues documented in tech debt
- Max iterations reached with progress made
- Quick mode completed

Exit with warning if:
- Verification fails after fixes
- No progress in last 2 iterations
- Too many false positives (>50% of findings)

## Error Handling

### No Framework Detected
```markdown
Framework detection failed, using generic code review patterns.
Review will focus on universal best practices.
```

### No Tests Available
```markdown
No test suite detected. Skipping test-quality-guardian agent.
Consider adding tests for better code quality assurance.
```

### Verification Command Not Found
```markdown
No test/lint/build commands configured.
Fixes applied without verification - manual testing recommended.
```

### All Agents Failed
```markdown
ERROR: All review agents failed to complete.

Possible causes:
1. Scope too large (try --recent or specific path)
2. File encoding issues
3. No source files found

Recommendation: Review scope and try again with smaller scope.
```

## Usage Examples

```bash
# Full review with iteration
/project-review

# Review recent commits only (faster)
/project-review --recent

# Review specific path
/project-review src/api

# Security audit only
/project-review --domain security

# Quick feedback (no fixes)
/project-review --quick

# Full review with tech debt tracking
/project-review --create-tech-debt

# Review recent commits in specific domain
/project-review --recent --domain performance
```

## Context Efficiency

Use context optimizer for git operations:

```bash
# Efficient file listing
git ls-files | head -100

# Recent commits only
git log --oneline --no-decorate -10 --format="%h %s"

# Changed files in last N commits
git diff HEAD~5..HEAD --name-only | head -50

# Blame specific line (for age checking)
git blame -L ${line},${line} ${file} --porcelain | grep '^committer-time' | cut -d' ' -f2
```

## Important Notes

- Framework patterns from `lib/patterns/review-patterns.js`
- Platform detection from `lib/platform/detect-platform.js`
- Tool verification from `lib/platform/verify-tools.js`
- All findings must be evidence-based (no speculation)
- Prefer automated fixes over manual intervention
- Document design decisions in TECHNICAL_DEBT.md
- Respect project conventions (check CLAUDE.md if exists)
- Minimal diffs (don't reformat unrelated code)

## Success Metrics

- ✅ Specialized agents per tech stack
- ✅ Framework-specific patterns applied
- ✅ Evidence-based findings only (file:line required)
- ✅ Iterative improvement with verification
- ✅ Optional tech debt tracking
- ✅ Graceful degradation without tests/linter

## Phase 8: GitHub Issue Creation & Cleanup

### Check for GitHub Repository

After completing all fixes and generating the completion report, check if this is a GitHub repository with `git` and `gh` available:

```bash
# Check if git and gh are available
GIT_AVAILABLE=$(command -v git >/dev/null 2>&1 && echo "true" || echo "false")
GH_AVAILABLE=$(command -v gh >/dev/null 2>&1 && echo "true" || echo "false")

# Check if this is a git repo with a GitHub remote
IS_GITHUB_REPO="false"
if [ "$GIT_AVAILABLE" = "true" ]; then
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
  if echo "$REMOTE_URL" | grep -q "github.com"; then
    IS_GITHUB_REPO="true"
  fi
fi
```

### Create GitHub Issues for Deferred Items

If `git` and `gh` are available and this is a GitHub repository, create issues for all **non-security** deferred items:

```bash
if [ "$GH_AVAILABLE" = "true" ] && [ "$IS_GITHUB_REPO" = "true" ]; then
  echo "Creating GitHub issues for deferred items..."

  # For each non-security deferred issue, create a GitHub issue
  # DO NOT create public issues for security-sensitive findings
  # Security issues should remain internal/private

  for issue in "${DEFERRED_NON_SECURITY_ISSUES[@]}"; do
    gh issue create \
      --title "${issue.title}" \
      --body "${issue.body}"
  done

  echo "Created ${#DEFERRED_NON_SECURITY_ISSUES[@]} GitHub issues"
fi
```

### Issue Format

Each created issue should include:

```markdown
## Issue from /project-review

**Severity**: [Critical|High|Medium|Low]
**Category**: [Performance|Architecture|Code Quality|Enhancement]
**Effort**: [Small|Medium|Large] (~X hours)

### Description
[Description of the issue]

### Current Behavior
\`\`\`[language]
[Code showing the problem]
\`\`\`

### Proposed Fix
[Specific remediation approach]

### Impact
[Why this matters]

### Files
- [List of affected files]
```

### Security Issue Handling

**IMPORTANT**: Security-sensitive issues must NOT be created as public GitHub issues. These include:
- Token/credential exposure
- Authentication vulnerabilities
- Authorization bypasses
- Injection vulnerabilities
- Any finding from the security-expert agent that could be exploited

For security issues:
1. Keep them documented internally only
2. Fix them immediately if possible
3. If they require design decisions, note them in the completion report but do not create public issues

### Cleanup: Remove TECHNICAL_DEBT.md

After all issues are either:
- Fixed, OR
- Deferred to GitHub issues, OR
- Documented as security-sensitive (internal only)

**Remove the TECHNICAL_DEBT.md file** to avoid duplication with GitHub issue tracker:

```bash
if [ "$GH_AVAILABLE" = "true" ] && [ "$IS_GITHUB_REPO" = "true" ]; then
  # All non-security issues are now in GitHub
  if [ -f "TECHNICAL_DEBT.md" ]; then
    rm TECHNICAL_DEBT.md
    git add TECHNICAL_DEBT.md
    git commit -m "chore: remove TECHNICAL_DEBT.md - issues tracked in GitHub

Created GitHub issues for all deferred non-security items.
Security-sensitive issues kept internal."
    echo "Removed TECHNICAL_DEBT.md - all issues now tracked in GitHub"
  fi
else
  # Keep TECHNICAL_DEBT.md if no GitHub integration
  echo "TECHNICAL_DEBT.md retained - no GitHub integration available"
fi
```

### Cleanup Conditions

Remove TECHNICAL_DEBT.md when ALL of the following are true:
1. `git` is available
2. `gh` CLI is available and authenticated
3. Repository has a GitHub remote
4. All non-security deferred issues have been created as GitHub issues
5. No additional manual tasks remain

Keep TECHNICAL_DEBT.md when ANY of the following are true:
1. No GitHub integration available
2. `gh` CLI not authenticated
3. User explicitly requested `--create-tech-debt` flag
4. Security issues exist that cannot be tracked publicly

### Final Commit

If issues were created and TECHNICAL_DEBT.md was removed:

```bash
git add -A
git commit -m "chore: project-review complete - issues tracked in GitHub

Created X GitHub issues for deferred items:
- #N: [issue title]
- #N: [issue title]
...

Security-sensitive issues (Y total) kept internal.
Fixed Z issues in this review session."
```

Begin Phase 1 now.
