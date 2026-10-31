<p align="center">
  <img src="site/assets/logo.png" alt="AgentSys" width="120">
</p>

<h1 align="center">AgentSys</h1>

<p align="center">
  <strong>A modular runtime and orchestration system for AI agents.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agentsys"><img src="https://img.shields.io/npm/v/agentsys.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/agentsys"><img src="https://img.shields.io/npm/dm/agentsys.svg" alt="npm downloads"></a>
  <a href="https://github.com/agent-sh/agentsys/actions/workflows/ci.yml"><img src="https://github.com/agent-sh/agentsys/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/agent-sh/agentsys/stargazers"><img src="https://img.shields.io/github/stars/agent-sh/agentsys.svg" alt="GitHub stars"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://agent-sh.github.io/agentsys/"><img src="https://img.shields.io/badge/Website-AgentSys-blue?style=flat&logo=github" alt="Website"></a>
  <a href="https://github.com/hesreallyhim/awesome-claude-code"><img src="https://awesome.re/mentioned-badge.svg" alt="Mentioned in Awesome Claude Code"></a>
</p>

<p align="center">
  <b>11 plugins · 5 agents · 14 skills (across all repos) · 13k lines of lib code · tests on Linux and Windows · 5 platforms</b><br>
  <em>Plugins distributed as standalone repos under <a href="https://github.com/agent-sh">agent-sh</a> org - agentsys is the marketplace &amp; installer</em>
</p>

