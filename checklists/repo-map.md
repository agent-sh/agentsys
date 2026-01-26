# Repo Map Checklist

Use this checklist when modifying the repo-map plugin or library.

## Functional

- [ ] `ast-grep` is detected before running scans
- [ ] No automatic installs without user approval
- [ ] Repo map saved to `{state-dir}/repo-map.json`
- [ ] `repo-map update` handles added/modified/deleted files
- [ ] `repo-map status` reports staleness correctly

## Integration

- [ ] `/repo-map` command updated and mapped in `bin/cli.js`
- [ ] `repo_map` MCP tool defined and documented
- [ ] `/ship` updates repo-map after merge (if map exists)
- [ ] `/drift-detect` suggests repo-map when missing or stale

## Docs + Tests

- [ ] `README.md` command list updated
- [ ] `docs/ARCHITECTURE.md` and `docs/USAGE.md` updated
- [ ] `docs/reference/MCP-TOOLS.md` updated
- [ ] `docs/reference/AGENTS.md` updated for map-validator
- [ ] `npm test` passes
