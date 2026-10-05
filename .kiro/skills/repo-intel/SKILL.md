---
name: repo-intel
description: "Use when the user asks about a repo's git history or structure: hotspots, bugspots, coupling, ownership, bus factor, test gaps, diff risk, stale docs, symbols, dependents, entry points, finding code by concept, or a repo summary."
argument-hint: "init|update|enrich|status|query <type>|embed <action> [--since=<date>] [--max-commits=<n>] [--limit=<n>] [--depth=1|3|10] [--min-changes=<n>] [<file-or-concept>]"
---

# repo-intel

Answer questions about a repository from its cached repo-intel artifact instead of re-reading history each time. The artifact (`{stateDir}/repo-intel.json`, where `{stateDir}` is `.claude`, `.opencode` or `.codex`) is built by the `agent-analyzer` binary from git history and the AST; `enrich` adds per-file descriptors and a narrative summary written by two small agents.

Arguments: `$ARGUMENTS`

## Running it

`scripts/repo-intel.js` at the plugin root (two directories up from this skill) runs every action and prints JSON:

```bash
node <plugin>/scripts/repo-intel.js status
node <plugin>/scripts/repo-intel.js query hotspots --limit=10
node <plugin>/scripts/repo-intel.js query find "worker pool"
```

The `/repo-intel` command documents each action, the enrich sequence and the report shape; follow it for `init`, `update` and `enrich`. For a question like "what breaks most often", pick the query that answers it (see [references/queries.md](references/queries.md)), run it, and answer the question from the rows. Several queries together often answer better than one: `painspots` plus `test-gaps` for "where should tests go first".

## Freshness

Check `status` before answering from a map. If it is behind HEAD, run `update` first (seconds on most repos); if there is no map, `init` it when the user asked for analysis, or say that one is needed. Answers from a stale map describe an older repo.

Recency is measured against the repo's last commit date, not the wall clock, so a quiet repo does not look dead. See the reference for the scoring details.

## Constraints

- The binary does the analysis. Do not approximate a query with `git log` or grep when the binary is missing; report the install error. Approximations look authoritative and are not.
- `enrich` writes LLM-generated text into the artifact. The descriptors describe files; they are search aids, not facts about behavior.
- The embedder downloads a model. Only the user opts in (see the command); unattended runs leave it off.
