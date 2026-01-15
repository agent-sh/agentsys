---
description: Intelligent task prioritization with code validation
argument-hint: "[filter] [--status] [--resume] [--abort] [--implement]"
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Read, Write, Edit, Glob, Grep, Task, AskUserQuestion
---

# /next-task - Master Workflow Orchestrator

Discover what to work on next and execute the complete implementation workflow.

## ⚠️ WORKFLOW ENFORCEMENT

When a task is selected, this triggers an **auto-performing workflow** that runs to completion:

1. **Policy Selection** → Ask user preferences via checkboxes
2. **Task Discovery** → Find and prioritize tasks
3. **Worktree Setup** → Create isolated development environment
4. **Exploration** → Deep codebase analysis (opus)
5. **Planning** → Design implementation plan (opus)
6. **User Approval** → Get plan approval
7. **Implementation** → Execute the plan (opus)
8. **Review Loop** → Multi-agent review until approved (opus)
9. **Ship** → PR creation, CI monitoring, merge
10. **Cleanup** → Remove worktree, update state

**The agent continues autonomously until PR is merged or explicitly cancelled.**

## Arguments

Parse from $ARGUMENTS:
- `--status`: Show current workflow state and exit
- `--resume`: Continue from last checkpoint
- `--abort`: Cancel workflow and cleanup
- `--implement`: Skip to implementation after task selection
- `[filter]`: Task filter (bug, feature, security, test)

## Pre-flight: Load State and Check Arguments

```javascript
const workflowState = require('${CLAUDE_PLUGIN_ROOT}/lib/state/workflow-state.js');

// Parse arguments
const args = '$ARGUMENTS'.split(' ').filter(Boolean);
const hasStatus = args.includes('--status');
const hasResume = args.includes('--resume');
const hasAbort = args.includes('--abort');
const hasImplement = args.includes('--implement');
const filter = args.find(a => !a.startsWith('--'));

// Check for existing workflow
const existingState = workflowState.readState();
const hasActiveWorkflow = workflowState.hasActiveWorkflow();
```

## Handle --status Flag

```javascript
if (hasStatus) {
  if (!existingState) {
    console.log("No active workflow.");
    return;
  }

  const summary = workflowState.getWorkflowSummary();
  console.log(`
## Workflow Status

**ID**: ${summary.id}
**Status**: ${summary.status}
**Phase**: ${summary.currentPhase}
**Progress**: ${summary.progress} (${summary.progressPercent}%)

**Task**: ${summary.task ? `#${summary.task.id} - ${summary.task.title}` : 'Not selected'}
**PR**: ${summary.pr ? `#${summary.pr.number} (${summary.pr.ciStatus})` : 'Not created'}

**Can Resume**: ${summary.canResume ? 'Yes' : 'No'}
**Resume From**: ${summary.resumeFrom || 'N/A'}
  `);
  return;
}
```

## Handle --abort Flag

```javascript
if (hasAbort) {
  if (!existingState) {
    console.log("No workflow to abort.");
    return;
  }

  console.log("Aborting workflow...");

  // Cleanup worktree if exists
  if (existingState.git?.worktreePath) {
    await Bash({ command: `git worktree remove "${existingState.git.worktreePath}" --force 2>/dev/null || true` });
  }

  // Delete branch if exists
  if (existingState.git?.workingBranch) {
    await Bash({ command: `git branch -D "${existingState.git.workingBranch}" 2>/dev/null || true` });
  }

  workflowState.abortWorkflow('User requested abort');
  workflowState.deleteState();

  console.log("✓ Workflow aborted and cleaned up.");
  return;
}
```

## Handle --resume Flag

```javascript
if (hasResume) {
  if (!existingState || !existingState.checkpoints?.canResume) {
    console.log("No workflow to resume.");
    return;
  }

  const resumePhase = existingState.checkpoints.resumeFrom;
  console.log(`Resuming workflow from phase: ${resumePhase}`);

  // Restore working directory if in worktree
  if (existingState.git?.worktreePath) {
    await Bash({ command: `cd "${existingState.git.worktreePath}"` });
  }

  // Jump to the resume phase
  CURRENT_PHASE = resumePhase;
  // Continue with workflow from that phase...
}
```

## Phase 1: Policy Selection

If no active workflow or starting fresh:

