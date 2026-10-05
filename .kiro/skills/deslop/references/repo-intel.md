# Repo-intel signals

repo-intel is an optional analysis the agentsys `agent-analyzer` binary writes to `<stateDir>/repo-intel.json`, where `<stateDir>` is the first of `.claude`, `.opencode`, `.codex` that exists in the repo. It is created by `/repo-intel init`. The binary downloads to `~/.agent-sh/bin/` on first use. When the file is missing, every step here is skipped.

## What detect.js does with it

`scripts/detect.js` reads two analyzer queries through `lib/repo-intel-signals.js` before scanning. You do not call them.

- **slop-fixes**: pre-located HIGH certainty fixes (tracked artifacts, stale CI configs, duplicate tooling, orphan exports, empty catches, tautological tests). They appear in the detector's top-level `fixes` array with `source: "analyzer-slop-fixes"` and a `fixType` already set (`delete-file`, `remove-line` with `endLine`, or `replace` with `replacement`). Carry them into the result's `fixes` as they are, after the same judgment check as any other fix.
- **slop-targets**: files and areas where slop is likely, ranked by score. On a run without explicit files, the detector scans only these (top 30), so treat that run as a sample. The `suspect` labels (for example `defensive-cargo-cult`, `bot-authored`, `wrapper-tower`, `single-impl`) are a hint about what kind of slop to look for when you read a finding.

## Test coupling: the query you run

Files that no test exercises are where a wrong fix goes unnoticed. With repo-intel present, list them:

```bash
node -e "const q=require('<plugin>/lib/repo-intel/queries'); console.log(JSON.stringify(q.testGaps(process.cwd(), { limit: 20 })))"
```

`<plugin>` is the plugin root, two directories up from the skill. The query returns an array of `{ path, ... }`. Mark findings in those files `"untested": true`, list them first in the report, and do not promote them into `fixes` on that basis. If the caller already passed a test-gaps list in the prompt, use it instead of running the query.

If the query throws (old agentsys, missing binary), note the reason once in the result and continue without it.
