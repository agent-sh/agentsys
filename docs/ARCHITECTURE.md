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

AgentSys supports five AI coding assistants through a unified architecture:

1. **Claude Code** - Anthropic's official CLI (primary target)
2. **OpenCode** - Multi-model AI coding assistant
3. **Codex CLI** - OpenAI's command-line interface
4. **Cursor** - AI-native code editor
5. **Kiro** - Amazon's agentic IDE

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
├── lib/                          # Shared library, maintained here (plugin repos vendor their own copies)
│   ├── cross-platform/           # Platform utilities
│   │   ├── index.js              # Platform detection, MCP helpers
│   │   └── RESEARCH.md           # Research documentation
│   ├── patterns/                 # Code analysis
│   │   ├── pipeline.js           # 3-phase slop detection
│   │   ├── slop-patterns.js      # Pattern definitions
│   │   └── slop-analyzers.js     # Multi-pass analyzers
│   ├── repo-intel/               # agent-analyzer map: init, update, queries
│   ├── state/                    # Workflow state
│   └── sources/                  # Task source discovery
├── bin/                          # CLI installer
│   └── cli.js                    # Interactive installer (fetches plugins from GitHub)
├── .claude-plugin/
│   └── marketplace.json          # Plugin registry (name, repo, requires)
├── meta/
│   └── skills/
│       └── maintain-cross-platform/  # Cross-platform compatibility skill
│           └── SKILL.md
├── scripts/
│   ├── setup-hooks.js            # Git hooks installer (manual: npm run setup-hooks)
│   └── graduate-plugin.js        # Extract a plugin to a new standalone repo
├── docs/                         # User documentation
│   ├── CROSS_PLATFORM.md
│   ├── INSTALLATION.md
│   └── USAGE.md
└── agent-docs/                   # Knowledge base (research)
    ├── KNOWLEDGE-LIBRARY.md      # Index
    └── *-REFERENCE.md            # Research documents

NOTE: plugins/ has been removed. All 11 plugins are now standalone repos
under the agent-sh org. The installer fetches them from GitHub at install time.
Plugin repos: agent-sh/{foreman,deslop,banthis,learn,agnix,skillers,
              skill-curator,system-prompt-curator,zig-lsp,mojo,ada-spark}
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
- `{state-dir}/flow.json` - Workflow progress (in worktree)
- `{state-dir}/repo-intel.json` - agent-analyzer map (git history, AST symbols), with its converted view `{state-dir}/repo-map.json`

### Core Capabilities

The package provides these capabilities through commands, agents, and skills:

| Capability | Command | Description |
|------------|---------|-------------|
| Issue queue | `/foreman` | GitHub issues as a task queue: pick, claim, worktree worker, Revuto findings, land |
| Code quality | `/deslop` | AI slop detection and cleanup |
| Negative memory | `/banthis` | Persist banned agent behaviors |
| Config linting | `/agnix` | Lint agent configurations (457 rules) |
| Research | `/learn` | Research topics, create learning guides |
| Workflow learning | `/skillers` | Workflow pattern learning and automation |
| Skill curation | `/skill-curator` | Create and improve SKILL.md files |
| Prompt curation | `/system-prompt-curator` | Create and improve autonomous agent prompts |

**Slop detection** uses the full 3-phase pipeline:
- Phase 1: Regex patterns (HIGH certainty)
- Phase 2: Multi-pass analyzers (MEDIUM certainty)
- Phase 3: CLI tools (LOW certainty, optional)

## Platform Installation Details

### Claude Code

```bash
# Via marketplace (recommended)
/plugin marketplace add agent-sh/agentsys
/plugin install foreman@agentsys

# Via CLI installer
agentsys  # Select option 1
```

**Location:** `~/.claude/plugins/agentsys/`

**Commands:** `/foreman`, `/deslop`, `/banthis`, `/agnix`, `/learn`, `/skillers`, `/skill-curator`, `/system-prompt-curator`

### OpenCode

```bash
agentsys  # Select option 2
```

**Locations:**
- Commands: `~/.config/opencode/commands/`
- Agents: `~/.config/opencode/agents/`
- Skills: `~/.config/opencode/skills/<name>/` (each skill directory copied whole)
- Native plugin: `~/.config/opencode/plugins/agentsys.ts`

**Commands:** `/foreman`, `/deslop`, `/banthis`, `/agnix`, `/learn`, `/skillers`, `/skill-curator`, `/system-prompt-curator`

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

**Skills:** `$foreman`, `$deslop`, `$banthis`, `$agnix`, `$learn`, `$skillers`, `$skill-curator`, `$system-prompt-curator`

**Plugin skills:** each plugin skill directory is copied whole to `~/.codex/skills/<name>/`, for example `recommend` and `skillers-compact` from skillers, or `mojo`. A plugin skill named like a command (`deslop`, `learn`, ...) is not installed there: `$<name>` stays the command, and the skill stays in `~/.agentsys/plugins/<plugin>/skills/<name>/`.

Note: Codex uses `$` prefix instead of `/`.

**SKILL.md Format:**
```yaml
---
name: learn
description: Research a topic online and write a learning guide
---
[skill content]
```

## Command Compatibility

| Command | Claude Code | OpenCode | Codex CLI | Notes |
|---------|-------------|----------|-----------|-------|
| `/foreman` | [OK] Full | [WARN] Partial | [WARN] Partial | The CLI runs everywhere; the loop spawns Claude Code worktree subagents |
| `/deslop` | [OK] Full | [OK] Full | [OK] Full | Uses pipeline.js |
| `/banthis` | [OK] Full | [OK] Full | [OK] Full | Negative behavior memory; includes CLI |
| `/agnix` | [OK] Full | [OK] Full | [OK] Full | Requires `agnix` CLI |
| `/learn` | [OK] Full | [OK] Full | [OK] Full | Research and learning |
| `/skillers` | [OK] Full | [OK] Full | [OK] Full | Workflow pattern learning |
| `/skill-curator` | [OK] Full | [OK] Full | [OK] Full | Skill authoring and review |
| `/system-prompt-curator` | [OK] Full | [OK] Full | [OK] Full | Agent prompt curation |

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
- [x] Test suite passes on Linux and Windows
- [x] npm pack creates valid package (~400 KB)
- [x] Interactive installer works for all platforms

## Maintenance

**Update workflow:**
1. Edit files in `lib/` (canonical source in this repo)
2. Merge to main through a PR. Nothing syncs `lib/` to the plugin repos; a plugin repo that needs the change copies it into its own vendored `lib/`
3. Publish agentsys: `npm version patch && npm publish`

To extract a new plugin to its own repo:
```bash
node scripts/graduate-plugin.js <plugin-name>
```

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

Each plugin repo needs its own `lib/` copy because Claude Code installs plugins separately and cannot share code across plugin boundaries. agentsys maintains `lib/` here; each plugin repo keeps its own vendored copy and updates it itself.

### Why Research Docs?

The knowledge base documents best practices from official sources, ensuring the implementation follows recommended patterns for each platform.
