# Changelog

> **Migration Note:** This project was renamed from `awesome-slash` to `agentsys` in v5.0.0. All npm packages, CLI commands, and GitHub references now use the new name. Previous versions are archived under the old name.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.4.1] - 2026-03-10

### Added

- **Project base branch** (`--base=BRANCH`) - `/next-task` now supports configuring a project-level base branch for batch workflows. All downstream operations (worktrees, diffs, PRs) use the configured branch instead of main.
- **Free-text preference caching** - When users select "Other" for any policy decision and type a custom response, it gets cached and offered as an option next time. Auto-removed after 3 skips.
- **Gate 0 hook** - SubagentStop hook blocks Phase 2 unless policy decisions are persisted to preference cache.
- **Multi-tool transcript support** - `/skillers compact` now reads from Claude Code, Codex CLI, and OpenCode (was Claude Code only).

### Fixed

- **ship target branch validation** - `/ship` now reads `baseBranch` from flow state and validates non-default targets with user confirmation.
- **Quality sweep** - Removed 95 lines of prose slop and duplication across ship and skillers.
- **Pre-push hooks** - Fixed for repos without `npm test` script (falls back to JS syntax check).
- **Cached source null check** - `getPolicyQuestions` no longer crashes when preference file has freeText but no source.

## [5.4.0] - 2026-03-10

### Added

- **`/release` command** - Discovery-first release workflow that detects how a repo releases before executing. Supports 12+ ecosystems (npm, cargo, python, go, maven, gradle, ruby, nuget, dart, hex, packagist, swift) and 7 release tool configurations (semantic-release, release-it, goreleaser, changesets, cargo-release, lerna, standard-version).
- **`/skillers` command** - Transcript-based workflow pattern learning. Analyzes Claude Code conversation history, clusters recurring patterns into weighted themes, and suggests skills/hooks/agents to automate repetitive work.
- **release-agent** (sonnet) - Discovers release method via tool configs, CI workflows, scripts, and manifests before performing the release.
- **skillers-compactor** (sonnet) - Extracts observations from conversation transcripts and clusters them into knowledge themes.
- **skillers-recommender** (opus) - Analyzes accumulated knowledge and classifies patterns as hook/skill/agent recommendations.
- **Agnix CI validation** - All plugins now run agnix lint in CI pipelines.
- **agent-knowledge submodule** - Research guides available as a git submodule.
- **Website additions** - How It Works content for consult, debate, web-ctl tabs.

### Fixed

- **Accurate ecosystem counts** - Stats now show 15 plugins, 35 agents, 32 skills, 3,751 tests, 14 commands. Previously showed inflated/stale counts.
- **Pinned action SHAs** - Updated to latest stable versions for security.
- **CodeQL regex** - Fixed inefficient regular expression flagged by code scanning.
- **Go test fixture** - Added go.mod so CodeQL can analyze Go fixtures.
- **Website CSS** - Reduced commands section bottom padding, removed inline how-it-works paragraphs.

## [5.3.7] - 2026-03-02

### Fixed

- **Website numbers updated** - Stats now show 14 plugins, 43 agents, 30 skills, 3,750 tests, 13 commands. Previously showed stale counts from earlier versions.
- **Kiro install TDZ bug** - Fixed `steeringMappingsForCleanup` used before initialization in v5.3.6 published code. Variable ordering corrected.

## [5.3.6] - 2026-03-02

### Fixed

