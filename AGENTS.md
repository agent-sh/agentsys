# Project Memory: awesome-slash

> **Cross-tool compatible**: This file works as CLAUDE.md (Claude Code) and can be copied to AGENTS.md for OpenCode, Codex, and other AI tools.

<project-memory>

<critical-rules>
## Critical Rules (Priority Order)

1. **Production project** - Real users depend on this. Test thoroughly, don't break things.
   *WHY: Breaking changes affect all plugin users immediately.*

2. **Plugin for OTHER projects** - Optimize for plugin users, not internal dev convenience.
   *WHY: Every decision should improve the experience for developers using this in their repos.*

3. **No summary files** - No `*_AUDIT.md`, `*_SUMMARY.md`, `*_COMPLETION.md`. Use CHANGELOG.md.
   *WHY: Summary files clutter repos and add no value. Report completion verbally.*

4. **Unless** it is a very small change of max few lines, or an urgent hotfix, **MUST create PRs for all changes** - No direct pushes to main.
   *WHY: PRs enable reviews, CI checks, and rollback if needed. Direct pushes are risky.*

5. **PR reviews** - Wait 3 min for auto-reviewers, address ALL comments (Copilot, Claude, Gemini, Codex).
   *WHY: Skipping comments leads to merged issues. Every comment must be addressed or explained.*

6. **Read checklists BEFORE multi-file changes** - **MUST** read the relevant checklist before starting:
   - **Cross-platform work → `checklists/cross-platform-compatibility.md`** (MASTER REF)
   - Release → `checklists/release.md`
   - New command → `checklists/new-command.md`
   - New agent → `checklists/new-agent.md`
   - New lib module → `checklists/new-lib-module.md`
   - MCP server update → `checklists/update-mcp.md`
   - OpenCode plugin update → `checklists/update-opencode-plugin.md`
   - Repo map changes → `checklists/repo-map.md`
   *WHY: Multi-file changes have hidden dependencies. Checklists prevent missed updates.*

