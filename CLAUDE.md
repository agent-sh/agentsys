# Project Memory: awesome-slash

> **Cross-tool compatible**: This file works as CLAUDE.md (Claude Code) and can be copied to AGENTS.md for OpenCode, Codex, and other AI tools.

<project-memory>

<critical-rules>
## Critical Rules (Priority Order)

1. **Production project** - Real users depend on this. Test thoroughly and verify all edge cases before committing.
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

9. **gh/git on Windows** - Escape `$` as `\$` in GraphQL queries, avoid `!=` in jq (use `== "A" or == "B"`).
   - `gh pr checks` uses `state` not `conclusion` - returns UPPERCASE: `SUCCESS`, `FAILURE`, `PENDING`
   - Single quotes unreliable - use double quotes with escaped inner quotes
   *WHY: Windows shell interprets $ and ! differently. These cause silent failures.*

10. **Always run git hooks** - Run all pre-commit and pre-push hooks. If a hook blocks, fix the reported issue.
   - Hooks catch problems before they reach the repo
   - Fix the root cause, then retry
   *WHY: Hooks are safety nets. Bypassing them defeats their purpose.*
</critical-rules>

<architecture>
## Architecture

```
lib/          → Shared library (canonical source)
plugins/      → 9 plugins, 39 agents (29 file-based + 10 role-based), 25 skills
adapters/     → Platform adapters (opencode-plugin/, opencode/, codex/)
checklists/   → Action checklists (8 files)
bin/cli.js    → npm CLI installer
```

| Plugin | Agents | Skills | Purpose |
|--------|--------|--------|---------|
| next-task | 10 | 3 | Master workflow orchestration |
| enhance | 9 | 9 | Code quality analyzers |
| ship | 0 | 0 | PR creation and deployment |
| perf | 6 | 8 | Performance investigation |
| audit-project | 10 | 0 | Multi-agent code review |
| deslop | 1 | 1 | AI slop cleanup |
| drift-detect | 1 | 1 | Plan drift detection |
| repo-map | 1 | 1 | AST repo mapping |
| sync-docs | 1 | 1 | Documentation sync |

**Pattern**: `Command → Agent → Skill` (orchestration → invocation → implementation)
</architecture>

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
npm run bump <version>       # Bump all version files (e.g., 3.7.3)
./scripts/sync-lib.sh        # Sync lib/ to plugins/
npm pack                     # Build package
awesome-slash                # Run installer
```
</commands>

<agents>
## Agents

39 agents across 9 plugins. Key agents by model:

| Model | Agents | Use Case |
|-------|--------|----------|
| **opus** | exploration, planning, implementation, perf-orchestrator | Complex reasoning, analysis |
| **sonnet** | task-discoverer, delivery-validator, ci-fixer, deslop-agent, reporters | Validation, pattern matching |
| **haiku** | worktree-manager, ci-monitor, simple-fixer | Mechanical execution |

See [README.md](./README.md#command-details) and [docs/reference/AGENTS.md](./docs/reference/AGENTS.md) for full agent list.
</agents>

<skills>
## Skills

25 skills across plugins. Agents invoke skills for reusable implementation.

| Category | Key Skills |
|----------|------------|
| Workflow | `orchestrate-review`, `discover-tasks`, `validate-delivery` |
| Enhancement | `enhance-*` (9 skills for plugins, agents, docs, prompts, hooks) |
| Performance | `baseline`, `benchmark`, `profile`, `theory-tester` |
| Cleanup | `deslop`, `sync-docs`, `drift-analysis`, `repo-mapping` |

See [README.md](./README.md#skills) for full skill list.
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
## Model Selection

| Model | When to Use |
|-------|-------------|
| **Opus** | Complex reasoning, analysis where imperfection compounds |
| **Sonnet** | Validation, pattern matching, most agents |
| **Haiku** | Mechanical execution, no judgment needed |
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
