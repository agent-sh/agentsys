# Repo Intel Library Checklist

Use this checklist when changing `lib/repo-intel/`. It wraps the `agent-analyzer` binary; deslop's v1.3.0 detector reads its slop queries and test gaps from its own vendored `lib/` copy.

## Functional

- [ ] `agent-analyzer` binary is available before running scans (`lib/binary/`)
- [ ] No automatic installs without user approval
- [ ] Raw artifact saved to `{state-dir}/repo-intel.json`, converted view to `{state-dir}/repo-map.json`
- [ ] `update` handles added, modified and deleted files
- [ ] `status` reports staleness correctly
- [ ] A missing map raises `RepoIntelMissingError` with a message that says how to generate it

## Consumers

- [ ] A consumer without a map falls back cleanly instead of failing

## Docs + Tests

- [ ] `docs/ARCHITECTURE.md` updated if the module layout changed
- [ ] `__tests__/repo-intel-queries.test.js` covers the change
- [ ] `npm test` passes
- [ ] Plugin repos that vendor `lib/` copy the change themselves; nothing syncs it for them
