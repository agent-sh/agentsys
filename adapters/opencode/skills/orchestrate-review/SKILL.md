---
name: orchestrate-review
version: 5.1.0
description: "Use when user asks to \"deep review the code\", \"thorough code review\", \"multi-pass review\", or when orchestrating the Phase 9 review loop. Provides review pass definitions (code quality, security, performance, test coverage), signal detection patterns, and iteration algorithms."
metadata:
  short-description: "Multi-pass code review orchestration"
---

> **OpenCode Note**: Invoke agents using `@agent-name` syntax.
> Available agents: task-discoverer, exploration-agent, planning-agent,
> implementation-agent, deslop-agent, delivery-validator, sync-docs-agent, consult-agent
> Example: `@exploration-agent analyze the codebase`


# Orchestrate Review

Multi-pass code review with parallel Task agents, finding aggregation, and iteration until clean.

## Scope-Based Specialist Selection

Select conditional specialists based on the review scope:
- **User request**: Detect signals from content user refers to (files, directory, module)
- **Workflow (Phase 9)**: Detect signals from changed files only
- **Project audit**: Detect signals from project structure as a whole

## Review Passes

Spawn parallel `general-purpose` Task agents (model: `sonnet`), one per pass:

### Core (Always)
*(JavaScript reference - not executable in OpenCode)*

### Conditional (Signal-Based)
```javascript
if (signals.hasDb) passes.push({ id: 'database', role: 'database specialist',
  focus: ['Query performance', 'Indexes/transactions', 'Migration safety', 'Data integrity'] });
if (signals.needsArchitecture) passes.push({ id: 'architecture', role: 'architecture reviewer',
  focus: ['Module boundaries', 'Dependency direction', 'Cross-layer coupling', 'Pattern consistency'] });
if (signals.hasApi) passes.push({ id: 'api', role: 'api designer',
  focus: ['REST conventions', 'Error/status consistency', 'Pagination/filters', 'Versioning'] });
if (signals.hasFrontend) passes.push({ id: 'frontend', role: 'frontend specialist',
  focus: ['Component boundaries', 'State management', 'Accessibility', 'Render performance'] });
if (signals.hasBackend) passes.push({ id: 'backend', role: 'backend specialist',
  focus: ['Service boundaries', 'Domain logic', 'Concurrency/idempotency', 'Background job safety'] });
if (signals.hasDevops) passes.push({ id: 'devops', role: 'devops reviewer',
  focus: ['CI/CD safety', 'Secrets handling', 'Build/test pipelines', 'Deploy config'] });
```

## Signal Detection

*(JavaScript reference - not executable in OpenCode)*

## Task Prompt Template

*(JavaScript reference - not executable in OpenCode)*

## Aggregation

*(JavaScript reference - not executable in OpenCode)*

## Iteration Loop

**Security Note**: Fixes are applied by the orchestrator using standard Edit tool permissions. Critical/high severity findings should be reviewed before applying - do not blindly apply LLM-suggested fixes to security-sensitive code. The orchestrator validates each fix against the original issue.

- Invoke `@general-purpose` agent
- Invoke `@deslop-agent` agent
- Use AskUserQuestion tool for user input
- Call `workflowState.completePhase(result)` to advance workflow state


## Review Queue

Store state at `{stateDir}/review-queue-{timestamp}.json`:
```json
{
  "status": "open|resolved|blocked",
  "scope": { "type": "diff", "files": ["..."] },
  "passes": ["code-quality", "security"],
  "items": [],
  "iteration": 0,
  "stallCount": 0
}
```

Delete when approved. Keep when blocked for orchestrator inspection.

## Cross-Platform Compatibility

This skill uses `Task({ subagent_type: ... })` which is Claude Code syntax. For other platforms:

| Platform | Equivalent Syntax |
|----------|-------------------|
| Claude Code | `Task({ subagent_type: 'general-purpose', model: 'sonnet', prompt: ... })` |
| OpenCode | `spawn_agent({ type: 'general-purpose', model: 'sonnet', prompt: ... })` |
| Codex CLI | `$agent general-purpose --model sonnet --prompt "..."` |

The aggregation and iteration logic remains the same across platforms - only the agent spawning syntax differs.
