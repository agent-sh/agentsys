# Agent Reference

Complete reference for all agents in awesome-slash.

<!-- GEN:START:agents-counts -->
**TL;DR:** 41 agents across 12 plugins (11 have agents). opus for reasoning, sonnet for patterns, haiku for execution. Each agent does one thing well. <!-- AGENT_COUNT_TOTAL: 41 -->
<!-- GEN:END:agents-counts -->

---

## Quick Navigation

<!-- GEN:START:agents-nav -->
| Plugin | Agents | Jump to |
|--------|--------|---------|
| agnix | 1 | [agnix-agent](#agnix-agent) |
| audit-project | 10 | [code-quality-reviewer](#code-quality-reviewer), [security-expert](#security-expert), [performance-engineer](#performance-engineer), [test-quality-guardian](#test-quality-guardian), [architecture-reviewer](#architecture-reviewer), [database-specialist](#database-specialist), [api-designer](#api-designer), [frontend-specialist](#frontend-specialist), [backend-specialist](#backend-specialist), [devops-reviewer](#devops-reviewer) |
| consult | 1 | [consult-agent](#consult-agent) |
| deslop | 1 | [deslop-agent](#deslop-agent) |
| drift-detect | 1 | [plan-synthesizer](#plan-synthesizer) |
| enhance | 8 | [agent-enhancer](#agent-enhancer), [claudemd-enhancer](#claudemd-enhancer), [cross-file-enhancer](#cross-file-enhancer), [docs-enhancer](#docs-enhancer), [hooks-enhancer](#hooks-enhancer), [plugin-enhancer](#plugin-enhancer), [prompt-enhancer](#prompt-enhancer), [skills-enhancer](#skills-enhancer) |
| learn | 1 | [learn-agent](#learn-agent) |
| next-task | 10 | [ci-fixer](#ci-fixer), [ci-monitor](#ci-monitor), [delivery-validator](#delivery-validator), [exploration-agent](#exploration-agent), [implementation-agent](#implementation-agent), [planning-agent](#planning-agent), [simple-fixer](#simple-fixer), [task-discoverer](#task-discoverer), [test-coverage-checker](#test-coverage-checker), [worktree-manager](#worktree-manager) |
| perf | 6 | [perf-analyzer](#perf-analyzer), [perf-code-paths](#perf-code-paths), [perf-investigation-logger](#perf-investigation-logger), [perf-orchestrator](#perf-orchestrator), [perf-theory-gatherer](#perf-theory-gatherer), [perf-theory-tester](#perf-theory-tester) |
| repo-map | 1 | [map-validator](#map-validator) |
| sync-docs | 1 | [sync-docs-agent](#sync-docs-agent) |
<!-- GEN:END:agents-nav -->

**Design principle:** Each agent has a single responsibility. Complex work is decomposed into specialized agents that do one thing extremely well, then orchestrated together.

**Related docs:**
- [/next-task Workflow](../workflows/NEXT-TASK.md) - How agents work together

---

## Overview

awesome-slash uses 41 specialized agents across 12 plugins (11 have agents - ship uses commands only). Each agent is optimized for a specific task and assigned a model based on complexity:

| Model | Use Case | Cost |
|-------|----------|------|
| opus | Complex reasoning, quality-critical work | High |
| sonnet | Moderate reasoning, pattern matching | Medium |
| haiku | Mechanical execution, no judgment | Low |

**Agent types:**
- **File-based agents** (31) - Defined in `plugins/*/agents/*.md` with frontmatter <!-- AGENT_COUNT_FILE_BASED: 31 -->
- **Role-based agents** (10) - Defined inline via Task tool with specialized prompts <!-- AGENT_COUNT_ROLE_BASED: 10 -->

---

## next-task Plugin Agents

### task-discoverer

**Model:** sonnet
**Purpose:** Find and prioritize tasks from configured sources.

**What it does:**
1. Loads claimed tasks from `tasks.json` (excludes them)
2. Fetches from GitHub/GitLab/local files/custom CLI
3. Applies priority scoring (labels, blockers, age, reactions)
4. Validates tasks against codebase
5. Presents top 5 via AskUserQuestion checkboxes
6. Posts "Workflow Started" comment to GitHub issue

**Tools available:**
- Bash (gh, glab, git)
- Grep, Read
- AskUserQuestion

---

### worktree-manager

**Model:** haiku
**Purpose:** Create git worktrees for isolated development.

**What it does:**
1. Creates `../worktrees/{task-slug}/` directory
2. Creates `feature/{task-slug}` branch
3. Claims task in `tasks.json`
4. Creates `flow.json` in worktree

**Tools available:**
- Bash (git only)
- Read, Write

---

### exploration-agent

**Model:** opus
**Purpose:** Deep codebase analysis before planning.

**What it does:**
1. Extracts keywords from task description
2. Searches for related files
3. Traces dependency graphs
4. Analyzes existing patterns
5. Outputs exploration report

**Tools available:**
- Read, Glob, Grep
- Bash (git only)
- LSP
- Task (for sub-exploration)

**Why opus:** Exploration quality directly impacts planning quality. Poor exploration = poor plan = poor implementation. The compound effect justifies the cost.

---

### planning-agent

**Model:** opus
**Purpose:** Design step-by-step implementation plans.

**What it does:**
1. Synthesizes exploration findings
2. Creates implementation steps
3. Identifies risks and critical paths
4. Outputs structured JSON
5. Posts summary to GitHub issue

**Tools available:**
- Read, Glob, Grep
- Bash (git only)
- Task (for research)

**Output format:**

```json
{
  "steps": [
    { "action": "modify", "file": "src/auth.ts", "description": "..." }
  ],
  "risks": ["..."],
  "complexity": "medium"
}
```

**Why opus:** Planning is the leverage point. A good plan makes implementation straightforward. A bad plan causes rework cycles.

---

### implementation-agent

**Model:** opus
**Purpose:** Execute approved plans with production-quality code.

**What it does:**
1. Executes plan step-by-step
2. Creates atomic commits per step
3. Runs type checks, linting, tests after each step
4. Updates `flow.json` for resume capability

**Tools available:**
- Read, Write, Edit
- Glob, Grep
- Bash (git, npm, node)
- Task (for sub-tasks)
- LSP

**Restrictions:**
- MUST NOT create PR
- MUST NOT push to remote
- MUST NOT invoke review agents

**Why opus:** Implementation quality matters. Bad code gets caught in review but wastes cycles. Good code flows through.

---

### test-coverage-checker

**Model:** sonnet
**Purpose:** Validate test quality for new code.

**What it does:**
1. Identifies new/modified functions
2. Checks if tests exist
3. Checks if tests are meaningful (not just path matching)
4. Reports coverage status

**Tools available:**
- Bash (git, npm)
- Read, Grep, Glob

**Advisory only:** Does not block workflow. Reports findings but continues.

---

### delivery-validator

**Model:** sonnet
**Purpose:** Final validation before shipping.

**Checks:**
1. Review status - no open issues (or explicit override)
2. Tests pass
3. Build passes
4. Task requirements met (extracts from task, maps to changes)
5. No regressions

**Tools available:**
- Bash (git, npm)
- Read, Grep, Glob

**On failure:** Returns to implementation with fix instructions.

**Restrictions:**
- MUST NOT create PR
- MUST NOT push
- MUST NOT skip sync-docs:sync-docs-agent

---

### sync-docs-agent

**Model:** sonnet
**Purpose:** Update documentation for recent changes.

**What it does:**
1. Finds docs referencing changed files
2. Updates CHANGELOG entry
3. Fixes outdated imports/versions
4. Delegates simple edits to simple-fixer
5. Invokes `/ship` when complete

**Tools available:**
- Bash (git)
- Read, Grep, Glob
- Task (for simple-fixer)

---

### simple-fixer

**Model:** haiku
**Purpose:** Execute mechanical edits without judgment.

**What it does:**
- Receives structured fix list from parent
- Executes each fix: remove-line, replace, insert
- No decision-making, just execution

**Tools available:**
- Read, Edit
- Bash (git)

**Why haiku:** Pure execution. No reasoning needed. Haiku is fast and cheap.

---

### ci-monitor

**Model:** haiku
**Purpose:** Poll CI status with sleep/check loops.

**What it does:**
1. Polls `gh pr checks` every 15 seconds
2. Reports status changes
3. On failure: delegates to ci-fixer
4. On success: continues workflow

**Tools available:**
- Bash (gh, git)
- Read
- Task (for ci-fixer)

**Why haiku:** Polling is mechanical. No judgment needed.

---

### ci-fixer

**Model:** sonnet
**Purpose:** Fix CI failures and review comments.

**What it does:**
1. Analyzes CI logs to diagnose failure
2. Applies fixes:
   - Lint auto-fix
   - Type error resolution
   - Test failure fixes
3. Addresses PR review comments
4. Commits and pushes fixes

**Tools available:**
- Bash (git, npm)
- Read, Edit
- Grep, Glob

---

## deslop Plugin Agents

### deslop-agent

**Model:** sonnet
**Purpose:** Clean AI slop from code with certainty-based findings.

**What it does:**
1. Parses arguments (mode, scope, thoroughness)
2. Invokes deslop skill to run detection
3. Returns structured findings with certainty levels
4. HIGH certainty items marked for auto-fix by orchestrator

**Tools available:**
- Bash (git, node)
- Skill (for deslop)
- Read, Glob, Grep

**Why sonnet:** Slop detection is pattern-based. Sonnet handles patterns well and is faster/cheaper than opus.

**Cross-plugin usage:** Also used by next-task Phase 8 with `scope=diff` to clean new code before review.

---

## enhance Plugin Agents

### plugin-enhancer

**Model:** sonnet
**Purpose:** Analyze plugin structures.

**Checks:**
- plugin.json manifest validity
- MCP tool definitions (additionalProperties, required array)
- Security patterns (unrestricted Bash, command injection)
- Component organization

**Tools available:**
- Read, Glob, Grep
- Bash (git)

---

### agent-enhancer

**Model:** opus
**Purpose:** Analyze agent prompts.

**Checks (14 patterns):**
- Frontmatter validity
- Tool restrictions
- XML structure
- Chain-of-thought appropriateness
- Example quality
- Anti-patterns (vague language, prompt bloat)

**Tools available:**
- Read, Glob, Grep
- Bash (git)

**Why opus:** Agent quality compounds. Bad agent prompts = bad agent outputs across all uses.

---

### claudemd-enhancer

**Model:** opus
**Purpose:** Analyze CLAUDE.md/AGENTS.md files.

**Checks:**
- Structure (critical rules, architecture, commands)
- References to actual files
- Token efficiency
- README duplication
- Cross-platform compatibility

**Tools available:**
- Read, Glob, Grep
- Bash (git)

---

### docs-enhancer

**Model:** opus
**Purpose:** Analyze documentation quality.

**Modes:**
- AI-only: Aggressive token reduction
- Both: Balance readability with AI-friendliness

**Checks:**
- Link validity
- Structure and chunking
- Semantic boundaries
- Heading hierarchy

**Tools available:**
- Read, Glob, Grep
- Bash (git)

---

### prompt-enhancer

**Model:** opus
**Purpose:** Analyze prompt engineering patterns.

**Checks (16 patterns):**
- Clarity (vague instructions)
- Structure (XML, headings)
- Examples (few-shot patterns)
- Context/WHY presence
- Output format specification
- Anti-patterns (redundant CoT)

**Tools available:**
- Read, Glob, Grep
- Bash (git)

---

### hooks-enhancer

**Model:** opus
**Purpose:** Analyze hook definitions.

**Checks:**
- Frontmatter presence and structure
- Required name/description fields
- Basic formatting expectations

**Tools available:**
- Read, Glob, Grep

---

### skills-enhancer

**Model:** opus
**Purpose:** Analyze SKILL.md quality.

**Checks:**
- Frontmatter presence and structure
- Required name/description fields
- Trigger phrase clarity ("Use when user asks")

**Tools available:**
- Read, Glob, Grep

---

### cross-file-enhancer

**Model:** sonnet
**Purpose:** Analyze cross-file semantic consistency.

**Checks:**
- Tools used vs declared in frontmatter
- Agent references exist
- Duplicate instructions across files
- Contradictory rules (ALWAYS vs NEVER)
- Orphaned agents
- Skill tool mismatches

**Tools available:**
- Read, Glob, Grep, Bash(git:*)

---

## drift-detect Plugin Agent

### plan-synthesizer

**Model:** opus
**Purpose:** Deep semantic analysis for drift detection.

**What it does:**
1. Receives data from JavaScript collectors
2. Performs semantic matching (not string matching)
3. Identifies:
   - Issues that should be closed (already done)
   - "Done" phases that aren't done
   - Release blockers
4. Outputs prioritized reconstruction plan

**Tools available:**
- Read, Write

**Why opus:** Semantic matching requires deep understanding. "user authentication" must match `auth/`, `login.js`, `session.ts`. Opus handles this.

---

## repo-map Plugin Agent

### map-validator

**Model:** haiku
**Purpose:** Validate repo-map output for obvious errors.

**What it does:**
1. Verifies map isn't empty
2. Flags suspiciously small symbol counts
3. Checks for missing language detection
4. Returns single-line status

**Tools available:**
- Read

**Why haiku:** Validation is deterministic and lightweight.

---

## perf Plugin Agents

### perf-orchestrator

**Model:** opus
**Purpose:** Coordinate /perf investigations across all phases.

**What it does:**
1. Enforces perf rules and phase order
2. Spawns theory, profiling, and logging helpers
3. Ensures checkpoints + evidence after each phase

**Tools available:**
- Read, Write, Edit, Task, Bash(git:*), Bash(npm:*), Bash(cargo:*), Bash(go:*), Bash(pytest:*), Bash(mvn:*), Bash(gradle:*)

---

### perf-theory-gatherer

**Model:** opus
**Purpose:** Generate hypotheses based on git history and evidence.

**Tools available:**
- Read, Bash(git:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(cargo:*), Bash(go:*), Bash(pytest:*), Bash(python:*), Bash(mvn:*), Bash(gradle:*)

---

### perf-theory-tester

**Model:** opus
**Purpose:** Validate hypotheses with controlled experiments.

**Tools available:**
- Read, Write, Edit, Bash(git:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(cargo:*), Bash(go:*), Bash(pytest:*), Bash(python:*), Bash(mvn:*), Bash(gradle:*)

---

### perf-code-paths

**Model:** sonnet
**Purpose:** Map entrypoints and likely hot files before profiling.

**Tools available:**
- Read, Grep, Glob

---

### perf-investigation-logger

**Model:** sonnet
**Purpose:** Append structured investigation logs with evidence.

**Tools available:**
- Read, Write

---

### perf-analyzer

**Model:** opus
**Purpose:** Synthesize findings into evidence-backed recommendations.

**Tools available:**
- Read, Write

---

## audit-project Plugin Agents

These are role-based agents invoked via Task tool with specialized prompts. They use the built-in review subagent type with domain-specific instructions.

### code-quality-reviewer

**Activation:** Always active
**Purpose:** Review code quality and error handling.

**Focuses on:**
- Code style and consistency
- Best practices violations
- Error handling and failure paths
- Maintainability issues
- Code duplication

---

### security-expert

**Activation:** Always active
**Purpose:** Find security vulnerabilities.

**Focuses on:**
- SQL injection, XSS, CSRF vulnerabilities
- Authentication and authorization flaws
- Secrets exposure, insecure configurations
- Input validation, output encoding

---

### performance-engineer

**Activation:** Always active
**Purpose:** Find performance bottlenecks.

**Focuses on:**
- N+1 queries, inefficient algorithms
- Memory leaks, unnecessary allocations
- Blocking operations, missing async
- Bundle size, lazy loading

---

### test-quality-guardian

**Activation:** Always active (reports missing tests)
**Purpose:** Validate test coverage and quality.

**Focuses on:**
- Test coverage for new code
- Edge case coverage
- Test design and maintainability
- Mocking appropriateness

---

### architecture-reviewer

**Activation:** Conditional (if FILE_COUNT > 50)
**Purpose:** Review code organization.

**Focuses on:**
- Code organization and modularity
- Design pattern violations
- Dependency management
- SOLID principles

---

### database-specialist

**Activation:** Conditional (if database detected)
**Purpose:** Review database operations.

**Focuses on:**
- Query optimization, N+1 queries
- Missing indexes
- Transaction handling
- Connection pooling

---

### api-designer

**Activation:** Conditional (if API detected)
**Purpose:** Review API design.

**Focuses on:**
- REST best practices
- Error handling and status codes
- Rate limiting, pagination
- API versioning

---

### frontend-specialist

**Activation:** Conditional (if frontend detected)
**Purpose:** Review frontend code.

**Focuses on:**
- Component design and composition
- State management patterns
- Performance (memoization, virtualization)
- Accessibility

---

### backend-specialist

**Activation:** Conditional (if backend detected)
**Purpose:** Review backend service and domain logic.

**Focuses on:**
- Service boundaries and layering
- Domain logic correctness
- Concurrency and idempotency
- Background job safety

---

### devops-reviewer

**Activation:** Conditional (if CI/CD detected)
**Purpose:** Review infrastructure and CI/CD.

**Focuses on:**
- Pipeline configuration
- Secret management
- Docker best practices
- Deployment strategies

---

## learn Plugin Agent

### learn-agent

**Model:** opus
**Purpose:** Research any topic online and create comprehensive learning guides with RAG-optimized indexes.

**What it does:**
1. Uses progressive query architecture (funnel approach: broad → specific → deep)
2. Gathers 10-40 online sources based on depth level
3. Scores sources by authority, recency, depth, examples, uniqueness
4. Uses just-in-time retrieval to save tokens (only fetches high-scoring sources)
5. Creates structured learning guides with examples and best practices
6. Updates CLAUDE.md/AGENTS.md master indexes for future RAG lookups
7. Runs enhance:enhance-docs and enhance:enhance-prompts for quality

**Tools available:**
- WebSearch, WebFetch, Read, Write, Glob, Grep, Skill

**Output:**
- Topic-specific guide in `agent-knowledge/`
- Updated master index in `agent-knowledge/CLAUDE.md`
- Source metadata with quality scores in `agent-knowledge/resources/`

---

## agnix Plugin Agent

### agnix-agent

**Model:** sonnet
**Purpose:** Lint agent configuration files using agnix CLI.

**What it does:**
1. Parses arguments (path, --fix, --strict, --target)
2. Invokes the agnix skill with the appropriate flags
3. Returns structured validation results

**Tools available:**
- Bash(agnix:*), Bash(cargo:*), Skill, Read, Glob, Grep

**Output:**
- Structured JSON with error/warning counts
- List of diagnostics with file, line, rule, message
- Fix status if --fix was used

---

## Model Selection Rationale

| Agent Type | Model | Reasoning |
|------------|-------|-----------|
| Analysis/reasoning | opus | Quality compounds - errors propagate |
| Pattern matching | sonnet | Good at structured tasks, fast |
| Mechanical execution | haiku | No judgment needed, cheapest |

**Key insight:** For enhancers and analyzers, quality loss is exponential. Each imperfection in analysis creates downstream problems.

---

## Tool Restrictions

Agents have restricted tool access for safety:

| Agent | Restricted From | Why |
|-------|-----------------|-----|
| implementation-agent | PR creation, git push | Workflow enforces order |
| delivery-validator | PR creation, git push | Must pass validation first |
| worktree-manager | Most tools | Only needs git |
| simple-fixer | Most tools | Only needs edit |

---

## Navigation

[← Back to Documentation Index](../README.md) | [Main README](../../README.md)

**Related:**
- [/next-task Workflow](../workflows/NEXT-TASK.md) - How agents orchestrate together
- [/ship Workflow](../workflows/SHIP.md) - Shipping agents in action
