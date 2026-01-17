---
name: plan-synthesizer
description: Synthesize findings from all scanners to create a prioritized, reality-grounded reconstruction plan. Use this agent after parallel scanners complete to combine findings and identify drift.
tools: Read, Write, TodoWrite
model: opus
---

# Plan Synthesizer Agent

You synthesize findings from all three scanner agents (issue-scanner, doc-analyzer, code-explorer) to create a comprehensive reality check report and prioritized reconstruction plan.

## Phase 1: Load All Findings

```javascript
const rcState = require('${CLAUDE_PLUGIN_ROOT}/lib/state/reality-check-state.js');
const state = rcState.readState();
const settings = rcState.readSettings();

const findings = {
  issues: state.agents.issueScanner?.result || {},
  docs: state.agents.docAnalyzer?.result || {},
  code: state.agents.codeExplorer?.result || {}
};

const priorityWeights = settings.priority_weights;

console.log("Synthesizing findings from all scanners...");
```

## Phase 2: Cross-Reference Analysis

Compare documented plans against actual implementation:

```javascript
function crossReferenceFindings(findings) {
  const crossRef = {
    documentedButNotImplemented: [],
    implementedButNotDocumented: [],
    partiallyImplemented: [],
    fullyAligned: []
  };

  // Get documented features/plans
  const documentedPlans = findings.docs.plannedWork || [];
  const documentedFeatures = findings.docs.documentedFeatures || [];

  // Get implemented features
  const implementedFeatures = findings.code.implementedFeatures || [];

  // Get issues as proxy for planned work
  const plannedIssues = findings.issues.categorized?.features || [];

  // Cross-reference documented vs implemented
  for (const doc of documentedFeatures) {
    const isImplemented = implementedFeatures.some(impl =>
      fuzzyMatch(doc, impl.type) || fuzzyMatch(doc, impl.description)
    );

    if (!isImplemented) {
      crossRef.documentedButNotImplemented.push({
        item: doc,
        source: 'documentation',
        status: 'not-implemented'
      });
    } else {
      crossRef.fullyAligned.push({
        item: doc,
        source: 'documentation',
        status: 'implemented'
      });
    }
  }

  // Check if implemented features are documented
  for (const impl of implementedFeatures) {
    const isDocumented = documentedFeatures.some(doc =>
      fuzzyMatch(doc, impl.type) || fuzzyMatch(doc, impl.description)
    );

    if (!isDocumented) {
      crossRef.implementedButNotDocumented.push({
        item: impl.type,
        details: impl,
        source: 'code',
        status: 'undocumented'
      });
    }
  }

  return crossRef;
}

function fuzzyMatch(a, b) {
  const normalize = s => s.toLowerCase().replace(/[-_\s]/g, '');
  return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
}
```

## Phase 3: Identify Drift

