# Repo Intel Checklist

Use this checklist when modifying the repo-intel plugin or library.

## Functional

- [ ] `agent-analyzer` binary is available before running scans
- [ ] No automatic installs without user approval
- [ ] Repo map saved to `{state-dir}/repo-map.json`
- [ ] `repo-intel update` handles added/modified/deleted files
- [ ] `repo-intel status` reports staleness correctly

## Integration

- [ ] `/repo-intel` command updated and mapped in `bin/cli.js`
- [ ] `repo_intel` MCP tool defined and documented
- [ ] `/ship` updates repo-intel after merge (if map exists)
- [ ] `/drift-detect` suggests repo-intel when missing or stale

## Docs + Tests

- [ ] `README.md` command list updated
- [ ] `docs/ARCHITECTURE.md` and `docs/USAGE.md` updated
- [ ] `docs/reference/AGENTS.md` updated for map-validator
- [ ] `npm test` passes
