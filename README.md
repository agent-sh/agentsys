# Awesome Slash Commands

> Professional-grade workflow automation for AI coding assistants

A cross-platform plugin providing powerful, zero-configuration slash commands for development workflows. Works with **Claude Code**, **Codex CLI**, and **OpenCode**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.1.1-blue)](https://github.com/avifenesh/awsome-slash/releases)
[![GitHub stars](https://img.shields.io/github/stars/avifenesh/awsome-slash?style=flat&color=yellow)](https://github.com/avifenesh/awsome-slash/stargazers)
[![Claude Code](https://img.shields.io/badge/Claude-Code%20Plugin-blue)](https://code.claude.com/)
[![Codex CLI](https://img.shields.io/badge/Codex-CLI%20Compatible-green)](https://developers.openai.com/codex/cli)
[![OpenCode](https://img.shields.io/badge/OpenCode-Compatible-orange)](https://opencode.ai)

## What's New in v2.1.0

- **Fully Autonomous Workflow** - No human intervention after plan approval until policy stop point
- **Quality Gate Agents** - Pre-review gates (deslop-work, test-coverage-checker) and delivery validation
- **12 Specialist Agents** - Enhanced with delivery-validator, docs-updater, and more
- **SubagentStop Hooks** - Automatic phase transitions for seamless workflow
- **Documentation Automation** - Auto-updates docs after delivery validation
- **New Commands** - `/update-docs-around`, `/delivery-approval` for standalone use

---

## Installation

### Claude Code (Native)

```bash
# Option 1: Marketplace (recommended)
claude plugin marketplace add avifenesh/awsome-slash
claude plugin install next-task@awsome-slash ship@awsome-slash

# Option 2: Direct install
git clone https://github.com/avifenesh/awsome-slash.git
./scripts/install/claude.sh
```

### OpenCode

```bash
git clone https://github.com/avifenesh/awsome-slash.git
cd awsome-slash
./scripts/install/opencode.sh
```

### Codex CLI

```bash
git clone https://github.com/avifenesh/awsome-slash.git
cd awsome-slash
./scripts/install/codex.sh
```

---

## Available Commands

### 📋 `/next-task:next-task` - Master Workflow Orchestrator

Complete task-to-production automation with state management and resume capability.

```bash
/next-task:next-task                   # Start new workflow with policy selection
/next-task:next-task --status          # Check current workflow state
/next-task:next-task --resume          # Resume from last checkpoint
/next-task:next-task --abort           # Cancel workflow and cleanup
/next-task:next-task bug               # Filter by task type
```

**13-Phase Autonomous Workflow:**
1. Policy Selection → Ask user preferences via checkboxes
2. Task Discovery → Find and prioritize tasks from GitHub/Linear/PLAN.md
3. Worktree Setup → Create isolated development environment [sonnet]
4. Exploration → Deep codebase analysis [opus]
5. Planning → Design implementation plan [opus]
6. **User Approval → Get plan approval (LAST human interaction)**
7. Implementation → Execute the plan [opus]
8. **Pre-Review Gates → deslop-work + test-coverage-checker [sonnet]**
9. Review Loop → Multi-agent review until approved [opus]
10. **Delivery Validation → Autonomous task completion check [sonnet]**
11. **Docs Update → Auto-update related documentation [sonnet]**
12. Ship → PR creation, CI monitoring, merge
13. Cleanup → Remove worktree, update state

**Features:**
- **Fully autonomous** after plan approval - no human in the loop
- Resume capability with `.claude/.workflow-state.json`
- 12 specialist agents with model optimization (opus/sonnet)
- Quality gates: deslop-work, test-coverage-checker, delivery-validator, docs-updater
- SubagentStop hooks for automatic workflow transitions
- Policy-based stopping points (pr-created, merged, deployed, production)

---

### 🚀 `/ship:ship` - Complete PR Workflow

Ship your code from commit to production with full validation and state integration.

```bash
/ship:ship                        # Default workflow
/ship:ship --strategy rebase      # Rebase before merge
/ship:ship --dry-run              # Show plan without executing
/ship:ship --state-file PATH      # Integrate with next-task workflow
```

**12-Phase Workflow:**
1. Pre-flight checks and platform detection
2. Commit with AI-generated message
3. Create PR with context
4. Wait for CI
5. Multi-agent review (code quality, silent failures, test coverage)
6. Merge PR
7. Deploy to development (if multi-branch)
8. Validate development
9. Deploy to production
10. Validate production
11. Cleanup
12. Completion report

**Platform Support:**
- **CI:** GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis CI
- **Deployment:** Railway, Vercel, Netlify, Fly.io, Platform.sh, Render

---

### 🧹 `/deslop-around:deslop-around` - AI Slop Cleanup

Remove debugging code, old TODOs, and AI slop from your codebase.

```bash
/deslop-around:deslop-around               # Report mode - analyze only
/deslop-around:deslop-around apply         # Apply fixes with verification
/deslop-around:deslop-around apply src/ 10 # Fix up to 10 issues in src/
```

**Detects:**
- Console debugging (`console.log`, `print()`, `dbg!()`)
- Old TODOs and commented code
- Placeholder text, magic numbers
- Empty catch blocks, disabled linters

---

### 🔍 `/project-review:project-review` - Multi-Agent Code Review

Comprehensive code review with specialized agents that iterate until zero issues.

```bash
/project-review:project-review              # Full codebase review
/project-review:project-review --recent     # Only recent changes
/project-review:project-review --domain security
```

**8 Specialized Agents:**
Security · Performance · Architecture · Testing · Error Handling · Code Quality · Type Safety · Documentation

---

### 📝 `/next-task:update-docs-around` - Documentation Sync

Sync documentation with actual code state across the entire repository.

```bash
/next-task:update-docs-around               # Report mode - analyze only
/next-task:update-docs-around --apply       # Apply safe fixes
/next-task:update-docs-around docs/ --apply # Sync specific directory
```

**Checks:**
- Outdated code references in documentation
- Invalid syntax in code examples
- Missing CHANGELOG entries
- Version mismatches
- Broken file/import paths

---

### ✅ `/next-task:delivery-approval` - Delivery Validation

Validate task completion and approve for shipping (standalone or part of workflow).

```bash
/next-task:delivery-approval                # Validate current work
/next-task:delivery-approval --task-id 142  # Validate specific task
/next-task:delivery-approval --verbose      # Show detailed check output
```

**Validation Checks:**
- Tests pass (npm test)
- Build passes (npm run build)
- Lint passes
- Type check passes
- Task requirements met

---

## Cross-Platform Integration

All platforms share the same workflow tools via MCP (Model Context Protocol):

| Tool | Description |
|------|-------------|
| `workflow_status` | Get current workflow state |
| `workflow_start` | Start a new workflow |
| `workflow_resume` | Resume from checkpoint |
| `workflow_abort` | Cancel and cleanup |
| `task_discover` | Find and prioritize tasks |
| `review_code` | Run multi-agent review |

See [docs/CROSS_PLATFORM.md](./docs/CROSS_PLATFORM.md) for details.

---

## Architecture

### State Management

Workflows persist state in `.claude/.workflow-state.json`:

```json
{
  "workflow": { "id": "...", "status": "in_progress" },
  "policy": { "taskSource": "gh-issues", "stoppingPoint": "merged" },
  "task": { "id": "142", "title": "Fix auth timeout" },
  "phases": { "current": "implementation", "history": [...] },
  "checkpoints": { "canResume": true, "resumeFrom": "implementation" }
}
```

### Specialist Agents (12 Total)

**Core Workflow (Opus - Complex Tasks):**
| Agent | Purpose |
|-------|---------|
| exploration-agent | Deep codebase analysis |
| planning-agent | Design implementation plans |
| implementation-agent | Execute plans with quality code |
| review-orchestrator | Multi-agent code review with iteration |

**Quality Gates (Sonnet - Side Reviewers):**
| Agent | Purpose |
|-------|---------|
| deslop-work | Clean AI slop from new work (committed but unpushed) |
| test-coverage-checker | Validate new work has test coverage |
| delivery-validator | Autonomous delivery validation (NOT manual) |
| docs-updater | Update docs related to changes |

**Operational (Sonnet - Infrastructure):**
| Agent | Purpose |
|-------|---------|
| policy-selector | Configure workflow policy |
| task-discoverer | Find and prioritize tasks |
| worktree-manager | Create isolated worktrees |
| ci-monitor | Monitor CI/PR status with sleep loops |

---

## Repository Structure

```
awsome-slash/
├── .claude-plugin/
│   └── marketplace.json      # Claude Code marketplace manifest
├── plugins/
│   ├── next-task/           # Master workflow orchestrator
│   │   ├── commands/        # next-task, update-docs-around, delivery-approval
│   │   ├── agents/          # 12 specialist agents
│   │   └── hooks/           # SubagentStop hooks for workflow automation
│   ├── ship/                # PR workflow
│   ├── deslop-around/       # AI slop cleanup
│   └── project-review/      # Multi-agent review
├── lib/
│   ├── state/               # Workflow state management
│   ├── platform/            # Auto-detection
│   └── patterns/            # Code analysis patterns
├── mcp-server/              # Cross-platform MCP server
├── scripts/install/         # Platform installers
└── docs/
```

---

## Requirements

**Required:**
- Git
- Node.js 18+
- GitHub CLI (`gh`) with authentication

**For Claude Code:**
- Claude Code CLI

**For OpenCode:**
- OpenCode CLI (`opencode`)

**For Codex CLI:**
- Codex CLI (`codex`)

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT © [Avi Fenesh](https://github.com/avifenesh)

## Support

- **Issues:** https://github.com/avifenesh/awsome-slash/issues
- **Discussions:** https://github.com/avifenesh/awsome-slash/discussions

---

Made with ❤️ for the AI coding community
