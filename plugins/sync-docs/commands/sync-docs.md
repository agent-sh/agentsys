---
description: Use when user asks to "update docs", "sync documentation", "fix outdated docs", "update changelog", "docs are stale", or after completing code changes that might affect documentation.
argument-hint: "[report|apply] [scope: --recent | --all | path]"
---

# /sync-docs - Documentation Sync

Sync documentation with actual code state. Finds docs that reference changed files, updates CHANGELOG, and flags outdated examples.

## Constraints

1. **Preserve existing content** - Update references, don't rewrite sections
2. **Minimal changes** - Only fix what's actually outdated
3. **Evidence-based** - Every change linked to a specific code change
4. **Safe defaults** - Report mode by default

## Arguments

Parse from $ARGUMENTS:

- **Mode**: `report` (default) or `apply`
- **Scope**:
  - `--recent` (default): Files changed since last commit to main
  - `--all`: Scan all docs against all code
  - `path`: Specific file or directory

## Phase 1: Get Changed Files

```bash
# Default: recent changes
CHANGED_FILES=$(git diff --name-only origin/main..HEAD 2>/dev/null || git diff --name-only HEAD~5..HEAD)

# If --all, use all source files
if [ "$SCOPE" = "--all" ]; then
  CHANGED_FILES=$(git ls-files '*.js' '*.ts' '*.py' '*.go' '*.rs' '*.java')
fi
```

## Phase 2: Find Related Documentation

For each changed file, search for docs that mention it:

```javascript
async function findRelatedDocs(changedFiles) {
  const results = [];
  const docFiles = await glob('**/*.md', { ignore: ['node_modules/**', 'dist/**'] });

  for (const file of changedFiles) {
    const basename = file.split('/').pop().replace(/\.[^.]+$/, '');
    const modulePath = file.replace(/\.[^.]+$/, '');

    for (const doc of docFiles) {
      const content = await readFile(doc);

      // Check for references
      const references = [];
      if (content.includes(basename)) references.push('filename');
      if (content.includes(file)) references.push('full-path');
      if (content.includes(`from '${modulePath}'`)) references.push('import');
      if (content.includes(`require('${modulePath}')`)) references.push('require');

      if (references.length > 0) {
        results.push({
          doc,
          referencedFile: file,
          referenceTypes: references
        });
      }
    }
  }

  return results;
}
```

## Phase 3: Analyze Documentation Issues

For each related doc, check for problems:

```javascript
async function analyzeDoc(docPath, changedFile) {
  const content = await readFile(docPath);
  const issues = [];

  // 1. Check code blocks for outdated imports
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  for (const block of codeBlocks) {
    // Check if imports reference moved/renamed files
    const imports = block.match(/import .* from ['"]([^'"]+)['"]/g) || [];
    for (const imp of imports) {
      const path = imp.match(/from ['"]([^'"]+)['"]/)[1];
      if (path.includes(changedFile.replace(/\.[^.]+$/, ''))) {
        issues.push({
          type: 'code-example',
          severity: 'medium',
          line: findLineNumber(content, imp),
          current: imp,
          suggestion: 'Verify import path is still valid'
        });
      }
    }
  }

  // 2. Check for function/export references
  const oldExports = await getExportsFromGit(changedFile, 'HEAD~1');
  const newExports = await getExportsFromGit(changedFile, 'HEAD');

  const removed = oldExports.filter(e => !newExports.includes(e));
  for (const fn of removed) {
    if (content.includes(fn)) {
      issues.push({
        type: 'removed-export',
        severity: 'high',
        reference: fn,
        suggestion: `'${fn}' was removed or renamed`
      });
    }
  }

  // 3. Check for outdated version numbers
  const versionMatch = content.match(/version[:\s]+['"]?(\d+\.\d+\.\d+)/gi);
  // Flag if doc version differs from package.json

  return issues;
}
```

## Phase 4: Check CHANGELOG

```javascript
async function checkChangelog(changedFiles) {
  const changelogPath = 'CHANGELOG.md';
  if (!await fileExists(changelogPath)) {
    return { exists: false };
  }

  const changelog = await readFile(changelogPath);
  const packageJson = JSON.parse(await readFile('package.json'));
  const currentVersion = packageJson.version;

  // Check if Unreleased section exists
  const hasUnreleased = changelog.includes('## [Unreleased]');

  // Check recent commits for undocumented changes
  const recentCommits = await exec('git log --oneline -10 HEAD');
  const documented = [];
  const undocumented = [];

  for (const commit of recentCommits.split('\n')) {
    const msg = commit.substring(8); // Skip hash
    if (changelog.includes(msg) || changelog.includes(commit.substring(0, 7))) {
      documented.push(msg);
    } else if (msg.match(/^(feat|fix|breaking)/i)) {
      undocumented.push(msg);
    }
  }

  return {
    exists: true,
    hasUnreleased,
    undocumented,
    suggestion: undocumented.length > 0
      ? `${undocumented.length} commits may need CHANGELOG entries`
      : null
  };
}
```

