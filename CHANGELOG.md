# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.1.1] - 2025-02-09

### Fixed
- **Skills $ARGUMENTS parsing** - Added `$ARGUMENTS` parsing to 13 skills that declared `argument-hint` but never consumed the arguments (CC-SK-012)
- **agnix config** - Migrated `.agnix.toml` `disabled_rules` from deprecated slug format to proper rule IDs (XP-003, AS-014)
- **Memory file language** - Strengthened imperative language in AGENTS.md/CLAUDE.md (PE-003, CC-MEM-006)

## [Unreleased]

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
  - `npx awesome-slash-dev new plugin <name>` - full plugin directory with plugin.json, default command, and shared lib
  - `npx awesome-slash-dev new agent <name> --plugin=<plugin>` - agent .md with YAML frontmatter template
  - `npx awesome-slash-dev new skill <name> --plugin=<plugin>` - skill directory with SKILL.md
  - `npx awesome-slash-dev new command <name> --plugin=<plugin>` - command .md with frontmatter
  - Name validation, collision detection, path traversal protection, YAML injection prevention
  - npm script aliases: `new:plugin`, `new:agent`, `new:skill`, `new:command`
  - 56 scaffold tests + 11 dev-cli integration tests
- **Shared agent template system** - Build-time template expansion (`expand-templates` command) with 3 shared snippets, replacing duplicated sections across 6 enhance agents with TEMPLATE markers and CI freshness validation (#187)
- **Auto-generate documentation** - `gen-docs` command reads plugin metadata, agent frontmatter, and skill frontmatter to auto-generate documentation sections between GEN:START/GEN:END markers
  - `npx awesome-slash-dev gen-docs` writes generated sections to README.md, CLAUDE.md, AGENTS.md, docs/reference/AGENTS.md, site/content.json
  - `npx awesome-slash-dev gen-docs --check` validates docs are fresh (for CI, exits 1 if stale)
  - Enhanced `lib/discovery` with YAML array parsing and frontmatter in `discoverAgents()`/`discoverSkills()`
  - Integrated into preflight as `gap:docs-freshness` check for new-agent, new-skill, new-command, and release checklists
  - 34 tests for the generation system, 7 new discovery tests
- **@awesome-slash/lib npm package** - Published shared library as standalone npm package
  - Enables external projects to use awesome-slash utilities via `require('@awesome-slash/lib')`
  - Zero dependencies, CommonJS, Node.js >= 18
  - npm workspaces link lib/ for local development
  - Plugins remain self-contained (vendored lib/ copies) for Claude Code marketplace compatibility
  - Version stamping, consistency validation, and CI publishing all updated
- **Preflight command** - Unified change-aware checklist enforcement (`npm run preflight`, `preflight --all`, `preflight --release`, `preflight --json`)
  - Detects changed files and runs only relevant checklist validators
  - Includes 7 existing validators + 7 new gap checks (CHANGELOG, labels, codex triggers, lib exports, lib sync, test existence, staged files)
  - Pre-push hook now delegates to preflight for validation
- **Unified Dev CLI** (`awesome-slash-dev`) - Single discoverable entry point for all dev scripts
  - `awesome-slash-dev validate` runs all 7 validators sequentially
  - `awesome-slash-dev validate <sub>` runs individual validators (plugins, cross-platform, consistency, etc.)
  - `awesome-slash-dev status` shows project health (version, plugin/agent/skill counts, git branch)
  - `awesome-slash-dev bump <version>`, `sync-lib`, `setup-hooks`, `detect`, `verify`, `test`
  - `awesome-slash-dev --help` lists all commands with descriptions
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
  - Single command updates all 15+ version locations: `npx awesome-slash-dev bump X.Y.Z`
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
  - Prominent link to [agnix CLI project](https://github.com/avifenesh/agnix)
  - Updated Commands table with more descriptive entry
  - Updated skill count to 26 across all references

## [4.1.0] - 2026-02-05

### Added
- **New /agnix Plugin** - Lint agent configurations before they break your workflow
  - Validates Skills, Hooks, MCP, Memory, Plugins across Claude Code, Cursor, GitHub Copilot, and Codex CLI
  - 100 validation rules from official specs, research papers, real-world testing
  - Auto-fix support with `--fix` flag
  - SARIF output for GitHub Code Scanning integration
  - Target-specific validation (`--target claude-code|cursor|codex`)
  - Requires [agnix CLI](https://github.com/avifenesh/agnix) (`cargo install agnix-cli`)

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

- [v3.x Changelog](https://github.com/avifenesh/awesome-slash/blob/main/changelogs/CHANGELOG-v3.md) (v3.0.0 - v3.9.0)
- [v2.x Changelog](https://github.com/avifenesh/awesome-slash/blob/main/changelogs/CHANGELOG-v2.md) (v2.0.0 - v2.10.1)
- [v1.x Changelog](https://github.com/avifenesh/awesome-slash/blob/main/changelogs/CHANGELOG-v1.md) (v1.0.0 - v1.1.0)
