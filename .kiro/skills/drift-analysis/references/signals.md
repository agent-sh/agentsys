# Reading the collected data

`scripts/collect.js` writes one JSON file. What each part tells you about drift:

| Key | Holds | Drift it reveals |
|-----|-------|------------------|
| `github` | Open issues and PRs, milestones, `overdueMilestones`, `categorized` (bugs, features, security...), `stale` (90+ days inactive), `themes` | Issues already done or no longer relevant, neglected priorities, milestones that slipped |
| `docs` | README, PLAN, CLAUDE.md, CHANGELOG and similar: `features`, `plans`, `checkboxes`, `gaps` | Checked items with no code behind them, features described but absent, low plan completion |
| `code` | `topLevelDirs`, `frameworks`, `testFramework`, `implementedFeatures`, `symbols`, `health` (tests, CI, lint) | Code that no doc mentions; missing tests or CI |
| `analyzer` | Structural facts from `agent-analyzer` when a repo-intel map exists, else `{ available: false, reason }` | See below |
| `repoIntel` | `atRiskAreas` (directory health) and `projectInfo` (languages, CI, license), or null | Where drift is most likely to hurt |
| `notes` | Why a source is missing or stale | Say these in the report so the reader knows what was not checked |

## Analyzer signals

These are facts about the code, not heuristics: if the analyzer says a symbol is never imported, it is not.

- **`orphanExports`**: exported, never imported. Next to a plan item this is either an abandoned feature (started, never wired up: resume it or close the item) or scope that was dropped but not deleted (remove the code). A cluster in one area is a strong drift signal for that area.
- **`passthroughWrappers`**: a function that only forwards to another call with the same arguments. Often a planned layer that never earned its keep, or a boundary that was meant to be inlined.
- **`alwaysTrueConditions`**: `if (x == x)`, `if (x && !x)` and similar. A bug or a dead branch. If the plan describes conditional behavior on that path, the feature is broken.
- **`staleDocsSample`**: a doc line that references a symbol the code no longer has. Cite it as exact evidence (`README.md:42 references legacyHandler`).
- **`docDrift`**: docs that rarely change with the code. Already filtered against versioned docs, fixtures, generated files and CHANGELOG; trust the list. An entry with `codeCoupling: 0` never changes with code.
- **`entryPoints`**: binaries, `main` functions, framework configs. An entry point is an execution surface; an undocumented one is not drift by itself.
- **`commentedOutCode`**, **`staleSuppressions`**: cleanup signals; drift only when a plan item points at them.

`repoIntel.atRiskAreas`: `health: "at-risk"` means stale owners and a high bug-fix rate, the most dangerous place for drift; `needs-attention` has one of the two. Stale areas often hold abandoned planned work, so check them against open phases and issues.

## Severity guide

| Finding | Severity |
|---------|----------|
| Orphan export that a plan or doc describes as a working feature | high |
| Always-true condition on a feature path | high |
| Phase or checkbox marked done with core pieces missing | high |
| Security issue open, or a release planned with blockers | high or critical |
| Passthrough wrapper documented as distinct behavior | medium |
| Stale doc reference in a file the plan points at | medium |
| Issue already implemented but still open | medium |
| Orphan export no doc mentions | low (cleanup, not drift) |

Weigh by impact, not only by type: user-facing and public-API drift matter more than internals, and one stale issue is noise while ten is a pattern.
