# Agent Reference

Every agent in the AgentSys plugins at the commits pinned in `.claude-plugin/marketplace.json`. Each plugin repo's `agents/*.md` is the source of truth; this page summarizes it.

<!-- GEN:START:agents-counts -->
**TL;DR:** 50 agents across 24 plugins (17 have agents). Each agent names a model family (opus, sonnet, haiku; currently Opus 5.5, Sonnet 5.5, Haiku 4.5) or inherits the caller's model, and does one thing. <!-- AGENT_COUNT_TOTAL: 50 -->
<!-- GEN:END:agents-counts -->

## Quick Navigation

<!-- GEN:START:agents-nav -->
| Plugin | Agents | Jump to |
|--------|--------|---------|
<!-- GEN:END:agents-nav -->

Related: [/next-task Workflow](../workflows/NEXT-TASK.md) shows how the agents work together; [/ship Workflow](../workflows/SHIP.md) covers CI and merge.

## Overview

| Model | Resolves to | Used for |
|-------|-------------|----------|
| opus | Claude Opus 5.5 | Judgment where errors compound into later phases |
| sonnet | Claude Sonnet 5.5 | Structured analysis and validation, most agents |
| haiku | Claude Haiku 4.5 | Mechanical work with no judgment |
| inherit | the caller's model | Agents with no `model` key |

Family aliases resolve to the current model in that family, so agent files do not pin versions.

- **File-based agents** (40): `agents/*.md` with frontmatter in each plugin repo. <!-- AGENT_COUNT_FILE_BASED: 40 -->
- **Role-based agents** (10): audit-project review passes, spawned through Task with a pass-specific prompt. <!-- AGENT_COUNT_ROLE_BASED: 10 -->

Plugins with no agents: gate-and-ship (commands only); banthis, skill-curator and system-prompt-curator (skill and command only); mojo and ada-spark (skills only); zig-lsp (LSP config only).

Tool lists are abbreviated: `Bash(git, gh)` means `Bash(git:*), Bash(gh:*)`.

## next-task Plugin Agents

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| task-discoverer | sonnet | Skill, Read, Grep, Bash(gh, glab, git) | Fetches, filters and scores tasks from the configured source and returns the top 5. |
| worktree-manager | haiku | Bash(git), Read | Creates an isolated worktree and feature branch for the selected task. Does not claim the task (the orchestrator does) or remove worktrees. |
| exploration-agent | sonnet | Read, Glob, Grep, Bash(git) | Finds the files to change, patterns to follow, dependencies and risks, and returns a report the planner uses without re-exploring. |
| planning-agent | inherit | Read, Glob, Grep, Bash(git) | Turns the exploration report into a JSON implementation plan for the user to approve. |
| implementation-agent | inherit | Read, Write, Edit, Glob, Grep, Bash(git, npm, node), LSP | Implements the approved plan with tests as local commits. Does not push, open a PR or run review agents: `/ship` owns the push. |
| simple-fixer | haiku | Read, Edit, Bash(git) | Applies a precomputed list of mechanical edits (remove line, replace text, insert line) from deslop or sync-docs and commits them. |
| ci-monitor | haiku | Bash(gh, git), Read, Task | Blocks on `gh pr checks --watch` with the whole wait bounded to 30 minutes, reports failing checks and review feedback, and hands fixes to ci-fixer for at most 5 rounds. Reports `passed`, `failed`, `timeout` or `no-checks`; does not reply to reviewers or merge. |
| ci-fixer | sonnet | Bash(git, npm, gh run view), Read, Edit, Grep, Glob | Fixes one CI failure or one review comment that needs a code change, commits it and pushes the PR branch. |

