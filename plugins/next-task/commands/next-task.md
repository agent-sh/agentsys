---
description: Master workflow orchestrator with autonomous task-to-production automation
argument-hint: "[filter] [--status] [--resume] [--abort] [--implement]"
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Read, Write, Edit, Glob, Grep, Task, AskUserQuestion
---

# /next-task - Master Workflow Orchestrator

Discover what to work on next and execute the complete implementation workflow.

---

<no-shortcuts-policy>
## No Shortcuts Policy

This workflow exists because each step serves a purpose. Taking shortcuts defeats the purpose of automation.

| Step | Purpose | What Happens If Skipped |
|------|---------|------------------------|
| Worktree creation | Parallel task isolation | Conflicts, lost work |
| Review loop (3 iterations) | Catches bugs humans miss | Bugs ship to production |
| 3-minute CI wait | Auto-reviewers need time | Miss critical feedback |
| Address all PR comments | Quality gate | Merge blocked, trust lost |

### Enforcement Rules

1. Every step is mandatory - not suggestions, not guidelines, requirements
2. Use the specified agents - do not substitute with manual commands
3. Output verification blocks - prove each step completed
4. If you think a step is unnecessary, you are wrong

### Forbidden Actions

- Using `git checkout -b` instead of `worktree-manager` agent
- Skipping review loop iterations
- Checking CI once and moving to merge
- Skipping the 3-minute wait for auto-reviewers
- Leaving PR comments unaddressed
- Rationalizing shortcuts ("it's faster", "not needed this time")
</no-shortcuts-policy>

---

## Workflow Overview

**Phases 1-6 (User Interaction):**
1. Policy Selection
2. Task Discovery
3. Worktree Setup
4. Exploration
5. Planning
6. User Approval

**Phases 7-12 (Autonomous):**
7. Implementation
8. Pre-Review Gates
9. Review Loop
10. Delivery Validation
11. Docs Update
12. /ship

**Human interaction points (ONLY THESE):**
1. Policy selection via checkboxes
2. Task selection from ranked list
3. Plan approval (EnterPlanMode/ExitPlanMode)

<workflow-gates>
## Workflow Gates

Each phase must complete before the next starts:

| Gate | Requirement |
|------|-------------|
| Implementation | Agent completes all plan steps |
| Pre-Review | deslop-work + test-coverage-checker (parallel) |
| Review Loop | Must approve (no open issues or override) |
| Delivery | Tests pass, build passes |
| Docs | Documentation updated |
| Ship | Explicit /ship invocation (not hook-only) |

**Forbidden actions for agents:**
- No agent may create PRs (only /ship)
- No agent may push to remote (only /ship)
- No agent may skip Phase 9 review loop
- No agent may skip delivery-validator
- No agent may skip docs update (sync-docs-agent)
</workflow-gates>

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

The workflow never auto-resumes. It always asks first.

<opencode-constraint>
## OpenCode Label Limit

All AskUserQuestion option labels must be ≤30 characters. Put details in `description`, not `label`.
</opencode-constraint>

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

**Agent**: `next-task:task-discoverer` (sonnet)

```javascript
workflowState.startPhase('task-discovery');
await Task({
  subagent_type: "next-task:task-discoverer",
  prompt: `Discover tasks from source: ${JSON.stringify(policy.taskSource)}. Filter: ${policy.priorityFilter}. Present top 5 for selection.`
});
```

<phase-3>
## Phase 3: Worktree Setup

**Blocking gate** - Cannot proceed to Phase 4 without completing this.

Spawn: `next-task:worktree-manager` (haiku)

```javascript
workflowState.startPhase('worktree-setup');

// Required - use this agent, not manual git commands
const worktreeResult = await Task({
  subagent_type: "next-task:worktree-manager",
  prompt: `Create worktree for task #${state.task.id}. Anchor pwd to worktree.`
});

