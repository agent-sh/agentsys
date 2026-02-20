# Changelog

> **Migration Note:** This project was renamed from `awesome-slash` to `agentsys` in v5.0.0. All npm packages, CLI commands, and GitHub references now use the new name. Previous versions are archived under the old name.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`/next-task` GitHub Projects source** — Added `gh-projects` as a supported task source. When selected, the workflow prompts for a project number and owner, then fetches issues from a GitHub Projects v2 board via `gh project item-list`. Includes PR-linked issue exclusion (same as GitHub Issues), input validation for project number and owner, and caching of project preferences. Fixes #247.

### Fixed

- **task-discoverer**: Exclude issues that already have an open PR from discovery results (GitHub source only). Detection uses branch name suffix, PR body closing keywords (`closes/fixes/resolves #N`), and PR title `(#N)` convention. Fixes #236.

- **`/debate` 240s timeout enforcement** — All tool invocations in the debate workflow now enforce a hard 240-second timeout. Round 1 proposer timeouts abort the debate; round 1 challenger timeouts proceed with an uncontested position; round 2+ timeouts synthesize from completed rounds. Added "all rounds timeout" error path (`[ERROR] Debate failed: all tool invocations timed out.`). Timeout handling is consistent across the Claude Code command, OpenCode adapter, Codex adapter, and the `debate-orchestrator` agent. Restored missing "Round 2+: Challenger Follow-up" template in the OpenCode adapter SKILL.md. Fixes issue #233.

- **`/next-task` review loop exit conditions** — The Phase 9 review loop now continues iterating until all issues are resolved or a stall is detected (MAX_STALLS reduced from 2 to 1: two consecutive identical-hash iterations = stall). The `orchestrate-review` skill now uses `completePhase()` instead of `updateFlow()` to properly advance workflow state. Added `pre-review-gates` and `docs-update` to the `PHASES` array and `RESULT_FIELD_MAP` in `workflow-state.js`, ensuring these phases can be tracked and resumed correctly. Fixes issue #235.

- **`/debate` command inline orchestration** — The `/debate` command now manages the full debate workflow directly (parse → resolve → execute → verdict), following the `/consult` pattern. The `debate-orchestrator` agent is now the programmatic entry point for other agents/workflows that need to spawn a debate via `Task()`. Fixes issue #231.

- **`/debate` External Tool Quick Reference** — Added a "External Tool Quick Reference" section to all copies of the debate skill (`plugins/debate/skills/debate/SKILL.md`, OpenCode and Codex adapters) with safe command patterns, effort-to-model mapping tables, and output parsing expressions. The section includes a canonical-source pointer to `plugins/consult/skills/consult/SKILL.md` so the debate orchestrator doesn't duplicate provider logic. Added pointer notes in `debate-orchestrator` agents. Fixes issue #232.

- **`/consult` and `/debate` model defaults update** — Gemini high/max effort now uses `gemini-3.1-pro-preview`; Gemini low/medium uses `gemini-3-flash-preview`. Codex uses `gpt-5.3-codex` for all effort tiers. Updated across all platforms: Claude Code plugin, OpenCode adapter, and Codex adapter for both consult and debate skills and commands. Fixes issue #234.

- **`/consult` model name updates** — Updated stale model names in the consult skill: Codex models are now `o4-mini` (low/medium) and `o3` (high/max); Gemini models include `gemini-3-flash-preview`, `gemini-3-pro-preview`, and `gemini-3.1-pro-preview`. Synced to OpenCode adapter consult skill. Fixes issue #232.

- **`/next-task` Phase 12 ship invocation** — Phase 12 now invokes `ship:ship` via `await Skill({ name: "ship:ship", args: ... })` instead of `Task({ subagent_type: "ship:ship", ... })`. `ship:ship` is a skill, not an agent; the previous `Task()` call silently failed, leaving the workflow stuck after delivery validation with no PR created. The Codex adapter is updated in parity and regression tests are added. Fixes issue #230.

## [5.1.0] - 2026-02-18

### Added

- **`/debate` plugin** — New plugin for structured multi-round AI dialectic. Pick two tools (e.g. `codex vs gemini`), set 1–5 rounds, and get a proposer/challenger debate with a synthesized verdict. Supports natural language input, effort levels (`--effort=low|high|max`), and context injection (`--context=diff` or `--context=file=PATH`). Available on Claude Code, OpenCode, and Codex CLI.
- **`/consult` multi-instance support** — Run N parallel consultations with the same tool using `--count=N` (or natural language: "ask 3 gemini about this"). Responses are numbered and a brief synthesis highlights agreements and differences.
- **`/consult` natural language parsing** — Free-form queries are now parsed automatically without requiring explicit flags. "with codex about my auth approach", "ask gemini thoroughly about this design", or "3 claude opinions on error handling" all work out of the box.

