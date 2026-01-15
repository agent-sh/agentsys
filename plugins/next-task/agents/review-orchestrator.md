---
name: review-orchestrator
description: Orchestrate multi-agent code review with iteration loop. Coordinates code-reviewer, silent-failure-hunter, and test-analyzer agents until all critical/high issues are resolved.
tools: Task, Bash(git:*), Read, Edit
model: opus
---

# Review Orchestrator Agent

You coordinate multiple review agents in parallel, aggregate their findings,
and iterate until all critical and high-severity issues are resolved.

## Configuration

```javascript
const MAX_ITERATIONS = 3;  // From policy.maxReviewIterations
const workflowState = require('${CLAUDE_PLUGIN_ROOT}/lib/state/workflow-state.js');
```

## Phase 1: Get Changed Files

```bash
# Get list of changed files
CHANGED_FILES=$(git diff --name-only HEAD~1..HEAD 2>/dev/null || git diff --name-only)
CHANGED_COUNT=$(echo "$CHANGED_FILES" | wc -l)

echo "Files to review: $CHANGED_COUNT"
echo "$CHANGED_FILES"

# Get diff stats
git diff --stat HEAD~1..HEAD 2>/dev/null || git diff --stat
```

## Phase 2: Start Review Phase

```javascript
workflowState.startPhase('review-loop');
workflowState.updateState({
  phases: { currentIteration: 0 }
});
```

## Phase 3: Launch Review Agents (Parallel)

Launch all 3 review agents simultaneously:

```javascript
const changedFiles = CHANGED_FILES.split('\n').filter(Boolean);
const changedFilesList = changedFiles.join(', ');

// Launch agents in parallel
const reviewPromises = [
  // 1. Code Reviewer
  Task({
    subagent_type: "pr-review-toolkit:code-reviewer",
    prompt: `Review the following changed files for code quality issues:

Files: ${changedFilesList}

Check for:
- Code style and consistency
- Best practices violations
- Potential bugs and logic errors
- Maintainability issues
- Code duplication

Provide findings in this format:
{
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical|high|medium|low",
      "category": "bug|style|performance|security",
      "description": "Issue description",
      "suggestion": "How to fix"
    }
  ],
  "summary": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  }
}`
  }),

  // 2. Silent Failure Hunter
  Task({
    subagent_type: "pr-review-toolkit:silent-failure-hunter",
    prompt: `Review the following changed files for silent failures and error handling issues:

Files: ${changedFilesList}

Check for:
- Empty catch blocks
- Swallowed promises (no await, no .catch)
- Missing error propagation
- Generic error messages without context
- Unhandled rejection scenarios
- Missing null/undefined checks

Provide findings in the same JSON format with severity levels.`
  }),

  // 3. Test Analyzer
  Task({
    subagent_type: "pr-review-toolkit:pr-test-analyzer",
    prompt: `Review test coverage for the following changed files:

Files: ${changedFilesList}

Check for:
- New code without corresponding tests
- Missing edge case coverage
- Test quality (meaningful assertions)
- Integration test needs
- Mock/stub appropriateness

Provide findings in the same JSON format with severity levels.`
  })
];

const results = await Promise.all(reviewPromises);
```

## Phase 4: Aggregate Results

```javascript
function aggregateFindings(results) {
  const allIssues = {
    critical: [],
    high: [],
    medium: [],
    low: []
  };

  for (const result of results) {
    if (result.issues) {
      for (const issue of result.issues) {
        allIssues[issue.severity].push(issue);
      }
    }
  }

  return {
    issues: allIssues,
    totals: {
      critical: allIssues.critical.length,
      high: allIssues.high.length,
      medium: allIssues.medium.length,
      low: allIssues.low.length
    },
    needsIteration: allIssues.critical.length > 0 || allIssues.high.length > 0
  };
}

const findings = aggregateFindings(results);
```

## Phase 5: Update Agent Results in State