- **Kiro commands install to ~/.kiro/prompts/** - Commands now install as prompts (invoked with `@name` in kiro-cli) instead of steering files. Legacy `~/.kiro/steering/` auto-cleaned on install.
- **Cursor installs globally to ~/.cursor/** - Previously project-scoped. Now global like all other platforms.
- **Kiro installs globally to ~/.kiro/** - Consistent with all other platforms.
- **Agent resources updated** - Reference `file://.kiro/prompts/**/*.md`.

## [5.3.5] - 2026-03-02 (broken - variable ordering bug)

## [5.3.4] - 2026-03-02

### Fixed

- **Kiro installs globally to ~/.kiro/** - Previously installed to `cwd/.kiro/` (project-scoped) which only worked in the agentsys directory. Now installs to `~/.kiro/` like other platforms (OpenCode → `~/.config/opencode/`, Codex → `~/.codex/`). Detection checks both global and project paths.

## [5.3.3] - 2026-03-02

### Fixed

- **Restored file:// prefix in Kiro agent resources** - kiro-cli requires `file://` or `skill://` scheme prefix on resources. The 5.3.2 removal caused all 34 agents to fail validation.

## [5.3.2] - 2026-03-02

### Fixed

- **Invalid file:// URI in Kiro agent resources** - Attempted to remove `file://` prefix (reverted in 5.3.3).
- **Kiro detection too strict** - Now detects `.kiro/` existence alone, catching fresh workspaces.
- **Silent tool stripping** - `task`, `web`, `fetch`, `notebook`, `lsp` tools added to Kiro agent mapping.
- **Kiro session continuity** - `supportsContinue` set to `true` (Kiro ACP reports `loadSession: true`).

## [5.3.1] - 2026-03-02

### Fixed

- **Code block Task() transform for Kiro** - Phase 9 reviewer Task() calls inside fenced JavaScript code blocks were not being transformed. Fixed with multiline-anchored fence regex that correctly handles backtick template literals inside code blocks.

## [5.3.0] - 2026-03-02

### Added

