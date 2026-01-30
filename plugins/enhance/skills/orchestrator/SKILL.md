---
name: enhance-orchestrator
description: "Use when coordinating multiple enhancers and producing a unified /enhance report."
version: 1.0.0
---

# enhance-orchestrator

Coordinate all enhancement analyzers in parallel and produce a unified report.

## Workflow

### Phase 1: Parse Arguments

```javascript
const args = '$ARGUMENTS'.split(' ').filter(Boolean);
const targetPath = args.find(a => !a.startsWith('--')) || '.';

const flags = {
  apply: args.includes('--apply'),
  focus: args.find(a => a.startsWith('--focus='))?.split('=')[1],
  verbose: args.includes('--verbose'),
  showSuppressed: args.includes('--show-suppressed'),
  resetLearned: args.includes('--reset-learned'),
  noLearn: args.includes('--no-learn'),
  exportLearned: args.includes('--export-learned')
};

// Validate focus type
const VALID_FOCUS = ['plugin', 'agent', 'claudemd', 'claude-memory', 'docs', 'prompt', 'hooks', 'skills'];
if (flags.focus && !VALID_FOCUS.includes(flags.focus)) {
  console.error(`Invalid --focus: "${flags.focus}". Valid: ${VALID_FOCUS.join(', ')}`);
  return;
}
```

### Phase 2: Discovery

Detect what exists in target path:

```javascript
const discovery = {
  plugins: await Glob({ pattern: 'plugins/*/plugin.json', path: targetPath }),
  agents: await Glob({ pattern: '**/agents/*.md', path: targetPath }),
  claudemd: await Glob({ pattern: '**/CLAUDE.md', path: targetPath }) ||
            await Glob({ pattern: '**/AGENTS.md', path: targetPath }),
  docs: await Glob({ pattern: 'docs/**/*.md', path: targetPath }),
  prompts: await Glob({ pattern: '**/prompts/**/*.md', path: targetPath }) ||
           await Glob({ pattern: '**/commands/**/*.md', path: targetPath }),
  hooks: await Glob({ pattern: '**/hooks/**/*.md', path: targetPath }),
  skills: await Glob({ pattern: '**/skills/**/SKILL.md', path: targetPath })
};

// Normalize focus type
const focus = flags.focus === 'claude-memory' ? 'claudemd' : flags.focus;
```

### Phase 3: Load Suppressions

```javascript
const { getSuppressionPath } = require('@awesome-slash/lib/cross-platform');
const { loadAutoSuppressions, getProjectId, clearAutoSuppressions, exportAutoSuppressions } = require('@awesome-slash/lib/enhance/auto-suppression');

const suppressionPath = getSuppressionPath();
const projectId = getProjectId(targetPath);

// Handle special flags
if (flags.resetLearned) {
  clearAutoSuppressions(suppressionPath, projectId);
  console.log(`Cleared suppressions for project: ${projectId}`);
}

if (flags.exportLearned) {
  console.log(JSON.stringify(exportAutoSuppressions(suppressionPath, projectId), null, 2));
  return;
}

const autoLearned = loadAutoSuppressions(suppressionPath, projectId);
```

### Phase 4: Launch Enhancers in Parallel

Enhancer registry:

| Type | Agent | Model |
|------|-------|-------|
| plugin | enhance:plugin-enhancer | sonnet |
| agent | enhance:agent-enhancer | opus |
| claudemd | enhance:claudemd-enhancer | sonnet |
| docs | enhance:docs-enhancer | sonnet |
| prompt | enhance:prompt-enhancer | opus |
| hooks | enhance:hooks-enhancer | opus |
| skills | enhance:skills-enhancer | opus |

```javascript
const enhancerAgents = {
  plugin: 'enhance:plugin-enhancer',
  agent: 'enhance:agent-enhancer',
  claudemd: 'enhance:claudemd-enhancer',
  docs: 'enhance:docs-enhancer',
  prompt: 'enhance:prompt-enhancer',
  hooks: 'enhance:hooks-enhancer',
  skills: 'enhance:skills-enhancer'
};

const promises = [];

// Launch each applicable enhancer
for (const [type, agent] of Object.entries(enhancerAgents)) {
  if (focus && focus !== type) continue;
  if (!discovery[type === 'claudemd' ? 'claudemd' : type]?.length) continue;

  promises.push(Task({
    subagent_type: agent,
    prompt: `Analyze ${type} in ${targetPath}. verbose: ${flags.verbose}
