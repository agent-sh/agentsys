---
name: deslop
description: "Use when the user asks to clean AI slop from code: 'deslop', 'clean up slop', 'remove debug statements', 'find ghost code', 'repo hygiene'. Detects slop with regex, AST and optional repo-intel signals, then reports or applies fixes."
version: 5.4.0
argument-hint: "[report|apply] [--scope=all|diff|path] [--thoroughness=quick|normal|deep]"
---

# deslop

Find AI slop in a codebase (debug output, placeholders, empty catches, stub functions, dead code, tracked artifacts) and return findings ranked by certainty, with a list of fixes that are safe to apply without review. This skill only reads; the caller applies fixes.

Arguments: `$ARGUMENTS`

- **mode**: `report` (default) or `apply`. The mode is passed through to the result; it does not change what you scan.
- **--scope**: `all` (default), `diff` (files changed on this branch), or a path.
- **--thoroughness**: `quick` (regex only), `normal` (default, adds multi-pass analyzers), `deep` (adds jscpd, madge and similar CLI tools when installed).

## Detection

The detector is `scripts/detect.js` at the plugin root, two directories up from this skill. Resolve it to an absolute path and run it from the repository root. It prints JSON by default (`findings`, `summary`); `--compact` prints a short markdown table without the `autoFix` field, so use the JSON when building fixes. Add `--quick` or `--deep` for those thoroughness levels.

```bash
node <plugin>/scripts/detect.js .                                   # scope all
node <plugin>/scripts/detect.js . src/api.js src/auth.js            # scope path: the files under it
git diff --name-only --diff-filter=d "origin/$BASE"...HEAD \
  | node <plugin>/scripts/detect.js . --files-from -                # scope diff
```

For diff scope, `BASE` is the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD` with `origin/` stripped, or `main`. Files after the repo path (or from `--files-from`) are exactly what gets scanned, relative to the repo root. Without them the detector scans at most 200 source files and skips tests, or only the repo-intel slop targets when a map exists, so a whole-repo run is a sample: say so in the result when `metadata.filesAnalyzed` is 200 or targeting was on. For a path scope, list its files (`git ls-files <path>`) and pass them, rather than passing the path as the repo root.

Finding paths are relative to the repo root. Exit code 2 means critical findings exist, not that the run failed. On a large repo the JSON is long: read `summary` first and filter `findings` by certainty with `node -e` or `jq` rather than reading all of it.

When the repo has repo-intel data, the detector folds in the analyzer's pre-located fixes. [references/repo-intel.md](references/repo-intel.md) covers what that adds and the one query you run yourself (files without test coupling).

Pattern names, certainty rules and fix strategies per language are in [references/slop-categories.md](references/slop-categories.md).

## Judgment

The detector is a pattern matcher. Before a finding goes into `fixes`, read the line and confirm it is slop in this codebase:

- `console.log`, `print` and `fmt.Println` in a CLI entry point or a logger are the program's output, not debugging. Drop those findings.
- An empty catch with a comment explaining why is deliberate. Keep it out of `fixes`.
- A finding in a test fixture, a generated file, or vendored code is not the repo's slop. Build output, `vendor/`, `node_modules/`, minified and generated files, and lockfiles are skipped by the detector; skip anything else of that kind you see.
- In files with no test coupling, a wrong fix goes unnoticed. Rank their findings first in the report, and leave them out of `fixes` unless certainty is HIGH on its own.

Only HIGH certainty findings with a real fix strategy become fixes. MEDIUM and LOW stay in `findings` for a human.

`autoFix: "remove"` means the matched text is slop, not always the whole line. Pick the fix that removes exactly that:

- The whole line is slop (a debug print, an unused debug import): `remove-line`.
- Only part of the line is (trailing whitespace, a trailing `// see #42` comment after live code): `replace` with the corrected line. Deleting it would delete the code in front.
- The finding spans lines (`commented_code` reports its range in `details.startLine` and `details.endLine`): `remove-line` with `endLine` set from `details.endLine`.

## Output

Return this block last. `/deslop` and `/next-task` parse the JSON between the markers and hand `fixes` to whatever applies them.

```
=== DESLOP_RESULT ===
{
  "mode": "report",
  "scope": "all",
  "filesScanned": 120,
  "findings": [
    { "file": "src/api.js", "line": 42, "pattern": "console_debugging", "message": "console.log found",
      "certainty": "HIGH", "severity": "medium", "autoFix": "remove", "untested": false }
  ],
  "fixes": [
    { "file": "src/api.js", "line": 42, "fixType": "remove-line", "pattern": "console_debugging" }
  ],
  "summary": { "high": 1, "medium": 0, "low": 0, "autoFixable": 1 }
}
=== END_RESULT ===
```

Paths are relative to the repository root. `fixType` is one of:

| fixType | From | Meaning |
|---------|------|---------|
| `remove-line` | detector `autoFix: "remove"` when the whole line or range is slop, analyzer `delete-lines` | Delete `line`, or `line` through `endLine`. |
| `add-comment` | detector `autoFix: "add_logging"` | Empty catch: log the error if the file has a logger, else add a comment saying it is ignored on purpose, in the file's comment syntax. |
| `replace` | detector `autoFix: "replace"`, `"remove"` on part of a line, analyzer `replace-lines` | Replace `line` (through `endLine` if set) with `replacement`. |
| `remove-block` | multi-line constructs | Delete the whole block starting at `line`. |
| `delete-file` | analyzer `delete-file` | Remove the tracked file (artifacts such as `.DS_Store`). |

If git is missing, skip git-based checks and say so. If the scope path does not exist, return the block with empty arrays and an `"error"` field. A file that fails to parse is skipped and the scan continues.