## Phase 5: Report Mode (Default)

Present findings without making changes:

```markdown
## Documentation Sync Report

### Scope
${scopeDescription}
Changed files analyzed: ${changedFiles.length}

### Related Documentation Found
| Doc | References | Issues |
|-----|------------|--------|
${relatedDocs.map(d => `| ${d.doc} | ${d.referencedFile} | ${d.issues.length} |`).join('\n')}

### Issues by Severity

**High** (likely broken)
${highIssues.map(i => `- ${i.doc}:${i.line} - ${i.suggestion}`).join('\n')}

**Medium** (should verify)
${mediumIssues.map(i => `- ${i.doc}:${i.line} - ${i.suggestion}`).join('\n')}

### CHANGELOG Status
${changelog.undocumented?.length > 0
  ? `[WARN] ${changelog.undocumented.length} commits may need entries:\n${changelog.undocumented.map(c => `  - ${c}`).join('\n')}`
  : '[OK] Recent changes appear documented'}

## Do Next
- [ ] Run `/sync-docs apply` to fix auto-fixable issues
- [ ] Review flagged items manually
```

## Phase 6: Apply Mode

Fix issues that can be safely auto-fixed:

```javascript
async function applyFixes(issues) {
  const applied = [];
  const skipped = [];

  for (const issue of issues) {
    switch (issue.type) {
      case 'outdated-version':
        // Safe to auto-fix
        await replaceInFile(issue.doc, issue.old, issue.new);
        applied.push(issue);
        break;

      case 'removed-export':
        // Flag only - needs human judgment
        skipped.push({ ...issue, reason: 'Needs manual review' });
        break;

      case 'code-example':
        // Flag only - example might be intentionally different
        skipped.push({ ...issue, reason: 'Code example may need context' });
        break;
    }
  }

  return { applied, skipped };
}
```

### CHANGELOG Update (Apply Mode)

If undocumented commits found, offer to add them:

```javascript
async function updateChangelog(undocumented) {
  const changelog = await readFile('CHANGELOG.md');

  // Find or create Unreleased section
  let updated = changelog;
  if (!changelog.includes('## [Unreleased]')) {
    const firstVersion = changelog.match(/## \[\d+\.\d+\.\d+\]/);
    if (firstVersion) {
      updated = changelog.slice(0, firstVersion.index) +
        '## [Unreleased]\n\n' +
        changelog.slice(firstVersion.index);
    }
  }

  // Group commits by type
  const grouped = {
    Added: undocumented.filter(c => c.startsWith('feat')),
    Fixed: undocumented.filter(c => c.startsWith('fix')),
    Changed: undocumented.filter(c => !c.startsWith('feat') && !c.startsWith('fix'))
  };

  // Add entries
  for (const [category, commits] of Object.entries(grouped)) {
    if (commits.length === 0) continue;

    const entries = commits.map(c => `- ${c.replace(/^(feat|fix)[:\(]?\)?:?\s*/i, '')}`).join('\n');

    // Insert after Unreleased heading
    const insertPoint = updated.indexOf('## [Unreleased]') + '## [Unreleased]'.length;
    const existingCategory = updated.indexOf(`### ${category}`, insertPoint);

    if (existingCategory > -1 && existingCategory < updated.indexOf('## [', insertPoint + 1)) {
      // Add to existing category
      const categoryEnd = updated.indexOf('\n### ', existingCategory + 1);
      updated = updated.slice(0, categoryEnd) + '\n' + entries + updated.slice(categoryEnd);
    } else {
      // Create new category
      updated = updated.slice(0, insertPoint) + `\n\n### ${category}\n${entries}` + updated.slice(insertPoint);
    }
  }

  await writeFile('CHANGELOG.md', updated);
  return grouped;
}
```

## Output Format (Apply Mode)

```markdown
## Documentation Sync Applied

### Changes Made
${applied.map(a => `- **${a.doc}**: ${a.description}`).join('\n')}

### CHANGELOG Updated
${changelogUpdates ? `Added ${changelogUpdates.length} entries` : 'No changes needed'}

### Flagged for Manual Review
${skipped.map(s => `- **${s.doc}:${s.line}**: ${s.suggestion} (${s.reason})`).join('\n')}

### Verification
${testResult ? '[OK] Tests pass' : '[WARN] Run tests to verify'}
```

## Error Handling

- **No git**: Exit with "Git required for change detection"
- **No changed files**: "No changes detected. Use --all to scan entire codebase"
- **No docs found**: "No documentation files found"

## Integration

This command works standalone. For workflow integration, the `docs-updater` agent in `/next-task` uses similar logic but with task context.

## Examples

```bash
# Check what docs might need updates (safe, no changes)
/sync-docs

# Check docs related to specific path
/sync-docs report src/auth/

# Apply safe fixes
/sync-docs apply

# Full codebase scan
/sync-docs report --all
```
