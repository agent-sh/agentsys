---
name: enhance-orchestrator
description: "Use when coordinating multiple enhancers for /enhance command. Runs analyzers in parallel and produces unified report."
version: 4.2.2
argument-hint: "[path] [--apply] [--focus=TYPE]"
---

# enhance-orchestrator

Coordinate all enhancement analyzers in parallel and produce a unified report.

## Critical Rules

1. **MUST run enhancers in parallel** - Use Promise.all for efficiency
2. **MUST only run enhancers for existing content** - Skip if no files found
3. **MUST report HIGH certainty first** - Priority order: HIGH → MEDIUM → LOW
4. **NEVER auto-fix without --apply flag** - Explicit consent required
5. **NEVER auto-fix MEDIUM or LOW issues** - Only HIGH certainty

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
const VALID_FOCUS = ['plugin', 'agent', 'claudemd', 'claude-memory', 'docs', 'prompt', 'hooks', 'skills', 'cross-file'];
if (flags.focus && !VALID_FOCUS.includes(flags.focus)) {
  console.error(`Invalid --focus: "${flags.focus}". Valid: ${VALID_FOCUS.join(', ')}`);
  return;
}
```

### Phase 2: Discovery

Detect what exists in target path:

```javascript
const discovery = {
  plugins: await Glob({ pattern: 'plugins/*/.claude-plugin/plugin.json', path: targetPath }),
  agents: await Glob({ pattern: '**/agents/*.md', path: targetPath }),
  claudemd: await Glob({ pattern: '**/CLAUDE.md', path: targetPath }) ||
            await Glob({ pattern: '**/AGENTS.md', path: targetPath }),
  docs: await Glob({ pattern: 'docs/**/*.md', path: targetPath }),
  prompts: await Glob({ pattern: '**/prompts/**/*.md', path: targetPath }) ||
           await Glob({ pattern: '**/commands/**/*.md', path: targetPath }),
  hooks: await Glob({ pattern: '**/hooks/**/*.md', path: targetPath }),
  skills: await Glob({ pattern: '**/skills/**/SKILL.md', path: targetPath }),
  // Cross-file runs if agents OR skills exist (analyzes relationships)
  'cross-file': discovery.agents?.length || discovery.skills?.length ? ['enabled'] : []
};
```

### Phase 3: Load Suppressions

```javascript
// Use relative path from skill directory to plugin lib
// Path: skills/enhance-orchestrator/ -> ../../lib/
const { getSuppressionPath } = require('../../lib/cross-platform');
const { loadAutoSuppressions, getProjectId, clearAutoSuppressions } = require('../../lib/enhance/auto-suppression');

const suppressionPath = getSuppressionPath();
const projectId = getProjectId(targetPath);

if (flags.resetLearned) {
  clearAutoSuppressions(suppressionPath, projectId);
  console.log(`Cleared suppressions for project: ${projectId}`);
}

const autoLearned = loadAutoSuppressions(suppressionPath, projectId);
```

### Phase 4: Launch Enhancers in Parallel

**CRITICAL**: MUST spawn these EXACT agents using Task(). Do NOT use Explore or other agents.

| Focus Type | Agent to Spawn | Model | JS Analyzer |
|------------|----------------|-------|-------------|
| `plugin` | `enhance:plugin-enhancer` | sonnet | `lib/enhance/plugin-analyzer.js` |
| `agent` | `enhance:agent-enhancer` | opus | `lib/enhance/agent-analyzer.js` |
| `claudemd` | `enhance:claudemd-enhancer` | opus | `lib/enhance/projectmemory-analyzer.js` |
| `docs` | `enhance:docs-enhancer` | opus | `lib/enhance/docs-analyzer.js` |
| `prompt` | `enhance:prompt-enhancer` | opus | `lib/enhance/prompt-analyzer.js` |
| `hooks` | `enhance:hooks-enhancer` | opus | `lib/enhance/hook-analyzer.js` |
| `skills` | `enhance:skills-enhancer` | opus | `lib/enhance/skill-analyzer.js` |
| `cross-file` | `enhance:cross-file-enhancer` | sonnet | `lib/enhance/cross-file-analyzer.js` |

Each agent has `Bash(node:*)` to run its JS analyzer. Do NOT substitute with Explore agents.

```javascript
// EXACT agent mapping - do not change
const ENHANCER_AGENTS = {
  plugin: 'enhance:plugin-enhancer',
  agent: 'enhance:agent-enhancer',
  claudemd: 'enhance:claudemd-enhancer',
  docs: 'enhance:docs-enhancer',
  prompt: 'enhance:prompt-enhancer',
  hooks: 'enhance:hooks-enhancer',
  skills: 'enhance:skills-enhancer',
  'cross-file': 'enhance:cross-file-enhancer'
};

const promises = [];

for (const [type, agentType] of Object.entries(ENHANCER_AGENTS)) {
  if (focus && focus !== type) continue;
  if (!discovery[type]?.length) continue;

  // MUST use exact subagent_type - these agents have Bash(node:*) to run JS analyzers
  promises.push(Task({
    subagent_type: agentType,
    prompt: `Analyze ${type} in ${targetPath}.
MUST use Skill tool to invoke your enhance-* skill.
The skill runs the JavaScript analyzer and returns structured findings.
verbose: ${flags.verbose}
Return JSON: { "enhancerType": "${type}", "findings": [...], "summary": { high, medium, low } }`
  }));
}

// MUST use Promise.all for parallel execution
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
```

### Phase 6: Generate Report

Generate report directly from aggregated findings:

```javascript
const { generateReport } = require('../../lib/enhance/reporter');

const report = generateReport(aggregated, {
  verbose: flags.verbose,
  showAutoFixable: flags.apply
});

console.log(report);
```

### Phase 7: Auto-Learning

```javascript
if (!flags.noLearn) {
  const { analyzeForAutoSuppression, saveAutoSuppressions } = require('../../lib/enhance/auto-suppression');

  const newSuppressions = analyzeForAutoSuppression(aggregated.findings, fileContents, { projectRoot: targetPath });

  if (newSuppressions.length > 0) {
    saveAutoSuppressions(suppressionPath, projectId, newSuppressions);
    console.log(`\nLearned ${newSuppressions.length} new suppressions.`);
  }
}
```

### Phase 8: Apply Fixes

```javascript
if (flags.apply) {
  const autoFixable = aggregated.findings.filter(f => f.certainty === 'HIGH' && f.autoFixable);

  if (autoFixable.length > 0) {
    console.log(`\n## Applying ${autoFixable.length} Auto-Fixes\n`);

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
[Grouped by enhancer, then file]

## MEDIUM Certainty Issues
[...]

## Auto-Fix Summary
{n} issues can be fixed with `--apply` flag.
```

## Constraints

- MUST run enhancers in parallel (Promise.all)
- MUST skip enhancers for missing content types
- MUST report HIGH certainty issues first
- MUST deduplicate findings across enhancers
- NEVER auto-fix without explicit --apply flag
- NEVER auto-fix MEDIUM or LOW certainty issues
