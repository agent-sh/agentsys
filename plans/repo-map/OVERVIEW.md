# Repo Map Plugin Plan

**Last Updated**: January 25, 2026  
**Status**: In progress  
**Branch**: `feature/repo-map`

## Goal

Add a standalone repo-map plugin that builds a cached AST map of symbols and imports using ast-grep, with incremental updates and cross-tool integration.

## Scope

- New lib module: `lib/repo-map/`
- New plugin: `plugins/repo-map/`
- New MCP tool: `repo_map`
- Integrations: `/ship` post-merge update, `/drift-detect` suggestion, agent awareness
- Documentation updates and testing

## Phases

1. **Core Library**
   - AST queries per language
   - Full scan + incremental update
   - Cache management (state-dir aware)

2. **Plugin Surface**
   - `/repo-map` command
   - `map-validator` agent (haiku)
   - `repo-mapping` skill

3. **Integrations**
   - MCP tool `repo_map`
   - `/ship` post-merge update
   - `/drift-detect` suggestion
   - Exploration/planning/implementation agent hints

4. **Docs + Tests**
   - README, ARCHITECTURE, USAGE, TESTING updates
   - MCP tool reference updates
   - Tests for MCP tool

## Files Added/Updated

### New Files
- `lib/repo-map/index.js`
- `lib/repo-map/installer.js`
- `lib/repo-map/runner.js`
- `lib/repo-map/cache.js`
- `lib/repo-map/updater.js`
- `lib/repo-map/queries/index.js`
- `lib/repo-map/queries/javascript.js`
- `lib/repo-map/queries/typescript.js`
- `lib/repo-map/queries/python.js`
- `lib/repo-map/queries/rust.js`
- `lib/repo-map/queries/go.js`
- `lib/repo-map/queries/java.js`
- `plugins/repo-map/commands/repo-map.md`
- `plugins/repo-map/agents/map-validator.md`
- `plugins/repo-map/skills/repo-mapping/SKILL.md`
- `plugins/repo-map/.claude-plugin/plugin.json`
- `plans/repo-map/OVERVIEW.md`
- `plans/README.md`

### Updated Files
- `bin/cli.js` (command + skill mappings, plugin list)
- `mcp-server/index.js` (repo_map tool)
- `plugins/ship/commands/ship.md` (post-merge repo-map update)
- `plugins/drift-detect/commands/drift-detect.md` (repo-map suggestion)
- `plugins/next-task/agents/exploration-agent.md` (repo-map awareness)
- `plugins/next-task/agents/planning-agent.md` (repo-map awareness)
- `plugins/next-task/agents/implementation-agent.md` (repo-map awareness)
- `.claude-plugin/marketplace.json` (new plugin + tool)
- `README.md` (new command)
- `docs/ARCHITECTURE.md` (new plugin + MCP tool)
- `docs/README.md` (command list)
- `docs/USAGE.md` (command list)
- `docs/INSTALLATION.md` (plugin list + prereq)
- `docs/CROSS_PLATFORM.md` (command list + agent)
- `docs/TESTING.md` (repo-map tests)
- `docs/reference/AGENTS.md` (agent count + repo-map agent)
- `docs/reference/MCP-TOOLS.md` (repo_map tool)
- `CHANGELOG.md` (unreleased entry)
- `checklists/cross-platform-compatibility.md` (counts)
- `__tests__/mcp-server.test.js` (repo_map tool test)

## Validation Checklist

- [ ] `./scripts/sync-lib.sh` (copy lib/ to plugins)
- [ ] `npm test` passes
- [ ] `/repo-map init` works locally with ast-grep installed
- [ ] `/repo-map update` handles git diffs + renames
- [ ] MCP tool `repo_map` responds via `mcp-server/index.js`

## Notes

- ast-grep is optional and installed only with user approval
- Tree-sitter parsing handled by ast-grep binaries (no dependencies added)