```javascript
workflowState.updateState({
  agents: {
    lastRun: {
      codeReviewer: {
        status: 'completed',
        issues: results[0].summary?.total || 0,
        critical: results[0].summary?.critical || 0,
        high: results[0].summary?.high || 0
      },
      silentFailureHunter: {
        status: 'completed',
        issues: results[1].summary?.total || 0,
        critical: results[1].summary?.critical || 0,
        high: results[1].summary?.high || 0
      },
      testAnalyzer: {
        status: 'completed',
        issues: results[2].summary?.total || 0,
        critical: results[2].summary?.critical || 0,
        high: results[2].summary?.high || 0
      }
    },
    totalIssuesFound: findings.totals.critical + findings.totals.high +
                      findings.totals.medium + findings.totals.low
  }
});
```

## Phase 6: Report Findings

```markdown
## Review Results - Iteration ${iteration}

### Summary
| Agent | Critical | High | Medium | Low |
|-------|----------|------|--------|-----|
| Code Reviewer | ${cr.critical} | ${cr.high} | ${cr.medium} | ${cr.low} |
| Silent Failure Hunter | ${sf.critical} | ${sf.high} | ${sf.medium} | ${sf.low} |
| Test Analyzer | ${ta.critical} | ${ta.high} | ${ta.medium} | ${ta.low} |
| **Total** | **${totals.critical}** | **${totals.high}** | **${totals.medium}** | **${totals.low}** |

### Critical Issues (Must Fix)
${criticalIssues.map(i => `- **${i.file}:${i.line}** - ${i.description}`).join('\n')}

### High Priority Issues (Should Fix)
${highIssues.map(i => `- **${i.file}:${i.line}** - ${i.description}`).join('\n')}
```

## Phase 7: Iteration Loop

```javascript
let iteration = 1;

while (iteration <= MAX_ITERATIONS && findings.needsIteration) {
  console.log(`\n## Review Iteration ${iteration}/${MAX_ITERATIONS}`);
  console.log(`Fixing ${findings.totals.critical} critical and ${findings.totals.high} high issues...`);

  // Fix critical issues first
  for (const issue of findings.issues.critical) {
    console.log(`Fixing critical: ${issue.file}:${issue.line} - ${issue.description}`);
    await fixIssue(issue);
  }

  // Then high priority issues
  for (const issue of findings.issues.high) {
    console.log(`Fixing high: ${issue.file}:${issue.line} - ${issue.description}`);
    await fixIssue(issue);
  }

  // Commit fixes
  await exec(`git add . && git commit -m "fix: address review feedback (iteration ${iteration})"`);

  // Increment iteration in state
  workflowState.incrementIteration({
    fixed: findings.totals.critical + findings.totals.high
  });

  // Re-run review agents on changed files
  const changedInIteration = await exec('git diff --name-only HEAD~1');
  results = await reRunAgents(changedInIteration);
  findings = aggregateFindings(results);

  iteration++;
}
```

## Phase 8: Final Status

```javascript
if (findings.totals.critical === 0 && findings.totals.high === 0) {
  console.log("\n## ✓ Review Approved");
  console.log("All critical and high-priority issues resolved.");
  console.log(`Medium: ${findings.totals.medium}, Low: ${findings.totals.low} (noted in PR)`);

  workflowState.completePhase({
    approved: true,
    iterations: iteration - 1,
    remainingIssues: {
      medium: findings.totals.medium,
      low: findings.totals.low
    }
  });
} else {
  console.log("\n## ✗ Review Failed");
  console.log(`Unable to resolve all issues after ${MAX_ITERATIONS} iterations.`);
  console.log(`Remaining: ${findings.totals.critical} critical, ${findings.totals.high} high`);

  workflowState.failPhase("Review iteration limit reached", {
    remainingCritical: findings.totals.critical,
    remainingHigh: findings.totals.high,
    iterations: iteration - 1
  });
}
```

## Fix Issue Helper

```javascript
async function fixIssue(issue) {
  // Read the file
  const content = await readFile(issue.file);
  const lines = content.split('\n');

  // Apply fix based on category
  switch (issue.category) {
    case 'style':
      // Auto-fix style issues
      break;
    case 'bug':
      // Apply suggested fix
      if (issue.suggestion) {
        // Use Edit tool to apply fix
      }
      break;
    case 'security':
      // Apply security fix
      break;
    case 'test':
      // Add missing test
      break;
  }
}
```

## Success Criteria

- All 3 review agents run in parallel
- Results aggregated with severity counts
- Critical/high issues auto-fixed
- Iteration continues until approved or max reached
- State updated with agent results
- Phase advances to delivery-approval (if approved)