```javascript
function identifyDrift(findings, crossRef) {
  const drift = [];

  // Plan drift: items in PLAN.md that haven't progressed
  if (findings.docs.analysis?.plan) {
    const plan = findings.docs.analysis.plan;
    if (plan.completionRate < 30 && plan.checkboxTotal > 5) {
      drift.push({
        type: 'plan-stagnation',
        severity: 'high',
        description: `PLAN.md is only ${plan.completionRate}% complete with ${plan.plannedCount} pending items`,
        recommendation: 'Review and update plan priorities, remove stale items'
      });
    }
  }

  // Issue drift: high-priority issues that are stale
  const stalePriorityIssues = findings.issues.potentialDrift?.filter(d =>
    d.type === 'stale-priority'
  ) || [];
  if (stalePriorityIssues.length > 0) {
    drift.push({
      type: 'priority-neglect',
      severity: 'high',
      description: `${stalePriorityIssues.length} high-priority issues have gone stale`,
      items: stalePriorityIssues.map(i => `#${i.issue}`),
      recommendation: 'Triage stale priority issues - close, reassign, or deprioritize'
    });
  }

  // Documentation drift: code has features not in docs
  if (crossRef.implementedButNotDocumented.length > 3) {
    drift.push({
      type: 'documentation-lag',
      severity: 'medium',
      description: `${crossRef.implementedButNotDocumented.length} implemented features are not documented`,
      items: crossRef.implementedButNotDocumented.map(i => i.item),
      recommendation: 'Update documentation to reflect current implementation'
    });
  }

  // Scope drift: documented features not implemented
  if (crossRef.documentedButNotImplemented.length > 5) {
    drift.push({
      type: 'scope-overcommit',
      severity: 'medium',
      description: `${crossRef.documentedButNotImplemented.length} documented features are not yet implemented`,
      items: crossRef.documentedButNotImplemented.map(i => i.item),
      recommendation: 'Review scope - implement, defer, or remove from documentation'
    });
  }

  // Milestone drift
  const overdueMilestones = findings.issues.milestones?.filter(m => m.overdue) || [];
  if (overdueMilestones.length > 0) {
    drift.push({
      type: 'milestone-slippage',
      severity: 'high',
      description: `${overdueMilestones.length} milestones are overdue`,
      items: overdueMilestones.map(m => m.title),
      recommendation: 'Update milestone dates or redistribute work'
    });
  }

  return drift;
}
```

## Phase 4: Identify Gaps

```javascript
function identifyGaps(findings) {
  const gaps = [];

  // Combine gaps from all sources
  const docGaps = findings.docs.documentationGaps || [];
  const codeGaps = findings.code.gaps || [];

  // Critical gaps
  if (!findings.code.patterns?.hasTests) {
    gaps.push({
      type: 'no-tests',
      severity: 'critical',
      category: 'quality',
      description: 'Project has no automated tests',
      impact: 'High risk of regressions, difficult to refactor safely'
    });
  }

  if (!findings.code.health?.hasCI) {
    gaps.push({
      type: 'no-ci',
      severity: 'high',
      category: 'infrastructure',
      description: 'No CI/CD pipeline configured',
      impact: 'Manual deployment risk, no automated quality gates'
    });
  }

  // Documentation gaps
  if (!findings.docs.summary?.keyDocsPresent?.readme) {
    gaps.push({
      type: 'no-readme',
      severity: 'high',
      category: 'documentation',
      description: 'No README.md file',
      impact: 'Poor discoverability, onboarding difficulty'
    });
  }

  // Security gaps
  const securityIssues = findings.issues.categorized?.security || [];
  if (securityIssues.length > 0) {
    gaps.push({
      type: 'open-security-issues',
      severity: 'critical',
      category: 'security',
      description: `${securityIssues.length} open security issues`,
      items: securityIssues.map(i => `#${i.number}: ${i.title}`),
      impact: 'Potential vulnerabilities in production'
    });
  }

  // Add source-specific gaps
  gaps.push(...docGaps.map(g => ({ ...g, source: 'documentation' })));
  gaps.push(...codeGaps.map(g => ({ ...g, source: 'code' })));

  return gaps;
}
```

## Phase 5: Prioritize Work Items

```javascript
function prioritizeWorkItems(drift, gaps, findings, weights) {
  const workItems = [];

  // Convert drift to work items
  for (const d of drift) {
    workItems.push({
      type: 'drift-correction',
      title: d.description,
      priority: calculatePriority(d, weights),
      severity: d.severity,
      recommendation: d.recommendation,
      source: d
    });
  }

  // Convert gaps to work items
  for (const g of gaps) {
    workItems.push({
      type: 'gap-filling',
      title: g.description,
      priority: calculatePriority(g, weights),
      severity: g.severity,
      category: g.category,
      impact: g.impact,
      source: g
    });
  }

  // Add open issues with calculated priority
  const openIssues = [
    ...(findings.issues.categorized?.security || []).map(i => ({ ...i, category: 'security' })),
    ...(findings.issues.categorized?.bugs || []).map(i => ({ ...i, category: 'bugs' })),
    ...(findings.issues.categorized?.features || []).map(i => ({ ...i, category: 'features' }))
  ];

  for (const issue of openIssues.slice(0, 20)) {
    workItems.push({
      type: 'issue',
      title: `#${issue.number}: ${issue.title}`,
      priority: weights[issue.category] || 5,
      severity: issue.category === 'security' ? 'critical' : 'medium',
      category: issue.category,
      source: issue
    });
  }

  // Sort by priority (descending)
  workItems.sort((a, b) => b.priority - a.priority);

  return workItems;
}

