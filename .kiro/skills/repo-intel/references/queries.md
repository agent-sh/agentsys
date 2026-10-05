# repo-intel queries

Run with `node <plugin>/scripts/repo-intel.js query <type> [arg] [--limit=N]`. Every type delegates to `agent-analyzer repo-intel query <type>` against the cached map. `--limit` caps rows (default 10).

## Git history

| Query | Answers |
|-------|---------|
| `hotspots` | Most-changed files, recency-weighted |
| `coldspots` | Files with no recent activity |
| `bugspots` | Files with the highest share of bug-fix commits |
| `coupling <file>` | Files that change together with `<file>` |
| `ownership <path>` | Who owns a file or directory |
| `bus-factor` | Bus factor, critical owners, at-risk areas |
| `norms` | Project norms detected from history |
| `areas` | Directory-level health (healthy, needs-attention, at-risk) |
| `contributors` | Contributors by commit count, with staleness |
| `release-info` | Release cadence and tags |
| `health` | Repository health summary |
| `file-history <file>` | History of one file |
| `conventions` | Commit message style, prefixes, scopes |
| `test-gaps [--min-changes=N]` | Hot source files with no co-changing test |
| `diff-risk <a,b,c>` | Risk score per changed file (`riskScore`, `bugFixRate`, `churn`, `authorCount`) |
| `doc-drift` | Docs with low code coupling (likely stale) |
| `onboard` | Newcomer summary |
| `can-i-help` | Where an outside contributor can help |
| `project-info` | Languages, CI, license, README |

## Structure

| Query | Answers |
|-------|---------|
| `painspots` | Hotspot x bug rate x complexity |
| `symbols <file>` | Exports, imports and definitions in a file |
| `dependents <symbol> [--file=PATH]` | Files that import a symbol |
| `entry-points [files...]` | Binaries, `main` functions, npm scripts |
| `communities` | Co-change communities (Louvain) |
| `boundaries` | Files bridging communities |
| `area-of <file>` | The community a file belongs to |
| `community-health <id>` | Health metrics for one community |
| `stale-docs` | Doc lines that reference symbols no longer in the code |

## Needs `enrich`

| Query | Answers |
|-------|---------|
| `find <concept>` | Files relevant to a concept, ranked, with a one-line reason. Works without enrich from paths, symbols and doc headers; descriptors add synonyms (worker, executor). |
| `summary [--depth=1\|3\|10]` | One sentence, one paragraph, or a one-page overview |

## For /deslop

| Query | Answers |
|-------|---------|
| `slop-fixes` | Located fix actions: tracked artifacts, stale CI configs, orphan exports, empty catches, tautological tests |
| `slop-targets` | Ranked files for deeper slop scans; with the embedder, also stylistic outliers and semantic duplicates |

## Scoring notes

- Recency window: 90 days before the repo's last commit.
- Stale contributor: last seen more than 90 days before the last commit.
- Hotspot score: `(recentChanges * 2 + totalChanges) / (totalChanges + 1)`.

## Embedder

Optional. `embed choose` stores the choice in `{stateDir}/sources/preference.json`:

- `embedder`: `none`, `small` (BGE-small Q8, ~30 MB), `big` (EmbeddingGemma-300M Q4, ~195 MB).
- `embedderDetail`: `compact` (per file, 128 dims), `balanced` (per function, 256 dims), `maximum` (per function, 768 dims).

Embeddings live next to the map in `<map stem>.embeddings.bin`. `embed update` re-embeds only files whose content changed. `embed reset` clears the choice (not the sidecar or the model) so the next `enrich` asks again. Without embeddings, `find` and `slop-targets` return the same shape from AST and graph signals only.
