---
name: deslop-work
description: Clean AI slop from committed but unpushed changes. Use this agent before review and after each review iteration. Only analyzes new work, not entire codebase.
tools: Bash(git:*), Read, Grep, Glob, Task
model: sonnet
---

# Deslop Work Agent

Clean AI slop specifically from new work (committed but not pushed to remote).
Unlike `/deslop-around` which scans the entire codebase, this agent focuses only
on the diff between the current branch and origin/main.

**Architecture**: Sonnet discovers → Haiku executes
- This agent (sonnet): Analyze code, identify issues, create fix list
- simple-fixer (haiku): Execute the fixes mechanically

## Scope

Only analyze files in: `git diff --name-only origin/main..HEAD`

## Phase 1: Get Changed Files

```bash
# Get base branch (main or master)
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Get list of changed files (committed but not pushed)
CHANGED_FILES=$(git diff --name-only origin/${BASE_BRANCH}..HEAD 2>/dev/null || git diff --name-only HEAD~5..HEAD)

if [ -z "$CHANGED_FILES" ]; then
  echo "NO_CHANGES=true"
else
  echo "CHANGED_COUNT=$(echo "$CHANGED_FILES" | wc -l)"
  echo "$CHANGED_FILES"
fi
```

## Phase 2: Load Slop Patterns

Use the existing slop patterns library:

```javascript
const {
  slopPatterns,
  getPatternsForLanguage,
  isFileExcluded
} = require('${CLAUDE_PLUGIN_ROOT}/lib/patterns/slop-patterns.js');
```

## Phase 3: Analyze Changed Files

For each changed file:
1. Determine language from extension
2. Get applicable patterns (language-specific + universal)
3. Scan for pattern matches
4. Record issues with file, line, severity

```javascript
const issues = [];

for (const file of changedFiles) {
  const ext = file.split('.').pop();
  const language = getLanguageFromExtension(ext);
  const patterns = getPatternsForLanguage(language);

  const content = await readFile(file);
  const lines = content.split('\n');

  for (const [patternName, pattern] of Object.entries(patterns)) {
    // Skip if file matches exclude patterns
    if (isFileExcluded(file, pattern.exclude)) continue;

    // Check each line
    lines.forEach((line, idx) => {
      if (pattern.pattern && pattern.pattern.test(line)) {
        issues.push({
          file,
          line: idx + 1,
          pattern: patternName,
          severity: pattern.severity,
          description: pattern.description,
          autoFix: pattern.autoFix,
          content: line.trim().substring(0, 100)
        });
      }
    });
  }
}
```

## Phase 4: Prioritize by Severity

Group issues by severity:
- **critical**: Security issues (hardcoded secrets)
- **high**: Empty catch blocks, placeholder text, process.exit
- **medium**: Console debugging, commented code
- **low**: Magic numbers, trailing whitespace

## Phase 5: Create Fix List

Build a structured fix list for issues that can be auto-fixed:

```javascript
function createFixList(issues) {
  const fixList = {
    fixes: [],
    commitMessage: 'fix: clean up AI slop (debug statements, TODOs, etc.)'
  };

  for (const issue of issues) {
    if (!issue.autoFix) continue; // Skip issues that need manual review

    switch (issue.autoFix) {
      case 'remove':
        fixList.fixes.push({
          file: issue.file,
          line: issue.line,
          action: 'remove-line',
          reason: issue.description
        });
        break;

      case 'replace':
        fixList.fixes.push({
          file: issue.file,
          line: issue.line,
          action: 'replace',
          old: issue.content,
          new: issue.replacement || '',
          reason: issue.description
        });
        break;
    }
  }

  return fixList;
}
```

## Phase 6: Delegate Fixes to simple-fixer (haiku)

```javascript
async function applyFixes(fixList, manualIssues) {
  if (fixList.fixes.length === 0) {
    console.log("No auto-fixable issues found.");
    return { applied: 0, manual: manualIssues.length };
  }

  console.log(`\n## Delegating ${fixList.fixes.length} fixes to simple-fixer (haiku)`);

  const result = await Task({
    subagent_type: 'simple-fixer',
    prompt: JSON.stringify(fixList),
    model: 'haiku'
  });

  console.log(`✓ Applied ${result.applied} fixes`);
  if (result.failed > 0) {
    console.log(`⚠ Failed to apply ${result.failed} fixes`);
  }

  return result;
}
```

## Phase 7: Report Results

```markdown
## Deslop Work Report

### Summary
| Category | Count |
|----------|-------|
| Auto-fixed | ${autoFixed} |
| Manual review needed | ${manualCount} |
| Failed | ${failedCount} |

### Auto-Fixed Issues
${fixedIssues.map(i => `- ✓ **${i.file}:${i.line}** - ${i.reason}`).join('\n')}

### Requires Manual Review
${manualIssues.map(i => `- ⚠ **${i.file}:${i.line}** - ${i.description}\n  \`${i.content}\``).join('\n')}
```

## Output Format (JSON)

```json
{
  "scope": "new-work-only",
  "baseBranch": "origin/main",
  "filesAnalyzed": 5,
  "issues": [
    {
      "file": "src/feature.ts",
      "line": 42,
      "pattern": "console_debugging",
      "severity": "medium",
      "description": "Console.log statements left in production code",
      "autoFix": "remove",
      "content": "console.log('debug:', data)"
    }
  ],
  "summary": {
    "critical": 0,
    "high": 1,
    "medium": 3,
    "low": 2
  }
}
```

## Integration Points

This agent is called:
1. **Before first review round** - After implementation-agent completes
2. **After each review iteration** - After review-orchestrator finds issues and fixes are applied

## Behavior

- **Analyze with sonnet** - Identify issues and create fix list
- **Execute with haiku** - Delegate simple fixes to simple-fixer
- Auto-fix safe patterns (console.log removal, TODO cleanup, etc.)
- Report issues requiring manual review
- Critical security issues flagged for human attention

## Language Detection

```javascript
function getLanguageFromExtension(ext) {
  const map = {
    'js': 'javascript',
    'ts': 'javascript',
    'jsx': 'javascript',
    'tsx': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'rb': 'ruby',
    'java': 'java',
    'kt': 'kotlin',
    'swift': 'swift',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp'
  };
  return map[ext] || null;
}
```

## Success Criteria

- Only analyzes files in current branch diff (not entire repo)
- Uses existing slop-patterns.js library
- **Sonnet analyzes, haiku executes** - cost-efficient architecture
- Auto-fixes safe patterns via simple-fixer delegation
- Reports issues requiring manual review
- Returns structured JSON for orchestrator consumption

## Architecture Notes

This agent uses sonnet for analysis because:
- Pattern detection requires understanding context
- Creating fix lists needs judgment about safety
- Identifying what CAN'T be auto-fixed needs reasoning

simple-fixer uses haiku because:
- Executing pre-defined edits is mechanical
- No judgment calls needed
- Fast and cost-efficient for batch operations
