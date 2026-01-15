---
description: Intelligent task prioritization with code validation
argument-hint: "[filter] [--include-blocked] [--implement]"
---

# /next-task - Intelligent Task Prioritization

Discover what to work on next with AI-powered task analysis and code validation.

## ⚠️ WORKFLOW ENFORCEMENT (READ FIRST)

When a user selects a task (via `--implement` or interactively), this skill triggers an **auto-performing workflow** that runs to completion. This is NOT a research task or regular conversation - it is a **complete implementation pipeline** identical to directly invoking `/ship`.

**Required workflow when task is selected:**
1. Create isolated worktree
2. Implement the fix/feature automatically
3. Run multi-agent review (3 agents, max 3 iterations)
4. Invoke `/ship` for full PR workflow (all 12 phases)
5. Monitor PR for comments, auto-iterate
6. Clean up after merge

**The agent must continue autonomously until PR is merged or explicitly cancelled.**

## Arguments

Parse from $ARGUMENTS:
- **Filter**: `bug`, `feature`, `test`, `security`, etc. (optional)
- **--include-blocked**: Show blocked tasks (default: hide)
- **--implement**: Start implementation after selection (default: recommend only)

## Pre-Context: Platform & Tool Detection

```bash
# Detect platform
PLATFORM=$(node ${CLAUDE_PLUGIN_ROOT}/lib/platform/detect-platform.js)
TOOLS=$(node ${CLAUDE_PLUGIN_ROOT}/lib/platform/verify-tools.js)

# Check required tools
GH_AVAILABLE=$(echo $TOOLS | jq -r '.gh.available')
if [ "$GH_AVAILABLE" != "true" ]; then
  echo "ERROR: GitHub CLI (gh) required. Install: https://cli.github.com"
  exit 1
fi

# Check optional integrations
HAS_PLAN=$(echo $PLATFORM | jq -r '.hasPlanFile')

# Try to detect Linear integration
LINEAR_DETECTED="false"
if gh issue list --json body --limit 1 | grep -q "linear.app"; then
  LINEAR_DETECTED="true"
fi
```

## Phase 1: Source Discovery

Determine available task sources:

### GitHub Issues (Required)

```bash
gh issue list --state open --json number,title,body,labels,assignees,createdAt --limit 100
```

Store as `GITHUB_ISSUES`.

### Linear Tasks (Optional)

If `LINEAR_DETECTED=true`:
- Parse Linear URLs from GitHub issue bodies
- Extract Linear task IDs
- Note: Full Linear API requires Linear MCP (future enhancement)

### PLAN.md (Optional)

If `HAS_PLAN=true`:
```bash
cat PLAN.md
```

Parse TODO sections, extract tasks, match with GitHub issues by title similarity.

### Output Source Summary

```markdown
## Available Sources
- GitHub Issues: X open issues
- Linear: Y tasks detected (via GitHub issue links)
- PLAN.md: Z tasks found

Proceeding with available sources...
```

## Phase 2: Task Collection

### Fetch from GitHub Issues

Extract from `GITHUB_ISSUES`:
- Number, title, body
- Labels (priority, status, type, area)
- Assignees
- Created date (for age calculation)

### Deduplicate

If same task appears in multiple sources:
- Use GitHub as source of truth for status
- Note Linear ID if present
- Mark PLAN.md tasks as "also in PLAN.md"

### Apply Filters

If filter provided:
- `bug`: Filter to issues with "bug" label
- `feature`: Filter to "enhancement" or "feature" labels
- `test`: Filter to "test" or "testing" labels
- `security`: Filter to "security" label
- `[custom]`: Filter to issues with matching label

If `--include-blocked` NOT provided:
- Exclude issues with "blocked" status
- Exclude issues with "waiting" label

## Phase 3: Code Validation (CRITICAL!)

For each task, verify it's not already implemented:

### Search Strategy

```bash
# Extract keywords from task title
TASK_TITLE="Add login page"
KEYWORDS="login page LoginPage"

# Search codebase
FOUND=$(rg -l "$KEYWORDS" --type ts --type tsx --type js --type jsx --max-count 1 2>/dev/null)

if [ -n "$FOUND" ]; then
  TASK_STATUS="appears-done"
  TASK_EVIDENCE="Found: $FOUND"
else
  TASK_STATUS="not-started"
  TASK_EVIDENCE="No implementation found"
fi
```

