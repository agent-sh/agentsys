---
name: deslop
description: "Use when user wants to clean AI slop from code. Use for cleanup, remove debug statements, find ghost code, repo hygiene."
version: 4.2.2
argument-hint: "[report|apply] [--scope=all|diff|path] [--thoroughness=quick|normal|deep]"
---

# deslop

Clean AI slop from code with certainty-based findings and auto-fixes.

## Parse Arguments

```javascript
const args = '$ARGUMENTS'.split(' ').filter(Boolean);
const mode = args.find(a => ['report', 'apply'].includes(a)) || 'report';
const scope = args.find(a => a.startsWith('--scope='))?.split('=')[1] || 'all';
const thoroughness = args.find(a => a.startsWith('--thoroughness='))?.split('=')[1] || 'normal';
```

## Input

Arguments: `[report|apply] [--scope=<path>|all|diff] [--thoroughness=quick|normal|deep]`

- **Mode**: `report` (default) or `apply`
- **Scope**: What to scan
  - `all` (default): Entire codebase
  - `diff`: Only files changed in current branch
  - `<path>`: Specific directory or file
- **Thoroughness**: Analysis depth (default: `normal`)
  - `quick`: Regex patterns only
  - `normal`: + multi-pass analyzers
  - `deep`: + CLI tools (jscpd, madge) if available

## Detection Pipeline

### Phase 1: Run Detection Script

The detection script is at `../../scripts/detect.js` relative to this skill.

**Run detection** (use relative path from skill directory):
```bash
# Scripts are at plugin root: ../../scripts/ from skills/deslop/
node ../../scripts/detect.js . --thoroughness normal --compact --max 50
```

**For diff scope** (only changed files):
```bash
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
# Use newline-separated list to safely handle filenames with special chars
git diff --name-only origin/${BASE}..HEAD 2>/dev/null | \
  xargs -d '\n' node ../../scripts/detect.js --thoroughness normal --compact
```

**Note**: The relative path `../../scripts/detect.js` navigates from `skills/deslop/` up to the plugin root where `scripts/` lives.

### Phase 2: Repo-Map Enhancement (Optional)

If repo-map exists, enhance detection with AST-based analysis:

```javascript
// Use relative path from skill directory to plugin lib
// Path: skills/deslop/ -> ../../lib/repo-map
const repoMap = require('../../lib/repo-map');

if (repoMap.exists(basePath)) {
  const map = repoMap.load(basePath);
  const usageIndex = repoMap.buildUsageIndex(map);

  // Find orphaned infrastructure with HIGH certainty
  const orphaned = repoMap.findOrphanedInfrastructure(map, usageIndex);
  for (const item of orphaned) {
    findings.push({
      file: item.file,
      line: item.line,
      pattern: 'orphaned-infrastructure',
      message: `${item.name} (${item.type}) is never used`,
      certainty: 'HIGH',
      severity: 'high',
      autoFix: false
    });
  }

  // Find unused exports
  const unusedExports = repoMap.findUnusedExports(map, usageIndex);
  for (const item of unusedExports) {
    findings.push({
      file: item.file,
      line: item.line,
      pattern: 'unused-export',
      message: `Export '${item.name}' is never imported`,
      certainty: item.certainty,
      severity: 'medium',
      autoFix: false
    });
  }
}
```

### Phase 3: Aggregate and Prioritize

Sort findings by:
1. **Certainty**: HIGH before MEDIUM before LOW
2. **Severity**: high before medium before low
3. **Fix complexity**: auto-fixable before manual

### Phase 4: Return Structured Results

Skill returns structured JSON - does NOT apply fixes (orchestrator handles that).

## Output Format

JSON structure between markers:

```
=== DESLOP_RESULT ===
{
  "mode": "report|apply",
  "scope": "all|diff|path",
  "filesScanned": N,
  "findings": [
    {
      "file": "src/api.js",
      "line": 42,
      "pattern": "debug-statement",
      "message": "console.log found",
      "certainty": "HIGH",
      "severity": "medium",
      "autoFix": true,
      "fixType": "remove-line"
    }
  ],
  "fixes": [
    {
      "file": "src/api.js",
      "line": 42,
      "fixType": "remove-line",
      "pattern": "debug-statement"
    }
  ],
  "summary": {
    "high": N,
    "medium": N,
    "low": N,
    "autoFixable": N
  }
}
=== END_RESULT ===
```

## Certainty Levels

| Level | Meaning | Action |
|-------|---------|--------|
| **HIGH** | Definitely slop, safe to auto-fix | Auto-fix via simple-fixer |
| **MEDIUM** | Likely slop, needs verification | Review first |
| **LOW** | Possible slop, context-dependent | Flag only |

## Pattern Categories

### HIGH Certainty (Auto-Fixable)

- `debug-statement`: console.log, console.debug, print, println!
- `debug-import`: Unused debug/logging imports
- `placeholder-text`: "Lorem ipsum", "TODO: implement"
- `empty-catch`: Empty catch blocks without comment
- `trailing-whitespace`: Trailing whitespace
- `mixed-indentation`: Mixed tabs/spaces

### MEDIUM Certainty (Review Required)

- `excessive-comments`: Comment/code ratio > 2:1
- `doc-code-ratio`: JSDoc > 3x function body
- `stub-function`: Returns placeholder value only
- `dead-code`: Unreachable after return/throw
- `infrastructure-without-impl`: DB clients created but never used

### LOW Certainty (Flag Only)

- `over-engineering`: File/export ratio > 20x
- `buzzword-inflation`: Claims without evidence
- `shotgun-surgery`: Files frequently change together

## Fix Types

| Fix Type | Action | Patterns |
|----------|--------|----------|
| `remove-line` | Delete line | debug-statement, debug-import |
| `add-comment` | Add explanation | empty-catch |
| `remove-block` | Delete code block | stub-function with TODO |

## Error Handling

- **Git not available**: Skip git-dependent checks
- **Invalid scope**: Return error in JSON
- **Parse errors**: Skip file, continue scan

## Integration

This skill is invoked by:
- `deslop-agent` for `/deslop` command
- `/next-task` Phase 8 (pre-review gates) with `scope=diff`

The orchestrator spawns `simple-fixer` to apply HIGH certainty fixes.