```javascript
if (!hasResume || !hasActiveWorkflow) {
  // Use AskUserQuestion for policy configuration
  const policyAnswers = await AskUserQuestion({
    questions: [
      {
        header: "Task Source",
        question: "Where should I look for tasks?",
        options: [
          { label: "Continue with defaults (Recommended)", description: "Use GitHub Issues" },
          { label: "GitHub Issues", description: "Open issues in this repository" },
          { label: "Linear", description: "Tasks linked from Linear" },
          { label: "PLAN.md", description: "Tasks from PLAN.md file" }
        ],
        multiSelect: false
      },
      {
        header: "Priority",
        question: "What type of tasks should I prioritize?",
        options: [
          { label: "Continue (Recommended)", description: "Resume or pick by priority" },
          { label: "Bugs", description: "Bug fixes first" },
          { label: "Security", description: "Security issues highest" },
          { label: "Features", description: "New features" }
        ],
        multiSelect: false
      },
      {
        header: "Stop Point",
        question: "How far should I take this task?",
        options: [
          { label: "Merged (Recommended)", description: "PR merged to main" },
          { label: "PR Created", description: "Stop after PR" },
          { label: "All Green", description: "Stop when CI passes" },
          { label: "Deployed", description: "Deploy to staging" },
          { label: "Production", description: "Full production release" }
        ],
        multiSelect: false
      }
    ]
  });

  // Map responses to policy
  const policy = mapPolicyResponses(policyAnswers);

  // Apply CLI filter if provided
  if (filter) {
    policy.priorityFilter = filter;
  }

  // Create new workflow state
  const state = workflowState.createState('next-task', policy);
  workflowState.writeState(state);
  workflowState.startPhase('policy-selection');
  workflowState.completePhase({ policy });
}
```

## Phase 2: Task Discovery

Launch the task-discoverer agent:

```javascript
workflowState.startPhase('task-discovery');

const discoveryResult = await Task({
  subagent_type: "next-task:task-discoverer",
  model: "sonnet",
  prompt: `Discover and prioritize tasks based on policy.

Policy: ${JSON.stringify(policy)}
Filter: ${filter || 'none'}

Steps:
1. Fetch tasks from configured source (${policy.taskSource})
2. Filter by priority (${policy.priorityFilter})
3. Validate against codebase (check if already implemented)
4. Score and rank tasks
5. Present top 5 to user for selection via AskUserQuestion
6. Update workflow state with selected task

Return the selected task details.`
});

// Task is now in state.task
workflowState.completePhase({ taskSelected: true });
```

## Phase 3: Worktree Setup

Launch the worktree-manager agent:

```javascript
workflowState.startPhase('worktree-setup');

await Task({
  subagent_type: "next-task:worktree-manager",
  model: "sonnet",
  prompt: `Create isolated worktree for task development.

Task: #${state.task.id} - ${state.task.title}

Steps:
1. Generate branch name: feature/{task-slug}-{id}
2. Create worktree at ../worktrees/{task-slug}
3. Change directory to worktree (anchor pwd)
4. Update workflow state with git info

CRITICAL: After this, all operations must happen in the worktree.`
});

workflowState.completePhase({ worktreeCreated: true });
```

## Phase 4: Exploration

Launch the exploration-agent (opus):

```javascript
workflowState.startPhase('exploration');

const explorationResult = await Task({
  subagent_type: "next-task:exploration-agent",
  model: "opus",
  prompt: `Deep codebase analysis for task implementation.

Task: #${state.task.id} - ${state.task.title}
Description: ${state.task.description}

Thoroughly explore:
1. Extract keywords from task
2. Search for related code
3. Analyze file structure
4. Deep dive into key files
5. Trace dependencies
6. Find existing patterns to follow
7. Check git history for context

Output: Comprehensive exploration report with key files, patterns, and recommendations.`
});

workflowState.completePhase({
  keyFiles: explorationResult.keyFiles,
  patterns: explorationResult.patterns
});
```

## Phase 5: Planning

Launch the planning-agent (opus):

```javascript
workflowState.startPhase('planning');

await Task({
  subagent_type: "next-task:planning-agent",
  model: "opus",
  prompt: `Design detailed implementation plan.

Task: #${state.task.id} - ${state.task.title}
Exploration Results: ${JSON.stringify(explorationResult)}

Create a comprehensive plan:
1. Analyze requirements
2. Review existing patterns
3. Design step-by-step implementation
4. Identify critical paths and risks
5. Plan test strategy
6. Enter plan mode for user approval

Output: Detailed implementation plan ready for approval.`
});

// Planning agent will use EnterPlanMode for approval
// After approval, completePhase is called
```

## Phase 6: User Approval

The planning-agent handles this via EnterPlanMode/ExitPlanMode.
Wait for user to approve the plan before continuing.

