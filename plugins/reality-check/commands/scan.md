---
description: Deep repository analysis to realign project plans with actual code reality
argument-hint: ""
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob, Grep, Task, AskUserQuestion, Write
---

# /reality-check:scan - Reality Check Scanner

Perform deep repository analysis to identify drift between documented plans and actual implementation.

## Workflow Overview

```
Settings Check → Parallel Scan (3 agents) → Synthesis → Report
       ↓                    ↓                   ↓
   (First-run         (issue-scanner,     (plan-synthesizer
    setup if           doc-analyzer,        combines all
    needed)            code-explorer)        findings)
```

## Phase 1: Settings Check

Check if settings file exists. If not, prompt user to configure via checkboxes.

```javascript
const rcState = require('${CLAUDE_PLUGIN_ROOT}/lib/state/reality-check-state.js');

// Check for existing settings
if (!rcState.hasSettings()) {
  console.log("No settings found. Starting first-run setup...");
  // → Use AskUserQuestion to gather settings
}
```

### First-Run Setup (if no settings exist)

Use AskUserQuestion with checkboxes to gather configuration:

```javascript
AskUserQuestion({
  questions: [
    {
      header: "Data Sources",
      question: "Which sources should I scan for project state?",
      options: [
        { label: "GitHub Issues & PRs (Recommended)", description: "Scan open issues, PRs, and milestones" },
        { label: "Documentation files", description: "README, CLAUDE.md, docs/, PLAN.md" },
        { label: "Linear issues", description: "Requires Linear MCP integration" },
        { label: "All sources", description: "Comprehensive scan of everything" }
      ],
      multiSelect: true
    },
    {
      header: "Scan Depth",
      question: "How thorough should the analysis be?",
      options: [
        { label: "Thorough (Recommended)", description: "Deep analysis, may take longer" },
        { label: "Quick", description: "Surface-level scan, faster results" },
        { label: "Medium", description: "Balanced depth and speed" }
      ],
      multiSelect: false
    },
    {
      header: "Output",
      question: "How should I deliver the results?",
      options: [
        { label: "Write to file (Recommended)", description: "Save reality-check-report.md" },
        { label: "Display only", description: "Show in conversation only" },
        { label: "Both", description: "Save file and show summary" }
      ],
      multiSelect: false
    }
  ]
});
```

After collecting settings, write them:

```javascript
const settings = mapResponsesToSettings(responses);
rcState.writeSettings(settings);
console.log("Settings saved to .claude/reality-check.local.md");
```

## Phase 2: Initialize Scan

```javascript
const settings = rcState.readSettings();
const state = rcState.createState(settings);
rcState.writeState(state);

rcState.startPhase('parallel-scan');

console.log(`
## Starting Reality Check Scan

**Scan ID**: ${state.scan.id}
**Sources**: ${Object.entries(settings.sources).filter(([k,v]) => v).map(([k]) => k).join(', ')}
**Depth**: ${settings.scan_depth}

Launching parallel scanners...
`);
```

## Phase 3: Parallel Agent Execution

Launch three scanner agents in parallel:

```javascript
// Launch all three scanners simultaneously
await Promise.all([
  Task({
    subagent_type: "reality-check:issue-scanner",
    prompt: `Scan GitHub issues and PRs. Settings: ${JSON.stringify(settings.sources)}`,
    run_in_background: false
  }),

  Task({
    subagent_type: "reality-check:doc-analyzer",
    prompt: `Analyze documentation files. Paths: ${settings.sources.docs_paths.join(', ')}`,
    run_in_background: false
  }),

  Task({
    subagent_type: "reality-check:code-explorer",
    prompt: `Deep codebase exploration. Exclusions: ${settings.exclusions.paths.join(', ')}`,
    run_in_background: false
  })
]);

rcState.completePhase({ scannersCompleted: 3 });
```

## Phase 4: Synthesis

After all scanners complete, launch the synthesizer:

```javascript
rcState.startPhase('synthesis');

const state = rcState.readState();

await Task({
  subagent_type: "reality-check:plan-synthesizer",
  model: "opus",
  prompt: `
Synthesize findings from all scanners:

**Issue Scanner Findings**: ${JSON.stringify(state.agents.issueScanner?.result || {})}
**Doc Analyzer Findings**: ${JSON.stringify(state.agents.docAnalyzer?.result || {})}
**Code Explorer Findings**: ${JSON.stringify(state.agents.codeExplorer?.result || {})}

Priority weights: ${JSON.stringify(settings.priority_weights)}

Create a prioritized reality-grounded plan.
  `
});

rcState.completePhase({ synthesisComplete: true });
```

## Phase 5: Report Generation

```javascript
rcState.startPhase('report-generation');

const state = rcState.readState();
const settings = rcState.readSettings();

if (settings.output.write_to_file) {
  // Write report to file
  const reportPath = settings.output.file_path;
  await Write({
    file_path: reportPath,
    content: state.report.content
  });
  console.log(`Report saved to: ${reportPath}`);
}

if (settings.output.display_summary) {
  // Display summary
  console.log(state.report.summary);
}

rcState.completePhase({ reportGenerated: true });
```

## Output Format

```markdown
## Reality Check Complete

**Scan ID**: ${scanId}
**Duration**: ${duration}

### Summary
- **Issues scanned**: ${issueCount}
- **Docs analyzed**: ${docCount}
- **Code files explored**: ${fileCount}

### Key Findings

**Drift Detected**:
${driftItems.map(d => `- ${d.description} (${d.severity})`).join('\n')}

**Gaps Identified**:
${gaps.map(g => `- ${g.description}`).join('\n')}

### Reconstructed Plan

${prioritizedPlan}

---
Full report: ${reportPath}
```

## Error Handling

```javascript
try {
  // ... scan workflow ...
} catch (error) {
  console.log(`
## Scan Failed

**Error**: ${error.message}

Run \`/reality-check:scan\` to retry.
  `);
}
```

## Success Criteria

- Settings gathered via checkboxes on first run
- Three scanner agents run in parallel
- Synthesizer combines all findings
- Report generated per output settings
- Drift and gaps clearly identified
- Prioritized reconstruction plan produced

Begin scan now.
