<p align="center">
  <img src="site/assets/logo.png" alt="AgentSys" width="120">
</p>

<h1 align="center">AgentSys</h1>

<p align="center">
  <strong>A modular runtime and orchestration system for AI agents.</strong>
</p>

> **Renamed from `awesome-slash`** — The `awesome-` prefix implies a curated list of links, but this project is a functional software suite and runtime. Please update your installs: `npm install -g agentsys`

<p align="center">
  <a href="https://www.npmjs.com/package/agentsys"><img src="https://img.shields.io/npm/v/agentsys.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/agentsys"><img src="https://img.shields.io/npm/dm/agentsys.svg" alt="npm downloads"></a>
  <a href="https://github.com/avifenesh/agentsys/actions/workflows/ci.yml"><img src="https://github.com/avifenesh/agentsys/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/avifenesh/agentsys/stargazers"><img src="https://img.shields.io/github/stars/avifenesh/agentsys.svg" alt="GitHub stars"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://avifenesh.github.io/agentsys/"><img src="https://img.shields.io/badge/Website-AgentSys-blue?style=flat&logo=github" alt="Website"></a>
  <a href="https://github.com/hesreallyhim/awesome-claude-code"><img src="https://awesome.re/mentioned-badge.svg" alt="Mentioned in Awesome Claude Code"></a>
</p>

<p align="center">
  <b>13 plugins · 42 agents · 28 skills · 26k lines of lib code · 3,357 tests · 3 platforms</b>
</p>

<p align="center">
  <a href="#commands">Commands</a> · <a href="#installation">Installation</a> · <a href="https://avifenesh.github.io/agentsys/">Website</a> · <a href="https://github.com/avifenesh/agentsys/discussions">Discussions</a>
</p>

<p align="center">
  <b>Built for Claude Code · Codex CLI · OpenCode</b>
</p>

<p align="center"><em>New skills, agents, and integrations ship constantly. Follow for real-time updates:</em></p>
<p align="center">
  <a href="https://x.com/avi_fenesh"><img src="https://img.shields.io/badge/Follow-@avi__fenesh-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Follow on X"></a>
</p>

---

AI models can write code. That's not the hard part anymore. The hard part is everything around it — task selection, branch management, code review, artifact cleanup, CI, PR comments, deployment. **AgentSys is the runtime that orchestrates agents to handle all of it** — structured pipelines, gated phases, specialized agents, and persistent state that survives session boundaries.