Return JSON: { "enhancerType": "${type}", "findings": [...], "summary": { high, medium, low } }`
  }));
}

const results = await Promise.all(promises);
```

### Phase 5: Aggregate Results

```javascript
function aggregateResults(enhancerResults) {
  const findings = [];
  const byEnhancer = {};

  for (const result of enhancerResults) {
    if (!result?.findings) continue;
    for (const finding of result.findings) {
      findings.push({ ...finding, source: result.enhancerType });
    }
    byEnhancer[result.enhancerType] = result.summary;
  }

  return {
    findings,
    byEnhancer,
    totals: {
      high: findings.filter(f => f.certainty === 'HIGH').length,
      medium: findings.filter(f => f.certainty === 'MEDIUM').length,
      low: findings.filter(f => f.certainty === 'LOW').length
    }
  };
}

const aggregated = aggregateResults(results);
```

### Phase 6: Generate Report

Delegate to enhancement-reporter:

```javascript
const report = await Task({
  subagent_type: "enhance:enhancement-reporter",
  prompt: `Generate unified report.
Findings: ${JSON.stringify(aggregated, null, 2)}
Options: verbose=${flags.verbose}, showAutoFixable=${flags.apply}`
});

console.log(report);
```

### Phase 7: Auto-Learning (unless --no-learn)

```javascript
if (!flags.noLearn) {
  const { analyzeForAutoSuppression, saveAutoSuppressions } = require('@awesome-slash/lib/enhance/auto-suppression');

  const fileContents = new Map();
  for (const finding of aggregated.findings) {
    if (finding.file && !fileContents.has(finding.file)) {
      try {
        fileContents.set(finding.file, await Read({ file_path: finding.file }));
      } catch {}
    }
  }

  const newSuppressions = analyzeForAutoSuppression(aggregated.findings, fileContents, { projectRoot: targetPath });

  if (newSuppressions.length > 0) {
    saveAutoSuppressions(suppressionPath, projectId, newSuppressions);
    console.log(`\nLearned ${newSuppressions.length} new suppressions.`);

    if (flags.showSuppressed) {
      for (const s of newSuppressions) {
        console.log(`- ${s.patternId}: ${s.suppressionReason} (${(s.confidence * 100).toFixed(0)}%)`);
      }
    }
  }
}
```

### Phase 8: Apply Fixes (if --apply)

```javascript
if (flags.apply) {
  const autoFixable = aggregated.findings.filter(f => f.certainty === 'HIGH' && f.autoFixable);

  if (autoFixable.length > 0) {
    console.log(`\n## Applying ${autoFixable.length} Auto-Fixes\n`);

    // Group by enhancer type
    const byEnhancer = {};
    for (const fix of autoFixable) {
      const type = fix.source;
      if (!byEnhancer[type]) byEnhancer[type] = [];
      byEnhancer[type].push(fix);
    }

    for (const [type, fixes] of Object.entries(byEnhancer)) {
      await Task({
        subagent_type: enhancerAgents[type],
        prompt: `Apply HIGH certainty fixes: ${JSON.stringify(fixes, null, 2)}`
      });
    }

    console.log(`Applied ${autoFixable.length} fixes.`);
  } else {
    console.log('\nNo auto-fixable issues found.');
  }
}
```

## Output Format

```markdown
# Enhancement Analysis Report

**Target**: {targetPath}
**Date**: {timestamp}
**Enhancers Run**: {list}

## Executive Summary

| Enhancer | HIGH | MEDIUM | LOW | Auto-Fixable |
|----------|------|--------|-----|--------------|
| plugin   | 2    | 3      | 1   | 1            |
| agent    | 1    | 2      | 0   | 1            |
| **Total**| **3**| **5**  | **1**| **2**       |

## HIGH Certainty Issues

[Grouped by enhancer, file, line]

## MEDIUM Certainty Issues

[...]

## Auto-Fix Summary

{n} issues can be automatically fixed with `--apply` flag.
```

## Constraints

- Run enhancers in parallel for efficiency
- Only run enhancers for content types that exist
- HIGH certainty issues reported first
- Auto-fixes only with explicit --apply
- Never auto-fix MEDIUM or LOW issues
- Deduplicate findings across enhancers