```javascript
// Plan approval happens in planning-agent
// State is updated when plan is approved
workflowState.completePhase({ planApproved: true });
```

## Phase 7: Implementation

Launch the implementation-agent (opus):

```javascript
workflowState.startPhase('implementation');

await Task({
  subagent_type: "next-task:implementation-agent",
  model: "opus",
  prompt: `Execute the approved implementation plan.

Task: #${state.task.id} - ${state.task.title}
Plan: ${approvedPlan}

Execute each step:
1. Pre-implementation setup
2. For each plan step:
   - Modify files as specified
   - Verify changes compile/lint
   - Run relevant tests
   - Commit the step
3. Write tests for new code
4. Run full verification (types, lint, tests, build)
5. Fix any failures
6. Update workflow state

Output: Implementation complete with all commits made.`
});

workflowState.completePhase({
  implementationComplete: true,
  commits: commitCount
});
```

## Phase 8: Review Loop

Launch the review-orchestrator (opus):

```javascript
workflowState.startPhase('review-loop');

await Task({
  subagent_type: "next-task:review-orchestrator",
  model: "opus",
  prompt: `Orchestrate multi-agent code review.

Changed files: ${changedFiles}
Max iterations: ${policy.maxReviewIterations || 3}

Coordinate review:
1. Launch 3 review agents in parallel:
   - pr-review-toolkit:code-reviewer
   - pr-review-toolkit:silent-failure-hunter
   - pr-review-toolkit:pr-test-analyzer
2. Aggregate findings
3. Auto-fix critical and high issues
4. Commit fixes
5. Re-run review
6. Repeat until approved or max iterations

Output: Review approved or failed with remaining issues.`
});

// Check if review passed
if (reviewResult.approved) {
  workflowState.completePhase({ reviewApproved: true });
} else {
  workflowState.failPhase('Review failed', reviewResult);
  return;
}
```

## Phase 9: Delivery Approval

Quick check before shipping:

```javascript
workflowState.startPhase('delivery-approval');

const deliveryCheck = await AskUserQuestion({
  questions: [{
    header: "Ready to Ship",
    question: "Implementation and review complete. Ready to create PR?",
    options: [
      { label: "Yes, ship it (Recommended)", description: "Create PR and continue workflow" },
      { label: "Let me review first", description: "Pause for manual review" },
      { label: "Abort", description: "Cancel workflow" }
    ],
    multiSelect: false
  }]
});

if (deliveryCheck === 'Abort') {
  workflowState.abortWorkflow('User cancelled before shipping');
  return;
}

if (deliveryCheck === 'Let me review first') {
  workflowState.updateState({
    checkpoints: { canResume: true, resumeFrom: 'delivery-approval' }
  });
  console.log("Paused. Use /next-task --resume to continue.");
  return;
}

workflowState.completePhase({ deliveryApproved: true });
```

## Phase 10-13: Ship (PR Creation, CI, Comments)

Launch ship workflow phases:

```javascript
// Ship prep: rebase and push
workflowState.startPhase('ship-prep');
await Bash({ command: 'git fetch origin && git rebase origin/main' });

const conflicts = await Bash({ command: 'git diff --name-only --diff-filter=U' });
if (conflicts) {
  await Task({ subagent_type: "next-task:conflict-resolver", model: "sonnet", prompt: `Resolve merge conflicts: ${conflicts}` });
}

await Bash({ command: 'git push -u origin HEAD' });
workflowState.completePhase({ pushed: true });

// Create PR
workflowState.startPhase('create-pr');
const prResult = await Bash({
  command: `gh pr create --title "${state.task.title}" --body "$(cat <<'EOF'
## Summary
Implements #${state.task.id}

## Changes
${changesSummary}

## Test Plan
${testPlan}

Closes #${state.task.id}
EOF
)"`
});

const prNumber = extractPRNumber(prResult);
workflowState.updateState({ pr: { number: prNumber, url: prResult, state: 'open', ciStatus: 'pending' } });
workflowState.completePhase({ prCreated: true, prNumber });

// CI Monitoring
workflowState.startPhase('ci-wait');
await Task({
  subagent_type: "next-task:ci-monitor",
  model: "sonnet",
  prompt: `Monitor CI/PR comments for PR #${prNumber}. Wait 180s, check status, auto-fix issues, repeat until green (max 30min).`
});
workflowState.completePhase({ ciPassed: true });
```

## Phase 14: Merge

Based on policy, merge or wait:

```javascript
workflowState.startPhase('merge');