### Changed

- **Agent model optimization** — `exploration-agent` and `learn-agent` switched from opus to sonnet, reducing cost and latency for exploration and research passes with no quality regression.

### Fixed

- **Debate `--context=file` path validation** — Added path containment checks to prevent directory traversal when passing file paths as context.
- **Debate prompt hardening** — Context passthrough, canonical output redaction, and relaxed disagreement rules applied consistently across all debate rounds.
- **Consult model/flag issues** — Hardened model flag handling and non-interactive invocation across all four supported tools (Claude, Gemini, Codex, OpenCode).

## [5.0.3] - 2026-02-17

### Fixed
- **Consult: Codex command corrected to `codex exec`** - Codex CLI uses `codex exec` for non-interactive mode (not `-q` flag). Non-interactive resume uses `codex exec resume SESSION_ID "prompt" --json`. All four tools (Claude, Gemini, Codex, OpenCode) now have correct native session resume support.

## [5.0.2] - 2026-02-17

### Fixed
- **Consult: Codex and OpenCode marked as continuable** - Both tools support session resume but were incorrectly marked as non-continuable. OpenCode supports `--session SESSION_ID` and `--continue` flags in non-interactive mode.

## [5.0.1] - 2026-02-14

### Fixed
- **OpenCode legacy cleanup** - Installer now removes legacy agent files (`review.md`, `ship.md`, `workflow.md`) left over from pre-rename installs
- **OpenCode install validator** - Now checks only the agents/commands/skills produced by discovery, preventing false positives from legacy files
- **Windows compatibility** - `bump-version.js` uses `npm.cmd` on win32 (fixes `execFileSync` PATHEXT resolution)
- **Windows test fixes** - Scaffold test tolerates `EBUSY` on temp directory cleanup; script-failure-hooks test skips bash-dependent tests on Windows
- **Jest module resolution** - Added `moduleNameMapper` for `@agentsys/lib` to resolve to local `lib/` directory

### Changed
- **Workflow ship references** - Updated all `/ship` references to `ship:ship` (plugin-namespaced command) across next-task command, agents, hooks, and Codex/OpenCode adapters

## [4.1.1] - 2025-02-09

### Fixed
- **Skills $ARGUMENTS parsing** - Added `$ARGUMENTS` parsing to 13 skills that declared `argument-hint` but never consumed the arguments (CC-SK-012)
- **agnix config** - Migrated `.agnix.toml` `disabled_rules` from deprecated slug format to proper rule IDs (XP-003, AS-014)
- **Memory file language** - Strengthened imperative language in AGENTS.md/CLAUDE.md (PE-003, CC-MEM-006)

## [4.2.2] - 2026-02-12

### Fixed
- Added missing frontmatter descriptions to 3 command reference files (`audit-project-agents`, `ship-ci-review-loop`, `ship-deployment`) that caused Codex adapter skills to install with empty descriptions
- Added build-time validation in `gen-adapters.js` to error on empty Codex skill descriptions
- Added install-time guard in `bin/cli.js` to skip skills with missing descriptions

## [4.2.1] - 2026-02-11

### Fixed
- Removed unused `@agentsys/lib` publish job from release workflow
- Cleaned up all references to lib as a standalone npm package (docs, scripts, tests, configs)

## [4.2.0] - 2026-02-11

