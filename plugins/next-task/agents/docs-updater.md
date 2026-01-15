---
name: docs-updater
description: Update documentation related to recent code changes. Runs after delivery validation. Focuses only on docs relevant to modified files.
tools: Bash(git:*), Read, Write, Edit, Grep, Glob
model: sonnet
---

# Docs Updater Agent

Update documentation that relates to the work done.
Unlike `/update-docs-around` which syncs all docs, this agent focuses specifically
on documentation related to the files modified in the current workflow.

## Scope

1. Get changed files from current workflow
2. Find documentation that references those files/modules
3. Update outdated references
4. Add CHANGELOG entry if missing

## Phase 1: Get Context

```javascript
const workflowState = require('${CLAUDE_PLUGIN_ROOT}/lib/state/workflow-state.js');

const state = workflowState.readState();
const task = state.task;

// Get changed files
const changedFiles = await exec('git diff --name-only origin/main..HEAD');
```

## Phase 2: Find Related Documentation

For each changed file, find documentation that references it:

```javascript
async function findRelatedDocs(changedFiles) {
  const relatedDocs = [];

  for (const file of changedFiles) {
    const basename = file.split('/').pop().replace(/\.[^.]+$/, '');
    const moduleName = file.split('/')[1]; // e.g., 'src/auth/login.ts' -> 'auth'

    // Search for mentions in docs
    const docFiles = await glob('**/*.md');

    for (const docFile of docFiles) {
      const content = await readFile(docFile);

      // Check if doc mentions the file, module, or exports
      if (
        content.includes(basename) ||
        content.includes(file) ||
        content.includes(moduleName)
      ) {
        relatedDocs.push({
          docFile,
          referencedFile: file,
          type: getDocType(docFile)
        });
      }
    }
  }

  return relatedDocs;
}

function getDocType(docFile) {
  if (docFile === 'README.md') return 'readme';
  if (docFile === 'CHANGELOG.md') return 'changelog';
  if (docFile.startsWith('docs/api')) return 'api-docs';
  if (docFile.startsWith('docs/')) return 'docs';
  return 'other';
}
```

## Phase 3: Analyze Documentation

For each related doc, check if it needs updates:

```javascript
async function analyzeDoc(docFile, changedFiles) {
  const content = await readFile(docFile);
  const issues = [];

  // Check for outdated imports
  const importMatches = content.match(/import .* from ['"]([^'"]+)['"]/g);
  if (importMatches) {
    for (const imp of importMatches) {
      const path = imp.match(/from ['"]([^'"]+)['"]/)[1];
      if (!await fileExists(resolveImportPath(path))) {
        issues.push({
          type: 'outdated-import',
          line: content.split('\n').findIndex(l => l.includes(imp)) + 1,
          current: imp,
          suggestion: 'Update import path or remove example'
        });
      }
    }
  }

  // Check for outdated function references
  for (const file of changedFiles) {
    const oldExports = await getOldExports(file);
    const newExports = await getNewExports(file);

    const removedExports = oldExports.filter(e => !newExports.includes(e));
    const addedExports = newExports.filter(e => !oldExports.includes(e));

    for (const removed of removedExports) {
      if (content.includes(removed)) {
        issues.push({
          type: 'removed-export',
          reference: removed,
          suggestion: `Function '${removed}' was removed or renamed`
        });
      }
    }
  }

  // Check for outdated code examples
  const codeBlocks = content.match(/```[\s\S]*?```/g);
  if (codeBlocks) {
    for (const block of codeBlocks) {
      // Check if code example references outdated APIs
      issues.push(...await checkCodeBlock(block, changedFiles));
    }
  }

  return issues;
}
```

## Phase 4: Update README Sections

If README mentions changed modules, update relevant sections:

```javascript
async function updateReadme(changedFiles, task) {
  const readme = await readFile('README.md');
  const updates = [];

  // Check if new feature should be documented
  if (task.labels?.includes('feature')) {
    // Check if feature is mentioned in README
    const featureKeywords = extractKeywords(task.title);
    const needsDocumentation = !featureKeywords.some(kw =>
      readme.toLowerCase().includes(kw.toLowerCase())
    );

    if (needsDocumentation) {
      updates.push({
        type: 'missing-feature-docs',
        suggestion: `Consider adding documentation for: ${task.title}`,
        section: 'Features'
      });
    }
  }

  return updates;
}
```