- **Kiro platform support (#276, #278)** - agentsys now installs to Kiro as a 5th platform alongside Claude Code, OpenCode, Codex CLI, and Cursor. Use `agentsys --tool kiro` or `agentsys install <plugin> --tool kiro` to install. Commands become steering files in `.kiro/steering/` (with `inclusion: manual` frontmatter), skills are copied to `.kiro/skills/` (standard SKILL.md format), and agents are converted to JSON in `.kiro/agents/`. All content is project-scoped under `.kiro/`. Platform detection uses `.kiro/` directory presence.

- **Kiro subagent transforms (#279, #280)** - Task() calls transform to `Delegate to the \`agent\` subagent` with prompt context. AskUserQuestion transforms to markdown numbered-list prompts. Plugin namespace prefixes are stripped.

- **Kiro parallel agent adaptation** - Workflows spawning 4+ parallel reviewer agents (next-task Phase 9, audit-project Phase 2) are automatically adapted for Kiro's experimental 4-agent limit. `installForKiro()` generates two combined reviewer agents (`reviewer-quality-security`, `reviewer-perf-test`). `transformCommandForKiro()` detects consecutive reviewer delegations and rewrites as try-4-then-fallback-to-2 pattern.

- **Subagent comparison documentation** - CROSS_PLATFORM.md now has a platform comparison table for subagent capabilities (spawning, parallelism, teams, ACP) across all 5 platforms.

### Changed

- **`transformAgentForKiro()` refactored** - Now reuses `discovery.parseFrontmatter()` instead of custom parsing. Supports YAML array syntax for tools field.

### Fixed

- **Copy-paste bug in `installForCursor()`** - Skill transform was calling `transformSkillForKiro` instead of `transformSkillForCursor`.

## [5.2.1] - 2026-03-01

### Fixed

- **Installer marketplace source parsing** — Added compatibility for both legacy string `source` values and structured source objects (`{ source: "url", url: "..." }`) so installs no longer crash with `plugin.source.startsWith is not a function`.
- **Plugin fetch resilience and failure behavior** — Normalized `.git` repository URLs, added GitHub ref fallback order (`vX.Y.Z`, `X.Y.Z`, `main`, `master`), and fail-fast behavior when any plugin fetch fails.
- **Cross-platform install ordering** — Fixed install sequence so local install directory reset no longer wipes the fetched plugin cache before OpenCode/Codex installation.

## [5.2.0] - 2026-02-27

### Added

- **Cursor platform support (#261)** — agentsys now installs to Cursor as a 4th platform alongside Claude Code, OpenCode, and Codex CLI. Use `agentsys --tool cursor` or `agentsys install <plugin> --tool cursor` to install. Skills are copied to `.cursor/skills/` (same SKILL.md format - no transform needed), commands to `.cursor/commands/` (light transform), and rules to `.cursor/rules/*.mdc` (MDC frontmatter). All content is project-scoped. Cursor v2.4+ natively supports the Agent Skills standard.

- **`/web-ctl` plugin** — New plugin for browser automation and web testing. Headless browser control via Playwright with persistent encrypted sessions, human-in-the-loop auth handoff (including CAPTCHA detection and checkpoint mode), anti-bot measures (webdriver spoofing, random delays), WSL detection with Windows Chrome fallback, and prompt injection defense via `[PAGE_CONTENT: ...]` delimiters. Includes `web-session` agent, `web-auth` and `web-browse` skills, and the `/web-ctl` command. Available at [agent-sh/web-ctl](https://github.com/agent-sh/web-ctl).

- **Plugin extraction to standalone repos (#250)** — All 13 plugins extracted from `plugins/` into standalone repos under the `agent-sh` org (`agent-sh/next-task`, `agent-sh/ship`, `agent-sh/deslop`, `agent-sh/audit-project`, `agent-sh/enhance`, `agent-sh/perf`, `agent-sh/drift-detect`, `agent-sh/sync-docs`, `agent-sh/repo-map`, `agent-sh/learn`, `agent-sh/consult`, `agent-sh/debate`, `agent-sh/agnix`). The `plugins/` directory has been removed from this repo. agentsys is now a marketplace + installer.

- **External plugin fetching in installer** — `bin/cli.js` now fetches plugins from their standalone GitHub repos at install time rather than bundling them. The installer resolves the correct version for each platform using the marketplace manifest.

- **Graduation script** (`scripts/graduate-plugin.js`) — Automates extraction of a plugin from the monorepo to a new standalone repo: creates repo, copies files, sets up agent-core sync, updates marketplace manifest.

- **Marketplace `requires` field** — `.claude-plugin/marketplace.json` now supports a `requires` field per plugin entry to declare the minimum agentsys installer version required. The installer validates this at install time and warns on incompatibility.

- **`/next-task` GitHub Projects source** — Added `gh-projects` as a supported task source. When selected, the workflow prompts for a project number and owner, then fetches issues from a GitHub Projects v2 board via `gh project item-list`. Includes PR-linked issue exclusion (same as GitHub Issues), input validation for project number and owner, and caching of project preferences. Fixes #247.

### Fixed

- **Installer crash with new marketplace schema** - Fixed `plugin.source.startsWith is not a function` error when installing plugins. The marketplace.json `source` field changed from a string to an object in #266 but the installer was not updated to handle the new format. Added `resolveSourceUrl()` helper that handles both legacy string and new `{ source: "url", url: "..." }` formats. Also fixed `.git` suffix in source URLs causing 404 errors when fetching tarballs from the GitHub API. Added fallback to `main` branch when version tags don't exist yet. Fixed Windows tar extraction failure by converting backslash paths to forward slashes for MSYS2 compatibility.

- **CLAUDE.md merge conflict markers** - Resolved broken merge conflict markers (HEAD/ancestor markers without closer) that were committed to main.

- **Windows jscpd output bug (#270)** - Fixed `runDuplicateDetection` creating a mangled filename on Windows when `--output NUL` was passed to jscpd via `execFileSync` (no shell). Replaced platform-specific null device with a temp directory via `os.tmpdir()` that is cleaned up in a `finally` block. Added 5 regression tests for temp directory lifecycle.

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
