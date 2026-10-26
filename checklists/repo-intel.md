# Repo Intel Library Checklist

Use this checklist when changing `lib/repo-intel/`, `lib/repo-map/` or the collectors that read their data (`lib/collectors/`). These wrap the `agent-analyzer` binary; onboard, can-i-help, drift-detect, sync-docs and audit-project consume the data from their own vendored `lib/` copies.

## Functional

- [ ] `agent-analyzer` binary is available before running scans (`lib/binary/`)
- [ ] No automatic installs without user approval
- [ ] Raw artifact saved to `{state-dir}/repo-intel.json`, converted view to `{state-dir}/repo-map.json`
- [ ] `update` handles added, modified and deleted files
- [ ] `status` reports staleness correctly
- [ ] A missing map raises `RepoIntelMissingError` with a message that says how to generate it

## Consumers

- [ ] `lib/collectors/` (git, analyzer-queries, docs-patterns) still read the fields they use
- [ ] A consumer without a map falls back cleanly instead of failing

## Docs + Tests

- [ ] `docs/ARCHITECTURE.md` updated if the module layout changed
- [ ] `__tests__/repo-intel-queries.test.js`, `__tests__/repo-map*.test.js` and `__tests__/docs-patterns.test.js` cover the change
- [ ] `npm test` passes
- [ ] Plugin repos that vendor `lib/` copy the change themselves; nothing syncs it for them