## prepare-delivery Plugin Agents

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| prepare-delivery-agent | inherit | Bash(git, npm, node, agnix), Skill, Task, Read, Edit, Write, Glob, Grep, AskUserQuestion | Runs the pre-ship gates (deslop, config lint, review loop, delivery validation, docs sync) and returns a `PREPARE_DELIVERY_RESULT` block. Local only; never pushes. |
| test-coverage-checker | sonnet | Bash(git, node), Skill, Read, Grep, Glob | Checks that changed code has tests that exercise it, not just a test file with a matching name. Advisory and read-only. |
| delivery-validator | sonnet | Skill, Bash(git, npm, node, cargo, go, pytest, make), Read, Grep, Glob | Decides whether a reviewed branch is ready to ship: tests, build, requirements and review status. Returns approval or fix instructions. |

## ship Plugin Agents

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| release-agent | sonnet | Read, Glob, Grep, Edit, Write, Bash(git, gh, npm, npx, node, cargo, go, python, pip, twine, mvn, gradle, make, sed, just, goreleaser) | Discovers how the repository releases, then plans or performs the release. |

## deslop Plugin Agents

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| deslop-agent | sonnet | Bash(git, node), Skill, Read, Glob, Grep | Scans for AI slop with the deslop skill and returns certainty-ranked findings plus safe fixes as a `DESLOP_RESULT` block. Read-only; the caller applies fixes. |

## enhance Plugin Agents

All eight load their matching `enhance-*` skill, which holds the analyzer command and the checks. Tools: Skill, Read, Glob, Grep, Bash(node), plus Edit and Bash(git) where noted.

| Agent | Model | Extra tools | What it analyzes |
|-------|-------|-------------|------------------|
| plugin-enhancer | sonnet | Edit, Bash(git) | Plugin manifests, MCP tool schemas, plugin security patterns |
| agent-enhancer | inherit | Edit, Bash(git) | Agent definitions: frontmatter, tools, model choice, prompt quality |
| claudemd-enhancer | inherit | Edit, Bash(git) | CLAUDE.md and AGENTS.md: broken references, bloat, instructions that no longer help |
| docs-enhancer | sonnet | Edit, Bash(git) | Documentation: broken links, structure, retrieval readiness |
| prompt-enhancer | inherit | Edit, Bash(git) | Prompt files: clarity, dated patterns, output contracts |
| hooks-enhancer | sonnet | Edit | Hook configs and scripts: safety, exit codes, timeouts |
| skills-enhancer | inherit | Edit | SKILL.md files: trigger quality, invocation control, tool scope, size |
| cross-file-enhancer | sonnet | Bash(git) | Consistency across agents, skills and commands: undeclared tools, missing agent references, duplicated or contradictory rules |

## drift-detect Plugin Agents

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| plan-synthesizer | sonnet | Read, Write, Glob, Grep | Compares the data from `scripts/collect.js` (issues, docs, code, analyzer facts) with the code and writes a Reality Check Report of drift, gaps and a prioritized plan. |

## repo-intel Plugin Agents

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| map-validator | haiku | Read | Sanity-checks a repo-intel init or status summary and returns valid, warning or invalid in one line. |
| repo-intel-summarizer | haiku | Read, Glob, Grep | Writes the three-depth repository summary (sentence, paragraph, page) for `/repo-intel enrich`. |
| repo-intel-weighter | haiku | Read, Glob, Grep | Writes a one-sentence descriptor per source file so `repo-intel find` can match concept queries, one batch per call. |

## perf Plugin Agents

| Agent | Model | Tools | What it does |
|-------|-------|-------|--------------|
| perf-orchestrator | inherit | Read, Write, Edit, Skill, Bash(git, node and the build and test runners) | Runs a whole `/perf` investigation as a subagent: phases, measurements, delegation to the perf skills, the investigation log. |
| perf-theory-gatherer | inherit | Skill, Read, Grep, Glob, Bash(git, node and the build and test runners) | Proposes up to 5 evidence-backed hypotheses from git history and the measurements so far. |
| perf-theory-tester | inherit | Skill, Read, Write, Edit, Bash(git, node and the build and test runners) | Tests one hypothesis: one change, repeated sequential benchmark runs, then revert to the clean baseline. |
| perf-code-paths | sonnet | Skill, Read, Grep, Glob | Maps the code paths, entry points and likely hot files for a scenario before profiling. |
| perf-investigation-logger | haiku | Skill, Read, Edit | Appends a structured log entry with exact user quotes, evidence pointers and decisions. |
| perf-analyzer | inherit | Skill, Read | Turns the investigation into evidence-backed recommendations and a continue-or-stop call. |

