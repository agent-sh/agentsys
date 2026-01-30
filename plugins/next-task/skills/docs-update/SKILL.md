---
name: update-docs
description: "Use when updating documentation related to recent code changes. Finds related docs, updates CHANGELOG, and delegates simple fixes to haiku."
version: 1.0.0
---

# update-docs

Update documentation related to files modified in current workflow.

## Architecture

**Sonnet discovers, Haiku executes:**
- This skill (sonnet): Find related docs, analyze issues, create fix list
- simple-fixer (haiku): Execute mechanical updates

## Workflow

### Phase 1: Get Context

```javascript
const { getPluginRoot } = require('./lib/cross-platform');
const path = require('path');
const pluginRoot = getPluginRoot('next-task');
const workflowState = require(path.join(pluginRoot, 'lib/state/workflow-state.js'));

const state = workflowState.readState();
const task = state.task;

// Get changed files
const changedFiles = await exec('git diff --name-only origin/main..HEAD');
```

### Phase 2: Find Related Documentation

```javascript
async function findRelatedDocs(changedFiles) {
  const relatedDocs = [];

  for (const file of changedFiles) {
    const basename = file.split('/').pop().replace(/\.[^.]+$/, '');
    const moduleName = file.split('/')[1];

    const docFiles = await glob('**/*.md');
    for (const docFile of docFiles) {
      const content = await readFile(docFile);
      if (content.includes(basename) || content.includes(moduleName)) {
        relatedDocs.push({ docFile, referencedFile: file });
      }
    }
  }
  return relatedDocs;
}
```

### Phase 3: Analyze Documentation Issues

```javascript
async function analyzeDoc(docFile, changedFiles) {
  const content = await readFile(docFile);
  const issues = [];

  // Check for outdated imports
  const importMatches = content.match(/import .* from ['"]([^'"]+)['"]/g);
  // ... validate each import path exists

  // Check for outdated function references
  for (const file of changedFiles) {
    const removedExports = await getRemovedExports(file);
    for (const removed of removedExports) {
      if (content.includes(removed)) {
        issues.push({ type: 'removed-export', reference: removed });
      }
    }
  }

  return issues;
}
```

### Phase 4: Update CHANGELOG

```javascript
async function updateChangelog(task) {
  const changelogPath = 'CHANGELOG.md';
  if (!await fileExists(changelogPath)) return null;

  const changelog = await readFile(changelogPath);

  // Skip if already documented
  if (changelog.includes(task.id) || changelog.includes(task.title)) {
    return null;
  }

  // Determine category from labels
  const category = task.labels?.includes('bug') ? 'Fixed' :
                   task.labels?.includes('feature') ? 'Added' :
                   'Changed';

  // Generate entry
  const entry = `- ${task.title} (#${task.id})`;

  // Add to Unreleased section under appropriate category
  // ... insertion logic
}
```

### Phase 5: Create Fix List for simple-fixer

```javascript
function createDocFixList(issues) {
  return {
    fixes: issues.filter(i => i.autoFixable).map(issue => ({
      file: issue.docFile,
      line: issue.line,
      action: 'replace',
      old: issue.current,
      new: issue.replacement,
      reason: issue.type
    })),
    commitMessage: 'docs: update documentation for recent changes'
  };
}
```

### Phase 6: Delegate to simple-fixer (haiku)

```javascript
if (fixList.fixes.length > 0) {
  await Task({
    subagent_type: 'simple-fixer',
    prompt: JSON.stringify(fixList),
    model: 'haiku'
  });
}
```

## Output Format

```json
{
  "scope": "task-related-only",
  "docsAnalyzed": 5,
  "changesApplied": [
    { "file": "README.md", "type": "updated-import-path" },
    { "file": "CHANGELOG.md", "type": "added-entry" }
  ],
  "flaggedForReview": [
    { "file": "docs/api.md", "line": 45, "suggestion": "..." }
  ],
  "summary": { "applied": 2, "flagged": 1 }
}
```

## Constraints

- Only update docs related to changed files (not all docs)
- Auto-fix safe updates (import paths, versions)
- Flag complex changes for PR review
- CHANGELOG updates use Keep a Changelog format
- Delegate mechanical fixes to haiku for cost efficiency