// Verification - mandatory before proceeding
if (!worktreeResult.worktreePath) {
  throw new Error('[BLOCKED] Worktree creation failed - STOP');
}
console.log(`[VERIFIED] Worktree: ${worktreeResult.worktreePath}`);
```

### Forbidden Actions for Phase 3
- `git checkout -b <branch>` (use worktree-manager agent)
- `git branch <branch>` (use worktree-manager agent)
- Proceeding to Phase 4 without worktree verification output
- Skipping worktree "because branching is faster"
</phase-3>

## Phase 4: Exploration

**Agent**: `next-task:exploration-agent` (opus)

```javascript
workflowState.startPhase('exploration');
await Task({
  subagent_type: "next-task:exploration-agent",
  model: "opus",
  prompt: `Deep codebase analysis for task #${state.task.id}. Find key files, patterns, dependencies.`
});
```

## Phase 5: Planning

**Agent**: `next-task:planning-agent` (opus)

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

**Agent**: `next-task:implementation-agent` (opus)

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

<phase-9>
## Phase 9: Review Loop

**Blocking gate** - Must run iterations before delivery validation.

Follow the `orchestrate-review` skill exactly.

```javascript
workflowState.startPhase('review-loop');

// REQUIRED: Run the review loop with MINIMUM 1 iteration
// Orchestrator may override after 3+ iterations if issues are non-blocking
let iteration = 0;
const MAX_ITERATIONS = 5;
const MIN_ITERATIONS = 1;

while (iteration < MAX_ITERATIONS) {
  iteration++;
  console.log(`[REVIEW] Iteration ${iteration}`);

  // Run review passes (see orchestrate-review skill)
  const findings = await runReviewPasses();

  if (findings.openCount === 0) {
    workflowState.updateFlow({
      reviewResult: { approved: true, iterations: iteration }
    });
    break;
  }

  // Fix issues, commit, run deslop
  await fixIssues(findings);

  // After 3 iterations, orchestrator MAY override if only low/medium issues remain
  if (iteration >= 3 && findings.bySeverity.critical.length === 0
      && findings.bySeverity.high.length === 0) {
    console.log('[ORCHESTRATOR] 3+ iterations with no critical/high issues');
    console.log('[ORCHESTRATOR] May proceed with override');
    workflowState.updateFlow({
      reviewResult: { approved: true, iterations: iteration, orchestratorOverride: true }
    });
    break;
  }
}

// VERIFICATION OUTPUT - MANDATORY
console.log(`[VERIFIED] Review: ${iteration} iterations, approved: ${reviewResult.approved}`);
```

### Review Iteration Rules
- Must run at least 1 iteration (never 0)
- Orchestrator may override after 3+ iterations if only medium/low issues remain
- Do not skip directly to delivery validation
- Do not claim "review passed" without running iterations

### Review Decision Gate

If review exits with `blocked: true`:
1. **Critical/high issues OR security/performance/architecture** -> re-run review
2. **Medium/low code-quality only after 3+ iterations** -> may override
3. **Unclear** -> re-run review

Override only via `workflowState.updateFlow({ reviewResult: { approved: true, orchestratorOverride: true, iterations: N } })`.
</phase-9>

## Phase 10: Delivery Validation

**Agent**: `next-task:delivery-validator` (sonnet)

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

**Agent**: `sync-docs:sync-docs-agent` (sonnet)

Uses the unified sync-docs agent from the sync-docs plugin with `before-pr` scope.

```javascript
workflowState.startPhase('docs-update');

// Helper to parse sync-docs structured output
function parseSyncDocsResult(output) {
  const match = output.match(/=== SYNC_DOCS_RESULT ===[\s\S]*?({[\s\S]*?})[\s\S]*?=== END_RESULT ===/);
  return match ? JSON.parse(match[1]) : { issues: [], fixes: [], changelog: { status: 'ok' } };
}

// Run sync-docs with before-pr scope
const syncResult = await Task({
  subagent_type: "sync-docs:sync-docs-agent",
  prompt: `Sync documentation with code state.
Mode: apply
Scope: before-pr

Execute the sync-docs skill and return structured results.`
});

// Parse results from === SYNC_DOCS_RESULT === markers
const result = parseSyncDocsResult(syncResult);

// If fixes are needed, spawn simple-fixer
if (result.fixes && result.fixes.length > 0) {
  await Task({
    subagent_type: "next-task:simple-fixer",
    model: "haiku",
    prompt: `Apply these documentation fixes:
${JSON.stringify(result.fixes, null, 2)}

Use the Edit tool to apply each fix. Commit message: "docs: sync documentation with code changes"`
  });
}

workflowState.completePhase({ docsUpdated: true, fixesApplied: result.fixes?.length || 0 });
```

<ship-handoff>
## Handoff to /ship

After docs update (sync-docs-agent) completes, invoke /ship explicitly:

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
</ship-handoff>

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