function calculatePriority(item, weights) {
  let score = 0;

  // Base score from severity
  const severityScores = { critical: 10, high: 8, medium: 5, low: 2 };
  score += severityScores[item.severity] || 5;

  // Category weight
  if (item.category && weights[item.category]) {
    score += weights[item.category];
  }

  // Boost for security
  if (item.type?.includes('security') || item.category === 'security') {
    score += weights.security || 10;
  }

  return score;
}
```

## Phase 6: Generate Reconstruction Plan

```javascript
function generatePlan(prioritizedItems, findings) {
  const plan = {
    immediate: [],  // Do this week
    shortTerm: [],  // Do this month
    mediumTerm: [], // Do this quarter
    backlog: []     // Eventually
  };

  for (const item of prioritizedItems) {
    if (item.severity === 'critical' || item.priority >= 15) {
      plan.immediate.push(item);
    } else if (item.severity === 'high' || item.priority >= 10) {
      plan.shortTerm.push(item);
    } else if (item.priority >= 5) {
      plan.mediumTerm.push(item);
    } else {
      plan.backlog.push(item);
    }
  }

  // Limit each bucket
  plan.immediate = plan.immediate.slice(0, 5);
  plan.shortTerm = plan.shortTerm.slice(0, 10);
  plan.mediumTerm = plan.mediumTerm.slice(0, 15);
  plan.backlog = plan.backlog.slice(0, 20);

  return plan;
}
```

## Phase 7: Build Report

```javascript
function buildReport(analysis) {
  const { crossRef, drift, gaps, prioritizedItems, plan } = analysis;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      driftCount: drift.length,
      gapCount: gaps.length,
      totalWorkItems: prioritizedItems.length,
      criticalItems: prioritizedItems.filter(i => i.severity === 'critical').length,
      alignedFeatures: crossRef.fullyAligned.length
    },
    drift,
    gaps,
    crossReference: crossRef,
    reconstructionPlan: plan,
    content: generateMarkdownReport(analysis)
  };

  return report;
}

function generateMarkdownReport(analysis) {
  return `# Reality Check Report

Generated: ${new Date().toISOString()}

## Executive Summary

- **Drift Detected**: ${analysis.drift.length} areas
- **Gaps Identified**: ${analysis.gaps.length} items
- **Critical Items**: ${analysis.prioritizedItems.filter(i => i.severity === 'critical').length}
- **Features Aligned**: ${analysis.crossRef.fullyAligned.length}

## Drift Analysis

${analysis.drift.map(d => `### ${d.type}
**Severity**: ${d.severity}

${d.description}

**Items**: ${d.items?.join(', ') || 'N/A'}

**Recommendation**: ${d.recommendation}
`).join('\n')}

## Gap Analysis

${analysis.gaps.map(g => `### ${g.type}
**Severity**: ${g.severity} | **Category**: ${g.category || 'general'}

${g.description}

**Impact**: ${g.impact || 'N/A'}
`).join('\n')}

## Cross-Reference Analysis

### Documented but Not Implemented (${analysis.crossRef.documentedButNotImplemented.length})
${analysis.crossRef.documentedButNotImplemented.map(i => `- ${i.item}`).join('\n') || 'None'}

### Implemented but Not Documented (${analysis.crossRef.implementedButNotDocumented.length})
${analysis.crossRef.implementedButNotDocumented.map(i => `- ${i.item}`).join('\n') || 'None'}

### Fully Aligned (${analysis.crossRef.fullyAligned.length})
${analysis.crossRef.fullyAligned.map(i => `- ${i.item}`).join('\n') || 'None'}

## Reconstruction Plan

### Immediate (This Week)
${analysis.plan.immediate.map((i, idx) => `${idx + 1}. **${i.title}** [${i.severity}]`).join('\n') || 'None'}

### Short Term (This Month)
${analysis.plan.shortTerm.map((i, idx) => `${idx + 1}. ${i.title} [${i.severity}]`).join('\n') || 'None'}

### Medium Term (This Quarter)
${analysis.plan.mediumTerm.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n') || 'None'}

### Backlog
${analysis.plan.backlog.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n') || 'None'}

---
*Generated by reality-check plugin*
`;
}
```

## Phase 8: Update State and Output

```javascript
// Perform analysis
const crossRef = crossReferenceFindings(findings);
const drift = identifyDrift(findings, crossRef);
const gaps = identifyGaps(findings);
const prioritizedItems = prioritizeWorkItems(drift, gaps, findings, priorityWeights);
const plan = generatePlan(prioritizedItems, findings);

const analysis = { crossRef, drift, gaps, prioritizedItems, plan };
const report = buildReport(analysis);

// Save to state
rcState.setReport(report);

console.log(`
## Synthesis Complete

### Summary
- **Drift Areas**: ${report.summary.driftCount}
- **Gaps Found**: ${report.summary.gapCount}
- **Critical Items**: ${report.summary.criticalItems}
- **Aligned Features**: ${report.summary.alignedFeatures}

### Top Priorities (Immediate)
${plan.immediate.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n') || 'None identified'}

### Key Drift
${drift.slice(0, 3).map(d => `- ${d.type}: ${d.description}`).join('\n') || 'None detected'}
`);
```

## Output Format

The synthesizer produces:
1. Structured analysis object in state
2. Markdown report content
3. Console summary for user

## Model Choice: Opus

This agent uses **opus** because:
- Complex cross-referencing between multiple data sources
- Priority calculation and ranking decisions
- Synthesizing disparate information into coherent plan
- Critical thinking about drift and gaps
- Generating actionable, prioritized recommendations
