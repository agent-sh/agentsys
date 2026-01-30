---
name: enhance-reporter
description: "Use when generating the unified enhancement report from aggregated findings. Called by orchestrator after all enhancers complete."
version: 1.1.0
---

# enhance-reporter

Generate the unified enhancement report from all enhancer findings.

## Critical Rules

1. **MUST group findings by enhancer type** - Keep related issues together
2. **MUST deduplicate identical issues** - Same file + line + issue = one entry
3. **MUST order by certainty** - HIGH first, then MEDIUM, then LOW (if verbose)
4. **MUST show auto-fixable count** - Help user decide on --apply
5. **NEVER include LOW certainty unless verbose flag** - Reduce noise

## Input Format

Receives aggregated findings from orchestrator:

```json
{
  "findings": [
    {
      "file": "path/to/file.md",
      "line": 42,
      "issue": "Missing required field",
      "fix": "Add 'name' to frontmatter",
      "certainty": "HIGH",
      "autoFixable": true,
      "source": "agent"
    }
  ],
  "byEnhancer": {
    "agent": { "high": 2, "medium": 1, "low": 0 },
    "plugin": { "high": 1, "medium": 3, "low": 2 }
  },
  "totals": { "high": 3, "medium": 4, "low": 2 }
}
```

## Report Generation

### Step 1: Build Executive Summary

```markdown
## Executive Summary

| Enhancer | HIGH | MEDIUM | LOW | Auto-Fixable |
|----------|------|--------|-----|--------------|
```

Count auto-fixable as `findings.filter(f => f.certainty === 'HIGH' && f.autoFixable).length`

### Step 2: Group Findings

```javascript
function groupFindings(findings) {
  const grouped = {
    HIGH: {},
    MEDIUM: {},
    LOW: {}
  };

  for (const f of findings) {
    const key = f.certainty;
    const enhancer = f.source;

    if (!grouped[key][enhancer]) grouped[key][enhancer] = [];
    grouped[key][enhancer].push(f);
  }

  return grouped;
}
```

### Step 3: Deduplicate

```javascript
function deduplicate(findings) {
  const seen = new Set();
  return findings.filter(f => {
    const key = `${f.file}:${f.line}:${f.issue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

### Step 4: Format Output

For each certainty level (HIGH, MEDIUM, LOW if verbose):

```markdown
## HIGH Certainty Issues

### Agent Issues (2)

| File | Line | Issue | Fix | Auto-Fix |
|------|------|-------|-----|----------|
| agents/foo.md | 5 | Missing description | Add description field | Yes |

### Plugin Issues (1)

| File | Line | Issue | Fix | Auto-Fix |
|------|------|-------|-----|----------|
```

## Output Format

```markdown
# Enhancement Analysis Report

**Target**: {targetPath}
**Date**: {ISO timestamp}
**Enhancers Run**: agent, plugin, claudemd

## Executive Summary

| Enhancer | HIGH | MEDIUM | LOW | Auto-Fixable |
|----------|------|--------|-----|--------------|
| agent    | 2    | 1      | 0   | 1            |
| plugin   | 1    | 3      | 2   | 1            |
| **Total**| **3**| **4**  | **2**| **2**       |

## HIGH Certainty Issues

### Agent Issues (2)
| File | Line | Issue | Fix | Auto-Fix |
|------|------|-------|-----|----------|
| agents/foo.md | 5 | Missing description | Add description | Yes |
| agents/bar.md | 12 | Unrestricted Bash | Scope to git | Yes |

### Plugin Issues (1)
| File | Line | Issue | Fix | Auto-Fix |
|------|------|-------|-----|----------|
| plugins/x/plugin.json | 8 | Missing additionalProperties | Add false | Yes |

## MEDIUM Certainty Issues

### Plugin Issues (3)
| File | Line | Issue | Fix |
|------|------|-------|-----|
| ... | ... | ... | ... |

## Auto-Fix Summary

**2 issues** can be automatically fixed.
Run with `--apply` flag to apply HIGH certainty fixes.

## Suppressed Issues

{If --show-suppressed}
- {patternId}: {reason} ({confidence}%)
```

## Constraints

- MUST produce valid markdown output
- MUST include all HIGH and MEDIUM issues
- MUST only include LOW if verbose flag is true
- MUST show auto-fix count even if zero
- MUST format tables consistently
- NEVER truncate or summarize findings - show all
