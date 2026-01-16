---
description: Master workflow orchestrator with autonomous task-to-production automation
argument-hint: "[filter] [--status] [--resume] [--abort] [--implement]"
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Read, Write, Edit, Glob, Grep, Task, AskUserQuestion
---

# /next-task - Master Workflow Orchestrator

Discover what to work on next and execute the complete implementation workflow.

## Workflow Overview

```
Policy Selection → Task Discovery → Worktree Setup → Exploration → Planning
       ↓                                                              ↓
   (User input)                                              (User approval)
                                                                      ↓
                    ← ← ← AUTONOMOUS FROM HERE → → →
                                                                      ↓
Implementation → Pre-Review Gates → Review Loop → Delivery Validation
                                                                      ↓
                                                        Docs Update → /ship
```

**Human interaction points (ONLY THESE):**
1. Policy selection via checkboxes
2. Task selection from ranked list
3. Plan approval (EnterPlanMode/ExitPlanMode)

**After plan approval, everything runs autonomously until delivery validation passes.**

## ⛔ WORKFLOW ENFORCEMENT - CRITICAL

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         MANDATORY WORKFLOW GATES                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  Each phase MUST complete and approve before the next can start:         ║
║                                                                          ║
║  1. implementation-agent completes                                       ║
║           ↓ MUST trigger                                                 ║
║  2. deslop-work + test-coverage-checker (parallel)                       ║
║           ↓ MUST trigger                                                 ║
║  3. review-orchestrator (MUST approve - all critical/high resolved)      ║
║           ↓ MUST trigger (only if approved)                              ║
║  4. delivery-validator (MUST approve - tests pass, build passes)         ║
║           ↓ MUST trigger (only if approved)                              ║
║  5. docs-updater                                                         ║
║           ↓ MUST trigger                                                 ║
║  6. /ship command (creates PR, monitors CI, merges)                      ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ⛔ NO AGENT may create a PR - only /ship creates PRs                    ║
║  ⛔ NO AGENT may push to remote - only /ship pushes                      ║
║  ⛔ NO AGENT may skip the review-orchestrator                            ║
║  ⛔ NO AGENT may skip the delivery-validator                             ║
║  ⛔ NO AGENT may skip the docs-updater                                   ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### SubagentStop Hook Enforcement

The `hooks/hooks.json` SubagentStop hook enforces this sequence. When any agent
completes, the hook determines and triggers the next mandatory phase. Agents
MUST NOT invoke subsequent phases themselves - they STOP and let the hook handle it.

## Arguments

Parse from $ARGUMENTS:
- `--status`: Show current workflow state and exit
- `--resume [task/branch/worktree]`: Continue from last checkpoint
- `--abort`: Cancel workflow and cleanup
- `--implement`: Skip to implementation after task selection
- `[filter]`: Task filter (bug, feature, security, test)

### Resume Syntax

```
/next-task --resume                     # Resume active worktree (if only one)
/next-task --resume 123                 # Resume by task ID
/next-task --resume feature/my-task-123 # Resume by branch name
/next-task --resume ../worktrees/my-task-123  # Resume by worktree path
```

## Pre-flight: Handle Arguments

```javascript
const workflowState = require('${CLAUDE_PLUGIN_ROOT}/lib/state/workflow-state.js');
const args = '$ARGUMENTS'.split(' ').filter(Boolean);

// Handle --status
if (args.includes('--status')) {
  const summary = workflowState.getWorkflowSummary();
  if (!summary) { console.log("No active workflow."); return; }
  console.log(`## Status: ${summary.status} | Phase: ${summary.currentPhase} | Task: ${summary.task?.title || 'None'}`);
  return;
}

// Handle --abort
if (args.includes('--abort')) {
  workflowState.abortWorkflow('User requested abort');
  console.log("✓ Workflow aborted.");
  return;
}

// Handle --resume
if (args.includes('--resume')) {
  const resumeArg = args[args.indexOf('--resume') + 1];
  const worktree = await findWorktreeToResume(resumeArg);

  if (!worktree) {
    console.log("No worktree found to resume. Specify task ID, branch, or worktree path.");
    return;
  }

  // Read workflow-status.json from the worktree
  const statusPath = path.join(worktree.path, '.claude', 'workflow-status.json');
  if (!fs.existsSync(statusPath)) {
    console.log(`No workflow-status.json found in ${worktree.path}`);
    return;
  }

  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  const lastStep = status.steps[status.steps.length - 1];

  console.log(`
## Resuming Workflow

**Task**: #${status.task.id} - ${status.task.title}
**Worktree**: ${worktree.path}
**Branch**: ${status.git.branch}
**Last Step**: ${lastStep.step} (${lastStep.status})
**Last Activity**: ${status.workflow.lastActivityAt}
  `);

  // Change to worktree
  process.chdir(worktree.path);

  // Determine resume phase from last completed step
  const resumePhase = mapStepToPhase(lastStep.step);
  console.log(`Resuming from phase: ${resumePhase}`);

  // Continue workflow from that phase...
}

