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

## [CRITICAL] Workflow Gates

Each phase MUST complete before the next starts:

| Gate | Requirement |
|------|-------------|
| Implementation | Agent completes all plan steps |
| Pre-Review | deslop-work + test-coverage-checker (parallel) |
| Review Loop | MUST approve (no open issues or override) |
| Delivery | Tests pass, build passes |
| Docs | Documentation updated |
| Ship | EXPLICIT /ship invocation (not hook-only) |

**Forbidden actions for agents:**
- NO agent may create PRs (only /ship)
- NO agent may push to remote (only /ship)
- NO agent may skip Phase 9 review loop
- NO agent may skip delivery-validator
- NO agent may skip docs-updater

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

## Default Behavior (No Arguments)

1. Goes to Phase 1: Policy Selection
2. Policy selector checks for existing tasks in `{stateDir}/tasks.json`
3. If existing tasks found, **ASKS USER** what to do
4. Then continues with normal policy configuration

**CRITICAL**: The workflow NEVER auto-resumes. It ALWAYS asks first.

## [WARN] OpenCode Label Limit

All AskUserQuestion option labels MUST be ≤30 characters. Put details in `description`, not `label`.

## State Management

Uses `lib/state/workflow-state.js` for all state operations:

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | Main repo `{stateDir}/` | Active task registry |
| `flow.json` | Worktree `{stateDir}/` | Workflow progress |

Key functions:
- `workflowState.startPhase(phase)` - Begin a phase
- `workflowState.completePhase(result)` - Complete and advance
- `workflowState.updateFlow(updates)` - Partial state updates
- `workflowState.hasActiveTask()` - Check for existing work
- `workflowState.canResume()` - Check if resumable

## Pre-flight: Handle Arguments

```javascript
const { getPluginRoot } = require('./lib/cross-platform');
const path = require('path');
const pluginRoot = getPluginRoot('next-task');
const workflowState = require(path.join(pluginRoot, 'lib/state/workflow-state.js'));
const args = '$ARGUMENTS'.split(' ').filter(Boolean);

// No flags → Phase 1 (Policy Selection asks about existing tasks)
if (args.length === 0) {
  console.log("Starting Phase 1 (Policy Selection)");
}

// Handle --status, --abort, --resume via workflowState functions
if (args.includes('--status')) {
  const summary = workflowState.getFlowSummary();
  console.log(summary ? `Phase: ${summary.phase} | Task: ${summary.task}` : "No active workflow.");
  return;
}

if (args.includes('--abort')) {
  workflowState.abortWorkflow('User requested abort');
  return;
}

if (args.includes('--resume')) {
  // Use lib functions to find worktree and resume from last phase
  const flow = workflowState.readFlow();
  if (flow && workflowState.canResume()) {
    console.log(`Resuming from phase: ${flow.phase}`);
  }
}
```

## Phase 1: Policy Selection

No agent needed. Use `lib/sources/policy-questions.js`:

```javascript
const { sources } = require(path.join(pluginRoot, 'lib'));
const { questions, cachedPreference } = sources.getPolicyQuestions();
AskUserQuestion({ questions });
const policy = sources.parseAndCachePolicy(responses);
workflowState.updateFlow({ policy, phase: 'task-discovery' });
```

## Phase 2: Task Discovery

→ **Agent**: `next-task:task-discoverer` (sonnet)

```javascript
workflowState.startPhase('task-discovery');
await Task({
  subagent_type: "next-task:task-discoverer",
  prompt: `Discover tasks from source: ${JSON.stringify(policy.taskSource)}. Filter: ${policy.priorityFilter}. Present top 5 for selection.`
});
```

## Phase 3: Worktree Setup

→ **Agent**: `next-task:worktree-manager` (haiku)

```javascript
workflowState.startPhase('worktree-setup');
await Task({
  subagent_type: "next-task:worktree-manager",
  prompt: `Create worktree for task #${state.task.id}. Anchor pwd to worktree.`
});
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
```

## Phase 5: Planning

→ **Agent**: `next-task:planning-agent` (opus)

```javascript
workflowState.startPhase('planning');
const planOutput = await Task({
  subagent_type: "next-task:planning-agent",
  model: "opus",
  prompt: `Design implementation plan for task #${state.task.id}. Output structured JSON between === PLAN_START === and === PLAN_END === markers.`
});
```

## Phase 6: User Approval (Plan Mode)

**Last human interaction point.** Present plan via EnterPlanMode/ExitPlanMode.

```javascript
EnterPlanMode();
// User reviews and approves via ExitPlanMode
workflowState.completePhase({ planApproved: true, plan });
```

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

→ **Agents** (parallel): `next-task:deslop-work` + `next-task:test-coverage-checker` (sonnet)

```javascript
workflowState.startPhase('pre-review-gates');
await Promise.all([
  Task({ subagent_type: "next-task:deslop-work", prompt: `Clean AI slop from new work.` }),
  Task({ subagent_type: "next-task:test-coverage-checker", prompt: `Validate test coverage.` })
]);
```

## Phase 9: Review Loop

MANDATORY: Follow the `orchestrate-review` skill exactly.

```javascript
workflowState.startPhase('review-loop');
// Implementation in: plugins/next-task/skills/orchestrate-review/SKILL.md
// Contains: pass definitions, signal detection, iteration algorithm, stall detection
```

### Review Decision Gate

If review exits with `blocked: true`:
1. **Critical/high issues OR security/performance/architecture** → re-run review
2. **Medium/low code-quality only** → may override if non-blocking
3. **Unclear** → re-run review

Override via `workflowState.updateFlow({ reviewResult: { approved: true, override: true } })`.

## Phase 10: Delivery Validation

→ **Agent**: `next-task:delivery-validator` (sonnet)

```javascript
workflowState.startPhase('delivery-validation');
const result = await Task({
  subagent_type: "next-task:delivery-validator",
  prompt: `Validate completion. Check: tests pass, build passes, requirements met.`
});
if (!result.approved) {
  workflowState.failPhase(result.reason, { fixInstructions: result.fixInstructions });
  return; // Retries from implementation
}
```

## Phase 11: Docs Update

→ **Agent**: `next-task:docs-updater` (sonnet)

```javascript
workflowState.startPhase('docs-update');
await Task({
  subagent_type: "next-task:docs-updater",
  prompt: `Update docs for changed files. CHANGELOG, API docs, code examples.`
});
```

## [CRITICAL] Handoff to /ship

After docs-updater completes, EXPLICITLY invoke /ship:

```javascript
console.log(`Task #${state.task.id} passed all validation. Invoking /ship...`);
const stateDir = workflowState.getStateDir(); // Returns platform-aware state directory
await Task({ subagent_type: "ship:ship", prompt: `Ship the task. State file: ${stateDir}/flow.json` });
```

**/ship responsibilities:**
- Create PR, push branch
- Monitor CI and review comments
- Merge when approved
- Cleanup worktree and tasks.json

## Error Handling

```javascript
try {
  // ... workflow phases ...
} catch (error) {
  workflowState.failPhase(error.message);
  console.log(`Workflow failed. Use --resume to retry or --abort to cancel.`);
}
```

## Success Criteria

- Policy selection via checkboxes
- Two-file state management (tasks.json + flow.json)
- Resume by task ID, branch, or worktree path
- Worktree isolation for parallel workflows
- Opus for complex tasks (explore, plan, implement)
- Sonnet for validation tasks (review, delivery)
- Haiku for simple tasks (worktree)
- Fully autonomous after plan approval
- Explicit /ship handoff for PR workflow

Begin workflow now.
