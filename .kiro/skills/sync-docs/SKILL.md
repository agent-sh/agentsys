---
name: sync-docs
description: "Use when the user asks to update docs, sync documentation, fix stale docs or update the changelog, or after code changes that may affect docs. Finds docs that no longer match the code and proposes exact fixes."
version: 5.2.0
argument-hint: "[report|apply] [--scope=all|recent|before-pr] [--base=BRANCH] [--include-undocumented] [path]"
allowed-tools: Bash(git:*), Bash(node:*), Read, Grep, Glob
---

# sync-docs

Find documentation that no longer matches the code, and turn each real mismatch into an exact edit someone can apply without re-reading the code. This skill reads and proposes; the caller applies.

Arguments: `$ARGUMENTS`

- **mode**: `report` (default) or `apply`. Passed through to the result; the evidence you collect is the same.
- **--scope**: `recent` (default: this branch against its base, or the last 5 commits when on the base branch), `before-pr` (this branch against its base), `all` (every tracked file), or a path.
- **--base=BRANCH**: base for `recent` and `before-pr`. Default: the remote default branch, else `main`.
- **--include-undocumented**: also list exports in the scope that no doc mentions. Needs a repo map (`/repo-intel` builds one); without it the result says why the list is empty.

## Evidence

The collector is `scripts/collect.js` at the plugin root, two directories up from this skill. Run it from the repository root with the same arguments:

```bash
node <plugin>/scripts/collect.js --scope=before-pr --base=main
```

It prints one JSON bundle:

- `discovery`: the diff range used, changed files, and docs that reference them.
- `issues`: `removed-export` (an export deleted anywhere in the range and still named in a doc, `certainty: HIGH`; or an analyzer stale-docs hit, `certainty: LOW`), `code-example` (an import in a doc's code block that points at a changed module), `outdated-version` (a version older than the manifest's).
- `documentsDeadCode` / `documentsWrapper`: docs that name, in code formatting, a symbol repo-intel found to have no importers or to be a one-call passthrough.
- `docDrift`: docs that never change with code, with versioned docs, fixtures, generated files and CHANGELOG already filtered out.
- `undocumentedExports`, `repoMap`, `analyzer` (available, reason, counts), `changelog` (`missing`, `needs-update` with the unlisted `feat`/`fix` commits, or `ok`).

CHANGELOG and other history files are not checked for removed symbols: a changelog naming an old function is a record, not a stale doc.

The analyzer signals need `{stateDir}/repo-intel.json` and the `agent-analyzer` binary. When the map is missing and the user is present, you may offer once to build it with `/repo-intel`. If AskUserQuestion is not available or the run is unattended, skip it: report `analyzer.available: false` with its reason and go on. Missing analyzer data narrows the check; it is not an error.

## Judgment

Every entry in the bundle is a lead, not a verdict. Read the doc line and the code before it becomes a fix.

- A `LOW` certainty stale-docs hit is often a CLI flag, a config key or a plain word in backticks (`quick`, `count`). Drop it unless the doc means a code symbol that is gone.
- A removed export may have been renamed. Find the new name in the diff and propose the rename, not a deletion.
- A code example that still works needs no fix. One that no longer runs gets a corrected example.
- `docDrift` and `documentsWrapper` are prompts to look, not fixes on their own.
- For `changelog.needs-update`, draft entries under `## [Unreleased]` (create the section if the file follows Keep a Changelog and lacks one) from the commits and the diff, in the file's existing style.

A finding becomes a fix only when you can state the exact text to replace and the replacement. Everything else stays in `issues` for a human. Preserve the doc's structure and voice: change the stale reference, not the section around it.

## Output

End with this block. `/sync-docs`, `/prepare-delivery` and `/next-task` read the JSON between the markers and apply `fixes`.

```
=== SYNC_DOCS_RESULT ===
{
  "mode": "report",
  "scope": "before-pr",
  "discovery": { "range": "origin/main...HEAD", "changedFilesCount": 5, "relatedDocsCount": 2, "relatedDocs": [] },
  "issues": [],
  "undocumentedExports": [],
  "documentsDeadCode": [],
  "documentsWrapper": [],
  "docDrift": [],
  "analyzer": { "available": false, "reason": "repo-intel-map-missing", "counts": {} },
  "fixes": [
    { "file": "README.md", "type": "replace", "line": 42, "search": "parseThing()", "replace": "parseItem()", "reason": "renamed in src/api.js" },
    { "file": "CHANGELOG.md", "type": "changelog-entry", "section": "Unreleased", "replace": "### Changed\n- `parseThing` is now `parseItem`" }
  ],
  "changelog": { "exists": true, "hasUnreleased": true, "undocumented": [], "status": "ok" },
  "summary": { "issueCount": 0, "fixableCount": 2, "bySeverity": { "high": 0, "medium": 0, "low": 0 } }
}
=== END_RESULT ===
```

Every field is present on every run: empty arrays, not `null`, so callers can iterate without guards. `search` must occur exactly once in `file`; widen it with surrounding text until it does. `issues` holds the confirmed findings that are not fixes, and drops the ones you ruled out. If the collector failed, return the block with an `"error"` field and empty arrays.