async function findWorktreeToResume(arg) {
  const registryPath = '.claude/tasks.json';
  if (!fs.existsSync(registryPath)) return null;

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

  // No argument - if only one active task, use it
  if (!arg && registry.tasks.length === 1) {
    return { path: registry.tasks[0].worktreePath, task: registry.tasks[0] };
  }

  // Search by task ID
  const byId = registry.tasks.find(t => t.id === arg);
  if (byId) return { path: byId.worktreePath, task: byId };

  // Search by branch name
  const byBranch = registry.tasks.find(t => t.branch === arg || t.branch.endsWith(arg));
  if (byBranch) return { path: byBranch.worktreePath, task: byBranch };

  // Direct path
  if (arg && fs.existsSync(arg)) {
    return { path: arg, task: null };
  }

  return null;
}

function mapStepToPhase(step) {
  const stepToPhase = {
    'worktree-created': 'exploration',
    'exploration-completed': 'planning',
    'plan-approved': 'implementation',
    'implementation-completed': 'pre-review-gates',
    'deslop-work-completed': 'review-loop',
    'review-approved': 'delivery-validation',
    'delivery-validation-passed': 'docs-update',
    'docs-updated': 'ship',
    'ready-to-ship': 'ship'
  };
  return stepToPhase[step] || 'exploration';
}
```

## Phase 1: Policy Selection

→ **Agent**: `next-task:policy-selector` (haiku)

```javascript
workflowState.startPhase('policy-selection');

await Task({
  subagent_type: "next-task:policy-selector",
  prompt: `Configure workflow via checkbox selection. Gather: task source, priority filter, stopping point.`
});

// Policy now in state
```

## Phase 2: Task Discovery

→ **Agent**: `next-task:task-discoverer` (inherit)

```javascript
workflowState.startPhase('task-discovery');

await Task({
  subagent_type: "next-task:task-discoverer",
  prompt: `Discover tasks from ${policy.taskSource}, filter by ${policy.priorityFilter}. Present top 5 to user for selection.`
});

// Selected task now in state.task
```

## Phase 3: Worktree Setup

→ **Agent**: `next-task:worktree-manager` (haiku)

```javascript
workflowState.startPhase('worktree-setup');

await Task({
  subagent_type: "next-task:worktree-manager",
  prompt: `Create worktree for task #${state.task.id} - ${state.task.title}. Anchor pwd to worktree.`
});

// All subsequent operations happen in worktree
```

## Phase 4: Exploration

→ **Agent**: `next-task:exploration-agent` (opus)

```javascript
workflowState.startPhase('exploration');

await Task({
  subagent_type: "next-task:exploration-agent",
  model: "opus",
  prompt: `Deep codebase analysis for task #${state.task.id}. Find key files, patterns, dependencies.`
});

// Exploration results in state for planning
```

## Phase 5: Planning

→ **Agent**: `next-task:planning-agent` (opus)

```javascript
workflowState.startPhase('planning');

await Task({
  subagent_type: "next-task:planning-agent",
  model: "opus",
  prompt: `Design implementation plan for task #${state.task.id}. Enter plan mode for user approval.`
});

// Agent uses EnterPlanMode → user approves → ExitPlanMode
```

## Phase 6: User Approval

Planning agent handles this via EnterPlanMode/ExitPlanMode.
**This is the LAST human interaction point.**

## Phase 7: Implementation

→ **Agent**: `next-task:implementation-agent` (opus)

```javascript
workflowState.startPhase('implementation');

await Task({
  subagent_type: "next-task:implementation-agent",
  model: "opus",
  prompt: `Execute approved plan for task #${state.task.id}. Commit changes incrementally.`
});

// → SubagentStop hook triggers pre-review gates
```

## Phase 8: Pre-Review Gates

→ **Agents** (parallel): `next-task:deslop-work` (sonnet) + `next-task:test-coverage-checker` (sonnet)

Triggered automatically by SubagentStop hook after implementation.

```javascript
workflowState.startPhase('pre-review-gates');