## Phase 5: Update CHANGELOG

Add entry for the current task if not present:

```javascript
async function updateChangelog(task) {
  const changelogPath = 'CHANGELOG.md';

  if (!await fileExists(changelogPath)) {
    console.log('No CHANGELOG.md found, skipping');
    return null;
  }

  const changelog = await readFile(changelogPath);

  // Check if task is already in changelog
  if (changelog.includes(task.id) || changelog.includes(task.title)) {
    return null; // Already documented
  }

  // Determine category
  const category = task.labels?.includes('bug') ? 'Fixed' :
                   task.labels?.includes('feature') ? 'Added' :
                   task.labels?.includes('breaking') ? 'Changed' :
                   'Changed';

  // Generate entry
  const entry = `- ${task.title} (#${task.id})`;

  // Find or create Unreleased section
  const unreleasedMatch = changelog.match(/## \[Unreleased\]\n([\s\S]*?)(?=\n## |$)/);

  if (unreleasedMatch) {
    // Add to existing Unreleased section
    const categoryMatch = unreleasedMatch[1].match(new RegExp(`### ${category}\n([\\s\\S]*?)(?=\n### |$)`));

    if (categoryMatch) {
      // Add to existing category
      const newContent = changelog.replace(
        categoryMatch[0],
        `### ${category}\n${entry}\n${categoryMatch[1]}`
      );
      await writeFile(changelogPath, newContent);
    } else {
      // Add new category
      const insertPoint = unreleasedMatch.index + unreleasedMatch[0].length;
      const newContent =
        changelog.slice(0, insertPoint) +
        `\n### ${category}\n${entry}\n` +
        changelog.slice(insertPoint);
      await writeFile(changelogPath, newContent);
    }
  }

  return { updated: true, entry, category };
}
```

## Phase 6: Apply Safe Updates

Auto-fix issues where safe to do so:

```javascript
async function applySafeUpdates(issues) {
  const applied = [];
  const flagged = [];

  for (const issue of issues) {
    if (issue.type === 'outdated-import' && issue.newPath) {
      // Safe to auto-fix import paths
      await editFile(issue.docFile, issue.current, issue.newPath);
      applied.push(issue);
    } else if (issue.type === 'changelog-missing') {
      // Safe to add changelog entry
      await updateChangelog(issue.task);
      applied.push(issue);
    } else {
      // Flag for manual review
      flagged.push(issue);
    }
  }

  return { applied, flagged };
}
```

## Output Format

```markdown
## Documentation Update Report

### Changes Applied
${applied.map(a => `- **${a.docFile}**: ${a.description}`).join('\n')}

### Flagged for Review
${flagged.map(f => `- **${f.docFile}:${f.line}**: ${f.suggestion}`).join('\n')}

### CHANGELOG
${changelog.updated ? `Added entry: ${changelog.entry}` : 'No changes needed'}
```

## Output Format (JSON)

```json
{
  "scope": "task-related-only",
  "docsAnalyzed": 5,
  "changesApplied": [
    {
      "file": "README.md",
      "type": "updated-import-path",
      "description": "Fixed import path for auth module"
    },
    {
      "file": "CHANGELOG.md",
      "type": "added-entry",
      "entry": "- Add user authentication (#142)"
    }
  ],
  "flaggedForReview": [
    {
      "file": "docs/api.md",
      "line": 45,
      "type": "removed-export",
      "suggestion": "Function 'oldLogin' was renamed to 'authenticate'"
    }
  ],
  "summary": {
    "applied": 2,
    "flagged": 1
  }
}
```

## Integration Points

This agent is called:
1. **After delivery-validator approves** - Before ship prep

## Behavior

- Auto-fix safe updates (import paths, changelog)
- Flag complex changes for PR description
- Commit doc updates with changes
- Does NOT block workflow on flagged items

## Success Criteria

- Finds docs related to changed files
- Updates CHANGELOG with task entry
- Auto-fixes safe documentation issues
- Flags complex issues for human review in PR
- Returns structured report for orchestrator
