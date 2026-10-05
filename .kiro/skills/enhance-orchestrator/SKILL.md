---
name: enhance-orchestrator
description: "Use when running /enhance: discovers which agent-facing content exists, runs the matching enhancers, and merges their findings into one report."
version: 5.2.0
argument-hint: "[path] [--apply] [--focus=TYPE]"
---

# enhance-orchestrator

Run the enhancers that apply to the target, merge their findings, and report them ranked by certainty. Arguments come in `$ARGUMENTS` (see the `/enhance` command for the full list). An invalid `--focus` value stops the run with the list of valid values.

## Constraints

- Analysis is read-only. Files change only with `--apply`, and then only for HIGH certainty findings that have an auto-fix. The user asked for a report; edits to their prompts without consent are unwelcome even when right.
- Run only enhancers whose content exists. An empty enhancer run is noise.
- Each finding appears once, even if two enhancers raised it.

## Discovery

Map what exists under the target to enhancers:

| Enhancer | Content | Agent | Analyzer |
|---|---|---|---|
| `plugin` | `.claude-plugin/plugin.json`, `plugins/*/.claude-plugin/plugin.json` | `plugin-enhancer` | `plugin-analyzer.js` |
| `agent` | `**/agents/*.md` | `agent-enhancer` | `agent-analyzer.js` |
| `claudemd` | `CLAUDE.md`, `AGENTS.md` (root, `.github/`, nested) | `claudemd-enhancer` | `projectmemory-analyzer.js` |
| `docs` | `docs/**/*.md`, `README.md` | `docs-enhancer` | `docs-analyzer.js` |
| `prompt` | `**/prompts/**/*.md`, `**/commands/**/*.md` | `prompt-enhancer` | `prompt-analyzer.js` |
| `hooks` | `**/hooks/**` (`.md`, `.json`, scripts), hook blocks in `settings.json` | `hooks-enhancer` | `hook-analyzer.js` |
| `skills` | `**/skills/**/SKILL.md` | `skills-enhancer` | `skill-analyzer.js` |
| `cross-file` | runs when agents or skills exist | `cross-file-enhancer` | `cross-file-analyzer.js` |

Analyzers live in `$HOME/.agentsys/plugins/enhance/lib/enhance/`.

## Context worth passing

If `<stateDir>/repo-intel.json` exists, gather two optional signals through `runAnalyzer` in `$HOME/.agentsys/plugins/enhance/lib/binary` (skip quietly on any failure):

- For the docs enhancer: `repo-intel query doc-drift --top 20` (docs with zero code coupling are likely stale) and `stale-docs --top 20` (docs that name symbols that no longer exist; take the first 10).
- For the agent, prompt and skills enhancers: `repo-intel query conventions`, so suggested wording matches the project's voice.

## Running the enhancers

Spawn each applicable enhancer agent with its enhancer type (the first column of the Discovery table), the target path, `verbose`, and its context. Run them in parallel, at most 4 at a time. Without a `Task` tool, run each enhancer's skill yourself, one after another. Each returns:

```json
{ "enhancerType": "agent", "findings": [ { "file": "...", "line": 12, "issue": "...", "fix": "...", "certainty": "HIGH|MEDIUM|LOW", "patternId": "...", "autoFixable": false } ], "summary": { "high": 0, "medium": 0, "low": 0 } }
```

An enhancer that fails or returns no JSON is listed in the report as failed with its error. The others still count.

## Suppressions

Learned suppressions hide findings the project has repeatedly shown to be false positives. Use `$HOME/.agentsys/plugins/enhance/lib/enhance/auto-suppression.js` with the path from `getSuppressionPath()` in `lib/cross-platform` and `getProjectId(target)`:

- `--reset-learned`: `clearAutoSuppressions(path, projectId)` before analysis.
- Before reporting: drop findings matched by `loadAutoSuppressions(path, projectId)`. With `--show-suppressed`, list them separately.
- After reporting, unless `--no-learn`: `analyzeForAutoSuppression(findings, fileContents, { projectRoot })`, then `saveAutoSuppressions` for what it returns.
- `--export-learned`: print `exportAutoSuppressions(path, projectId)` and stop.

## Report

Merge the findings. Set `source` on each finding to its enhancer's `enhancerType`, and key `byEnhancer` by the same value with that enhancer's `summary`: the reporter builds the Executive Summary rows, deduplication and grouping from `source`. Deduplicate by file, line and issue, and render with `generateOrchestratorReport(aggregated, { verbose, showAutoFixable, targetPath })` from `lib/enhance/reporter.js`, where `aggregated` is `{ findings, byEnhancer, totals }`. HIGH findings come first. LOW findings appear only with `--verbose`. The reporter's summary table has rows for `plugin`, `agent`, `claudemd`, `docs`, `prompt`, `hooks` and `skills` only, so add a `cross-file` row yourself when that enhancer ran. If the reporter is unavailable, produce the same shape by hand (see the `/enhance` output format).

## Apply

With `--apply`, group the HIGH certainty `autoFixable` findings by enhancer and send each group back to its enhancer agent to apply. Then show `git diff --stat` and list any fix that failed.
