---
description: Configure reality-check settings via interactive checkboxes
argument-hint: ""
allowed-tools: Read, Write, AskUserQuestion
---

# /reality-check:set - Settings Configuration

Configure reality-check plugin settings interactively.

## Overview

This command provides an interactive way to configure the reality-check plugin. Settings are stored in `.claude/reality-check.local.md` and persist across sessions.

## Phase 1: Load Current Settings

```javascript
const rcState = require('${CLAUDE_PLUGIN_ROOT}/lib/state/reality-check-state.js');

const currentSettings = rcState.readSettings();
const hasExisting = rcState.hasSettings();

if (hasExisting) {
  console.log(`
## Current Settings

**Sources**:
- GitHub Issues: ${currentSettings.sources.github_issues ? 'Enabled' : 'Disabled'}
- Linear: ${currentSettings.sources.linear ? 'Enabled' : 'Disabled'}
- Doc paths: ${currentSettings.sources.docs_paths.join(', ')}
- Code exploration: ${currentSettings.sources.code_exploration ? 'Enabled' : 'Disabled'}

**Scan Depth**: ${currentSettings.scan_depth}

**Output**:
- Write to file: ${currentSettings.output.write_to_file ? 'Yes' : 'No'}
- File path: ${currentSettings.output.file_path}
- Display summary: ${currentSettings.output.display_summary ? 'Yes' : 'No'}

**Priority Weights**: Security(${currentSettings.priority_weights.security}), Bugs(${currentSettings.priority_weights.bugs}), Features(${currentSettings.priority_weights.features}), Docs(${currentSettings.priority_weights.docs})
  `);
}
```

## Phase 2: Present Configuration Options

Use AskUserQuestion to allow users to modify settings:

```javascript
AskUserQuestion({
  questions: [
    {
      header: "Data Sources",
      question: "Which sources should be scanned?",
      options: [
        {
          label: "GitHub Issues & PRs",
          description: currentSettings.sources.github_issues ? "Currently enabled" : "Currently disabled"
        },
        {
          label: "Documentation files",
          description: `Paths: ${currentSettings.sources.docs_paths.slice(0, 2).join(', ')}...`
        },
        {
          label: "Linear issues",
          description: currentSettings.sources.linear ? "Currently enabled" : "Currently disabled"
        },
        {
          label: "Deep code exploration",
          description: currentSettings.sources.code_exploration ? "Currently enabled" : "Currently disabled"
        }
      ],
      multiSelect: true
    },
    {
      header: "Scan Depth",
      question: "How thorough should the analysis be?",
      options: [
        {
          label: "Thorough",
          description: currentSettings.scan_depth === 'thorough' ? "Currently selected" : "Deep analysis"
        },
        {
          label: "Medium",
          description: currentSettings.scan_depth === 'medium' ? "Currently selected" : "Balanced"
        },
        {
          label: "Quick",
          description: currentSettings.scan_depth === 'quick' ? "Currently selected" : "Fast scan"
        }
      ],
      multiSelect: false
    },
    {
      header: "Output",
      question: "How should results be delivered?",
      options: [
        {
          label: "Write to file",
          description: `Save to ${currentSettings.output.file_path}`
        },
        {
          label: "Display only",
          description: "Show in conversation without saving"
        },
        {
          label: "Both",
          description: "Save file and show summary"
        }
      ],
      multiSelect: false
    }
  ]
});
```

## Phase 3: Process Responses

Map user selections to settings:

```javascript
function mapResponsesToSettings(responses, currentSettings) {
  const sources = responses['Data Sources'] || [];
  const depth = responses['Scan Depth'];
  const output = responses['Output'];

  return {
    sources: {
      github_issues: sources.includes('GitHub Issues & PRs'),
      linear: sources.includes('Linear issues'),
      docs_paths: sources.includes('Documentation files')
        ? currentSettings.sources.docs_paths
        : [],
      code_exploration: sources.includes('Deep code exploration')
    },
    scan_depth: depth?.toLowerCase() || currentSettings.scan_depth,
    output: {
      write_to_file: output === 'Write to file' || output === 'Both',
      file_path: currentSettings.output.file_path,
      display_summary: output === 'Display only' || output === 'Both'
    },
    priority_weights: currentSettings.priority_weights,
    exclusions: currentSettings.exclusions
  };
}
```

## Phase 4: Save Settings

```javascript
const newSettings = mapResponsesToSettings(responses, currentSettings);
rcState.writeSettings(newSettings);

console.log(`
## Settings Updated

**Sources**:
- GitHub Issues: ${newSettings.sources.github_issues ? 'Enabled' : 'Disabled'}
- Linear: ${newSettings.sources.linear ? 'Enabled' : 'Disabled'}
- Code exploration: ${newSettings.sources.code_exploration ? 'Enabled' : 'Disabled'}

**Scan Depth**: ${newSettings.scan_depth}

**Output**: ${newSettings.output.write_to_file ? 'File' : ''} ${newSettings.output.display_summary ? '+ Summary' : ''}

Settings saved to \`.claude/reality-check.local.md\`

Run \`/reality-check:scan\` to start a scan with these settings.
`);
```

## Advanced Configuration

For advanced settings (priority weights, exclusions, custom doc paths), users can directly edit `.claude/reality-check.local.md`:

```markdown
## Advanced Settings

To modify priority weights or exclusions, edit the YAML frontmatter in:
\`.claude/reality-check.local.md\`

Example:
\`\`\`yaml
priority_weights:
  security: 10
  bugs: 8
  features: 5
  docs: 3
exclusions:
  paths: ["node_modules/", "dist/", "vendor/"]
  labels: ["wontfix", "duplicate", "invalid"]
\`\`\`
```

## Success Criteria

- Current settings displayed if they exist
- Interactive checkboxes for common settings
- Settings saved to .local.md file
- Clear confirmation of changes
- Guidance for advanced configuration

Begin settings configuration now.