The build and test runners are npm, pnpm, yarn, cargo, go, pytest, python, mvn and gradle.

## audit-project Plugin Agents

Role-based: `/audit-project` spawns one subagent per pass with the pass's prompt from `commands/audit-project-agents.md` (a `general-purpose` agent in Claude Code), or runs the passes in sequence without Task. `--domain <name>` runs one pass.

| Pass | Reviewer | Runs when | Focus |
|------|----------|-----------|-------|
| code-quality | code-quality-reviewer | always | Bugs and logic errors, error handling, maintainability, duplication, conventions |
| security | security-expert | always | Authn and authz, input validation and output encoding, injection, secrets and unsafe config |
| performance | performance-engineer | always | N+1 queries, blocking calls in async paths, hot-path waste, leaks |
| test-coverage | test-quality-guardian | always (skipped with no test runner) | Untested code, missing edge cases, weak assertions, mock fit |
| architecture | architecture-reviewer | more than 50 files, or 3+ repo-intel slop targets | Ownership, dependency direction, cross-layer coupling |
| database | database-specialist | database detected | Query cost, missing indexes, transactions, migration safety |
| api | api-designer | API detected | Contracts, status codes and errors, rate limits, pagination, versioning |
| frontend | frontend-specialist | frontend detected | Component boundaries, state management, accessibility, render cost |
| backend | backend-specialist | backend detected | Service boundaries, domain correctness, concurrency and idempotency, background jobs |
| devops | devops-reviewer | CI/CD detected | Pipeline safety, secrets handling, build and test steps, deploy config |

## Other Plugin Agents

| Plugin | Agent | Model | Tools | What it does |
|--------|-------|-------|-------|--------------|
| sync-docs | sync-docs-agent | sonnet | Bash(git, node), Read, Glob, Grep | Compares docs with the code and returns confirmed doc issues plus exact fixes as a `SYNC_DOCS_RESULT` block. Read-only. |
| learn | learn-agent | sonnet | WebSearch, WebFetch, Skill, Read, Write, Glob, Grep | Researches a topic and writes a cited learning guide with a RAG index under `agent-knowledge/`. |
| consult | consult-agent | sonnet | Bash(the AI CLIs, node, npx, git, timeout), Read, Write | Runs a pre-resolved consultation with another AI CLI (Gemini, Codex, Claude, OpenCode, Copilot, Kiro), including parallel instances with a synthesis. |
| debate | debate-orchestrator | inherit | Bash(the AI CLIs, node, npx, git, timeout), Read, Write, Glob | Runs and judges a structured debate between two AI CLIs: proposer and challenger rounds and a verdict that picks a side. |
| skillers | skillers-compactor | sonnet | Read, Write, Glob, Bash(node), Skill | Turns a redacted digest of recent sessions into themed observations and merges them into weighted knowledge files. |
| skillers | skillers-recommender | opus | Read, Glob, Grep, Bash(node), Skill | Ranks at most five hooks, skills and agents worth creating from the knowledge, checked against what is installed. |
| onboard | onboard-agent | sonnet | Read, Glob, Grep, Bash(git), AskUserQuestion | Gives a short, code-grounded tour of an unfamiliar codebase from collected data, then answers follow-up questions. |
| can-i-help | can-i-help-agent | sonnet | Read, Glob, Grep, Bash(git, gh), AskUserQuestion | Matches a developer's interests to contribution targets: test gaps, stale docs, bugspots, cleanup candidates, open issues. |
| agnix | agnix-agent | sonnet | Bash(agnix, cargo), Read, Glob, Grep | Runs the agnix CLI for `/agnix` (with `--fix` only when asked) and returns the diagnostics as an `AGNIX_RESULT` block. |

## Navigation

[Back to Documentation Index](../README.md) | [Main README](../../README.md)
