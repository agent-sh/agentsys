---
name: sync-docs
description: "Sync documentation with code. Use when user asks to update docs, check docs, fix stale documentation, update changelog, or after code changes."
version: 4.2.2
argument-hint: "[report|apply] [--scope=all|recent|before-pr] [--include-undocumented]"
allowed-tools: Bash(git:*), Read, Grep, Glob
---

# sync-docs

Unified skill for syncing documentation with code state. Combines discovery, analysis, and CHANGELOG update into a single workflow.

## Parse Arguments

```javascript
const args = '$ARGUMENTS'.split(' ').filter(Boolean);
const mode = args.find(a => ['report', 'apply'].includes(a)) || 'report';
const scope = args.find(a => a.startsWith('--scope='))?.split('=')[1] || 'recent';
const includeUndocumented = args.includes('--include-undocumented');
```

## Quick Start - Agent Instructions

**Step 1**: Get changed files (use Bash):
```bash
# Recent changes (default scope)
git diff --name-only origin/main..HEAD 2>/dev/null || git diff --name-only HEAD~5..HEAD

# Or for all files
git ls-files '*.md'
```

**Step 2**: Find docs that reference changed files (use Grep):
- Search for filenames, function names, class names in `*.md` files
- Check README.md, CHANGELOG.md, docs/*.md

**Step 3**: Analyze each doc for issues:
- Version mismatches (compare doc versions to package.json)
- Removed exports (symbols in docs but not in code)
- Outdated code examples
- Import path changes

**Step 4**: Check CHANGELOG:
- Look for `## [Unreleased]` section
- Compare recent commit messages to CHANGELOG entries

**Step 5**: If repo-map exists (`{stateDir}/repo-map.json` - platform state directory):
- Load it to get accurate export list
- Find exports not mentioned in any documentation
- Report as `undocumented-export` issues

## Input

Arguments: `[report|apply] [--scope=all|recent|before-pr] [--include-undocumented]`

- **Mode**: `report` (default) or `apply`
- **Scope**:
  - `recent` (default): Files changed since last commit to main
  - `all`: Scan all docs against all code
  - `before-pr`: Files in current branch, optimized for /next-task Phase 11
- **--include-undocumented**: Find exports not mentioned in any docs (uses repo-map)

## Architecture

This skill orchestrates all documentation sync operations:

```
sync-docs skill
    |-- Phase 1: Detect project context
    |-- Phase 2: Find related docs (lib/collectors/docs-patterns)
    |-- Phase 3: Analyze issues
    |-- Phase 3.5: Find undocumented exports (repo-map integration)
    |-- Phase 4: Check CHANGELOG
    |-- Phase 5: Return structured results
```

The skill MUST NOT apply fixes directly. It returns structured data for the orchestrator to decide what to do.

---

## Implementation Details (Reference)

The sections below describe the internal JavaScript implementation for reference only. Agents should follow the Quick Start instructions above using Bash, Read, and Grep tools.

### Phase 1: Detect Project Context

Detect project type and find documentation files.

### Phase 1.5: Ensure Repo-Map

Before analyzing issues, ensure repo-map is available for accurate symbol detection:

```javascript
const { ensureRepoMap } = require('../../lib/collectors/docs-patterns');

// Try to get repo-map (will auto-init if ast-grep available)
const repoMapStatus = await ensureRepoMap({
  cwd: process.cwd(),
  askUser: async (opts) => {
    // Use AskUserQuestion tool
    const answer = await AskUserQuestion({
      question: opts.question,
      header: opts.header,
      options: opts.options
    });
    return answer;
  }
});

if (repoMapStatus.installInstructions) {
  // User wants to install ast-grep, show instructions
  console.log(repoMapStatus.installInstructions);
  // Wait for user to confirm installation, then retry
}

// repoMapStatus.available indicates if repo-map can be used
// repoMapStatus.fallbackReason explains why if not available
```

**User Interaction (only if ast-grep not installed):**

Use AskUserQuestion:
- Header: "ast-grep Required"
- Question: "ast-grep not found. Install for better doc sync accuracy?"
- Options:
  - "Yes, show instructions" - Display platform-specific install instructions
  - "No, use regex fallback" - Continue with less accurate regex-based detection

If user declines or repo-map unavailable, the system falls back to regex-based export detection automatically.

```javascript
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Detect documentation files
const docFiles = [];
const commonDocs = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'docs/**/*.md'];

for (const pattern of commonDocs) {
  // Use glob to find matching files
  const matches = glob.sync(pattern, { cwd: process.cwd() });
  docFiles.push(...matches);
}

// Detect project type from package.json, Cargo.toml, go.mod, etc.
let projectType = 'unknown';
if (fs.existsSync('package.json')) projectType = 'javascript';
else if (fs.existsSync('Cargo.toml')) projectType = 'rust';
else if (fs.existsSync('go.mod')) projectType = 'go';
else if (fs.existsSync('pyproject.toml') || fs.existsSync('setup.py')) projectType = 'python';

const context = { docFiles, projectType };
```

This phase gathers context about the project without requiring external scripts.

## Phase 2: Find Related Documentation

Use lib/collectors/docs-patterns to find docs related to changed files:

```javascript
// Use relative path from skill directory to plugin lib
// Path: skills/sync-docs/ -> ../../lib
const { collectors } = require('../../lib');
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
- `undocumented-export`: Export exists in code but not mentioned in any docs (requires repo-map)

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
  "context": {
    "projectType": "javascript|python|rust|go|unknown",
    "docFiles": ["README.md", "CHANGELOG.md"]
  },
  "repoMap": {
    "available": true,
    "fallbackReason": null,
    "stats": { "files": 142, "symbols": 847 }
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
  "undocumentedExports": [
    {
      "type": "undocumented-export",
      "severity": "low",
      "file": "src/utils.js",
      "name": "formatDate",
      "line": 25,
      "certainty": "MEDIUM",
      "suggestion": "Export 'formatDate' in src/utils.js is not mentioned in any documentation"
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
- **No docs found**: Report empty docFiles, suggest creating README.md
- **No changed files**: Report scope as "empty", suggest using --scope=all