### Validation Checks

For each task:
1. Extract main keywords from title
2. Search for component/file names
3. Search for function names
4. Check test files
5. Categorize:
   - **Verified Pending**: No code found
   - **Appears Done**: Implementation found with evidence
   - **Partially Done**: Implementation exists but incomplete (e.g., no tests)

### Filter Out Completed

Remove tasks where `TASK_STATUS="appears-done"` with high confidence.

Keep tasks marked "partially-done" but note what's missing.

## Phase 4: Context-Aware Prioritization

Score each remaining task:

### Scoring Algorithm

```javascript
function scoreTask(task) {
  let score = 0;

  // 1. Explicit Priority (from labels)
  if (task.labels.includes('priority/critical') || task.labels.includes('P0')) score += 100;
  if (task.labels.includes('priority/high') || task.labels.includes('P1')) score += 50;
  if (task.labels.includes('priority/medium') || task.labels.includes('P2')) score += 25;

  // 2. Blockers (dependencies)
  if (task.body.match(/blocks #\d+/i)) score += 30;

  // 3. Effort Estimate (prefer quick wins)
  if (task.labels.includes('effort/small')) score += 20;
  if (task.labels.includes('effort/medium')) score += 10;
  if (task.labels.includes('effort/large')) score -= 10;

  // 4. Relation to Recent Work
  const recentFiles = execSync('git diff HEAD~10..HEAD --name-only').toString();
  const taskKeywords = extractKeywords(task.title);
  if (taskKeywords.some(k => recentFiles.includes(k))) score += 15;

  // 5. Age (older = higher priority for bugs)
  const ageInDays = (Date.now() - new Date(task.createdAt)) / (1000 * 60 * 60 * 24);
  if (task.labels.includes('bug') && ageInDays > 30) score += 10;

  // 6. Impact (affects many users)
  if (task.labels.includes('impact/high')) score += 25;

  return score;
}
```

### Sort by Score

```bash
# Sort tasks by calculated score (descending)
# Keep top 10 for detailed analysis
```

## Phase 5: Recommendation with Rationale

Present top 5 tasks:

### Recommendation Format

```markdown
## Top Priority Tasks

### 1. [P1] Fix authentication timeout bug (#142)
**Source**: GitHub Issue #142
**Status**: Verified Pending (no fix found in codebase)
**Priority Score**: 85 (high priority + bug + old + blocking)
**Effort**: Small (labeled effort/small)
**Why Now**:
  - Blocking #145 and #147
  - Reported 45 days ago
  - Related to recent auth work in src/auth/
  - Affects production users (impact/high label)
**Related Files**:
  - src/auth/session.ts (likely location based on description)
  - tests/auth/session.test.ts (needs test)
**Dependencies**: None

---

### 2. [P2] Add dark mode toggle to settings (#89)
**Source**: GitHub Issue #89, also in PLAN.md
**Status**: Partially Done (found Settings component, no dark mode code)
**Priority Score**: 60 (medium priority + feature + recent work in settings/)
**Effort**: Medium (labeled effort/medium)
**Why Now**:
  - Recent work in src/components/Settings.tsx
  - User-requested feature (10 👍 reactions)
  - No blockers
**Related Files**:
  - src/components/Settings.tsx (add toggle)
  - src/hooks/useTheme.ts (create new hook)
  - src/styles/theme.ts (add dark theme)
**Dependencies**: None

---

[Continue for top 5...]
```

### Include Context

For each task:
- Evidence from code search
- Why it ranks highly
- What files will likely change
- Dependencies that must be done first
- Estimated complexity

## Phase 6: Auto-Performing Implementation Workflow

**CRITICAL**: When a task is selected (via `--implement` or user selection), this phase executes automatically like a direct `/ship` invocation. The agent MUST NOT drop into "regular session mode" - it must execute the full workflow end-to-end.

If `--implement` flag provided OR user selects a task from recommendations:

