# Documentation

AgentSys is a modular runtime and orchestration system for AI agents. These docs cover the architecture, commands, and workflows — how agents compose into pipelines, how phases gate execution, and how state persists across sessions.

**New here?** Start with [USAGE.md](./USAGE.md) to see commands in action.

---

## Quick Links

| I want to... | Go to |
|-------------|-------|
| Install and start using | [INSTALLATION.md](./INSTALLATION.md) |
| See examples and workflows | [USAGE.md](./USAGE.md) |
| Understand how /next-task works | [workflows/NEXT-TASK.md](./workflows/NEXT-TASK.md) |
| Understand how /ship works | [workflows/SHIP.md](./workflows/SHIP.md) |
| Run /perf investigations | [perf-requirements.md](./perf-requirements.md) |
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
| [workflows/NEXT-TASK.md](./workflows/NEXT-TASK.md) | Complete /next-task flow: phases, agents, state management, resume. |
| [workflows/SHIP.md](./workflows/SHIP.md) | Complete /ship flow: CI monitoring, review handling, merge, deploy. |
| [perf-requirements.md](./perf-requirements.md) | /perf rules and required phases. |
| [perf-research-methodology.md](./perf-research-methodology.md) | /perf process details, benchmarking method. |

### Reference

| Document | Description |
|----------|-------------|
| [reference/AGENTS.md](./reference/AGENTS.md) | All 42 agents: purpose, model, tools, restrictions. <!-- AGENT_COUNT_TOTAL: 42 --> |
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
| `/next-task` | Task discovery → implementation → review → ship |
| `/ship` | Push → PR → CI → reviews → merge → deploy |
| `/deslop` | 3-phase slop detection and cleanup |
| `/audit-project` | Multi-agent code review |
| `/drift-detect` | Compare docs to actual code |
| `/repo-map` | Build cached AST repo map |
| `/perf` | Performance investigation workflow |
| `/enhance` | Analyze prompts, plugins, agents, docs, hooks, skills |
| `/sync-docs` | Sync docs with code changes |

### Internal Skills

- `orchestrate-review` â€” Defines review passes and signal thresholds for the Phase 9 review loop

### State Files

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | `{state-dir}/` | Which task is active |
| `flow.json` | `{state-dir}/` (worktree) | Which phase you're in |
| `preference.json` | `{state-dir}/sources/` | Cached task source preference |
| `repo-map.json` | `{state-dir}/` | Cached AST repo map |

State directories by platform:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`

### Agent Models

| Model | Used For |
|-------|----------|
| opus | Complex reasoning (exploration, planning, implementation, review) |
| sonnet | Pattern matching (slop detection, validation, discovery) |
| haiku | Mechanical execution (worktree, simple-fixer, ci-monitor) |

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
