---
description: Sync documentation with actual code state across entire repository. Compares docs with actual code, exports, APIs and fixes discrepancies.
argument-hint: "[path] [--apply] [--report-only]"
allowed-tools: Bash(git:*), Read, Write, Edit, Grep, Glob
model: sonnet
---

# /update-docs-around - Documentation Sync

Compare documentation with actual code state and fix discrepancies.
This is a standalone command (not part of workflow) that scans the entire repo.

## Arguments

- `[path]`: Specific path to check (default: entire repo)
- `--apply`: Apply fixes (default: report only)
- `--report-only`: Only report issues, don't fix

## Parse Arguments

```javascript
const args = $ARGUMENTS.split(' ').filter(Boolean);
const applyMode = args.includes('--apply');
const reportOnly = args.includes('--report-only') || !applyMode;
const targetPath = args.find(a => !a.startsWith('--')) || '.';
```

## Phase 1: Find All Documentation Files

```bash
# Find all markdown files
DOC_FILES=$(find ${targetPath} -name "*.md" -type f | grep -v node_modules | grep -v .git)

# Categorize docs
README_FILES=$(echo "$DOC_FILES" | grep -i readme)
API_DOCS=$(echo "$DOC_FILES" | grep -E '(api|reference)')
GUIDES=$(echo "$DOC_FILES" | grep -E '(guide|tutorial|getting-started)')
CHANGELOG=$(echo "$DOC_FILES" | grep -i changelog)

echo "Total docs: $(echo "$DOC_FILES" | wc -l)"
echo "READMEs: $(echo "$README_FILES" | wc -l)"
echo "API docs: $(echo "$API_DOCS" | wc -l)"
```

## Phase 2: Extract Code References from Docs

For each doc file, extract:
- Import statements in code blocks
- Function/class references
- File path references
- URL references

```javascript
async function extractCodeReferences(docFile) {
  const content = await readFile(docFile);
  const references = [];

  // Extract code blocks
  const codeBlocks = content.match(/```[\w]*\n[\s\S]*?```/g) || [];

  for (const block of codeBlocks) {
    // Extract imports
    const imports = block.match(/import .* from ['"]([^'"]+)['"]/g);
    if (imports) {
      references.push(...imports.map(i => ({
        type: 'import',
        value: i.match(/from ['"]([^'"]+)['"]/)[1],
        block
      })));
    }

    // Extract require statements
    const requires = block.match(/require\(['"]([^'"]+)['"]\)/g);
    if (requires) {
      references.push(...requires.map(r => ({
        type: 'require',
        value: r.match(/\(['"]([^'"]+)['"]\)/)[1],
        block
      })));
    }

    // Extract function calls
    const functionCalls = block.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
    if (functionCalls) {
      references.push(...functionCalls.map(f => ({
        type: 'function',
        value: f.replace(/\s*\($/, ''),
        block
      })));
    }
  }

  // Extract inline code references
  const inlineCode = content.match(/`[^`]+`/g) || [];
  for (const code of inlineCode) {
    const value = code.replace(/`/g, '');
    if (value.includes('/') || value.includes('.')) {
      references.push({ type: 'path', value, inline: true });
    }
  }

  return references;
}
```

## Phase 3: Verify References Against Codebase

```javascript
async function verifyReferences(references) {
  const issues = [];

  for (const ref of references) {
    let exists = false;
    let suggestion = null;

    switch (ref.type) {
      case 'import':
      case 'require':
      case 'path':
        // Check if file/module exists
        const resolved = resolveImportPath(ref.value);
        exists = await fileExists(resolved);

        if (!exists) {
          // Try to find similar file
          const similar = await findSimilarFile(ref.value);
          suggestion = similar ? `Did you mean: ${similar}` : null;
        }
        break;

      case 'function':
        // Check if function exists in exports
        exists = await functionExistsInProject(ref.value);

        if (!exists) {
          // Try to find renamed function
          const renamed = await findRenamedFunction(ref.value);
          suggestion = renamed ? `Function may have been renamed to: ${renamed}` : null;
        }
        break;
    }

    if (!exists) {
      issues.push({
        type: 'outdated-reference',
        reference: ref,
        suggestion
      });
    }
  }

  return issues;
}
```

## Phase 4: Check Code Examples

Verify code examples are syntactically valid and runnable:

```javascript
async function checkCodeExamples(docFile) {
  const content = await readFile(docFile);
  const issues = [];

  const codeBlocks = content.match(/```(\w+)\n([\s\S]*?)```/g) || [];

  for (const block of codeBlocks) {
    const [, lang, code] = block.match(/```(\w+)\n([\s\S]*?)```/);

    if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') {
      // Check for syntax errors
      try {
        // Basic syntax check
        new Function(code.replace(/import|export/g, '//'));
      } catch (e) {
        issues.push({
          type: 'invalid-syntax',
          docFile,
          lang,
          error: e.message,
          code: code.substring(0, 100)
        });
      }
    }
  }

  return issues;
}
```

## Phase 5: Check README Accuracy

```javascript
async function checkReadmeAccuracy() {
  const issues = [];
  const readme = await readFile('README.md');

  // Check if installation instructions work
  const installMatch = readme.match(/npm install ([^\n`]+)/);
  if (installMatch) {
    const pkg = await readFile('package.json');
    const pkgJson = JSON.parse(pkg);
    if (!pkgJson.name === installMatch[1]) {
      issues.push({
        type: 'wrong-package-name',
        expected: pkgJson.name,
        found: installMatch[1]
      });
    }
  }

  // Check version numbers
  const versionMatch = readme.match(/version[^\d]*(\d+\.\d+\.\d+)/i);
  if (versionMatch) {
    const pkg = await readFile('package.json');
    const pkgJson = JSON.parse(pkg);
    if (pkgJson.version !== versionMatch[1]) {
      issues.push({
        type: 'outdated-version',
        docsVersion: versionMatch[1],
        actualVersion: pkgJson.version
      });
    }
  }

  // Check if exports mentioned in docs exist
  const exportMentions = readme.match(/\{([^}]+)\}/g) || [];
  for (const mention of exportMentions) {
    const exports = mention.replace(/[{}]/g, '').split(',').map(e => e.trim());
    for (const exp of exports) {
      if (!await exportExistsInProject(exp)) {
        issues.push({
          type: 'missing-export',
          export: exp
        });
      }
    }
  }

  return issues;
}
```

## Phase 6: Check CHANGELOG

```javascript
async function checkChangelog() {
  const issues = [];

  if (!await fileExists('CHANGELOG.md')) {
    issues.push({ type: 'missing-changelog' });
    return issues;
  }

  const changelog = await readFile('CHANGELOG.md');

  // Check for recent commits not in changelog
  const recentCommits = await exec('git log --oneline -20');
  const commits = recentCommits.split('\n').filter(Boolean);

  for (const commit of commits) {
    const [hash, ...msgParts] = commit.split(' ');
    const msg = msgParts.join(' ');

    // Skip merge commits and chore commits
    if (msg.startsWith('Merge') || msg.startsWith('chore')) continue;

    // Check if commit is mentioned
    if (!changelog.includes(hash) && !changelog.includes(msg.substring(0, 30))) {
      issues.push({
        type: 'missing-commit-entry',
        commit: { hash, msg }
      });
    }
  }

  return issues;
}
```

## Phase 7: Apply Fixes (if --apply)

```javascript
async function applyFixes(issues) {
  if (reportOnly) {
    console.log('Report-only mode, not applying fixes');
    return { applied: [], skipped: issues };
  }

  const applied = [];
  const skipped = [];

  for (const issue of issues) {
    switch (issue.type) {
      case 'outdated-reference':
        if (issue.suggestion) {
          // Apply the suggested fix
          const oldPath = issue.reference.value;
          const newPath = issue.suggestion.replace('Did you mean: ', '');
          await editFile(issue.docFile, oldPath, newPath);
          applied.push({ ...issue, fixed: true });
        } else {
          skipped.push(issue);
        }
        break;

      case 'outdated-version':
        // Update version in docs
        await editFile('README.md', issue.docsVersion, issue.actualVersion);
        applied.push({ ...issue, fixed: true });
        break;

      default:
        skipped.push(issue);
    }
  }

  return { applied, skipped };
}
```

## Output Report

```markdown
## Documentation Sync Report