### Added
- **Static adapter generation system** (`scripts/gen-adapters.js`) - generates OpenCode and Codex adapters from plugin source at build time
- **Shared `lib/adapter-transforms.js` module** - extracted transform logic from `bin/cli.js` and `scripts/dev-install.js`
- **`gen-adapters` and `gen-adapters --check` dev-cli commands** with npm script aliases
- **CI validation step for adapter freshness**
- **Preflight integration for adapter freshness checks**
- **`/consult` command** - Cross-tool AI consultation: query Gemini CLI, Codex CLI, Claude Code, OpenCode, or Copilot CLI from your current session (#198)
  - Choose tool, model, and thinking effort (`--effort=low|medium|high|max`)
  - Context packaging (`--context=diff|file|none`) and session continuity (`--continue`)
  - Three invocation paths: `/consult` command, `Skill('consult')`, `Task({ subagent_type: 'consult:consult-agent' })`
  - Provider detection, structured JSON output, and per-provider effort mapping
- **Plugin scaffolding system** (`scripts/scaffold.js`) - Scaffold new plugins, agents, skills, and commands from templates (#184)
  - `npx agentsys-dev new plugin <name>` - full plugin directory with plugin.json, default command, and shared lib
  - `npx agentsys-dev new agent <name> --plugin=<plugin>` - agent .md with YAML frontmatter template
  - `npx agentsys-dev new skill <name> --plugin=<plugin>` - skill directory with SKILL.md
  - `npx agentsys-dev new command <name> --plugin=<plugin>` - command .md with frontmatter
  - Name validation, collision detection, path traversal protection, YAML injection prevention
  - npm script aliases: `new:plugin`, `new:agent`, `new:skill`, `new:command`
  - 56 scaffold tests + 11 dev-cli integration tests
- **Shared agent template system** - Build-time template expansion (`expand-templates` command) with 3 shared snippets, replacing duplicated sections across 6 enhance agents with TEMPLATE markers and CI freshness validation (#187)
- **Auto-generate documentation** - `gen-docs` command reads plugin metadata, agent frontmatter, and skill frontmatter to auto-generate documentation sections between GEN:START/GEN:END markers
  - `npx agentsys-dev gen-docs` writes generated sections to README.md, CLAUDE.md, AGENTS.md, docs/reference/AGENTS.md, site/content.json
  - `npx agentsys-dev gen-docs --check` validates docs are fresh (for CI, exits 1 if stale)
  - Enhanced `lib/discovery` with YAML array parsing and frontmatter in `discoverAgents()`/`discoverSkills()`
  - Integrated into preflight as `gap:docs-freshness` check for new-agent, new-skill, new-command, and release checklists
  - 34 tests for the generation system, 7 new discovery tests
- **Preflight command** - Unified change-aware checklist enforcement (`npm run preflight`, `preflight --all`, `preflight --release`, `preflight --json`)
  - Detects changed files and runs only relevant checklist validators
  - Includes 7 existing validators + 7 new gap checks (CHANGELOG, labels, codex triggers, lib exports, lib sync, test existence, staged files)
  - Pre-push hook now delegates to preflight for validation
- **Unified Dev CLI** (`agentsys-dev`) - Single discoverable entry point for all dev scripts
  - `agentsys-dev validate` runs all 7 validators sequentially
  - `agentsys-dev validate <sub>` runs individual validators (plugins, cross-platform, consistency, etc.)
  - `agentsys-dev status` shows project health (version, plugin/agent/skill counts, git branch)
  - `agentsys-dev bump <version>`, `sync-lib`, `setup-hooks`, `detect`, `verify`, `test`
  - `agentsys-dev --help` lists all commands with descriptions
  - All existing `npm run` commands still work (now delegate through dev-cli)
  - All direct `node scripts/foo.js` invocations still work (require.main guards)
  - No external CLI framework dependencies - hand-rolled parsing matching bin/cli.js style
- **Script failure enforcement hooks** - Three-layer system preventing agents from silently falling back to manual work when project scripts fail (#189)
  - Claude Code PostToolUse hook for context injection on project script execution
  - OpenCode plugin failure detection enhancement in tool.execute.after
  - New critical rule #13 in CLAUDE.md/AGENTS.md requiring failure reporting before manual fallback

### Changed
- **Adapter transform refactoring** - Refactored `bin/cli.js` and `scripts/dev-install.js` to use shared adapter transforms (eliminates duplication)
- **CHANGELOG Archival** - Moved v1.x-v3.x entries to `changelogs/` directory, reducing CHANGELOG.md from ~92KB to ~10KB (#186)
- **Version Management** - Single version source of truth via `package.json` with automated stamping (#183)
  - Created `scripts/stamp-version.js` to stamp all downstream files from package.json
  - Refactored `scripts/bump-version.js` to delegate to `npm version`
  - Added npm `version` lifecycle hook for automatic stamping
  - Fixed `validate-counts.js` plugin.json path resolution bug
  - Added `package-lock.json` and `site/content.json` to version validation
  - Fixed stale versions in `site/content.json` and `package-lock.json`
  - Single command updates all 15+ version locations: `npx agentsys-dev bump X.Y.Z`
- **Plugin Discovery** - Convention-based filesystem scanning replaces 14+ hardcoded registration lists (#182)
  - New `lib/discovery/` module auto-discovers plugins, commands, agents, and skills
  - `bin/cli.js`, `scripts/dev-install.js`, `scripts/bump-version.js` use discovery calls
  - Adding a new plugin no longer requires updating registration points
  - Fixed stale lists in `dev-install.js` and `bump-version.js` (missing learn, agnix)
  - Added `codex-description` frontmatter for Codex trigger phrases
  - `scripts/sync-lib.sh` reads from generated `plugins.txt` manifest
  - Deprecated `adapters/opencode/install.sh` and `adapters/codex/install.sh`
- **README /agnix Documentation** - Expanded agnix section to be on par with other major commands
  - Added "The problem it solves" section explaining why agent config linting matters
  - Added "What it validates" table with 5 categories (Structure, Security, Consistency, Best Practices, Cross-Platform)
  - Added details about 100 validation rules and their sources
  - Added CI/CD integration example with GitHub Code Scanning SARIF workflow
  - Added installation instructions (Cargo, Homebrew)
  - Added "Why use agnix" value proposition section
  - Prominent link to [agnix CLI project](https://github.com/agent-sh/agnix)
  - Updated Commands table with more descriptive entry
  - Updated skill count to 26 across all references

### Security
- **consult plugin security hardening** (#208) - Shell injection prevention, path traversal protection, and API key redaction
  - Question text passed via temp files instead of shell interpolation (prevents `$()` and backtick expansion)
  - File context validation blocks UNC paths, resolves canonical paths, prevents symlink escapes
  - Output sanitization redacts 12 credential patterns (API keys, tokens, env vars, auth headers)
  - Fixed 3 pre-existing test regressions in consult-command.test.js

## [4.1.0] - 2026-02-05

### Added
- **New /agnix Plugin** - Lint agent configurations before they break your workflow
  - Validates Skills, Hooks, MCP, Memory, Plugins across Claude Code, Cursor, GitHub Copilot, and Codex CLI
  - 100 validation rules from official specs, research papers, real-world testing
  - Auto-fix support with `--fix` flag
  - SARIF output for GitHub Code Scanning integration
  - Target-specific validation (`--target claude-code|cursor|codex`)
  - Requires [agnix CLI](https://github.com/agent-sh/agnix) (`cargo install agnix-cli`)

### Changed
- **Plugin Count** - Now 11 plugins, 40 agents, 26 skills
- **CLAUDE.md Rule #11** - Added rule about using `[]` not `<>` for argument hints

### Fixed
- **Prompt Injection** - Sanitize user arguments in agnix command (validate target, strip newlines from path)
- **Argument Parsing** - Support both `--target=value` and `--target value` forms
- **enhance-hooks/SKILL.md** - Fixed path example escaping

## [4.0.0] - 2026-02-05

### Added
- **New /learn Plugin** - Research any topic online and create comprehensive learning guides
  - Gathers 10-40 online sources based on depth level (brief/medium/deep)
  - Uses progressive query architecture (funnel approach: broad → specific → deep)
  - Implements source quality scoring (authority, recency, depth, examples, uniqueness)
  - Just-in-time retrieval to avoid context rot
  - Creates topic-specific guides in `agent-knowledge/` directory
  - Maintains CLAUDE.md/AGENTS.md as master RAG indexes
  - Self-evaluation step for output quality assessment
  - Integrates with enhance:enhance-docs and enhance:enhance-prompts
  - Opus model for high-quality research synthesis

### Changed
- **Agent Frontmatter Format** - Converted all 29 agents to YAML array format for tools field (Claude Code spec compliance)
- **Argument Hints** - Aligned all argument-hint fields to official `[placeholder]` format
- **Plugin Count** - Now 10 plugins total (added learn)

### Fixed
- **Semver Sorting** - Fixed version comparison so "1.10.0" correctly > "1.9.9"
- **CodeQL Security** - Escape backslashes in glob pattern matching
- **Path Traversal** - Use `path.relative()` instead of `startsWith()` for Windows compatibility

## [4.0.0-rc.1] - 2026-02-05

### Added
- **New /learn Plugin** - Research any topic online and create comprehensive learning guides
  - Gathers 10-40 online sources based on depth level (brief/medium/deep)
  - Uses progressive query architecture (funnel approach: broad → specific → deep)
  - Implements source quality scoring (authority, recency, depth, examples, uniqueness)
  - Just-in-time retrieval to avoid context rot
  - Creates topic-specific guides in `agent-knowledge/` directory
  - Maintains CLAUDE.md/AGENTS.md as master RAG indexes
  - Self-evaluation step for output quality assessment
  - Integrates with enhance:enhance-docs and enhance:enhance-prompts
  - Opus model for high-quality research synthesis

### Changed
- **Agent Frontmatter Format** - Converted all 29 agents to YAML array format for tools field (Claude Code spec compliance)
- **Argument Hints** - Aligned all argument-hint fields to official `[placeholder]` format
- **Plugin Count** - Now 10 plugins total (added learn)

### Fixed
- **Semver Sorting** - Fixed version comparison so "1.10.0" correctly > "1.9.9"
- **CodeQL Security** - Escape backslashes in glob pattern matching
- **Path Traversal** - Use `path.relative()` instead of `startsWith()` for Windows compatibility


---

## Previous Releases

- [v3.x Changelog](https://github.com/agent-sh/agentsys/blob/main/changelogs/CHANGELOG-v3.md) (v3.0.0 - v3.9.0)
- [v2.x Changelog](https://github.com/agent-sh/agentsys/blob/main/changelogs/CHANGELOG-v2.md) (v2.0.0 - v2.10.1)
- [v1.x Changelog](https://github.com/agent-sh/agentsys/blob/main/changelogs/CHANGELOG-v1.md) (v1.0.0 - v1.1.0)
