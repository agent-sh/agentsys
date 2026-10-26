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
| Cursor | Skills + commands | N/A | [OK] Supported |
| Kiro | Steering + skills + agents | N/A | [OK] Supported |

> **Note:** Codex CLI uses `$` prefix for skills (e.g., `$learn`, `$deslop`) instead of `/` slash commands.

## Common Architecture

All five platforms share:

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
/plugin install foreman@agentsys
/plugin install deslop@agentsys
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
git clone https://github.com/agent-sh/deslop.git
claude --plugin-dir ./deslop
```

### Available Commands
- `/foreman` - GitHub issue queue for native agents (worktree subagents need Claude Code)
- `/deslop` - AI slop cleanup
- `/banthis` - Durable negative behavior memory
- `/learn` - Research topics and create learning guides
- `/agnix` - Lint agent configuration files
- `/skillers` - Workflow pattern learning
- `/skill-curator` - Skill authoring and review
- `/system-prompt-curator` - System prompt curation

### Available Agents (5 total)

| Agent | Plugin | Model | Purpose |
|-------|--------|-------|---------|
| deslop-agent | deslop | sonnet | AI slop detection and cleanup |
| learn-agent | learn | sonnet | Web research and learning guides |
| agnix-agent | agnix | sonnet | Agent config linting |
| skillers-compactor | skillers | sonnet | Transcript compaction into knowledge themes |
| skillers-recommender | skillers | opus | Automation suggestions from those themes |

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
- Slash commands (`/foreman`, `/deslop`, `/banthis`, `/learn`, `/agnix`, `/skillers`, `/skill-curator`, `/system-prompt-curator`)
- **Native OpenCode plugin** with advanced features:

### Native Plugin Features

The native plugin (`~/.config/opencode/plugins/agentsys.ts`) provides deep integration:

| Feature | Description |
|---------|-------------|
| **Auto-thinking selection** | Adjusts thinking budget per agent complexity (0-20k tokens) |
| **Workflow enforcement** | Blocks `git push`/`gh pr create` during an active workflow phase |
| **Session compaction** | Preserves workflow state when context overflows |
| **Activity tracking** | Updates `flow.json` on significant tool executions |

**Agent Thinking Tiers:**

| Tier | Budget | Agents |
|------|--------|--------|
| Analysis | 12k | deslop-agent |

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

**OpenCode Agent Format** (`.opencode/agents/release-checker.md`):

```markdown
---
name: release-checker
model: claude-sonnet-4-20250514
tools:
  read: true
  write: true
  bash: true
  glob: true
  grep: true
---

You check that the current branch is ready to ship.

When invoked, you should:
1. Run /deslop on the changed files and /agnix on any changed agent config
2. Report what failed with its fix
3. Say when the branch is clean, so you can push it and open the PR
```

## Codex CLI Integration

> **Note:** Codex uses `$` prefix for skills instead of `/` slash commands (e.g., `$learn`, `$deslop`).

### Option 1: npm Global Install (Recommended)

```bash
npm install -g agentsys@latest
agentsys  # Select option 3 for Codex CLI

# Or non-interactive:
agentsys --tool codex
```

This installs skills to `~/.codex/skills/` (`$foreman`, `$deslop`, `$banthis`, `$learn`, `$agnix`, `$skillers`, `$skill-curator`, `$system-prompt-curator`).

Plugin skills are installed next to them, each skill directory copied whole (`references/`, `scripts/`), with paths that pointed at the plugin root pointing at `~/.agentsys/plugins/<plugin>/`. A plugin skill named like a command (`deslop`, `learn`, ...) is not installed there: `$<name>` stays the command.

### Option 2: Custom Skills

Create Codex skills in `~/.codex/skills/<name>/SKILL.md`:

```markdown
---
name: my-review
description: Review the current branch before shipping
---

# Review Workflow

Run `$deslop` on the changed files, then `$agnix` on any agent config you changed.
```

## Shared Libraries

All integrations use the same core libraries:

```
lib/
├── config/                    # Configuration management
├── cross-platform/            # Platform detection, utilities
├── patterns/                  # 3-phase slop detection pipeline
│   ├── pipeline.js            # Orchestrates phases
│   ├── slop-patterns.js       # Regex patterns (HIGH certainty)
│   └── slop-analyzers.js      # Multi-pass analyzers (MEDIUM)
├── platform/                  # Project type detection
├── repo-intel/                # agent-analyzer map: init, update, queries
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
| Cursor | `.cursor/` |
| Kiro | `.kiro/` |

The plugin auto-detects the platform and uses the appropriate directory. Override with `AI_STATE_DIR` environment variable.

**Files stored in state directory:**
- `flow.json` - Workflow progress (worktree)

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
- Agents in `~/.config/opencode/agents/` (5 agents at the pinned plugin commits)
- Skills in `~/.config/opencode/skills/<name>/` (11 skills at the pinned plugin commits, each skill directory copied whole)
- Native plugin in `~/.config/opencode/plugins/agentsys.ts`
- **Native plugin features:**
  - Auto-thinking selection (adjusts budget per agent)
  - Workflow enforcement (blocks git push and PR creation during an active workflow phase)
  - Session compaction with state preservation
  - Provider-agnostic thinking config (Anthropic, OpenAI, Google)

### Codex CLI
- OpenAI-native with GPT-5-Codex
- State directory: `.codex/`
- Skills in `~/.codex/skills/` (invoked with `$` prefix, e.g., `$deslop`): one per command, plus each plugin skill directory copied whole unless a command has its name

### Cursor
- Global installation in `~/.cursor/`
- State directory: `.cursor/`
- Skills in `~/.cursor/skills/<name>/` (the whole skill directory), commands in `~/.cursor/commands/`

### Kiro
- Global installation in `~/.kiro/`
- State directory: `.kiro/`
- Prompts in `~/.kiro/prompts/` (commands with `inclusion: manual`, invoked with `@name`)
- Skills in `~/.kiro/skills/<name>/` (the whole skill directory), agents converted to JSON in `~/.kiro/agents/`
- Reads AGENTS.md and `.kiro/steering/*.md` for instructions
- **Subagent spawning**: Experimental (max 4 agents). Primary agent invokes subagents by name from `~/.kiro/agents/*.json`. Sequential only - no parallel spawning publicly available yet.
- **Parallel Task() adaptation**: A `Promise.all` block of Task() calls becomes one "Delegate to the `<agent>` subagent" line per call.
- **No team/swarm pattern**: TeamCreate, SendMessage not supported. All orchestration is single-primary with sequential subagent delegation.

### Subagent Capabilities by Platform

| Feature | Claude Code | Kiro | OpenCode | Codex | Cursor |
|---------|-------------|------|----------|-------|--------|
| Sub-agent spawning | Task() tool | By name from ~/.kiro/agents/*.json | @agent syntax | N/A | N/A |
| Parallel agents | Yes (multiple Task) | Experimental (max 4) | No | N/A | N/A |
| Agent teams | TeamCreate + SendMessage | Not supported | Not supported | N/A | N/A |

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