**Mode**: ${applyMode ? 'Apply Fixes' : 'Report Only'}
**Scope**: ${targetPath === '.' ? 'Entire repository' : targetPath}
**Files Analyzed**: ${docFiles.length}

### Summary
| Category | Issues Found | Fixed |
|----------|--------------|-------|
| Outdated References | ${outdatedRefs.length} | ${fixed.filter(f => f.type === 'outdated-reference').length} |
| Invalid Syntax | ${syntaxErrors.length} | 0 |
| Missing Changelog Entries | ${missingChangelog.length} | 0 |
| Version Mismatch | ${versionIssues.length} | ${fixed.filter(f => f.type === 'outdated-version').length} |

### Outdated References (${outdatedRefs.length} found)
${outdatedRefs.map(i => `
- **${i.docFile}**
  - Reference: \`${i.reference.value}\`
  - ${i.suggestion || 'No suggestion available'}
  - ${i.fixed ? '✓ Fixed' : '⚠️ Manual fix required'}
`).join('\n')}

### Invalid Code Examples (${syntaxErrors.length} found)
${syntaxErrors.map(i => `
- **${i.docFile}** (${i.lang})
  - Error: ${i.error}
  - Code: \`${i.code}...\`
`).join('\n')}

### Missing Changelog Entries (${missingChangelog.length} found)
${missingChangelog.map(i => `
- ${i.commit.hash}: ${i.commit.msg}
`).join('\n')}

### Recommendations
${recommendations.map(r => `- ${r}`).join('\n')}
```

## Output Format (JSON)

```json
{
  "mode": "report-only",
  "scope": ".",
  "filesAnalyzed": 15,
  "issues": {
    "total": 12,
    "outdatedReferences": 5,
    "syntaxErrors": 2,
    "missingChangelog": 3,
    "versionMismatch": 1,
    "missingExports": 1
  },
  "fixed": 0,
  "details": [
    {
      "file": "README.md",
      "line": 45,
      "type": "outdated-reference",
      "reference": "import { oldFunction }",
      "suggestion": "Function renamed to newFunction"
    }
  ],
  "recommendations": [
    "Update README.md with current version",
    "Add changelog entry for recent commits"
  ]
}
```

## Examples

```bash
# Report-only mode (default)
/update-docs-around

# Apply fixes
/update-docs-around --apply

# Check specific directory
/update-docs-around docs/ --report-only

# Apply fixes to specific path
/update-docs-around docs/api --apply
```

## Success Criteria

- Scans all documentation files
- Identifies outdated references to code
- Validates code examples for syntax errors
- Checks CHANGELOG for missing entries
- Provides clear, actionable report
- Applies safe fixes when --apply is used