7. **Especially Before release, and when delivering ANY work** - Check the relevant checklist for completion requirements:
   - Identify which checklist applies to your work (see rule #6)
   - Go through EVERY item in that checklist and apply it (e.g. run commands, which files to bump versions in, etc)
   - Run the `/enhance` command on new or modified commands, agents, skills, hooks or prompts
   - Verify cross-platform compatibility (OpenCode + Codex)
   - Update `bin/cli.js` mappings if new command/agent added
   - Don't mark complete until ALL checklist items are done
   *WHY: Checklists exist because we kept missing things. They are the definition of "done".*

8. **No emojis or ASCII art** - No emojis or decorative ASCII boxes in any files.
   - Save tokens - conciseness and clarity over decorations.
   - Use plain text: `[OK]`, `[ERROR]`, `[WARN]`, `[CRITICAL]`
   - Use markdown formatting instead of decorative borders
   *WHY: Emojis and ASCII art waste tokens. AI models parse plain text better.*
</critical-rules>

<architecture>
## Architecture

```
lib/                        # Shared library (canonical source)
├── config/                 # Configuration utilities
├── cross-platform/         # Platform detection, MCP helpers
├── enhance/                # Enhancement analyzers and patterns
├── patterns/               # Slop detection pipeline
├── perf/                   # Performance investigation tools
├── platform/               # Platform detection, state directory
├── repo-map/               # AST-based repo mapping
├── schemas/                # JSON schema validation
├── sources/                # Task source handlers
├── state/                  # Workflow state management
├── utils/                  # Utilities (cache, shell-escape)
└── index.js                # Main exports

plugins/                    # 9 plugins, 40 agents (30 file-based + 10 role-based), 25 skills
├── next-task/              # Master workflow (12 agents, 4 skills)
├── enhance/                # Enhancement analyzers (9 agents, 10 skills)
├── ship/                   # PR workflow (4 commands)
├── perf/                   # Performance investigation (6 agents, 8 skills)
├── audit-project/          # Multi-agent review (10 role-based agents, 3 commands)
├── deslop/                 # AI slop cleanup (1 agent, 2 skills)
├── drift-detect/           # Plan drift detection (1 agent, 1 skill)
├── repo-map/               # AST repo mapping (1 agent, 1 skill)
└── sync-docs/              # Documentation sync (2 agents, 3 skills)

adapters/                   # Platform-specific adapters
├── opencode-plugin/        # Native OpenCode plugin
├── opencode/               # OpenCode install script
└── codex/                  # Codex install script

mcp-server/                 # Cross-platform MCP server
bin/cli.js                  # npm CLI installer
checklists/                 # Action checklists (9 files)
agent-docs/                 # Knowledge base
docs/                       # User documentation
```

### Agent/Skill Pattern

```
Command (orchestration) → Agent (thin wrapper) → Skill (implementation)
```

- **Commands**: Orchestration, argument parsing, phase coordination
- **Agents**: Invoke skills, handle output, manage state
- **Skills**: Reusable implementation, patterns, detection logic, auto-fixes
</architecture>

<plugins>
## Plugins Overview

| Plugin | Commands | Agents | Skills | Purpose |
|--------|----------|--------|--------|---------|
| next-task | 3 | 12 | 4 | Master workflow orchestration |
| enhance | 1 | 10 | 10 | Code quality analyzers |
| ship | 4 | 0 | 0 | PR creation and deployment |
| perf | 1 | 6 | 8 | Performance investigation |
| audit-project | 3 | 0 | 0 | Multi-agent code review |
| deslop | 1 | 0 | 0 | AI slop cleanup |
| drift-detect | 1 | 1 | 1 | Plan drift detection |
| repo-map | 1 | 1 | 1 | AST-based repo mapping |
| sync-docs | 1 | 0 | 0 | Documentation sync |
</plugins>

<commands>
## Commands

### Core Workflow
- `/next-task` - Master workflow: task → implementation → PR → merge
- `/ship` - PR creation, CI monitoring, merge
- `/enhance` - Run all enhancement analyzers

### Analysis
- `/audit-project` - Multi-agent code review
- `/deslop` - Clean AI slop patterns
- `/drift-detect` - Compare plan vs implementation
- `/perf` - Performance investigation
- `/repo-map` - Generate AST-based repo map

### Maintenance
- `/sync-docs` - Update documentation to match code

### Dev Commands
```bash
npm test                     # Run tests (do before commits)
./scripts/sync-lib.sh        # Sync lib/ to plugins/
npm pack                     # Build package
awesome-slash                # Run installer
```
</commands>

<agents>
## Key Agents

### next-task (12 agents)
| Agent | Model | Purpose |
|-------|-------|---------|
| task-discoverer | sonnet | Find and rank tasks from sources |
| worktree-manager | haiku | Create isolated git worktrees |
| exploration-agent | opus | Deep codebase analysis |
| planning-agent | opus | Design implementation plans |
| implementation-agent | opus | Execute approved plans |
| deslop-work | sonnet | Clean AI slop from new code |
| test-coverage-checker | sonnet | Validate test coverage |
| delivery-validator | sonnet | Autonomous completion validation |
| ci-monitor | haiku | Monitor CI and PR comments |
| ci-fixer | sonnet | Fix CI failures |
| simple-fixer | haiku | Execute mechanical fixes |

### enhance (10 agents)
| Agent | Model | Purpose |
|-------|-------|---------|
| enhancement-orchestrator | opus | Coordinate all enhancers |
| enhancement-reporter | sonnet | Generate unified reports |
| plugin-enhancer | sonnet | Analyze plugin structures |
| agent-enhancer | opus | Analyze agent prompts |
| docs-enhancer | sonnet | Analyze documentation |
| claudemd-enhancer | sonnet | Analyze CLAUDE.md files |
| prompt-enhancer | opus | Analyze prompt quality |
| hooks-enhancer | opus | Analyze hook safety |
| skills-enhancer | opus | Analyze skill triggers |

### perf (6 agents)
| Agent | Model | Purpose |
|-------|-------|---------|
| perf-orchestrator | sonnet | Coordinate perf investigation |
| perf-analyzer | sonnet | Synthesize findings |
| perf-code-paths | sonnet | Map likely hot paths |
| perf-theory-gatherer | sonnet | Generate hypotheses |
| perf-theory-tester | sonnet | Run controlled experiments |
| perf-investigation-logger | sonnet | Log evidence |
</agents>

<skills>
## Skills

Skills contain reusable implementation. Agents invoke skills to perform work.

### next-task Skills
- `orchestrate-review` - Phase 9 review loop logic
- `discover-tasks` - Task discovery and scoring
- `update-docs` - Documentation update patterns
- `validate-delivery` - Completion validation checks

### enhance Skills
- `enhance-orchestrator` - Enhancer coordination
- `enhance-reporter` - Report generation
- `enhance-plugins` - Plugin analysis patterns
- `enhance-agent-prompts` - Agent analysis patterns
- `enhance-docs` - Documentation patterns
- `enhance-claude-memory` - CLAUDE.md patterns
- `enhance-prompts` - Prompt quality patterns
- `enhance-hooks` - Hook safety patterns
- `enhance-skills` - Skill trigger patterns

### perf Skills
- `baseline`, `benchmark`, `profile` - Measurement
- `analyzer`, `code-paths`, `theory` - Analysis
- `theory-tester`, `investigation-logger` - Testing

### Other Skills
- `drift-analysis` - Plan drift detection
- `repo-mapping` - AST repo map generation
</skills>

<state-files>
## State Files

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | `{stateDir}/` | Active task registry |
| `flow.json` | `{stateDir}/` (worktree) | Workflow progress |
| `preference.json` | `{stateDir}/sources/` | Cached task source |
| `suppressions.json` | `~/.claude/enhance/` | Auto-learned suppressions |

Platform-aware state directory:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex: `.codex/`
</state-files>

<workflow-agents>
## Workflow Agents (MUST-CALL)

Cannot skip in /next-task:
- `exploration-agent` → before planning
- `planning-agent` → before implementation
- **Phase 9 review loop** → MUST use orchestrate-review skill
- `delivery-validator` → before sync-docs:sync-docs-agent
- `sync-docs:sync-docs-agent` → before /ship
</workflow-agents>

<pr-auto-review>
## PR Auto-Review

4 reviewers: Copilot, Claude, Gemini, Codex

1. Wait 3 min after PR creation (initial auto-reviews)
2. Claude-review may take 10+ min - wait for it
3. Read ALL comments
4. Address EVERY comment
5. Iterate until zero unresolved
</pr-auto-review>

<model-selection>
## Model Selection Guidelines

| Model | When to Use |
|-------|-------------|
| **Opus** | Complex reasoning, enhancers, analyzers where imperfection compounds |
| **Sonnet** | Most agents, validation, pattern matching |
| **Haiku** | Mechanical execution, simple operations, no judgment needed |

**Examples**:
- `exploration-agent` uses opus - codebase analysis requires deep reasoning
- `delivery-validator` uses sonnet - validation is structured
- `simple-fixer` uses haiku - mechanically applies pre-defined fixes
- `worktree-manager` uses haiku - scripted git commands
</model-selection>

<priorities>
## Core Priorities

1. User DX (plugin users)
2. Worry-free automation
3. Token efficiency
4. Quality output
5. Simplicity
</priorities>

<end-reminder>
**REMEMBER**:
- No summary files (`*_AUDIT.md`, `*_SUMMARY.md`) - use CHANGELOG.md
- BEFORE starting → Read the relevant checklist (`checklists/*.md`)
- BEFORE delivering any work, especially releases → Go through that checklist item by item
- 3 platforms: Claude Code + OpenCode + Codex - ALL must work
- Agent/Skill pattern: Agents invoke skills, skills have implementation
- Create PRs for non-trivial changes
</end-reminder>

</project-memory>