> Running open models for your company? [**Tiyuvta**](https://tiyuvta.ai/services/) helps with model choice, deployment and optimization, and fine-tuning on your hardware or cloud account.

> Built and maintained with a lot of agent tokens and hours.
> If it saves you time, [sponsoring](https://github.com/sponsors/avifenesh) helps keep it going.

<p align="center">
  <a href="#commands">Commands</a> · <a href="#installation">Installation</a> · <a href="https://agent-sh.github.io/agentsys/">Website</a> · <a href="https://github.com/agent-sh/agentsys/discussions">Discussions</a>
</p>

<p align="center">
  <b>Built for Claude Code · Codex CLI · OpenCode · Cursor · Kiro</b>
</p>

<p align="center"><em>New skills, agents, and integrations ship constantly. Follow for real-time updates:</em></p>
<p align="center">
  <a href="https://x.com/avi_fenesh"><img src="https://img.shields.io/badge/Follow-@avi__fenesh-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Follow on X"></a>
</p>

---

AI models can write code. That's not the hard part anymore. The hard part is everything around it - branch management, code review, artifact cleanup, CI, PR comments. **AgentSys is the runtime that orchestrates agents to handle all of it** - structured pipelines, gated phases, specialized agents, and persistent state that survives session boundaries.

---
> Building custom skills, agents, hooks, or MCP tools? [agnix](https://github.com/agent-sh/agnix) is the CLI + LSP linter that catches config errors before they fail silently - real-time IDE validation, auto suggestions, auto-fix, and 457 rules for Claude Code, Codex, OpenCode, Cursor, Kiro, Copilot, Gemini CLI, Cline, Windsurf, Roo Code, Amp, and more.

## What's New in 6.1.1

- OpenCode, Codex, Cursor and Kiro installs get the plugins that ship no `.claude-plugin/plugin.json` at their pin. The installer fetched such a plugin and installed nothing from it. It now makes one from the marketplace entry, as Claude Code does.
- agnix installs its `/agnix` command, agent and skill on every platform. Claude Code installed only its skill before, and the other platforms nothing. The marketplace entry is now a `git-subdir` source for the plugin's `plugin/` folder.
- The installer fetches a `git-subdir` source as that folder, pinned by `sha` or `commit`.
- Contributor docs: every change reaches main through a PR, and a release commit merges through a PR with only the tag pushed.

## What This Is

An agent orchestration system - 11 plugins, 5 agents, and 14 skills that compose into structured pipelines for software development. Each plugin lives in its own standalone repo under the [agent-sh](https://github.com/agent-sh) org. agentsys is the marketplace and installer that ties them together.

Each agent has a single responsibility, a specific model assignment, and defined inputs/outputs. Pipelines enforce phase gates so agents can't skip steps. State persists across sessions so work survives interruptions.

The system runs on Claude Code, OpenCode, Codex CLI, Cursor, and Kiro. Install via the marketplace or the npm installer, and the plugins are fetched automatically from their repos.

---

## The Approach

**Code does code work. AI does AI work.**

- **Detection**: regex, AST analysis, static analysis - fast, deterministic, no tokens wasted
- **Judgment**: LLM calls for synthesis, planning, review - where reasoning matters
- **Result**: certainty-graded findings throughout

**Certainty levels exist because not all findings are equal:**

| Level | Meaning | Action |
|-------|---------|--------|
| HIGH | Definitely a problem | Safe to auto-fix |
| MEDIUM | Probably a problem | Needs context |
| LOW | Might be a problem | Needs human judgment |

This came from testing on 1,000+ repositories.

---

## Commands

| Command | What it does |
|---------|--------------|
| [`/foreman`](#foreman) | Work the GitHub issue queue with native subagents, from pick to land |
| [`/banthis`](#banthis) | Durable negative memory: persist banned agent behaviors |
| [`/agnix`](#agnix) | Lint agent configurations (457 rules) |
| [`/deslop`](#deslop) | Clean AI slop patterns |
| [`/learn`](#learn) | Research topics, create learning guides |
| [`/skillers`](#skillers) | Workflow pattern learning and automation |
| [`/skill-curator`](#skill-curator) | Create and improve reliable SKILL.md files |
| [`/system-prompt-curator`](#system-prompt-curator) | Create and improve autonomous agent system prompts |

Each command works standalone. Together, they compose into end-to-end pipelines.

---

## Skills

14 skills included across the plugins:

| Category | Skills |
|----------|--------|
| **Workflow** | `foreman` |
| **Message Queues** | `glide-mq-migrate-bee`, `glide-mq-migrate-bullmq`, `glide-mq` |
| **Enhancement** | `skill-curator`, `system-prompt-curator` |
| **Cleanup** | `deslop` |
| **AI Collaboration** | `learn`, `recommend`, `skillers-compact` |
| **Memory** | `banthis` |
| **Linting** | `agnix` |
| **Languages** | `ada-spark`, `mojo` |

**External skill plugins** (standalone repos, installed separately):

| Category | Skills | Plugin |
|----------|--------|--------|
| **Message Queues** | `glide-mq`, `glide-mq-migrate-bullmq`, `glide-mq-migrate-bee` | [agent-sh/glidemq](https://github.com/agent-sh/glidemq) |
| **Languages** | `mojo` | [agent-sh/mojo](https://github.com/agent-sh/mojo) |
| **Languages** | `ada-spark` | [agent-sh/ada-spark](https://github.com/agent-sh/ada-spark) |

Skills are the reusable implementation units. Agents invoke skills; commands orchestrate agents. When you install a plugin, its skills become available to all agents in that session.

---

## Quick Navigation

| Section | What's there |
|---------|--------------|
| [The Approach](#the-approach) | Why it's built this way |
| [Commands](#commands) | Overview of every command |
| [Skills](#skills) | 14 skills across plugins |
| [Skill-Only Plugins](#skill-only-plugins) | glide-mq and other non-command plugins |
| [Command Details](#command-details) | Deep dive into each command |
| [How Commands Work Together](#how-commands-work-together) | Standalone vs integrated |
| [Design Philosophy](#design-philosophy) | The thinking behind the architecture |
| [Installation](#installation) | Get started |
| [Research & Testing](#research--testing) | What went into building this |
| [Documentation](#documentation) | Links to detailed docs |

---

## Skill-Only Plugins

Plugins that provide skills without a `/` command. Installed alongside agentsys; skills become available to all agents.

### glide-mq

Build message queues, background jobs, and workflow orchestration with [glide-mq](https://github.com/avifenesh/glide-mq) - high-performance Node.js queue on Valkey/Redis.

| Skill | What it does |
|-------|--------------|
| `glide-mq` | Greenfield queue development - queues, workers, ordering, rate limiting, flows, broadcast, step jobs |
| `glide-mq-migrate-bullmq` | Migrate from BullMQ to glide-mq - API mapping, breaking changes, feature comparison |
| `glide-mq-migrate-bee` | Migrate from Bee-Queue to glide-mq - API mapping, pattern conversion |

Key features: per-key ordering, group concurrency, runtime group rate limiting (`job.rateLimitGroup()`), token bucket, DAG workflows, broadcast pub/sub, step jobs, deduplication, serverless producers.

[Skill plugin →](https://github.com/agent-sh/glidemq) | [glide-mq docs →](https://avifenesh.github.io/glide-mq.dev/) | [npm →](https://www.npmjs.com/package/glide-mq)

---

## Command Details

### /foreman

**Purpose:** Work a repo's GitHub issues as a task queue. One main session picks the next ready issue, claims it, and hands it to a worktree subagent. Revuto reviews the PR, and foreman lands it at the exact head it checked. It replaces next-task and tower-crane.

There is no daemon and no state store. Labels, assignees and comments on GitHub are the state, and every command reads GitHub live, so several sessions can share one queue.

**The loop:**

1. **Capacity, pick, claim** - checks load, CPU pressure and memory, takes the next ready issue (urgent first, then oldest, open dependencies skipped) and claims it
2. **Brief and spawn** - one worktree subagent per issue from its brief, in parallel up to `agents_max`
3. **Review** - reads Revuto's findings; every real finding gets fixed, a wrong one gets a reply. When Revuto is capped or down, the session reviews the diff itself and records it
4. **Land** - every check green at the head, no unaddressed finding, the repo's own land command, then a squash merge pinned to that head and the issue closed

```bash
/foreman                    # Run the queue until nothing is ready
/foreman status             # Counts by label, claims and capacity
/foreman stats              # Revuto caps, self-reviews, manual review requests
/foreman 123                # Work issue #123 only, from claim to land
```

**Config:** optional `.foreman.json` in the repo root: label names, `agents_max`, load and memory holds, the check and land commands, required checks, Revuto round cap, forbidden words for posted comments.

**Requires:** Node 22+, `gh` (logged in), `git` and `waitfor`. `run-long` needs systemd user units (Linux).

**Skill:** foreman (no agents: workers are native worktree subagents)

[Full workflow documentation →](./docs/workflows/FOREMAN.md) · [Repo →](https://github.com/agent-sh/foreman)

---

### /banthis

**Purpose:** Durable negative memory for repeated agent mistakes. Turn a user's "stop doing this" correction into a persistent rule in `CLAUDE.md` or `AGENTS.md`.

**[banthis](https://github.com/agent-sh/banthis)** is a tiny standalone CLI plus skill. It maintains a managed banned-behaviors section, supports project or global targets, and includes an `init` meta-rule so agents learn when to invoke it automatically.

**What it does:**

| Command | Use |
|---------|-----|
| `banthis add "<title>" "<rule>"` | Add or update a banned behavior |
| `banthis list` | List current bans |
| `banthis show` | Print the managed section |
| `banthis remove "<title>"` | Remove a ban |
| `banthis init` | Install the meta-rule that teaches agents to call `banthis` |

**Usage:**

```bash
/banthis "stop ending with vague optional follow-up offers"
banthis add "No vague endings" "Do not end with vague optional follow-up offers."
banthis init --file AGENTS.md
```

---

### /agnix

**Purpose:** Lint agent configurations before they break your workflow. The first dedicated linter for AI agent configs.

**[agnix](https://github.com/agent-sh/agnix)** is a standalone open-source project that provides the validation engine. This plugin integrates it into your workflow.

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
| **Cross-Platform** | Compatibility across Claude Code, Codex, OpenCode, Cursor, Kiro, Copilot, Gemini CLI, Cline, Windsurf, Roo Code, Amp, and more |

**457 validation rules** derived from:
- Official tool specifications (Claude Code, Codex CLI, OpenCode, Cursor, Kiro, GitHub Copilot, Gemini CLI, Cline, Windsurf, Roo Code, Amp, and more)
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
| Kiro | `.kiro/steering/**/*.md`, `.kiro/agents/*.json`, `.kiro/hooks/*.kiro.hook`, `POWER.md` |
| Windsurf | `.windsurf/rules/**/*.md`, `.windsurf/workflows/**/*.md`, `.windsurfrules` |
| Roo Code | `.roo/rules/*.md`, `.roo/rules-{mode}/*.md`, `.roomodes`, `.rooignore`, `.roorules` |
| Gemini CLI | `GEMINI.md`, `.gemini/settings.json`, `gemini-extension.json` |
| OpenCode | `opencode.json` |
| Amp | `.agents/checks/**/*.md`, `.amp/settings.json` |

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

**External tool:** Requires [agnix CLI](https://github.com/agent-sh/agnix)

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

### /deslop

**Purpose:** Finds AI slop - debug statements, placeholder text, verbose comments, TODOs - and removes it.

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

### /learn

**Purpose:** Research any topic online and create a comprehensive learning guide with RAG-optimized indexes.

**What it does:**

1. **Progressive Discovery** - Uses funnel approach (broad → specific → deep) to find quality sources
2. **Quality Scoring** - Scores sources by authority, recency, depth, examples, uniqueness
3. **Just-In-Time Extraction** - Fetches only high-scoring sources to save tokens
4. **Synthesis** - Creates structured learning guide with examples and best practices
5. **RAG Index** - Updates CLAUDE.md/AGENTS.md master index for future lookups

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
```

**Agent:** learn-agent (sonnet model)

---

### /skillers

> Learn from your workflow patterns and suggest automations

```bash
/skillers show              # Display current config and knowledge stats
/skillers compact           # Analyze recent transcripts, extract patterns
/skillers compact --days=14 # Analyze older transcripts
/skillers recommend         # Get automation suggestions from accumulated knowledge
```

Reads your Claude Code conversation transcripts, identifies recurring patterns (pain points, repeated workflows, wishes), clusters them into weighted themes, and suggests skills, hooks, or agents to automate them.

No per-turn overhead - it reads transcripts that Claude Code already saves.

**Agents:** skillers-compactor (sonnet), skillers-recommender (opus)

**Skills:** skillers-compact, recommend

---

### /skill-curator

> Create and improve reliable `SKILL.md` files

```bash
/skill-curator "create a skill for reviewing background jobs"
/skill-curator --improve path/to/SKILL.md --category review
```

The skill curator focuses on trigger quality, clear scope, router patterns, concrete `Skip unless:` gates, token budgets, and agnix-ready structure across Claude Code, Codex, OpenCode, Cursor, Kiro, and similar tools.

**Skill:** skill-curator

---

### /system-prompt-curator

> Create and improve autonomous coding-agent system prompts

```bash
/system-prompt-curator "GitHub issue resolver"
/system-prompt-curator --improve path/to/prompt.md --for-orchestrator
```

The system prompt curator rewrites prompts around task-matched identity, phased workflow, explicit tools, evidence-based completion criteria, and realistic error recovery examples. It separates prompt guidance from harness-level checks that belong in code.

**Skill:** system-prompt-curator

---

## How Commands Work Together

**Standalone use:**

```bash
/deslop apply          # Just clean up your code
/agnix                 # Just lint your agent configs
/foreman               # Work the issue queue, one worktree agent per issue
/learn react hooks     # Just research a topic
```

**Together:**

[`/foreman`](#foreman) picks an issue and hands it to a worktree worker. The worker can run [`/deslop`](#deslop) on its diff and [`/agnix`](#agnix) on any agent config it touched before it reports back. foreman then reads Revuto's findings and lands the PR only when every check is green at the head it checked.

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

Same principle as good code: single responsibility. The deslop-agent cleans. The learn-agent researches. The agnix-agent lints agent configs. No agent tries to do everything. Specialized agents, each with narrow scope and clear success criteria.

**2. Pipeline with gates, not a monolith**

Same principle as DevOps. Each step must pass before the next begins. Can't push before review. Can't merge before CI passes. Hooks enforce this - agents literally cannot skip phases.

**3. Tools do tool work, agents do agent work**

If static analysis, regex, or a shell command can do it, don't ask an LLM. Pattern detection uses pre-indexed regex. File discovery uses glob. Platform detection uses file existence checks. The LLM only handles what requires judgment.

**4. Agents don't need to know how tools work**

The slop detector returns findings with certainty levels. The agent doesn't need to understand the three-phase pipeline, the regex patterns, or the analyzer heuristics. Good tool design means the consumer doesn't need implementation details.

**5. Build tools where tools don't exist**

Many tasks lack existing tools. Multi-pass analyzers for slop detection. A rule engine for agent configs. The result: agents receive structured data, not raw problems to figure out.

**6. Research-backed prompt engineering**

Documented techniques that measurably improve results:
- **Progressive disclosure** - Agents see only what's needed for the current step
- **Structured output** - JSON between delimiters, XML tags for sections
- **Explicit constraints** - What agents MUST NOT do matters as much as what they do
- **Few-shot examples** - Where patterns aren't obvious
- **Tool calling over generation** - Let the model use tools rather than generate tool-like output

**7. Validate plan and results, not every step**

Approve the plan. See the results. The middle is automated. /foreman picks, briefs, reads the review and lands without a prompt at each step.

**8. Right model for the task**

Match model capability to task complexity:
- **opus** - Planning, implementation, review orchestration
- **sonnet** - Pattern matching, validation, discovery
- **haiku** - Git operations, file moves, CI polling

Quality compounds. Poor exploration → poor plan → poor implementation → review cycles. Early phases deserve the best model.

**9. Persistent state survives sessions**

State files track the workflow phase. Sessions can die and resume. Multiple sessions run in parallel in separate worktrees.

**10. Delegate everything automatable**

Agents don't just write code. They:
- Clean their own output (deslop-agent)
- Work the issue queue from pick to land ([/foreman](#foreman))
- Lint their own configs ([/agnix](#agnix))
- Research what they need to know ([/learn](#learn))

If it can be specified, it can be delegated.

**11. Orchestrator stays high-level**

The main workflow orchestrator doesn't read files, search code, or write implementations. It launches specialized agents and receives their outputs. Keeps the orchestrator's context window available for coordination rather than filled with file contents.

**12. Composable, not monolithic**

Every command works standalone. [`/deslop`](#deslop) cleans code without needing [`/foreman`](#foreman). [`/agnix`](#agnix) lints configs without needing the full workflow. Pieces compose together, but each piece is useful on its own.

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
/plugin marketplace add agent-sh/agentsys
/plugin install foreman@agentsys
```

### All Platforms (npm)

```bash
npm install -g agentsys && agentsys
```

Interactive installer for Claude Code, OpenCode, Codex CLI, Cursor, and Kiro.

```bash
# Non-interactive install
agentsys --tool claude              # Single tool
agentsys --tool cursor              # Cursor (project-scoped skills + commands)
agentsys --tool kiro                # Kiro (project-scoped steering + skills + agents)
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

**For repo-intel data (read by deslop):**
- [agent-analyzer](https://github.com/agent-sh/agent-analyzer), downloaded automatically on first use

**For /foreman:**
- Node.js 22+, `gh` authenticated, and `waitfor` on `PATH`

**For /agnix:**
- [agnix CLI](https://github.com/agent-sh/agnix) installed (`npm install -g agnix`, `cargo install agnix-cli`, or `brew install agnix`)

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
- Jest suite runs on Linux and Windows in CI
- E2E workflow testing across all commands
- Cross-platform validation (Claude Code, OpenCode, Codex CLI, Cursor, Kiro)

**Methodology:**
- Certainty levels derived from pattern analysis across repositories

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
| /foreman Flow | [docs/workflows/FOREMAN.md](./docs/workflows/FOREMAN.md) |

### Reference

| Topic | Link |
|-------|------|
| Slop Patterns | [docs/reference/SLOP-PATTERNS.md](./docs/reference/SLOP-PATTERNS.md) |
| Agent Reference | [docs/reference/AGENTS.md](./docs/reference/AGENTS.md) |

---

## Support

- **Issues:** [github.com/agent-sh/agentsys/issues](https://github.com/agent-sh/agentsys/issues)
- **Discussions:** [github.com/agent-sh/agentsys/discussions](https://github.com/agent-sh/agentsys/discussions)

---

MIT License | Made by [Avi Fenesh](https://github.com/avifenesh)

## Contributor instructions

Repository instructions live in AGENTS.md. Claude Code v2.1.281 or later supports
native loading across supported providers. If an ancestor instruction file masks
AGENTS.md, select `claude-md-and-agents-md` in user-level Project instructions.
The platform helpers retain support for analyzing older instruction layouts;
they do not control the native CLI loader.
See [Claude Code instruction loading](https://code.claude.com/docs/en/memory#agents-md).