---
> Building custom skills, agents, hooks, or MCP tools? [agnix](https://github.com/avifenesh/agnix) is the CLI + LSP linter that catches config errors before they fail silently - real-time IDE validation, auto suggestions, auto-fix, and 155 rules for Cursor, Claude Code, Cline, Copilot, Codex, Windsurf, and more.

## What This Is

An agent orchestration system — 13 plugins, 42 agents, and 28 skills that compose into structured pipelines for software development.

Each agent has a single responsibility, a specific model assignment, and defined inputs/outputs. Pipelines enforce phase gates so agents can't skip steps. State persists across sessions so work survives interruptions.

The system runs on Claude Code, OpenCode, and Codex CLI. Install the plugins, get the runtime.

---

## The Approach

**Code does code work. AI does AI work.**

- **Detection**: regex, AST analysis, static analysis—fast, deterministic, no tokens wasted
- **Judgment**: LLM calls for synthesis, planning, review—where reasoning matters
- **Result**: 77% fewer tokens for [/drift-detect](#drift-detect) vs multi-agent approaches, certainty-graded findings throughout

**Certainty levels exist because not all findings are equal:**

| Level | Meaning | Action |
|-------|---------|--------|
| HIGH | Definitely a problem | Safe to auto-fix |
| MEDIUM | Probably a problem | Needs context |
| LOW | Might be a problem | Needs human judgment |

This came from testing on 1,000+ repositories.

---

## Commands

<!-- GEN:START:readme-commands -->
| Command | What it does |
|---------|--------------|
| [`/next-task`](#next-task) | Task → exploration → plan → implementation → review → ship |
| [`/agnix`](#agnix) | **Lint agent configs** - 155 rules for Skills, Memory, Hooks, MCP across 10+ AI tools |
| [`/ship`](#ship) | Branch → PR → CI → reviews addressed → merge → cleanup |
| [`/deslop`](#deslop) | 3-phase detection pipeline, certainty-graded findings |
| [`/perf`](#perf) | 10-phase performance investigation with baselines and profiling |
| [`/drift-detect`](#drift-detect) | AST-based plan vs code analysis, finds what's documented but not built |
| [`/audit-project`](#audit-project) | Multi-agent code review, iterates until issues resolved |
| [`/enhance`](#enhance) | Analyzes prompts, agents, plugins, docs, hooks, skills |
| [`/repo-map`](#repo-map) | AST symbol and import mapping via ast-grep |
| [`/sync-docs`](#sync-docs) | Finds outdated references, stale examples, missing CHANGELOG entries |
| [`/learn`](#learn) | Research any topic, gather online sources, create learning guide with RAG index |
| [`/consult`](#consult) | Consult another AI CLI tool for a second opinion. Use when you want to cross-check ideas, get alternative approaches, or validate decisions with Gemini, Codex, Claude, OpenCode, or Copilot. |
| [`/debate`](#debate) | Use when user asks to "debate", "argue about", "compare perspectives", "stress test idea", "devil advocate", or "tool vs tool". Structured debate between two AI tools with proposer/challenger roles and a verdict. |
<!-- GEN:END:readme-commands -->

Each command works standalone. Together, they compose into end-to-end pipelines.

---

## Skills

<!-- GEN:START:readme-skills -->
28 skills included across the plugins:

| Category | Skills |
|----------|--------|
| **Performance** | `perf:perf-analyzer`, `perf:perf-baseline-manager`, `perf:perf-benchmarker`, `perf:perf-code-paths`, `perf:perf-investigation-logger`, `perf:perf-profiler`, `perf:perf-theory-gatherer`, `perf:perf-theory-tester` |
| **Enhancement** | `enhance:enhance-agent-prompts`, `enhance:enhance-claude-memory`, `enhance:enhance-cross-file`, `enhance:enhance-docs`, `enhance:enhance-hooks`, `enhance:enhance-orchestrator`, `enhance:enhance-plugins`, `enhance:enhance-prompts`, `enhance:enhance-skills` |
| **Workflow** | `next-task:discover-tasks`, `next-task:orchestrate-review`, `next-task:validate-delivery` |
| **Cleanup** | `deslop:deslop`, `sync-docs:sync-docs` |
| **Analysis** | `debate:debate`, `drift-detect:drift-analysis`, `repo-map:repo-mapping` |
| **Productivity** | `consult:consult` |
| **Learning** | `learn:learn` |
| **Linting** | `agnix:agnix` |
<!-- GEN:END:readme-skills -->

Skills are the reusable implementation units. Agents invoke skills; commands orchestrate agents. When you install a plugin, its skills become available to all agents in that session.

---

## Quick Navigation

| Section | What's there |
|---------|--------------|
| [The Approach](#the-approach) | Why it's built this way |
| [Commands](#commands) | All 12 commands overview |
| [Skills](#skills) | 28 skills across plugins |
| [Command Details](#command-details) | Deep dive into each command |
| [How Commands Work Together](#how-commands-work-together) | Standalone vs integrated |
| [Design Philosophy](#design-philosophy) | The thinking behind the architecture |
| [Installation](#installation) | Get started |
| [Research & Testing](#research--testing) | What went into building this |
| [Documentation](#documentation) | Links to detailed docs |

---

## Command Details

### /next-task

**Purpose:** Complete task-to-production automation.

**What happens when you run it:**

1. **Policy Selection** - Choose task source (GitHub issues, GitLab, local file), priority filter, stopping point
2. **Task Discovery** - Shows top 5 prioritized tasks, you pick one
3. **Worktree Setup** - Creates isolated branch and working directory
4. **Exploration** - Deep codebase analysis to understand context
5. **Planning** - Designs implementation approach
6. **User Approval** - You review and approve the plan (last human interaction)
7. **Implementation** - Executes the plan
8. **Pre-Review** - Runs [deslop](#deslop)-agent and test-coverage-checker
9. **Review Loop** - Multi-agent review iterates until clean
10. **Delivery Validation** - Verifies tests pass, build passes, requirements met
11. **Docs Update** - Updates CHANGELOG and related documentation
12. **[Ship](#ship)** - Creates PR, monitors CI, addresses comments, merges

Phase 9 uses the `orchestrate-review` skill to spawn parallel reviewers (code quality, security, performance, test coverage) plus conditional specialists.

**Agents involved:**

| Agent | Model | Role |
|-------|-------|------|
| task-discoverer | sonnet | Finds and ranks tasks from your source |
| worktree-manager | haiku | Creates git worktrees and branches |
| exploration-agent | opus | Deep codebase analysis before planning |
| planning-agent | opus | Designs step-by-step implementation plan |
| implementation-agent | opus | Writes the actual code |
| test-coverage-checker | sonnet | Validates tests exist and are meaningful |
| delivery-validator | sonnet | Final checks before shipping |
| ci-monitor | haiku | Watches CI status |
| ci-fixer | sonnet | Fixes CI failures and review comments |
| simple-fixer | haiku | Executes mechanical edits |

**Cross-plugin agent:**
| Agent | Plugin | Role |
|-------|--------|------|
| deslop-agent | deslop | Removes AI artifacts before review |
| sync-docs-agent | sync-docs | Updates documentation |

**Usage:**

```bash
/next-task              # Start new workflow
/next-task --resume     # Resume interrupted workflow
/next-task --status     # Check current state
/next-task --abort      # Cancel and cleanup
```

[Full workflow documentation →](./docs/workflows/NEXT-TASK.md)

---

### /agnix

**Purpose:** Lint agent configurations before they break your workflow. The first dedicated linter for AI agent configs.

**[agnix](https://github.com/avifenesh/agnix)** is a standalone open-source project that provides the validation engine. This plugin integrates it into your workflow.

**The problem it solves:**

Agent configurations are code. They affect behavior, security, and reliability. But unlike application code, they have no linting. You find out your SKILL.md is malformed when the agent fails. You discover your hooks have security issues when they're exploited. You realize your CLAUDE.md has conflicting rules when the AI behaves unexpectedly.

agnix catches these issues before they cause problems.

**What it validates:**

| Category | What It Checks |
|----------|----------------|
| **Structure** | Required fields, valid YAML/JSON, proper frontmatter |
| **Security** | Prompt injection vectors, overpermissive tools, exposed secrets |
| **Consistency** | Conflicting rules, duplicate definitions, broken references |
| **Best Practices** | Tool restrictions, model selection, trigger phrase quality |
| **Cross-Platform** | Compatibility across Claude Code, Cursor, Copilot, Codex, OpenCode, Gemini CLI, Cline, and more |

**155 validation rules** (57 auto-fixable) derived from:
- Official tool specifications (Claude Code, Cursor, GitHub Copilot, Codex CLI, OpenCode, Gemini CLI, and more)
- Research papers on agent reliability and prompt injection
- Real-world testing across 500+ repositories
- Community-reported issues and edge cases

**Supported files:**

| File Type | Examples |
|-----------|----------|
| Skills | `SKILL.md`, `*/SKILL.md` |
| Memory | `CLAUDE.md`, `AGENTS.md`, `.github/CLAUDE.md` |
| Hooks | `.claude/settings.json`, hooks configuration |
| MCP | `*.mcp.json`, MCP server configs |
| Cursor | `.cursor/rules/*.mdc`, `.cursorrules` |
| Copilot | `.github/copilot-instructions.md` |

**CI/CD Integration:**

agnix outputs SARIF format for GitHub Code Scanning. Add it to your workflow:

```yaml
- name: Lint agent configs
  run: agnix --format sarif > results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

**Usage:**

```bash
/agnix                       # Validate current project
/agnix --fix                 # Auto-fix fixable issues
/agnix --strict              # Treat warnings as errors
/agnix --target claude-code  # Only Claude Code rules
/agnix --format sarif        # Output for GitHub Code Scanning
```

**Agent:** agnix-agent (sonnet model)

**External tool:** Requires [agnix CLI](https://github.com/avifenesh/agnix)

```bash
npm install -g agnix         # Install via npm
# or
cargo install agnix-cli      # Install via Cargo
# or
brew install agnix           # Install via Homebrew (macOS)
```

**Why use agnix:**
- Catch config errors before they cause agent failures
- Enforce security best practices across your team
- Maintain consistency as your agent configs grow
- Integrate validation into CI/CD pipelines
- Support multiple AI tools from one linter

---

### /ship

**Purpose:** Takes your current branch from "ready to commit" to "merged PR."

**What happens when you run it:**

1. **Pre-flight** - Detects CI platform, deployment platform, branch strategy
2. **Commit** - Stages and commits with generated message (if uncommitted changes)
3. **Push & PR** - Pushes branch, creates pull request
4. **CI Monitor** - Waits for CI, retries on transient failures
5. **Review Wait** - Waits 3 minutes for auto-reviewers (Copilot, Claude, Gemini, Codex)
6. **Address Comments** - Handles every comment from every reviewer
7. **Merge** - Merges when all comments resolved and CI passes
8. **Deploy** - Deploys and validates (if multi-branch workflow)
9. **Cleanup** - Removes worktree, closes issue, deletes branch

**Platform Detection:**

| Type | Detected |
|------|----------|
| CI | GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis |
| Deploy | Railway, Vercel, Netlify, Fly.io, Render |
| Project | Node.js, Python, Rust, Go, Java |

**Review Comment Handling:**

Every comment gets addressed. No exceptions. The workflow categorizes comments and handles each:
- Code fixes get implemented
- Style suggestions get applied
- Questions get answered
- False positives get explained

If something can't be fixed, the workflow replies explaining why and resolves the thread.

**Usage:**

```bash
/ship                       # Full workflow
/ship --dry-run             # Preview without executing
/ship --strategy rebase     # Use rebase instead of squash
```

[Full workflow documentation →](./docs/workflows/SHIP.md)

---

### /deslop

**Purpose:** Finds AI slop—debug statements, placeholder text, verbose comments, TODOs—and removes it.

**How detection works:**

Three phases run in sequence:

1. **Phase 1: Regex Patterns** (HIGH certainty)
   - `console.log`, `print()`, `dbg!()`, `println!()`
   - `// TODO`, `// FIXME`, `// HACK`
   - Empty catch blocks, disabled linters
   - Hardcoded secrets (API keys, tokens)

2. **Phase 2: Multi-Pass Analyzers** (MEDIUM certainty)
   - Doc-to-code ratio (excessive comments)
   - Verbosity ratio (AI preambles)
   - Over-engineering patterns
   - Buzzword inflation
   - Dead code detection
   - Stub functions

3. **Phase 3: CLI Tools** (LOW certainty, optional)
   - jscpd, madge, escomplex (JS/TS)
   - pylint, radon (Python)
   - golangci-lint (Go)
   - clippy (Rust)

**Languages supported:** JavaScript/TypeScript, Python, Rust, Go, Java

**Usage:**

```bash
/deslop              # Report only (safe)
/deslop apply        # Fix HIGH certainty issues
/deslop apply src/ 10  # Fix 10 issues in src/
```

**Thoroughness levels:**

- `quick` - Phase 1 only (fastest)
- `normal` - Phase 1 + Phase 2 (default)
- `deep` - All phases if tools available

[Pattern reference →](./docs/reference/SLOP-PATTERNS.md)

---

### /perf

**Purpose:** Structured performance investigation with baselines, profiling, and evidence-backed decisions.

**10-phase methodology** (based on recorded real performance investigation sessions):

1. **Setup** - Confirm scenario, success criteria, benchmark command
2. **Baseline** - 60s minimum runs, PERF_METRICS markers required
3. **Breaking Point** - Binary search to find failure threshold
4. **Constraints** - CPU/memory limits, measure delta vs baseline
5. **Hypotheses** - Generate up to 5 hypotheses with evidence and confidence
6. **Code Paths** - Use repo-map to identify entrypoints and hot files
7. **Profiling** - Language-specific tools (--cpu-prof, JFR, cProfile, pprof)
8. **Optimization** - One change per experiment, 2+ validation passes
9. **Decision** - Continue or stop based on measurable improvement
10. **Consolidation** - Final baseline, evidence log, investigation complete

**Agents and skills:**

| Component | Role |
|-----------|------|
| perf-orchestrator | Coordinates all phases |
| perf-theory-gatherer | Generates hypotheses from git history and code |
| perf-theory-tester | Validates hypotheses with controlled experiments |
| perf-analyzer | Synthesizes findings into recommendations |
| perf-code-paths | Maps entrypoints and likely hot paths |
| perf-investigation-logger | Structured evidence logging |

**Usage:**

```bash
/perf                 # Start new investigation
/perf --resume        # Resume previous investigation
```

**Phase flags (advanced):**

```bash
/perf --phase baseline --command "npm run bench" --version v1.2.0
/perf --phase breaking-point --param-min 1 --param-max 500
/perf --phase constraints --cpu 1 --memory 1GB
/perf --phase hypotheses --hypotheses-file perf-hypotheses.json
/perf --phase optimization --change "reduce allocations"
/perf --phase decision --verdict stop --rationale "no measurable improvement"
```

---

### /drift-detect

**Purpose:** Compares your documentation and plans to what's actually in the code.

**The problem it solves:**

Your roadmap says "user authentication: done." But is it actually implemented? Your GitHub issue says "add dark mode." Is it already in the codebase? Plans drift from reality. This command finds the drift.

**How it works:**

1. **JavaScript collectors** gather data (fast, token-efficient)
   - GitHub issues and their labels
   - Documentation files
   - Actual code exports and implementations

2. **Single Opus call** performs semantic analysis
   - Matches concepts, not strings ("user auth" matches `auth/`, `login.js`, `session.ts`)
   - Identifies implemented but not documented
   - Identifies documented but not implemented
   - Finds stale issues that should be closed

**Why this approach:**

Multi-agent collection wastes tokens on coordination. JavaScript collectors are fast and deterministic. One well-prompted LLM call does the actual analysis. Result: 77% token reduction vs multi-agent approaches.

**Tested on 1,000+ repositories** before release.

**Usage:**

```bash
/drift-detect              # Full analysis
/drift-detect --depth quick  # Quick scan
```

---

### /audit-project

**Purpose:** Multi-agent code review that iterates until issues are resolved.

**What happens when you run it:**

Up to 10 specialized role-based agents run based on your project:

| Agent | When Active | Focus Area |
|-------|-------------|------------|
| code-quality-reviewer | Always | Code quality, error handling |
| security-expert | Always | Vulnerabilities, auth, secrets |
| performance-engineer | Always | N+1 queries, memory, blocking ops |
| test-quality-guardian | Always | Coverage, edge cases, mocking |
| architecture-reviewer | If 50+ files | Modularity, patterns, SOLID |
| database-specialist | If DB detected | Queries, indexes, transactions |
| api-designer | If API detected | REST, errors, pagination |
| frontend-specialist | If frontend detected | Components, state, UX |
| backend-specialist | If backend detected | Services, domain logic |
| devops-reviewer | If CI/CD detected | Pipelines, configs, secrets |

Findings are collected and categorized by severity (critical/high/medium/low). All non-false-positive issues get fixed automatically. The loop repeats until no open issues remain.

**Usage:**

```bash
/audit-project                   # Full review
/audit-project --quick           # Single pass
/audit-project --resume          # Resume from queue file
/audit-project --domain security # Security focus only
/audit-project --recent          # Only recent changes
```

[Agent reference →](./docs/reference/AGENTS.md#audit-project-plugin-agents)

---

### /enhance

**Purpose:** Analyzes your prompts, plugins, agents, docs, hooks, and skills for improvement opportunities.

**Seven analyzers run in parallel:**

| Analyzer | What it checks |
|----------|----------------|
| plugin-enhancer | Plugin structure, MCP tool definitions, security patterns |
| agent-enhancer | Agent frontmatter, prompt quality |
| claudemd-enhancer | CLAUDE.md/AGENTS.md structure, token efficiency |
| docs-enhancer | Documentation readability, RAG optimization |
| prompt-enhancer | Prompt engineering patterns, clarity, examples |
| hooks-enhancer | Hook frontmatter, structure, safety |
| skills-enhancer | SKILL.md structure, trigger phrases |

**Each finding includes:**
- Certainty level (HIGH/MEDIUM/LOW)
- Specific location (file:line)
- What's wrong
- How to fix it
- Whether it can be auto-fixed

**Auto-learning:** Detects obvious false positives (pattern docs, workflow gates) and saves them for future runs. Reduces noise over time without manual suppression files.

**Usage:**

```bash
/enhance                    # Run all analyzers
/enhance --focus=agent      # Just agent prompts
/enhance --apply            # Apply HIGH certainty fixes
/enhance --show-suppressed  # Show what's being filtered
/enhance --no-learn         # Analyze but don't save false positives
```

---

### /repo-map

**Purpose:** Builds an AST-based map of symbols and imports for fast repo analysis.

**What it generates:**

- Cached file→symbols map (exports, functions, classes)
- Import graph for dependency hints

Output is cached at `{state-dir}/repo-map.json` and exposed via the MCP `repo_map` tool.

**Why it matters:**

Tools like `/drift-detect` and planners can use the map instead of re-scanning the repo every time.

**Usage:**

```bash
/repo-map init        # First-time map generation
/repo-map update      # Incremental update
/repo-map status      # Check freshness
```

**Required:** ast-grep (`sg`) must be installed.

---

### /sync-docs

**Purpose:** Sync documentation with actual code changes—find outdated refs, update CHANGELOG, flag stale examples.

**The problem it solves:**

You refactor `auth.js` into `auth/index.js`. Your README still says `import from './auth'`. You rename a function. Three docs still reference the old name. You ship a feature. CHANGELOG doesn't mention it. Documentation drifts from code. This command finds the drift.

**What it detects:**

| Category | Examples |
|----------|----------|
| Broken references | Imports to moved/renamed files, deleted exports |
| Version mismatches | Doc says v2.0, package.json says v2.1 |
| Stale code examples | Import paths that no longer exist |
| Missing CHANGELOG | `feat:` and `fix:` commits without entries |

**Auto-fixable vs flagged:**

| Auto-fixable (apply mode) | Flagged for review |
|---------------------------|-------------------|
| Version number updates | Removed exports referenced in docs |
| CHANGELOG entries for commits | Code examples needing context |
| | Function renames |

**Usage:**

```bash
/sync-docs              # Check what docs need updates (safe)
/sync-docs apply        # Apply safe fixes
/sync-docs report src/  # Check docs related to src/
/sync-docs --all        # Full codebase scan
```

---

### /learn

**Purpose:** Research any topic online and create a comprehensive learning guide with RAG-optimized indexes.

**What it does:**

1. **Progressive Discovery** - Uses funnel approach (broad → specific → deep) to find quality sources
2. **Quality Scoring** - Scores sources by authority, recency, depth, examples, uniqueness
3. **Just-In-Time Extraction** - Fetches only high-scoring sources to save tokens
4. **Synthesis** - Creates structured learning guide with examples and best practices
5. **RAG Index** - Updates CLAUDE.md/AGENTS.md master index for future lookups
6. **Enhancement** - Runs enhance:enhance-docs and enhance:enhance-prompts

**Depth levels:**

| Depth | Sources | Use Case |
|-------|---------|----------|
| brief | 10 | Quick overview |
| medium | 20 | Default, balanced |
| deep | 40 | Comprehensive |

**Output structure:**

```
agent-knowledge/
  CLAUDE.md                    # Master index (updated each run)
  AGENTS.md                    # Index for OpenCode/Codex
  recursion.md                 # Topic-specific guide
  resources/
    recursion-sources.json     # Source metadata with quality scores
```

**Usage:**

```bash
/learn recursion                    # Default (20 sources)
/learn react hooks --depth=deep     # Comprehensive (40 sources)
/learn kubernetes --depth=brief     # Quick overview (10 sources)
/learn python async --no-enhance    # Skip enhancement pass
```

**Agent:** learn-agent (opus model for research quality)

---

### /consult

**Purpose:** Get a second opinion from another AI CLI tool without leaving your current session.

**What it does:**

1. **Tool Detection** - Detects which AI CLI tools are installed (cross-platform)
2. **Interactive Picker** - If no tool specified, shows only installed tools to choose from
3. **Effort Mapping** - Maps effort levels to per-provider models and reasoning flags
4. **Execution** - Runs the consultation with safe-mode defaults and 120s timeout
5. **Session Continuity** - Saves session state for Claude and Gemini (supports `--continue`)

**Supported tools:**

| Tool | Default Model (high) | Reasoning Control |
|------|---------------------|-------------------|
| Claude | claude-opus-4-6 | max-turns |
| Gemini | gemini-3.1-pro-preview | built-in |
| Codex | gpt-5.3-codex | model_reasoning_effort |
| OpenCode | (user-selected or default) | --variant |
| Copilot | (default) | none |

**Usage:**

```bash
/consult "Is this the right approach?" --tool=gemini --effort=high
/consult "Review for performance issues" --tool=codex
/consult "Suggest alternatives" --tool=claude --effort=max
/consult "Continue from where we left off" --continue
/consult "Explain this error" --context=diff --tool=gemini
```

**Agent:** consult-agent (sonnet model for orchestration)

---

### /debate

**Purpose:** Stress-test ideas through structured multi-round debate between two AI CLI tools.

**What it does:**

1. **Tool Detection** - Detects which AI CLI tools are installed (cross-platform)
2. **Interactive Picker** - If no tools specified, prompts for proposer, challenger, effort, rounds, and context in a single batch question
3. **Proposer/Challenger Format** - First tool argues for the topic; second tool challenges with evidence
4. **Multi-Round Exchange** - Each round the proposer defends and the challenger responds (1–5 rounds)
5. **Verdict** - Orchestrator delivers a final synthesis picking a winner with reasoning

**Usage:**

```bash
# Natural language
/debate codex vs gemini about microservices vs monolith
/debate with claude and codex about our auth implementation
/debate thoroughly gemini vs codex about database schema design
/debate codex vs gemini 3 rounds about event sourcing

# Explicit flags
/debate "Should we use event sourcing?" --tools=claude,gemini --rounds=3 --effort=high
/debate "Valkey vs PostgreSQL for caching" --tools=codex,opencode

# With codebase context
/debate "Is our current approach correct?" --tools=gemini,codex --context=diff
```

**Options:**

| Flag | Description |
|------|-------------|
| `--tools=TOOL1,TOOL2` | Proposer and challenger (comma-separated) |
| `--rounds=N` | Number of debate rounds, 1–5 (default: 2) |
| `--effort=low\|medium\|high\|max` | Reasoning depth per tool call |
| `--context=diff\|file=PATH\|none` | Codebase context passed to both tools |

**Agent:** debate-orchestrator (opus model for orchestration)

---

## How Commands Work Together

**Standalone use:**

```bash
/deslop apply          # Just clean up your code
/sync-docs             # Just check if docs need updates
/ship                  # Just ship this branch
/audit-project         # Just review the codebase
```

**Integrated workflow:**

When you run [`/next-task`](#next-task), it orchestrates everything:

```
/next-task picks task → explores codebase → plans implementation
    ↓
implementation-agent writes code
    ↓
deslop-agent cleans AI artifacts
    ↓
Phase 9 review loop iterates until approved
    ↓
delivery-validator checks requirements
    ↓
sync-docs-agent syncs documentation
    ↓
[/ship](#ship) creates PR → monitors CI → merges
```

The workflow tracks state so you can resume from any point.

---

## Design Philosophy

<details>
<summary><strong>Architecture decisions and trade-offs</strong> (click to expand)</summary>

### The Actual Problem

Frontier models write good code. That's solved. What's not solved:

- **Context management** - Models forget what they're doing mid-session
- **Compaction amnesia** - Long sessions get summarized, losing critical state
- **Task drift** - Without structure, agents wander from the actual goal
- **Skipped steps** - Agents skip reviews, tests, or cleanup when not enforced
- **Token waste** - Using LLM calls for work that static analysis can do faster
- **Babysitting** - Manually orchestrating each phase of development
- **Repetitive requests** - Asking for the same workflow every single session

### How This Addresses It

**1. One agent, one job, done extremely well**

Same principle as good code: single responsibility. The exploration-agent explores. The implementation-agent implements. Phase 9 spawns multiple focused reviewers. No agent tries to do everything. Specialized agents, each with narrow scope and clear success criteria.

**2. Pipeline with gates, not a monolith**

Same principle as DevOps. Each step must pass before the next begins. Can't push before review. Can't merge before CI passes. Hooks enforce this—agents literally cannot skip phases.

**3. Tools do tool work, agents do agent work**

If static analysis, regex, or a shell command can do it, don't ask an LLM. Pattern detection uses pre-indexed regex. File discovery uses glob. Platform detection uses file existence checks. The LLM only handles what requires judgment.

**4. Agents don't need to know how tools work**

The slop detector returns findings with certainty levels. The agent doesn't need to understand the three-phase pipeline, the regex patterns, or the analyzer heuristics. Good tool design means the consumer doesn't need implementation details.

**5. Build tools where tools don't exist**

Many tasks lack existing tools. JavaScript collectors for drift-detect. Multi-pass analyzers for slop detection. The result: agents receive structured data, not raw problems to figure out.

**6. Research-backed prompt engineering**

Documented techniques that measurably improve results:
- **Progressive disclosure** - Agents see only what's needed for the current step
- **Structured output** - JSON between delimiters, XML tags for sections
- **Explicit constraints** - What agents MUST NOT do matters as much as what they do
- **Few-shot examples** - Where patterns aren't obvious
- **Tool calling over generation** - Let the model use tools rather than generate tool-like output

**7. Validate plan and results, not every step**

Approve the plan. See the results. The middle is automated. One plan approval unlocks autonomous execution through implementation, review, cleanup, and shipping.

**8. Right model for the task**

Match model capability to task complexity:
- **opus** - Exploration, planning, implementation, review orchestration
- **sonnet** - Pattern matching, validation, discovery
- **haiku** - Git operations, file moves, CI polling

Quality compounds. Poor exploration → poor plan → poor implementation → review cycles. Early phases deserve the best model.

**9. Persistent state survives sessions**

Two JSON files track everything: what task, what phase. Sessions can die and resume. Multiple sessions run in parallel on different tasks using separate worktrees.

**10. Delegate everything automatable**

Agents don't just write code. They:
- Clean their own output (deslop-agent)
- Update documentation (sync-docs-agent)
- Fix CI failures (ci-fixer)
- Respond to review comments
- Check for plan drift ([/drift-detect](#drift-detect))
- Analyze their own prompts ([/enhance](#enhance))

If it can be specified, it can be delegated.

**11. Orchestrator stays high-level**

The main workflow orchestrator doesn't read files, search code, or write implementations. It launches specialized agents and receives their outputs. Keeps the orchestrator's context window available for coordination rather than filled with file contents.

**12. Composable, not monolithic**

Every command works standalone. [`/deslop`](#deslop) cleans code without needing [`/next-task`](#next-task). [`/ship`](#ship) merges PRs without needing the full workflow. Pieces compose together, but each piece is useful on its own.

### What This Gets You

- **Run multiple sessions** - Different tasks in different worktrees, no interference
- **Fast iteration** - Approve plan, check results, repeat
- **Stay in the interesting parts** - Policy decisions, architecture choices, edge cases
- **Minimal review burden** - Most issues caught and fixed before you see the output
- **No repetitive requests** - The workflow you want, without asking each time
- **Scale horizontally** - More sessions, more tasks, same oversight level

</details>

---

## Installation

### Claude Code (Recommended way)

```bash
/plugin marketplace add avifenesh/agentsys
/plugin install next-task@agentsys
/plugin install ship@agentsys
```

### All Platforms (npm)

```bash
npm install -g agentsys && agentsys
```

Interactive installer for Claude Code, OpenCode, and Codex CLI.

```bash
# Non-interactive install
agentsys --tool claude              # Single tool
agentsys --tools "claude,opencode"  # Multiple tools
agentsys --development              # Dev mode (bypasses marketplace)
```

[Full installation guide →](./docs/INSTALLATION.md)

---

## Requirements

**Required:**
- Git
- Node.js 18+

**For GitHub workflows:**
- GitHub CLI (`gh`) authenticated

**For GitLab workflows:**
- GitLab CLI (`glab`) authenticated

**For /repo-map:**
- ast-grep (`sg`) installed

**For /agnix:**
- [agnix CLI](https://github.com/avifenesh/agnix) installed (`cargo install agnix-cli` or `brew install agnix`)

**Local diagnostics (optional):**
```bash
npm run detect   # Platform detection (CI, deploy, project type)
npm run verify   # Tool availability + versions
```

---

## Research & Testing

The system is built on research, not guesswork.

**Knowledge base** (`agent-docs/`): 8,000 lines of curated documentation from Anthropic, OpenAI, Google, and Microsoft covering:
- Agent architecture and design patterns
- Prompt engineering techniques
- Function calling and tool use
- Context efficiency and token optimization
- Multi-agent systems and orchestration
- Instruction following reliability

**Testing:**
- 1,818 tests passing
- Drift-detect validated on 1,000+ repositories
- E2E workflow testing across all commands
- Cross-platform validation (Claude Code, OpenCode, Codex CLI)

**Methodology:**
- `/perf` investigation phases based on recorded real performance investigation sessions
- Certainty levels derived from pattern analysis across repositories
- Token optimization measured and validated (77% reduction in drift-detect)

---

## Documentation

| Topic | Link |
|-------|------|
| Installation | [docs/INSTALLATION.md](./docs/INSTALLATION.md) |
| Cross-Platform Setup | [docs/CROSS_PLATFORM.md](./docs/CROSS_PLATFORM.md) |
| Usage Examples | [docs/USAGE.md](./docs/USAGE.md) |
| Architecture | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |

### Workflow Deep-Dives

| Workflow | Link |
|----------|------|
| /next-task Flow | [docs/workflows/NEXT-TASK.md](./docs/workflows/NEXT-TASK.md) |
| /ship Flow | [docs/workflows/SHIP.md](./docs/workflows/SHIP.md) |

### Reference

| Topic | Link |
|-------|------|
| Slop Patterns | [docs/reference/SLOP-PATTERNS.md](./docs/reference/SLOP-PATTERNS.md) |
| Agent Reference | [docs/reference/AGENTS.md](./docs/reference/AGENTS.md) |

---

## Support

- **Issues:** [github.com/avifenesh/agentsys/issues](https://github.com/avifenesh/agentsys/issues)
- **Discussions:** [github.com/avifenesh/agentsys/discussions](https://github.com/avifenesh/agentsys/discussions)

---

MIT License | Made by [Avi Fenesh](https://github.com/avifenesh)
