---
name: sync-docs
description: "Sync documentation with code. Use when user asks to update docs, check docs, fix stale documentation, update changelog, or after code changes."
version: 1.0.0
argument-hint: "[report|apply] [--scope=all|recent|before-pr] [path]"
---

# sync-docs

Unified skill for syncing documentation with code state. Combines discovery, analysis, and CHANGELOG update into a single workflow.

## Input

Arguments: `[report|apply] [--scope=all|recent|before-pr] [path]`

- **Mode**: `report` (default) or `apply`
- **Scope**:
  - `recent` (default): Files changed since last commit to main
  - `all`: Scan all docs against all code
  - `before-pr`: Files in current branch, optimized for /next-task Phase 11
  - `path`: Specific file or directory

## Architecture

This skill orchestrates all documentation sync operations:

```
sync-docs skill
    |-- Phase 1: Run validation scripts (--json output)
    |-- Phase 2: Find related docs (lib/collectors/docs-patterns)
    |-- Phase 3: Analyze issues
    |-- Phase 4: Check CHANGELOG
    |-- Phase 5: Return structured results
```

The skill MUST NOT apply fixes directly. It returns structured data for the orchestrator to decide what to do.

## Phase 1: Run Validation Scripts

Run the validation scripts with JSON output:

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Count and version validation
const { stdout: countsJson } = await execPromise('node scripts/validate-counts.js --json');
const counts = JSON.parse(countsJson);

// Cross-platform validation
const { stdout: crossPlatformJson } = await execPromise('node scripts/validate-cross-platform-docs.js --json');
const crossPlatform = JSON.parse(crossPlatformJson);
```

Parse the JSON results and extract issues.

## Phase 2: Find Related Documentation

Use lib/collectors/docs-patterns to find docs related to changed files:

```javascript
const path = require('path');
const { getPluginRoot } = require('./lib/cross-platform');
const pluginRoot = getPluginRoot('sync-docs');
const { collectors } = require(path.join(pluginRoot, 'lib'));
const docsPatterns = collectors.docsPatterns;

// Get changed files based on scope
let changedFiles;
if (scope === 'all') {
  changedFiles = await exec("git ls-files '*.js' '*.ts' '*.py' '*.go' '*.rs' '*.java'");
} else if (scope === 'before-pr') {
  changedFiles = await exec("git diff --name-only origin/main..HEAD");
} else {
  // recent (default): get the default branch name
  let base = 'main';
  try {
    const { stdout: refOutput } = await exec("git symbolic-ref refs/remotes/origin/HEAD");
    // Parse "refs/remotes/origin/branch-name" to extract "branch-name"
    const rawBase = refOutput.trim().split('/').pop();
    // Sanitize branch name to prevent shell injection (only allow alphanumeric, dash, underscore, dot)
    if (/^[a-zA-Z0-9._-]+$/.test(rawBase)) {
      base = rawBase;
    }
  } catch (e) {
    base = 'main'; // fallback to main if symbolic-ref fails
  }
  changedFiles = await exec(`git diff --name-only origin/${base}..HEAD 2>/dev/null || git diff --name-only HEAD~5..HEAD`);
}

// Find related docs
const relatedDocs = docsPatterns.findRelatedDocs(changedFiles.split('\n').filter(Boolean), {
  cwd: process.cwd()
});
```

## Phase 3: Analyze Documentation Issues

For each related doc, check for issues:

```javascript
const allIssues = [];

for (const { doc, referencedFile } of relatedDocs) {
  const issues = docsPatterns.analyzeDocIssues(doc, referencedFile, {
    cwd: process.cwd()
  });

  issues.forEach(issue => {
    allIssues.push({
      ...issue,
      doc,
      referencedFile
    });
  });
}
```

Issue types detected:
- `outdated-version`: Version string doesn't match current
- `removed-export`: References removed symbol
- `code-example`: Code example may be outdated
- `import-path`: Import path changed

## Phase 4: Check CHANGELOG

```javascript
const changelogResult = docsPatterns.checkChangelog(changedFiles.split('\n').filter(Boolean), {
  cwd: process.cwd()
});

// changelogResult contains:
// - exists: boolean
// - hasUnreleased: boolean
// - documented: string[]
// - undocumented: string[]
// - suggestion: string | null
```

## Phase 5: Return Structured Results

Combine all results into a single output:

```json
{
  "mode": "report|apply",
  "scope": "recent|all|before-pr|path",
  "validation": {
    "counts": { /* from validate-counts.js --json */ },
    "crossPlatform": { /* from validate-cross-platform-docs.js --json */ }
  },
  "discovery": {
    "changedFilesCount": 5,
    "relatedDocsCount": 3,
    "relatedDocs": [
      { "doc": "README.md", "referencedFile": "src/api.js", "referenceTypes": ["filename", "import"] }
    ]
  },
  "issues": [
    {
      "type": "outdated-version",
      "severity": "low",
      "doc": "README.md",
      "line": 15,
      "current": "1.0.0",
      "expected": "1.1.0",
      "autoFix": true,
      "suggestion": "Update version from 1.0.0 to 1.1.0"
    }
  ],
  "fixes": [
    {
      "file": "README.md",
      "type": "update-version",
      "line": 15,
      "search": "1.0.0",
      "replace": "1.1.0"
    }
  ],
  "changelog": {
    "exists": true,
    "hasUnreleased": true,
    "undocumented": ["feat: add new feature"],
    "status": "needs-update|ok"
  },
  "summary": {
    "issueCount": 3,
    "fixableCount": 2,
    "bySeverity": { "high": 0, "medium": 1, "low": 2 }
  }
}
```

## Output Format

Output the result as JSON between markers:

```
=== SYNC_DOCS_RESULT ===
{JSON output}
=== END_RESULT ===
```

## Usage by Agents

### sync-docs-agent (standalone /sync-docs)

```
Skill: sync-docs
Args: report --scope=recent
```

### /next-task Phase 11

```
Skill: sync-docs
Args: apply --scope=before-pr
```

The orchestrator receives the structured result and spawns `simple-fixer` if fixes are needed.

## Constraints

1. **Report mode by default** - Never modify files unless explicitly in apply mode
2. **Structured output** - Always return JSON between markers
3. **No direct fixes** - Return fix instructions, let orchestrator decide
4. **Preserve formatting** - Fix suggestions should preserve existing style
5. **Safe changes only** - Only auto-fixable issues get fix entries

## Error Handling

- **No git**: Exit with error "Git required for change detection"
- **Script failure**: Include error in validation section, continue with other phases
- **No changed files**: Report scope as "empty", suggest using --scope=all
