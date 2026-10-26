# Documentation

AgentSys is a modular runtime and orchestration system for AI agents. These docs cover the architecture, commands, and workflows - how agents compose into pipelines, how phases gate execution, and how state persists across sessions.

**New here?** Start with [USAGE.md](./USAGE.md) to see commands in action.

---

## Quick Links

| I want to... | Go to |
|-------------|-------|
| Install and start using | [INSTALLATION.md](./INSTALLATION.md) |
| See examples and workflows | [USAGE.md](./USAGE.md) |
| Work an issue queue with /foreman | [workflows/FOREMAN.md](./workflows/FOREMAN.md) |
| Use with OpenCode or Codex | [CROSS_PLATFORM.md](./CROSS_PLATFORM.md) |
| See all slop patterns | [reference/SLOP-PATTERNS.md](./reference/SLOP-PATTERNS.md) |
| See all agents | [reference/AGENTS.md](./reference/AGENTS.md) |
| Understand the architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |

---

## Document Categories

### Getting Started

| Document | Description |
|----------|-------------|
| [INSTALLATION.md](./INSTALLATION.md) | Install via marketplace or npm. Prerequisites. Verification. |
| [USAGE.md](./USAGE.md) | Command examples, common workflows, tips. |

### Workflow Deep-Dives

| Document | Description |
|----------|-------------|
| [workflows/FOREMAN.md](./workflows/FOREMAN.md) | /foreman loop: capacity, pick, claim, worktree worker, Revuto findings, land. |

### Reference

| Document | Description |
|----------|-------------|
| [reference/AGENTS.md](./reference/AGENTS.md) | All 5 agents: purpose, model, tools, restrictions. <!-- AGENT_COUNT_TOTAL: 5 --> |
| [reference/SLOP-PATTERNS.md](./reference/SLOP-PATTERNS.md) | All detection patterns by language, severity, auto-fix. |

### Platform & Architecture

| Document | Description |
|----------|-------------|
| [CROSS_PLATFORM.md](./CROSS_PLATFORM.md) | Claude Code, OpenCode, Codex CLI setup. Migration. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Directory structure, libraries, state management. |

---

## Key Concepts

### Commands

| Command | Purpose |
|---------|---------|
| `/deslop` | 3-phase slop detection and cleanup |
| `/banthis` | Durable negative behavior memory |
| `/learn` | Research topics online, create learning guides |
| `/skillers` | Workflow pattern learning and automation suggestions |
| `/skill-curator` | Create and improve reliable SKILL.md files |
| `/system-prompt-curator` | Create and improve autonomous agent system prompts |
| `/agnix` | Linter for AI agent configs |
| `/foreman` | GitHub issues as a task queue for native agents |

### State Files

| File | Location | Purpose |
|------|----------|---------|
| `flow.json` | `{state-dir}/` (worktree) | Which phase you're in |
| `repo-intel.json` | `{state-dir}/` | Cached agent-analyzer map (git history, AST symbols) read by deslop |

State directories by platform:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`
- Cursor: `.cursor/`
- Kiro: `.kiro/`

### Agent Models

| Model | Used For |
|-------|----------|
| opus | Complex reasoning (planning, review, synthesis) |
| sonnet | Pattern matching (slop detection, validation, discovery) |
| haiku | Mechanical execution with no judgment |

### Certainty Levels

| Level | Meaning | Auto-Fix? |
|-------|---------|-----------|
| CRITICAL | Security issue | Yes (with warning) |
| HIGH | Definite problem | Yes |
| MEDIUM | Probable problem | No |
| LOW | Possible problem | No |

---

## Diagnostics Scripts

When working in the repo directly, you can sanity-check detection and tooling:

```bash
npm run detect   # Platform detection (CI, deploy, project type)
npm run verify   # Tool availability + versions
```

## Getting Help

- **Issues:** [github.com/agent-sh/agentsys/issues](https://github.com/agent-sh/agentsys/issues)
- **Discussions:** [github.com/agent-sh/agentsys/discussions](https://github.com/agent-sh/agentsys/discussions)
- **Main README:** [../README.md](../README.md)
