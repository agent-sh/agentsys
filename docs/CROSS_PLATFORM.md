# Cross-Platform Integration Guide

Build tools once, run everywhere. The core workflows are the same regardless of which AI assistant you use. Platform differences are abstracted away—state files, configuration paths, and command syntax adapt automatically. You get the same automation whether you're using Claude Code, OpenCode, or Codex CLI.

---

## Quick Navigation

| Section | Jump to |
|---------|---------|
| [Supported Platforms](#supported-platforms) | Which platforms work |
| [Claude Code](#claude-code-native) | Native plugin installation |
| [OpenCode](#opencode) | Plugins/agents |
| [Codex CLI](#codex-cli) | Skills |
| [State Directories](#state-directories) | Where state files live |
| [Troubleshooting](#troubleshooting) | Common issues |

---

## Supported Platforms

| Platform | Integration Method | Command Prefix | Status |
|----------|-------------------|----------------|--------|
| Claude Code | Native plugins | `/` (slash) | [OK] Full support |
| OpenCode | Plugins + agent configs | `/` (slash) | [OK] Supported |
| Codex CLI | Skills | `$` (dollar) | [OK] Supported |

> **Note:** Codex CLI uses `$` prefix for skills (e.g., `$next-task`, `$ship`) instead of `/` slash commands.

## Common Architecture

All three platforms share:

1. **Agent/Subagent systems** - Specialized assistants with tool restrictions
2. **Slash commands** - User-invoked actions
3. **Configuration files** - JSON/YAML/Markdown formats
4. **Platform-aware state directories** - Automatic state isolation

## Command Arguments ($ARGUMENTS)

Claude Code passes a raw `$ARGUMENTS` string into commands. Commands should parse the raw string locally (including quoted values) to match Claude Code behavior.

For OpenCode and Codex CLI, the installer adapts the platform argument handling to preserve `$ARGUMENTS` as a raw string. This keeps parsing consistent across platforms without changing command content.

## Claude Code (Native)

### Option 1: Marketplace (Recommended)

```bash
# Add the marketplace
/plugin marketplace add agent-sh/agentsys

# Install plugins
/plugin install next-task@agentsys
/plugin install ship@agentsys
```

### Option 2: npm Global Install

```bash
npm install -g agentsys@latest
agentsys  # Select option 1 for Claude Code

# Or non-interactive:
agentsys --tool claude
```

### Option 3: Development Mode (Testing RC Versions)

Install directly to `~/.claude/plugins/` bypassing the marketplace:

```bash
agentsys --development
```

### Option 4: Plugin Directory (Local Development)

```bash
claude --plugin-dir /path/to/agentsys/plugins/next-task
```

### Available Commands
- `/next-task` - Master workflow orchestrator
- `/ship` - Complete PR workflow
- `/deslop` - AI slop cleanup
- `/audit-project` - Multi-agent code review
- `/drift-detect` - Plan drift detection
- `/repo-map` - AST repo map generation
- `/enhance` - Enhancement analyzer suite
- `/sync-docs` - Documentation sync

### Available Agents (39 total: 29 file-based agents + 10 role-based)

**Key agents shown below:**

**next-task: Core Workflow (10 agents)**

| Agent | Model | Purpose |
|-------|-------|---------|
| exploration-agent | opus | Deep codebase analysis |
| planning-agent | opus | Design implementation plans |
| implementation-agent | opus | Execute plans with quality code |
| test-coverage-checker | sonnet | Validate test coverage |
| delivery-validator | sonnet | Autonomous delivery validation |
| task-discoverer | sonnet | Find and prioritize tasks |
| worktree-manager | haiku | Create isolated worktrees |
| ci-monitor | haiku | Monitor CI status |
| ci-fixer | sonnet | Fix CI failures and PR comments |
| simple-fixer | haiku | Execute pre-defined fixes |

*Note: Phase 9 review loop uses inline orchestration (orchestrate-review skill) to spawn parallel Task agents*

**enhance: Quality Analyzers (9 agents)**

| Agent | Model | Purpose |
|-------|-------|---------|
| plugin-enhancer | sonnet | Analyze plugin structures |
| agent-enhancer | opus | Review agent prompts |
| docs-enhancer | opus | Documentation quality |
| claudemd-enhancer | opus | Project memory optimization |
| prompt-enhancer | opus | General prompt quality |
| hooks-enhancer | sonnet | Hook frontmatter and safety |
| skills-enhancer | sonnet | SKILL.md structure and triggers |
| cross-file-enhancer | sonnet | Cross-file consistency |

**perf: Performance Investigation (6 agents)**

| Agent | Model | Purpose |
|-------|-------|---------|
| perf-orchestrator | sonnet | Coordinate perf investigation |
| perf-theory-gatherer | sonnet | Generate hypotheses |
| perf-theory-tester | sonnet | Validate hypotheses |
| perf-code-paths | sonnet | Map hot paths |
| perf-investigation-logger | sonnet | Log evidence |
| perf-analyzer | sonnet | Synthesize findings |

**audit-project: Code Review (10 role-based agents)**

Always active: code-quality-reviewer, security-expert, performance-engineer, test-quality-guardian

Conditional: architecture-reviewer, database-specialist, api-designer, frontend-specialist, backend-specialist, devops-reviewer

**drift-detect: Drift Detection (1 agent)**

| Agent | Model | Purpose |
|-------|-------|---------|
| plan-synthesizer | opus | Deep semantic analysis |

*Data collection uses JavaScript collectors (77% token reduction vs multi-agent)*

**repo-map: Repo Mapping (1 agent)**

| Agent | Model | Purpose |
|-------|-------|---------|
| map-validator | haiku | Validate repo-map output |

## OpenCode Integration

### Option 1: npm Global Install (Recommended)

```bash
npm install -g agentsys@latest
agentsys  # Select option 2 for OpenCode

# Or non-interactive:
agentsys --tool opencode
```

By default, model specifications (sonnet/opus/haiku) are stripped from agents. This prevents errors when your OpenCode setup doesn't have matching model aliases. If you have proper model mappings configured, use `--no-strip` to include them:

```bash
agentsys --tool opencode --no-strip
```

This installs:
- Slash commands (`/next-task`, `/ship`, `/deslop`, `/audit-project`, `/drift-detect`, `/repo-map`, `/sync-docs`)
- **Native OpenCode plugin** with advanced features:

### Native Plugin Features

The native plugin (`~/.config/opencode/plugins/agentsys.ts`) provides deep integration:

| Feature | Description |
|---------|-------------|
| **Auto-thinking selection** | Adjusts thinking budget per agent complexity (0-20k tokens) |
| **Workflow enforcement** | Blocks `git push`/`gh pr create` until `/ship` |
| **Session compaction** | Preserves workflow state when context overflows |
| **Activity tracking** | Updates `flow.json` on significant tool executions |

**Agent Thinking Tiers:**

| Tier | Budget | Agents |
|------|--------|--------|
| Execution | 0 | worktree-manager, simple-fixer, ci-monitor |
| Discovery | 8k | task-discoverer |
| Analysis | 12k | exploration-agent, deslop-agent, ci-fixer |
| Reasoning | 16k | planning-agent, implementation-agent |
| Synthesis | 20k | plan-synthesizer, enhancement-orchestrator |

**Provider-Specific Thinking:**

The plugin auto-detects your model provider and applies the correct thinking config:

```typescript
// Anthropic → thinking.budgetTokens
// OpenAI → reasoningEffort ("high"/"medium"/"low")
// Google → thinkingConfig.thinkingBudget
```

### Option 2: Agent Configuration

Create agent definitions in OpenCode format:

```bash
# Global agents
mkdir -p ~/.config/opencode/agent/

# Agent files follow OpenCode markdown format (see below)
```

**OpenCode Agent Format** (`.opencode/agents/workflow.md`):

```markdown
---
name: workflow-orchestrator
model: claude-sonnet-4-20250514
tools:
  read: true
  write: true
  bash: true
  glob: true
  grep: true
---

You are a workflow orchestrator that manages development tasks.

When invoked, you should:
1. Check for existing workflow state in .claude/workflow-state.json
2. Continue from the last checkpoint if resuming
3. Follow the 18-phase workflow from policy selection to completion
```

## Codex CLI Integration

> **Note:** Codex uses `$` prefix for skills instead of `/` slash commands (e.g., `$next-task`, `$ship`).

### Option 1: npm Global Install (Recommended)

```bash
npm install -g agentsys@latest
agentsys  # Select option 3 for Codex CLI

# Or non-interactive:
agentsys --tool codex
```

This installs skills to `~/.codex/skills/` (`$next-task`, `$ship`, `$deslop`, `$audit-project`, `$repo-map`, `$sync-docs`).

### Option 2: Custom Skills

Create Codex skills in `~/.codex/skills/<name>/SKILL.md`:

```markdown
---
name: next-task
description: Master workflow orchestrator for task automation
---

# Next Task Workflow

Run `$next-task` to start the master workflow orchestrator.
```

## Shared Libraries

All integrations use the same core libraries:

```
lib/
├── config/                    # Configuration management
├── cross-platform/            # Platform detection, utilities
├── enhance/                   # Quality analyzer logic
├── patterns/                  # 3-phase slop detection pipeline
│   ├── pipeline.js            # Orchestrates phases
│   ├── slop-patterns.js       # Regex patterns (HIGH certainty)
│   └── slop-analyzers.js      # Multi-pass analyzers (MEDIUM)
├── platform/                  # Project type detection
├── drift-detect/             # Drift detection collectors
├── repo-map/                 # AST repo map generation
├── schemas/                   # JSON schemas for validation
├── sources/                   # Task source discovery
├── state/                     # Workflow state management
├── types/                     # TypeScript-style type definitions
└── utils/                     # Shell escape, context optimization
```

## Platform-Aware State Directories

State files are stored in platform-specific directories:

| Platform | State Directory |
|----------|-----------------|
| Claude Code | `.claude/` |
| OpenCode | `.opencode/` |
| Codex CLI | `.codex/` |

The plugin auto-detects the platform and uses the appropriate directory. Override with `AI_STATE_DIR` environment variable.

**Files stored in state directory:**
- `tasks.json` - Active task tracking (main project)
- `flow.json` - Workflow progress (worktree)
- `sources/preference.json` - Task source preferences

## Platform-Specific Considerations

### Claude Code
- Full plugin support with hooks, agents, commands
- State directory: `.claude/`
- Native state management integration
- Best experience with opus model for complex tasks

### OpenCode
- Works with any model provider (Claude, OpenAI, Google, local)
- State directory: `.opencode/`
- Slash commands in `~/.config/opencode/commands/`
- Agents in `~/.config/opencode/agents/` (31 agents)
- Skills in `~/.config/opencode/skills/` (28 skills)
- Native plugin in `~/.config/opencode/plugins/agentsys.ts`
- **Native plugin features:**
  - Auto-thinking selection (adjusts budget per agent)
  - Workflow enforcement (blocks git push until /ship)
  - Session compaction with state preservation
  - Provider-agnostic thinking config (Anthropic, OpenAI, Google)

### Codex CLI
- OpenAI-native with GPT-5-Codex
- State directory: `.codex/`
- Skills in `~/.codex/skills/` (invoked with `$` prefix, e.g., `$next-task`)

## Migration Guide

### From Claude Code to OpenCode

1. Run: `npm install -g agentsys && agentsys --tool opencode`
2. State files will be created fresh in `.opencode/`
3. Or copy state: `cp -r .claude/* .opencode/`

### From Claude Code to Codex

1. Run: `npm install -g agentsys && agentsys --tool codex`
2. State files will be created fresh in `.codex/`
3. Or copy state: `cp -r .claude/* .codex/`

### Using Multiple Platforms

If you use multiple AI assistants on the same project, set `AI_STATE_DIR` to share state:

```bash
export AI_STATE_DIR=".ai-state"
```

## Contributing

To add support for a new platform:

1. Create installation script in `scripts/install/<platform>.sh`
2. Add platform-specific configuration examples
3. Test integration with the target platform
4. Submit PR with documentation
