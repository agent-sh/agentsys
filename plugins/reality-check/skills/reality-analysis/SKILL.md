---
name: Reality Analysis
description: This skill should be used when the user asks about "plan drift", "reality check", "comparing docs to code", "project state analysis", "roadmap alignment", "implementation gaps", or needs guidance on identifying discrepancies between documented plans and actual implementation state.
version: 1.0.0
---

# Reality Analysis

Knowledge and patterns for analyzing project state, detecting plan drift, and creating prioritized reconstruction plans.

## Drift Detection Patterns

### Types of Drift

**Plan Drift**: When documented plans diverge from actual implementation
- PLAN.md items remain unchecked for extended periods
- Roadmap milestones slip without updates
- Sprint/phase goals not reflected in code changes

**Documentation Drift**: When documentation falls behind implementation
- New features exist without corresponding docs
- README describes features that don't exist
- API docs don't match actual endpoints

**Issue Drift**: When issue tracking diverges from reality
- Stale issues that no longer apply
- Completed work without closed issues
- High-priority items neglected

**Scope Drift**: When project scope expands beyond original plans
- More features documented than can be delivered
- Continuous addition without completion
- Ever-growing backlog with no pruning

### Detection Signals

```
HIGH-CONFIDENCE DRIFT INDICATORS:
- Milestone 30+ days overdue with open issues
- PLAN.md < 30% completion after 90 days
- 5+ high-priority issues stale > 60 days
- README features not found in codebase

MEDIUM-CONFIDENCE INDICATORS:
- Documentation files unchanged for 180+ days
- Draft PRs open > 30 days
- Issue themes don't match code activity
- Large gap between documented and implemented features

LOW-CONFIDENCE INDICATORS:
- Many TODOs in codebase
- Stale dependencies
- Old git branches not merged
```

## Prioritization Framework

### Priority Calculation

```javascript
function calculatePriority(item, weights) {
  let score = 0;

  // Severity base score
  const severityScores = {
    critical: 15,
    high: 10,
    medium: 5,
    low: 2
  };
  score += severityScores[item.severity] || 5;

  // Category multiplier
  const categoryWeights = {
    security: 2.0,    // Security issues get 2x
    bugs: 1.5,        // Bugs get 1.5x
    infrastructure: 1.3,
    features: 1.0,
    documentation: 0.8
  };
  score *= categoryWeights[item.category] || 1.0;

  // Recency boost
  if (item.createdRecently) score *= 1.2;

  // Stale penalty (old items slightly deprioritized)
  if (item.daysStale > 180) score *= 0.9;

  return Math.round(score);
}
```

### Time Bucket Thresholds

| Bucket | Criteria | Max Items |
|--------|----------|-----------|
| Immediate | severity=critical OR priority >= 15 | 5 |
| Short-term | severity=high OR priority >= 10 | 10 |
| Medium-term | priority >= 5 | 15 |
| Backlog | everything else | 20 |

### Priority Weights (Default)

```yaml
security: 10     # Security issues always top priority
bugs: 8          # Bugs affect users directly
features: 5      # New functionality
documentation: 3 # Important but not urgent
tech-debt: 4     # Keeps codebase healthy
```

## Cross-Reference Patterns

### Document-to-Code Matching

```javascript
// Fuzzy matching for feature names
function featureMatch(docFeature, codeFeature) {
  const normalize = s => s
    .toLowerCase()
    .replace(/[-_\s]+/g, '')
    .replace(/s$/, ''); // Remove trailing 's'

  const docNorm = normalize(docFeature);
  const codeNorm = normalize(codeFeature);

  return docNorm.includes(codeNorm) ||
         codeNorm.includes(docNorm) ||
         levenshteinDistance(docNorm, codeNorm) < 3;
}
```

### Common Mismatches

| Documented As | Implemented As |
|---------------|----------------|
| "user authentication" | auth/, login/, session/ |
| "API endpoints" | routes/, api/, handlers/ |
| "database models" | models/, entities/, schemas/ |
| "caching layer" | cache/, redis/, memcache/ |
| "logging system" | logger/, logs/, telemetry/ |

## Output Templates

### Drift Report Section

```markdown
## Drift Analysis

### {drift_type}
**Severity**: {severity}
**Detected In**: {source}

{description}

**Evidence**:
{evidence_items}

**Recommendation**: {recommendation}
```

### Gap Report Section

```markdown
## Gap: {gap_title}

**Category**: {category}
**Severity**: {severity}

{description}

**Impact**: {impact_description}

**To Address**:
1. {action_item_1}
2. {action_item_2}
```

### Reconstruction Plan Section

```markdown
## Reconstruction Plan

### Immediate Actions (This Week)
{immediate_items_numbered}

### Short-Term (This Month)
{short_term_items_numbered}

### Medium-Term (This Quarter)
{medium_term_items_numbered}

### Backlog
{backlog_items_numbered}
```

## Best Practices

### When Analyzing Drift

1. **Compare timestamps, not just content**
   - When was the doc last updated vs. last code change?
   - Are milestones dated realistically?

2. **Look for patterns, not individual items**
   - One stale issue isn't drift; 10 stale issues is a pattern
   - One undocumented feature isn't drift; 5 undocumented features is

3. **Consider context**
   - Active development naturally has some drift
   - Mature projects should have minimal drift
   - Post-launch projects often have documentation lag

4. **Weight by impact**
   - User-facing drift matters more than internal
   - Public API drift matters more than implementation details

### When Creating Plans

1. **Be actionable, not exhaustive**
   - Top 5 immediate items, not top 50
   - Each item should be completable in reasonable time

2. **Group related items**
   - "Update authentication docs" not "Update login page docs" + "Update signup docs"

3. **Include success criteria**
   - How do we know this drift item is resolved?

4. **Balance categories**
   - All security first, but don't ignore everything else
   - Mix quick wins with important work

## Integration Points

### With Issue Scanner

Issue scanner provides:
- Open issue counts and categories
- Stale issue identification
- Milestone status
- Theme analysis

Use this data to:
- Cross-reference with documented plans
- Identify priority neglect
- Detect scope creep

### With Doc Analyzer

Doc analyzer provides:
- Documented features list
- Plan completion status
- Documentation freshness
- Mentioned files/commands

Use this data to:
- Compare against implemented features
- Measure plan progress
- Identify documentation gaps

### With Code Explorer

Code explorer provides:
- Implemented features
- Public API surface
- Code health metrics
- Recent activity patterns

Use this data to:
- Verify documented features exist
- Find undocumented implementations
- Assess project maturity

## Example Analysis

### Input

```json
{
  "issues": {
    "openCount": 47,
    "stalePriorityCount": 8,
    "overdoeMilestones": 2
  },
  "docs": {
    "planCompletion": 23,
    "documentedFeatures": 12,
    "lastUpdated": "2024-06-15"
  },
  "code": {
    "implementedFeatures": 8,
    "hasTests": false,
    "todoCount": 34
  }
}
```

### Output Assessment

```
DRIFT SCORE: HIGH

Primary Drift Areas:
1. Plan stagnation (23% completion)
2. Priority neglect (8 stale high-priority issues)
3. Milestone slippage (2 overdue)

Key Gaps:
1. No automated tests (critical)
2. 34 TODO comments (medium)
3. 4 features documented but not implemented

Recommendation:
Focus on stabilization before new features.
Address testing gap and stale priorities first.
```