### Step 6.1: Prompt User for Selection

```markdown
Select a task to implement (1-5), or 'cancel':
```

Wait for user input. Once selected, the **full workflow runs automatically** without further prompts.

### Step 6.2: Setup Isolated Worktree

**MANDATORY**: Create an isolated worktree for the implementation to avoid polluting the main working directory.

```bash
TASK_NUMBER=142
TASK_SLUG="fix-auth-timeout"
BRANCH_NAME="feature/${TASK_SLUG}"
WORKTREE_PATH="../worktrees/${TASK_SLUG}"

# Create worktree with new branch
git worktree add -b $BRANCH_NAME $WORKTREE_PATH

# Change to worktree
cd $WORKTREE_PATH

echo "✓ Created isolated worktree: $WORKTREE_PATH"
echo "✓ Working on branch: $BRANCH_NAME"
```

### Step 6.3: Generate Implementation Plan

Based on selected task, create a detailed implementation plan:

```markdown
## Implementation Plan: Fix Authentication Timeout Bug (#142)

### Phase A: Investigation
- Read src/auth/session.ts
- Understand timeout logic
- Identify bug location

### Phase B: Implementation
- Update timeout handling
- Add proper error handling
- Update types if needed

### Phase C: Testing
- Add unit test for timeout scenario
- Add integration test
- Verify edge cases

### Phase D: Quality Gates → Ship
- Run tests: npm test
- Run type check: npm run check-types
- Multi-agent review
- Ship to production
```

### Step 6.4: Multi-Agent Implementation (Auto-Executing)

Launch specialized agents **in sequence** - do NOT wait for user input between steps:

#### 6.4.1: Code Exploration Agent

```javascript
Task({
  subagent_type: "Explore",
  prompt: `Thoroughly analyze the codebase for task: ${TASK_TITLE}

  GitHub Issue: #${TASK_NUMBER}
  Description: ${TASK_DESCRIPTION}

  Find:
  - All related files
  - Current implementation patterns
  - Dependencies and imports
  - Test file locations
  - Similar implementations in codebase

  Report findings with file:line references.`
})
```

Wait for completion, then proceed immediately to implementation.

#### 6.4.2: Implementation Agent

Implement the fix/feature directly (no user prompts):
- Read current code
- Implement changes following codebase patterns
- Write/update tests
- Run local tests to verify

```bash
# After implementation, run local tests
if [ "$PROJECT_TYPE" = "nodejs" ]; then
  $PACKAGE_MGR test
elif [ "$PROJECT_TYPE" = "python" ]; then
  pytest
elif [ "$PROJECT_TYPE" = "rust" ]; then
  cargo test
fi

if [ $? -ne 0 ]; then
  echo "Local tests failed - fixing before proceeding..."
  # Auto-fix test failures, then re-run
fi
```

#### 6.4.3: Pre-Ship Quality Gate (Multi-Agent Review)

**MANDATORY GATE**: All agents must approve before shipping.

```javascript
// Launch all 3 review agents in PARALLEL
const reviewResults = await Promise.all([
  Task({
    subagent_type: "pr-review-toolkit:code-reviewer",
    prompt: `Review implementation for task #${TASK_NUMBER}: ${TASK_TITLE}

    Branch: ${BRANCH_NAME}
    Changed files: ${CHANGED_FILES}

    Check for:
    - Code quality and best practices
    - Potential bugs
    - Adherence to project patterns

    Report findings with file:line references.`
  }),

  Task({
    subagent_type: "pr-review-toolkit:silent-failure-hunter",
    prompt: `Review error handling for task #${TASK_NUMBER}

    Check for:
    - Empty catch blocks
    - Swallowed promises
    - Missing error propagation
    - Generic error messages`
  }),

  Task({
    subagent_type: "pr-review-toolkit:pr-test-analyzer",
    prompt: `Review test coverage for task #${TASK_NUMBER}

    Verify:
    - New code has tests
    - Edge cases covered
    - Test quality (not just presence)`
  })
]);
```

### Step 6.5: Review Iteration Loop

**AUTOMATIC ITERATION**: Fix issues and re-review until approved (max 3 iterations).

