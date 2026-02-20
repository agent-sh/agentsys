# Multi-Platform Architecture

The design principle: write tools once, run everywhere. AI models already have their strengths—code generation, reasoning, analysis. The bottleneck is orchestration, state management, and platform integration. This architecture handles those parts so the models can do what they're good at.

---

## Quick Navigation

| Section | Jump to |
|---------|---------|
| [Overview](#overview) | Platform support |
| [Architecture](#architecture) | Directory structure |
| [Cross-Platform Library](#cross-platform-library-libcross-platform) | Shared utilities |
| [State Directories](#state-directory-by-platform) | Where state lives |
| [Core Capabilities](#core-capabilities) | Command reference |
| [Platform Details](#platform-installation-details) | Per-platform setup |
| [Knowledge Base](#knowledge-base) | Research docs |

---

## Overview

AgentSys supports three AI coding assistants through a unified architecture:

1. **Claude Code** - Anthropic's official CLI (primary target)
2. **OpenCode** - Multi-model AI coding assistant
3. **Codex CLI** - OpenAI's command-line interface

## Quick Install

```bash
npm install -g agentsys
agentsys
# Select platforms: 1,2,3 for all
```

## Architecture

### Core Components

```text
agentsys/
├── lib/                          # Shared library
│   ├── cross-platform/           # Platform utilities
│   │   ├── index.js              # Platform detection, MCP helpers
│   │   └── RESEARCH.md           # Research documentation
│   ├── enhance/                  # Quality analyzers (agent, plugin, docs, hooks, skills)
│   ├── perf/                     # Performance investigation workflow
│   ├── patterns/                 # Code analysis
│   │   ├── pipeline.js           # 3-phase slop detection
│   │   ├── slop-patterns.js      # Pattern definitions
│   │   └── slop-analyzers.js     # Multi-pass analyzers
│   ├── repo-map/                 # AST repo map generation
│   ├── state/                    # Workflow state
│   └── sources/                  # Task source discovery
├── plugins/                      # Claude Code plugins
│   ├── next-task/
│   ├── ship/
│   ├── deslop/
│   ├── audit-project/
│   ├── enhance/                  # Code quality analyzers
│   ├── perf/                     # Performance investigations
│   ├── drift-detect/
│   ├── sync-docs/       # Documentation sync
│   ├── repo-map/        # AST repo mapping
│   └── learn/           # Topic research and learning guides
├── bin/                          # CLI installer
│   └── cli.js                    # Interactive installer
├── meta/
│   └── skills/
│       └── maintain-cross-platform/  # Cross-platform compatibility skill
│           └── SKILL.md
├── scripts/
│   ├── setup-hooks.js            # Git hooks installer (npm prepare)
│   └── sync-lib.sh               # Dev: sync lib/ to plugins/
├── docs/                         # User documentation
│   ├── CROSS_PLATFORM.md
│   ├── INSTALLATION.md
│   └── USAGE.md
└── agent-docs/                   # Knowledge base (research)
    ├── KNOWLEDGE-LIBRARY.md      # Index
    └── *-REFERENCE.md            # Research documents
```

### Cross-Platform Library (`lib/cross-platform/`)

Provides unified utilities for all platforms:

```javascript
const { xplat } = require('agentsys/lib');

// Platform detection
xplat.detectPlatform();  // 'claude-code' | 'opencode' | 'codex-cli'
xplat.getStateDir();     // '.claude' | '.opencode' | '.codex'

// MCP response helpers
xplat.successResponse({ data: 'result' });
xplat.errorResponse('Something failed', { details: '...' });

// Tool schema creation
xplat.createToolDefinition('my_tool', 'Description', { param: { type: 'string' } });

// Prompt formatting (cross-model compatible)
xplat.formatBlock('context', 'XML tags for Claude');
xplat.formatSection('Title', 'Markdown for GPT-4');
```

### State Directory by Platform

| Platform | State Directory | Override |
|----------|-----------------|----------|
| Claude Code | `.claude/` | `AI_STATE_DIR=.claude` |
| OpenCode | `.opencode/` | `AI_STATE_DIR=.opencode` |
| Codex CLI | `.codex/` | `AI_STATE_DIR=.codex` |

State files:
- `{state-dir}/tasks.json` - Active task registry
- `{state-dir}/flow.json` - Workflow progress (in worktree)
- `{state-dir}/sources/preference.json` - Cached task source
- `{state-dir}/repo-map.json` - Cached AST repo map

### Core Capabilities

The package provides these capabilities through commands, agents, and skills:

| Capability | Command | Description |
|------------|---------|-------------|
| Workflow orchestration | `/next-task` | Task discovery through PR merge |
| PR workflow | `/ship` | Commit, push, CI monitor, merge |
| Code quality | `/deslop` | AI slop detection and cleanup |
| Enhancement | `/enhance` | Analyze plugins, agents, docs, prompts |
| Performance | `/perf` | Performance investigation workflow |
| Repo mapping | `/repo-map` | AST-based symbol/import mapping |
| Documentation | `/sync-docs` | Sync docs with code changes |
| Drift detection | `/drift-detect` | Plan vs implementation analysis |
| Code review | `/audit-project` | Multi-agent code review |

**Slop detection** uses the full 3-phase pipeline:
- Phase 1: Regex patterns (HIGH certainty)
- Phase 2: Multi-pass analyzers (MEDIUM certainty)
- Phase 3: CLI tools (LOW certainty, optional)

## Platform Installation Details

### Claude Code

```bash
# Via marketplace (recommended)
/plugin marketplace add agent-sh/agentsys
/plugin install next-task@agentsys

# Via CLI installer
agentsys  # Select option 1
```

**Location:** `~/.claude/plugins/agentsys/`

**Commands:** `/next-task`, `/ship`, `/deslop`, `/audit-project`, `/drift-detect`, `/repo-map`, `/enhance`, `/perf`, `/sync-docs`

### OpenCode

```bash
agentsys  # Select option 2
```

**Locations:**
- Commands: `~/.config/opencode/commands/`
- Agents: `~/.config/opencode/agents/`
- Skills: `~/.config/opencode/skills/`
- Native plugin: `~/.config/opencode/plugins/agentsys.ts`

**Commands:** `/next-task`, `/ship`, `/deslop`, `/audit-project`, `/drift-detect`, `/repo-map`, `/enhance`, `/perf`, `/sync-docs`

**Native Plugin Features:**
- Auto-thinking selection per agent
- Workflow enforcement
- Session compaction

### Codex CLI

```bash
agentsys  # Select option 3
```

**Locations:**
- Config: `~/.codex/config.toml`
- Skills: `~/.codex/skills/`

**Skills:** `$next-task`, `$ship`, `$deslop`, `$audit-project`, `$drift-detect`, `$repo-map`, `$enhance`, `$perf`, `$sync-docs`

**Internal skill:** `orchestrate-review` (Phase 9 review pass definitions used by /next-task and /audit-project)

Note: Codex uses `$` prefix instead of `/`.

**SKILL.md Format:**
```yaml
---
name: next-task
description: Master workflow orchestrator for task-to-production automation
---
[skill content]
```

## Command Compatibility

| Command | Claude Code | OpenCode | Codex CLI | Notes |
|---------|-------------|----------|-----------|-------|
| `/next-task` | [OK] Full | [OK] Full | [OK] Full | Master workflow |
| `/ship` | [OK] Full | [OK] Full | [OK] Full | Requires `gh` CLI |
| `/deslop` | [OK] Full | [OK] Full | [OK] Full | Uses pipeline.js |
| `/audit-project` | [OK] Full | [OK] Full | [OK] Full | Multi-agent review |
| `/drift-detect` | [OK] Full | [OK] Full | [OK] Full | JS collectors + Opus |
| `/repo-map` | [OK] Full | [OK] Full | [OK] Full | AST map via ast-grep |
| `/enhance` | [OK] Full | [OK] Full | [OK] Full | Orchestrates all enhancers |
| `/perf` | [OK] Full | [OK] Full | [OK] Full | Performance investigations |
| `/sync-docs` | [OK] Full | [OK] Full | [OK] Full | Documentation sync |

## Knowledge Base

Research documents informing the implementation (in `agent-docs/`):

| Document | Topic |
|----------|-------|
| `CONTEXT-OPTIMIZATION-REFERENCE.md` | Token efficiency strategies |
| `PROMPT-ENGINEERING-REFERENCE.md` | Cross-model prompt design |
| `FUNCTION-CALLING-TOOL-USE-REFERENCE.md` | MCP and tool patterns |
| `MULTI-AGENT-SYSTEMS-REFERENCE.md` | Agent orchestration |
| `LLM-INSTRUCTION-FOLLOWING-RELIABILITY.md` | Instruction adherence |
| `CLAUDE-CODE-REFERENCE.md` | Claude Code specifics |
| `AI-AGENT-ARCHITECTURE-RESEARCH.md` | Agent design patterns |
| `KNOWLEDGE-LIBRARY.md` | Index and overview |
| `lib/cross-platform/RESEARCH.md` | Platform comparison |

## Implementation Status

### Core Infrastructure [OK]
- [x] CLI installer (`bin/cli.js`)
- [x] MCP server with pipeline integration
- [x] Cross-platform library (`lib/cross-platform/`)
- [x] Platform-aware state directories
- [x] Knowledge base documentation

### Platform Support [OK]
- [x] Claude Code (marketplace + CLI)
- [x] OpenCode (MCP + commands)
- [x] Codex CLI (MCP + skills)

### Testing [OK]
- [x] All 1400+ tests passing
- [x] npm pack creates valid package (338 KB)
- [x] Interactive installer works for all platforms

## Maintenance

**Update workflow:**
1. Edit files in `lib/` (canonical source)
2. Run `./scripts/sync-lib.sh` (or `agentsys-dev sync-lib`) to copy to plugins
3. Commit both source and copies
4. Publish: `npm version patch && npm publish`

**User update:**
```bash
npm update -g agentsys
agentsys  # Re-run installer
```

## Design Decisions

### Why MCP Server?

MCP (Model Context Protocol) provides:
- Standardized tool interface across platforms
- No format translation needed
- Single implementation, multiple consumers
- Platform-specific env vars for state isolation

### Why Shared Library?

Each plugin needs its own `lib/` copy because Claude Code installs plugins separately. The `sync-lib.sh` script maintains consistency.

### Why Research Docs?

The knowledge base documents best practices from official sources, ensuring the implementation follows recommended patterns for each platform.
