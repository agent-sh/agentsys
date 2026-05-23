- ---
name: drift-analysis
description: Use for plan drift, reality check, docs-to-code comparison, project state analysis, roadmap alignment, implementation gaps, or identifying discrepancies between documented plans and actual implementation.
version: 5.1.0

<h1>Drift Analysis</h1>
Knowledge and patterns for analyzing project state, detecting plan drift, and creating prioritized reconstruction plans.

<h2>Architecture Overview</h2>
```
/drift-detect
│
├─→ collectors.js (pure JavaScript)
│   ├─ scanGitHubState()
│   ├─ analyzeDocumentation()
│   └─ scanCodebase()
│
└─→ plan-synthesizer (Opus)
    └─ Deep semantic analysis with full context
```
**Data collection**: Pure JavaScript (no LLM overhead)
**Semantic analysis**: Single Opus call with complete context

<h2>Drift Detection Patterns</h2>
<h3>Types of Drift</h3>
**Plan Drift**: Documented plans diverge from actual implementation
* PLAN.md items unchecked for extended periods
* Roadmap milestones slip without updates
* Sprint/phase goals not reflected in code changes

**Documentation Drift**: Documentation lags behind implementation
* New features exist without corresponding docs
* README describes non-existent features
* API docs don't match actual endpoints

**Issue Drift**: Issue tracking diverges from reality
* Stale issues no longer apply
* Completed work without closed issues
* High-priority items neglected

**Scope Drift**: Project scope expands beyond original plans
* More features documented than deliverable
* Continuous additions without completion
* Ever-growing backlog with no pruning

<h3>Detection Signals</h3>
```
HIGH-CONFIDENCE DRIFT INDICATORS:
* Milestone 30+ days overdue with open issues
* PLAN.md < 30% completion after 90 days
* 5+ high-priority issues stale > 60 days
* README features not found in codebase

MEDIUM-CONFIDENCE INDICATORS:
* Documentation files unchanged for 180+ days
* Draft PRs open > 30 days
* Issue themes don't match code activity
* Large gap between documented and implemented features

LOW-CONFIDENCE INDICATORS:
* Many TODOs in codebase
* Stale dependencies
* Old git branches not merged
```

<h2>Prioritization Framework</h2>
<h3>Priority Calculation</h3>
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

<h3>Time Bucket Thresholds</h3>
| Bucket | Criteria | Max Items |
|--------|----------|-----------|
| Immediate | severity=critical OR priority >= 15 | 5 |
| Short-term | severity=high OR priority >= 10 | 10 |
| Medium-term | priority >= 5 | 15 |
| Backlog | everything else | 20 |

<h3>Priority Weights (Default)</h3>
```
security: 10     # Security issues always top priority
bugs: 8          # Bugs affect users directly
features: 5      # New functionality
documentation: 3 # Important but not urgent
tech-debt: 4     # Keeps codebase healthy
```

<h2>Cross-Reference Patterns</h2>
<h3>Document-to-Code Matching</h3>
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

<h3>Common Mismatches</h3>
| Documented As | Implemented As |
|---------------|----------------|
| "user authentication" | auth/, login/, session/ |
| "API endpoints" | routes/, api/, handlers/ |
| "database models" | models/, entities/, schemas/ |
| "caching layer" | cache/, redis/, memcache/ |
| "logging system" | logger/, logs/, telemetry/ |

<h2>Output Templates</h2>
<h3>Drift Report Section</h3>
```markdown
## Drift Analysis
<h3>{drift_type}</h3>
**Severity**: {severity}
**Detected In**: {source}
{description}
**Evidence**:
{evidence_items}
**Recommendation**: {recommendation}
```

<h3>Gap Report Section</h3>
```markdown
## Gap: {gap_title}
**Category**: {category}
**Severity**: {severity}
{description}
**Impact**: {impact_description}
**To Address**:
* {action_item_1}
* {action_item_2}
```

<h3>Reconstruction Plan Section</h3>
```markdown
## Reconstruction Plan
<h3>Immediate Actions (This Week)</h3>
{immediate_items_numbered}
<h3>Short-Term (This Month)</h3>
{short_term_items_numbered}
<h3>Medium-Term (This Quarter)</h3>
{medium_term_items_numbered}
<h3>Backlog</h3>
{backlog_items_numbered}
```

<h2>Best Practices</h2>
<h3>When Analyzing Drift</h3>
* **Compare timestamps, not just content**: Doc vs. code update times, milestone realism.
* **Look for patterns, not individual items**: 10 stale issues vs. one. 5 undocumented features vs. one.
* **Consider context**: Active dev (some drift expected), mature projects (minimal drift), post-launch (doc lag common).
* **Weight by impact**: User-facing > internal. Public API > implementation details.

<h3>When Creating Plans</h3>
* **Be actionable, not exhaustive**: Top 5 immediate, not top 50. Each item completable.
* **Group related items**: "Update authentication docs" instead of granular updates.
* **Include success criteria**: How is this drift item resolved?
* **Balance categories**: Address security, but don't ignore other areas. Mix quick wins with important work.

<h2>Data Collection (JavaScript)</h2>
`collectors.js` extracts data without LLM overhead:

<h3>GitHub Data</h3>
* Open issues (categorized by labels)
* Open PRs (draft status)
* Milestones (due dates)
* Stale items (> 90 days inactive)
* Theme analysis from titles

<h3>Documentation Data</h3>
* Parsed README, PLAN.md, CLAUDE.md, CHANGELOG.md
* Checkbox completion counts
* Section analysis
* Feature lists

<h3>Code Data</h3>
* Directory structure
* Framework detection
* Test framework presence
* Health indicators (CI, linting, tests)

<h2>Semantic Analysis (Opus)</h2>
`plan-synthesizer` receives collected data and performs:
* **Cross-referencing**: Match documented features to implementation
* **Drift identification**: Find divergence patterns
* **Gap analysis**: Identify missing elements
* **Prioritization**: Context-aware ranking
* **Report generation**: Actionable recommendations

<h2>Example Input/Output</h2>
<h3>Collected Data (from collectors.js)</h3>
```json
{
  "github": {
    "issues": [...],
    "categorized": { "bugs": [...], "features": [...] },
    "stale": [...]
  },
  "docs": {
    "files": { "README.md": {...}, "PLAN.md": {...} },
    "checkboxes": { "total": 15, "checked": 3 }
  },
  "code": {
    "frameworks": ["Express"],
    "health": { "hasTests": true, "hasCi": true }
  }
}
```

<h3>Analysis Output (from plan-synthesizer)</h3>
```markdown
# Reality Check Report
<h2>Executive Summary</h2>
Project has moderate drift: 8 stale priority issues and 20% plan completion.
Strong code health (tests + CI) but documentation lags implementation.

<h2>Drift Analysis</h2>
<h3>Priority Neglect</h3>
**Severity**: high
8 high-priority issues inactive for 60+ days...

<h2>Prioritized Plan</h2>
<h3>Immediate</h3>
* Close #45 (already implemented)
* Update README API section...
```