if (policy.stoppingPoint === 'all-green') {
  console.log("Stopping at all-green as per policy.");
  workflowState.completePhase({ stoppedAtGreen: true });
  return;
}

// Check if human approval needed
const needsHumanApproval = policy.stoppingPoint === 'pr-created';

if (needsHumanApproval) {
  console.log("PR created. Waiting for human to merge.");
  workflowState.completePhase({ waitingForHuman: true });
  return;
}

// Auto-merge
await Bash({
  command: `gh pr merge ${prNumber} --${policy.mergeStrategy || 'squash'} --delete-branch`
});

workflowState.updateState({
  pr: { state: 'merged' }
});

workflowState.completePhase({ merged: true });
```

## Phase 15-17: Deploy (Conditional)

If policy allows deployment:

```javascript
if (['deployed', 'production'].includes(policy.stoppingPoint)) {
  workflowState.startPhase('deploy');

  // Invoke ship's deployment phases
  await Task({
    subagent_type: "next-task:deployment-agent",
    model: "sonnet",
    prompt: `Handle deployment for merged PR.

    Target: ${policy.stoppingPoint}
    Platform: ${detectedPlatform}

    Steps:
    1. Wait for deployment to complete
    2. Run health checks
    3. Monitor for errors
    4. If production: extra validation
    5. Rollback if needed`
  });

  workflowState.completePhase({ deployed: true });
}
```

## Phase Complete: Cleanup

```javascript
workflowState.startPhase('complete');

// Return to original directory
const originalDir = process.cwd().replace(/\/worktrees\/[^/]+$/, '');
await Bash({ command: `cd "${originalDir}"` });

// Remove worktree
if (state.git?.worktreePath) {
  await Bash({ command: `git worktree remove "${state.git.worktreePath}" --force` });
}

// Final report
const summary = workflowState.getWorkflowSummary();

console.log(`
## ✓ Workflow Complete

**Task**: #${state.task.id} - ${state.task.title}
**PR**: #${state.pr.number} - ${state.pr.state}
**Duration**: ${formatDuration(summary.duration)}

### Phases Completed
${state.phases.history.map(p => `- ${p.phase}: ${p.status}`).join('\n')}

### Metrics
- Files modified: ${state.metrics.filesModified}
- Lines added: ${state.metrics.linesAdded}
- Lines removed: ${state.metrics.linesRemoved}
- Review iterations: ${state.agents?.totalIterations || 0}
`);

workflowState.completeWorkflow({ success: true });
```

## Error Handling

```javascript
// Global error handler
try {
  // ... workflow phases ...
} catch (error) {
  console.error(`Workflow error: ${error.message}`);

  workflowState.failPhase(error.message, {
    stack: error.stack,
    phase: currentPhase
  });

  console.log(`
## Workflow Failed

**Phase**: ${currentPhase}
**Error**: ${error.message}

Use \`/next-task --resume\` to retry from checkpoint.
Use \`/next-task --abort\` to cancel and cleanup.
  `);
}
```

## Helper Functions

```javascript
const POLICY_MAPS = {
  source: { 'Continue with defaults (Recommended)': 'gh-issues', 'GitHub Issues': 'gh-issues', 'Linear': 'linear', 'PLAN.md': 'tasks-md' },
  priority: { 'Continue (Recommended)': 'continue', 'Bugs': 'bugs', 'Security': 'security', 'Features': 'features' },
  stop: { 'Merged (Recommended)': 'merged', 'PR Created': 'pr-created', 'All Green': 'all-green', 'Deployed': 'deployed', 'Production': 'production' }
};

function mapPolicyResponses(answers) {
  return {
    taskSource: POLICY_MAPS.source[answers['Task Source']] || 'gh-issues',
    priorityFilter: POLICY_MAPS.priority[answers['Priority']] || 'continue',
    stoppingPoint: POLICY_MAPS.stop[answers['Stop Point']] || 'merged',
    mergeStrategy: 'squash',
    autoFix: true,
    maxReviewIterations: 3
  };
}

function formatDuration(ms) {
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}
```

## Success Criteria

- ✅ Policy selection via checkboxes
- ✅ State management throughout
- ✅ Resume capability (--resume)
- ✅ Status checking (--status)
- ✅ Abort capability (--abort)
- ✅ Worktree isolation
- ✅ Multi-agent orchestration
- ✅ Opus for complex tasks (explore, plan, implement, review)
- ✅ Sonnet for operational tasks (worktree, monitoring)
- ✅ Auto-performing to completion
- ✅ Policy-based stopping points

Begin workflow now.
