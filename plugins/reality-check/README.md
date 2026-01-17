# reality-check

Deep repository analysis to realign project plans with actual code reality.

## Overview

The reality-check plugin performs comprehensive analysis of your codebase to identify drift between documented plans and actual implementation. It scans GitHub issues, documentation files, and code structure to produce a prioritized reconstruction plan.

## Features

- **Multi-source scanning**: Analyzes GitHub issues, documentation, and codebase in parallel
- **Drift detection**: Identifies where plans have diverged from reality
- **Gap analysis**: Finds missing tests, documentation, and implementation
- **Priority ranking**: Uses configurable weights to prioritize work items
- **Interactive setup**: First-run wizard with checkbox configuration
- **Configurable settings**: Persistent settings in `.claude/reality-check.local.md`

## Commands

### `/reality-check:scan`

Run a comprehensive reality check scan.

```
/reality-check:scan
```

On first run, presents interactive checkboxes to configure:
- Data sources (GitHub issues, docs, Linear, code exploration)
- Scan depth (quick, medium, thorough)
- Output format (file, display, both)

### `/reality-check:set`

Configure or update settings interactively.

```
/reality-check:set
```

## Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| `issue-scanner` | Scans GitHub issues, PRs, milestones | sonnet |
| `doc-analyzer` | Analyzes documentation files | sonnet |
| `code-explorer` | Deep codebase structure analysis | sonnet |
| `plan-synthesizer` | Combines findings, creates plan | opus |

## Workflow

```
/reality-check:scan
        │
        ▼
┌───────────────────┐
│  Settings Check   │ ← First-run setup if needed
└───────────────────┘
        │
        ├──────────────────┬──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Issue Scanner│   │ Doc Analyzer │   │ Code Explorer│
└──────────────┘   └──────────────┘   └──────────────┘
        │                  │                  │
        └──────────────────┴──────────────────┘
                           │
                           ▼
                ┌──────────────────┐
                │ Plan Synthesizer │
                └──────────────────┘
                           │
                           ▼
              Prioritized Reality Report
```

## Configuration

Settings are stored in `.claude/reality-check.local.md`:

```yaml
---
sources:
  github_issues: true
  linear: false
  docs_paths: ["docs/", "README.md", "CLAUDE.md"]
  code_exploration: true
scan_depth: thorough
output:
  write_to_file: true
  file_path: "reality-check-report.md"
  display_summary: true
priority_weights:
  security: 10
  bugs: 8
  features: 5
  docs: 3
exclusions:
  paths: ["node_modules/", "dist/"]
  labels: ["wontfix", "duplicate"]
---
```

## Output

The scan produces:

1. **Drift Analysis**: Where plans diverge from reality
2. **Gap Analysis**: Missing tests, docs, implementation
3. **Cross-Reference**: Documented vs. implemented features
4. **Reconstruction Plan**: Prioritized action items

### Example Output

```markdown
## Reality Check Complete

### Summary
- Drift Areas: 4
- Gaps Found: 7
- Critical Items: 2
- Aligned Features: 8

### Immediate Actions (This Week)
1. Address 3 open security vulnerabilities
2. Fix stale milestone "v2.0" (45 days overdue)

### Short-Term (This Month)
1. Add test coverage (0% currently)
2. Update outdated documentation
3. Close 8 stale priority issues
```

## Skills

### reality-analysis

Provides knowledge for:
- Drift detection patterns
- Prioritization framework
- Cross-reference matching
- Output templates

## Requirements

- GitHub CLI (`gh`) for issue scanning
- Git repository
- Node.js for state management

## Installation

The plugin is part of the awsome-slash marketplace. Enable it in your Claude Code settings.

## License

MIT