await Promise.all([
  Task({ subagent_type: "next-task:deslop-work", prompt: `Clean AI slop from new work.` }),
  Task({ subagent_type: "next-task:test-coverage-checker", prompt: `Validate test coverage (advisory).` })
]);

// → Proceeds to review loop
```

## Phase 9: Review Loop

→ **Agent**: `next-task:review-orchestrator` (opus)

```javascript
workflowState.startPhase('review-loop');

await Task({
  subagent_type: "next-task:review-orchestrator",
  model: "opus",
  prompt: `Orchestrate multi-agent review. Fix critical/high issues. Max ${policy.maxReviewIterations || 3} iterations.`
});

// Runs deslop-work after each iteration to clean fixes
// → SubagentStop hook triggers delivery validation when approved
```

## Phase 10: Delivery Validation

→ **Agent**: `next-task:delivery-validator` (sonnet)

Triggered automatically by SubagentStop hook after review approval.

```javascript
workflowState.startPhase('delivery-validation');

const result = await Task({
  subagent_type: "next-task:delivery-validator",
  prompt: `Validate task completion. Check: tests pass, build passes, requirements met, no regressions.`
});

if (!result.approved) {
  // Return to implementation with fix instructions - automatic retry
  workflowState.failPhase(result.reason, { fixInstructions: result.fixInstructions });
  return; // Workflow retries from implementation
}

workflowState.completePhase({ deliveryApproved: true });
```

## Phase 11: Docs Update

→ **Agent**: `next-task:docs-updater` (sonnet)

Triggered automatically by SubagentStop hook after delivery validation.

```javascript
workflowState.startPhase('docs-update');

await Task({
  subagent_type: "next-task:docs-updater",
  prompt: `Update docs for changed files. CHANGELOG, API docs, code examples.`
});

workflowState.completePhase({ docsUpdated: true });
```

## Handoff to /ship

After docs update completes, pass to /ship command for:
- PR creation
- CI monitoring
- Merge (based on policy)
- Deploy (if policy allows)
- Cleanup

```javascript
console.log(`
## ✓ Implementation Complete - Ready to Ship

Task #${state.task.id} passed all validation checks.

→ Passing to /ship for PR creation and merge workflow.
`);

// Invoke ship command
await Skill({ skill: "ship:ship" });
```

## Error Handling

```javascript
try {
  // ... workflow phases ...
} catch (error) {
  workflowState.failPhase(error.message, { phase: currentPhase });
  console.log(`
## Workflow Failed at ${currentPhase}

Use \`/next-task --resume\` to retry from checkpoint.
Use \`/next-task --abort\` to cancel.
  `);
}
```

## State Management Architecture

Two-file state management to prevent collisions across parallel workflows:

### Main Repo: `.claude/tasks.json`
```
- Shared registry of claimed tasks
- task-discoverer reads to exclude claimed tasks
- worktree-manager adds entry when creating worktree
- ship removes entry on cleanup
```

### Worktree: `.claude/workflow-status.json`
```
- Local to each worktree
- Tracks all steps with timestamps
- Used for --resume to find last step
- Isolated from other workflows
```

### Step Recording

Each agent MUST record its step in the worktree's workflow-status.json:

```javascript
function recordStep(stepName, status, result = null) {
  const statusPath = '.claude/workflow-status.json';
  const state = JSON.parse(fs.readFileSync(statusPath, 'utf8'));

  state.steps.push({
    step: stepName,
    status: status,
    startedAt: new Date().toISOString(),
    completedAt: status === 'completed' ? new Date().toISOString() : null,
    result: result
  });

  state.workflow.lastActivityAt = new Date().toISOString();
  state.workflow.currentPhase = stepName;
  state.resume.resumeFromStep = stepName;

  fs.writeFileSync(statusPath, JSON.stringify(state, null, 2));
}
```

## Success Criteria

- Policy selection via checkboxes
- **Two-file state management** (main repo registry + worktree status)
- **Resume by task ID, branch, or worktree path**
- Worktree isolation
- Opus for complex tasks (explore, plan, implement, review)
- Sonnet for validation tasks (quality gates, delivery)
- Haiku for simple tasks (policy, worktree)
- Fully autonomous after plan approval
- SubagentStop hooks for phase transitions
- Handoff to /ship for PR workflow

Begin workflow now.