```javascript
let iteration = 1;
const MAX_ITERATIONS = 3;

while (iteration <= MAX_ITERATIONS) {
  const issues = aggregateAgentFindings(reviewResults);

  if (issues.critical.length === 0 && issues.high.length === 0) {
    console.log("✓ All review agents approved");
    break;
  }

  console.log(`\n## Review Iteration ${iteration}`);
  console.log(`Auto-fixing ${issues.critical.length} critical and ${issues.high.length} high issues...`);

  // Auto-fix issues (no user prompt)
  for (const issue of [...issues.critical, ...issues.high]) {
    await autoFixIssue(issue);
  }

  // Commit fixes
  await exec(`git add . && git commit -m "fix: address review feedback (iteration ${iteration})"`);

  // Re-run review agents
  reviewResults = await reRunAgents();
  iteration++;
}

if (hasRemainingIssues()) {
  console.log("✗ Could not resolve all issues after 3 iterations");
  console.log("Proceeding with remaining medium/low issues noted in PR");
}
```

### Step 6.6: Ship (Invoke Full /ship Workflow)

**MANDATORY**: Once review passes, invoke `/ship` with full 12-phase execution.

```javascript
// This is NOT optional - ship runs automatically
Skill({
  skill: "ship",
  args: "" // Uses default squash strategy
})
```

The `/ship` command will execute ALL 12 phases automatically:
- Phase 1-3: Pre-flight, commit, create PR
- Phase 4: Wait for CI
- Phase 5: Additional review loop (ship has its own)
- Phase 6: Merge PR
- Phase 7-10: Deploy and validate (if multi-branch)
- Phase 11-12: Cleanup and report

### Step 6.7: Wait for PR Comments and Iterate

**AFTER PR IS CREATED**: Monitor for reviewer comments and iterate.

```javascript
const PR_NUMBER = getPRNumber();
let hasOpenComments = true;

while (hasOpenComments) {
  // Check for new comments every 2 minutes
  console.log(`Monitoring PR #${PR_NUMBER} for reviewer comments...`);

  await sleep(120000); // 2 minutes

  const comments = await exec(`gh pr view ${PR_NUMBER} --json comments,reviews`);
  const unresolvedComments = parseUnresolvedComments(comments);

  if (unresolvedComments.length > 0) {
    console.log(`\n## Addressing ${unresolvedComments.length} reviewer comments`);

    for (const comment of unresolvedComments) {
      console.log(`- ${comment.author}: ${comment.body.substring(0, 100)}...`);

      // Auto-address comment
      await addressComment(comment);
    }

    // Commit and push fixes
    await exec(`git add . && git commit -m "fix: address reviewer feedback" && git push`);

    // Reply to comments indicating they're addressed
    for (const comment of unresolvedComments) {
      await exec(`gh pr comment ${PR_NUMBER} --body "Addressed in latest commit"`);
    }
  } else {
    // Check if PR is approved and merged
    const prStatus = await exec(`gh pr view ${PR_NUMBER} --json state,mergedAt`);
    if (prStatus.state === 'MERGED') {
      hasOpenComments = false;
      console.log("✓ PR merged successfully");
    } else if (prStatus.state === 'CLOSED') {
      hasOpenComments = false;
      console.log("✗ PR was closed without merging");
    }
    // If still open with no comments, continue monitoring
  }
}
```

### Step 6.8: Worktree Cleanup

After PR is merged:

```bash
# Return to main working directory
cd $ORIGINAL_DIR

# Remove worktree
git worktree remove $WORKTREE_PATH --force

# Delete local feature branch
git branch -D $BRANCH_NAME 2>/dev/null || true

echo "✓ Cleaned up worktree and branch"
```

### Workflow Enforcement Summary

**When user selects a task, ALL of these happen automatically:**

1. ✅ **Worktree created** - Isolated environment
2. ✅ **Implementation** - Code changes made
3. ✅ **Local tests** - Verified before PR
4. ✅ **Multi-agent review** - 3 agents must approve
5. ✅ **Review iteration** - Auto-fix until approved (max 3x)
6. ✅ **Ship invoked** - Full 12-phase workflow
7. ✅ **PR comment monitoring** - Wait and iterate on feedback
8. ✅ **Worktree cleanup** - After merge

**The agent MUST NOT:**
- ❌ Drop to regular chat mode after selection
- ❌ Ask user what to do next
- ❌ Skip any of the above steps
- ❌ Stop before PR is merged or explicitly cancelled

## Stale/Invalid Task Handling

If code validation finds many "appears-done" tasks:

```markdown
## ⚠️ Stale Tasks Detected

