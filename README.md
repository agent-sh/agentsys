# awesome-slash

> Stop babysitting AI agents. Automate your entire workflow.

**1307 tests. 7 languages. 21 specialist agents. Production-grade.**

[![npm](https://img.shields.io/npm/v/awesome-slash?color=red)](https://www.npmjs.com/package/awesome-slash)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/avifenesh/awesome-slash?style=flat&color=yellow)](https://github.com/avifenesh/awesome-slash/stargazers)

**Claude Code** | **OpenCode** | **Codex CLI**

[Try It Now](#try-it-now-30-seconds) | [Documentation](./docs/) | [Support](#support)

---

## Try It Now (30 seconds)

```bash
# Claude Code
/plugin marketplace add avifenesh/awesome-slash
/plugin install deslop-around@awesome-slash

# Then just run:
/deslop-around
```

See what AI slop is hiding in your code. No config. No setup.

---

## Which Plugin Do You Need?

| Your Problem | Plugin | What Actually Happens |
|-------------|--------|----------------------|
| "I have 50 issues, which first?" | `/next-task` | Discovers → Worktree → Implements → Reviews (no limit) → Ships |
| "PRs are scary" | `/ship` | Auto-detects CI + deploy platform → Monitors → Auto-rollback if fails |
| "AI slop everywhere" | `/deslop-around` | 3-phase pipeline: regex (HIGH) → analyzers (MEDIUM) → CLI tools (LOW) |
| "Need thorough review" | `/project-review` | 8 agents review in parallel until zero critical/high issues |
| "Docs lie about code" | `/reality-check` | JS collectors + single Opus call. Semantic matching, not string search. |
| "Prompts need work" | `/enhance` | 5 analyzers, 50+ patterns, certainty-based findings |

---

## The Plugin Marketplace

### Workflow Automation

<details>
<summary><strong>/next-task</strong> - Master Workflow Orchestrator</summary>

**Problem:** You have dozens of issues. Manual workflow is tedious.

**Solution:** Complete task-to-production automation with 14 specialist agents.
- Discovers tasks from GitHub/GitLab/Linear/local files
- Creates worktree + branch
- Implements with quality gates (deslop, test coverage, review)
- Ships PR with validation
- **Resume from any checkpoint if interrupted**

```bash
/next-task              # Start workflow
/next-task --resume     # Resume from checkpoint
/next-task --status     # Check progress
/next-task --abort      # Cancel and cleanup
```

**18-Phase Workflow:** policy-selection → task-discovery → worktree-setup → exploration → planning → user-approval → implementation → review-loop → delivery-approval → ship-prep → create-pr → ci-wait → comment-fix → merge → production-ci → deploy → production-release → complete

</details>

<details>
<summary><strong>/ship</strong> - Complete PR Workflow</summary>

**Problem:** PRs sit waiting for CI. Deploys are scary.

**Solution:** Commit → PR → CI → Review → Merge → Deploy, fully automated.
- Detects your CI (GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis)
- Detects your deploy platform (Railway, Vercel, Netlify, Fly.io, Render)
- Monitors CI, addresses review comments
- Automatic rollback if production fails

```bash
/ship                   # Full workflow
/ship --dry-run         # Preview what will happen
/ship --strategy rebase # Use rebase instead of squash
```

</details>

### Code Quality

<details>
<summary><strong>/deslop-around</strong> - AI Slop Detection</summary>

**Problem:** Your codebase is full of console.logs, TODOs, and AI artifacts.

**Solution:** 3-phase detection pipeline with 95% false positive reduction.
- **Phase 1:** Regex patterns (HIGH certainty) - always runs
- **Phase 2:** Multi-pass analyzers (MEDIUM certainty) - context-aware
- **Phase 3:** CLI tools (LOW certainty) - graceful degradation
- Supports JS/TS, Python, Rust, Go, Java

**Detects:** Console debugging, old TODOs, commented code, placeholder text, magic numbers, empty catch blocks, placeholder functions, excessive documentation, phantom references, buzzword inflation, code smells

```bash
/deslop-around          # Report only
/deslop-around apply    # Fix automatically
/deslop-around apply src/ 10  # Fix 10 issues in src/
```

</details>

<details>
<summary><strong>/project-review</strong> - Multi-Agent Code Review</summary>

**Problem:** You need thorough review but don't have time.

**Solution:** 8 specialized agents review until zero issues remain.
- Security, Performance, Architecture, Testing
- Error Handling, Code Quality, Type Safety, Documentation
- Iterates until all critical/high issues resolved

```bash
/project-review              # Full review
/project-review --recent     # Only recent changes
/project-review --domain security  # Focused review
```

</details>

### Analysis & Intelligence

<details>
<summary><strong>/reality-check:scan</strong> - Plan Drift Detection</summary>

**Problem:** Your docs say one thing, your code does another.

**Solution:** Deep analysis comparing documentation to actual implementation.
- Finds issues that should be closed (already done)
- Finds "done" phases that aren't actually done
- Identifies release blockers
- ~77% token reduction vs multi-agent approaches

```bash
/reality-check:scan          # Full analysis
/reality-check:scan --depth quick  # Quick scan
```

</details>

<details>
<summary><strong>/enhance</strong> - Quality Analyzer Suite</summary>

**Problem:** Your prompts, plugins, and docs need improvement.

**Solution:** 5 specialized enhancers run in parallel.
- **plugin** - Plugin structures, MCP tools, security patterns
- **agent** - Agent prompts, frontmatter, tool restrictions
- **claudemd** - CLAUDE.md/AGENTS.md project memory files
- **docs** - Documentation structure and RAG optimization
- **prompt** - General prompt quality and clarity

```bash
/enhance                     # Run all analyzers
/enhance --focus=agent       # Specific analyzer
/enhance --apply             # Apply HIGH certainty fixes
```

</details>

---

## What Makes It Different

<details>
<summary><strong>For the curious</strong> - Real engineering under the hood</summary>

**Not another AI wrapper.** Here's what's actually happening:

| Capability | The Detail |
|------------|------------|
| **Certainty-Based Detection** | Findings tagged HIGH/MEDIUM/LOW. HIGH = auto-fix safe. LOW = needs judgment. |
| **Self-Healing Review Loop** | Review-orchestrator has NO iteration limit. Loops until clean. Then runs deslop on the fixes. |
| **Workflow Enforcement** | SubagentStop hook literally prevents skipping phases. Cannot push before validation. |
| **Autonomous Validation** | Delivery-validator extracts requirements from task description, maps to changed files, verifies implementation. No human approval needed. |
| **Token Efficiency** | Compact mode = 60-70% reduction. Reality-check uses JS collectors + single Opus call = 77% reduction. |
| **ReDoS Hardening** | MAX_PATTERN_CACHE=50, MAX_GLOB_WILDCARDS=10, maxBuffer=10MB. Won't DOS your machine. |
| **Semantic Matching** | Reality-check compares "user authentication" concept to auth/, login.js, session handling. Not string matching. |
| **7 Languages** | JS/TS, Python, Rust, Go, Java with language-specific patterns. 2,232 lines of detection rules. |

</details>

---

## How They Work Together

**Use standalone:**
```bash
/deslop-around apply    # Just clean up slop
/ship                   # Just ship this branch
```

**Use integrated:**
```
/next-task picks issue → explores → plans → implements
    ↓
deslop-work cleans before review
    ↓
review-orchestrator iterates until approved
    ↓
/ship creates PR → monitors CI → merges → deploys
```

**Resume from any checkpoint** if interrupted. State tracked in `.claude/flow.json`.

---

## Quick Install

### Claude Code (Recommended)

```bash
/plugin marketplace add avifenesh/awesome-slash
/plugin install next-task@awesome-slash
/plugin install ship@awesome-slash
```

### Any Platform (npm)

```bash
npm install -g awesome-slash && awesome-slash
```

Interactive installer for Claude Code, OpenCode, and Codex CLI.

```bash
npm update -g awesome-slash       # Update
npm uninstall -g awesome-slash    # Remove
```

[Full Installation Guide →](./docs/INSTALLATION.md)

---

## Why awesome-slash?

| Feature | The Reality |
|---------|-------------|
| **1307 Tests** | Production-grade. Not a weekend project. |
| **21 Specialist Agents** | Opus for reasoning, Sonnet for reviews, Haiku for execution |
| **7 Languages** | JS/TS, Python, Rust, Go, Java with 2,232 lines of patterns |
| **Zero Config** | Auto-detects CI (5 platforms), deploy (6 platforms), project type |
| **Resume Anywhere** | Dual state system: tasks.json + flow.json. Exact checkpoint recovery. |
| **Cross-Platform** | Claude Code, OpenCode, Codex CLI. Same tools, different state dirs. |

---

## Cross-Platform Support

All platforms share the same workflow tools via MCP (Model Context Protocol):

| Tool | Description |
|------|-------------|
| `workflow_status` | Get current workflow state |
| `workflow_start` | Start a new workflow |
| `workflow_resume` | Resume from checkpoint |
| `workflow_abort` | Cancel and cleanup |
| `task_discover` | Find and prioritize tasks |
| `review_code` | Run pattern-based code review |
| `slop_detect` | Detect AI slop patterns |
| `enhance_analyze` | Analyze plugins, agents, docs |

**Platform Note:** Commands use `/` prefix in Claude Code and OpenCode, but `$` prefix in Codex CLI.

| Platform | State Directory |
|----------|-----------------|
| Claude Code | `.claude/` |
| OpenCode | `.opencode/` |
| Codex CLI | `.codex/` |

---

## Requirements

**Required:**
- Git
- Node.js 18+

**For GitHub workflows:**
- GitHub CLI (`gh`) with authentication

**For GitLab workflows:**
- GitLab CLI (`glab`) with authentication

---

## Documentation

- [Installation](./docs/INSTALLATION.md) - All install methods
- [Usage Guide](./docs/USAGE.md) - Examples and workflows
- [Architecture](./docs/ARCHITECTURE.md) - Technical details
- [Cross-Platform](./docs/CROSS_PLATFORM.md) - OpenCode/Codex setup

---

## Support

- **Issues:** [github.com/avifenesh/awesome-slash/issues](https://github.com/avifenesh/awesome-slash/issues)
- **Discussions:** [github.com/avifenesh/awesome-slash/discussions](https://github.com/avifenesh/awesome-slash/discussions)

---

> **Model Recommendation:** Using **Opus** as the main agent model produces significantly better results. While Sonnet works for simpler tasks, Opus is recommended for complex multi-step workflows.

Made by [Avi Fenesh](https://github.com/avifenesh) | MIT License