The following tasks appear to be completed but are still open:

1. **#89 - Add login page**: Found LoginPage.tsx, LoginPage.test.tsx
2. **#102 - Setup CI**: Found .github/workflows/ci.yml
3. **#115 - Add README**: Found README.md with comprehensive docs

**Recommendation**: Close these issues or update their status.

Would you like me to generate close commands?
```

If yes:
```bash
gh issue close 89 --comment "Completed: LoginPage.tsx exists with tests"
gh issue close 102 --comment "Completed: CI configured in .github/workflows/"
gh issue close 115 --comment "Completed: README.md is comprehensive"
```

## Blocked Tasks Report

If tasks are blocked (and `--include-blocked` used):

```markdown
## Blocked Tasks

### #67 - Deploy to production
**Blocked By**: #65 (setup staging environment)
**Status**: Cannot proceed until #65 is complete

### #98 - Add payment processing
**Blocked By**: External (waiting for vendor API access)
**Status**: On hold pending vendor

**Recommendation**: Focus on unblocked tasks first.
```

## Error Handling

### GitHub CLI Not Available
```markdown
ERROR: GitHub CLI required for task analysis.

Install: https://cli.github.com

Or use brew:
  brew install gh

Then authenticate:
  gh auth login
```

### No Issues Found
```markdown
No open issues found in this repository.

Consider:
1. Creating issues for planned work
2. Running /project-review to find code quality improvements
3. Running /deslop-around to clean up technical debt
```

### All Tasks Appear Complete
```markdown
Great news! All open issues appear to be implemented.

Suggestions:
1. Review and close completed issues
2. Run /project-review for quality improvements
3. Check PLAN.md for upcoming work not yet in issues
```

## Output Format

Be concise and actionable:
- Use evidence (file paths, line numbers)
- Show priority reasoning
- Link related work
- Provide next steps

## Example Usage

```bash
/next-task
# Analyze all open issues, recommend top 5

/next-task bug
# Focus on bug-labeled issues only

/next-task --include-blocked
# Show all tasks including blocked ones

/next-task feature --implement
# Analyze features, then start implementation workflow

/next-task test
# Focus on test-related issues
```

## Context Efficiency

Use context optimizer for git commands:

```bash
# Recent commits (for context)
git log --oneline --no-decorate -10 --format="%h %s"

# Changed files (for relation detection)
git diff HEAD~10..HEAD --name-only | head -20

# Current branch
git branch --show-current
```

## Success Criteria

- ✅ Multi-source task collection
- ✅ Code validation prevents recommending completed work
- ✅ Evidence-based prioritization
- ✅ Graceful degradation without Linear/PLAN.md
- ✅ **Auto-performing implementation workflow** (not optional once started)
- ✅ **Worktree isolation** for all implementations
- ✅ **Multi-agent review gates** with auto-iteration
- ✅ **Full /ship integration** (all 12 phases)
- ✅ **PR comment monitoring** and iteration loop
- ✅ **Automatic cleanup** (worktree, branches)
- ✅ Context-efficient commands

## IMPORTANT: Workflow Enforcement

When a user selects a task from recommendations, the implementation workflow is **NOT** a regular chat session. It is an **auto-performing pipeline** that:

1. Runs to completion without user prompts (except for blocking errors)
2. Uses the same enforcement as direct `/ship` invocation
3. Maintains full context (worktree, branch, PR state) throughout
4. Only stops when PR is merged or explicitly cancelled

**The agent must NOT:**
- Ask "what would you like to do next?" after task selection
- Treat the selected task as a regular conversation topic
- Skip worktree setup, review rounds, or ship invocation
- Wait for user input between workflow phases

Begin Phase 1 now.
