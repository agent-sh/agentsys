# New Slash Command Checklist

Adding a new slash command (e.g., `/my-command`).

## Best Practices Reference

- **Prompt Design**: `agent-docs/PROMPT-ENGINEERING-REFERENCE.md`
- **Cross-Model Compatibility**: `lib/cross-platform/RESEARCH.md`

## 1. Create Command File

Location: `plugins/{plugin-name}/commands/{command-name}.md`

```markdown
---
description: Short description for implicit invocation (max 500 chars)
---

# /command-name - Title

Brief description of what the command does.

## Arguments

- `--flag`: Description
- `[optional]`: Description

## Workflow

1. Step one
2. Step two

## Output Format

Describe expected output.
```

**Guidelines:**
- Keep description under 500 chars (token efficiency)
- Use imperative instructions ("Do X", not "You should do X")
- Include examples for complex operations
- Reference lib modules with Windows-safe paths:
  ```javascript
  // CORRECT
  const module = require('${CLAUDE_PLUGIN_ROOT}'.replace(/\\/g, '/') + '/lib/module.js');

  // WRONG (breaks on Windows)
  const module = require('${CLAUDE_PLUGIN_ROOT}/lib/module.js');
  ```

## 2. Update Plugin Manifest

File: `plugins/{plugin-name}/.claude-plugin/plugin.json`

Add command to the plugin's command list if needed.

## 3. Update Marketplace

File: `.claude-plugin/marketplace.json`

If it's a new plugin or major command:
```json
{
  "name": "plugin-name",
  "description": "Updated description mentioning new command"
}
```

## 4. Verify Auto-Discovery

Commands are automatically discovered from the filesystem by `lib/discovery/`. No manual registration needed.

The installer (`bin/cli.js`) scans:
- `plugins/<name>/commands/*.md` → Commands
- `plugins/<name>/agents/*.md` → Agents
- `plugins/<name>/skills/*/SKILL.md` → Skills

For Codex trigger phrases, add `codex-description` to command frontmatter:

```yaml
---
description: Short description for Claude Code
codex-description: 'Use when user asks to "trigger1", "trigger2". What it does.'
---
```

**CRITICAL for Codex:** The description MUST include trigger phrases like:
- `'Use when user asks to "find bugs", "review code", "check quality"...'`
- Without trigger phrases, Codex won't know when to invoke the skill

## 5. Update Documentation

- [ ] `docs/ARCHITECTURE.md` → Add to commands list if significant
- [ ] `README.md` → Add to Available Commands section
- [ ] `CHANGELOG.md` → Note the addition

## 6. Cross-Platform Compatibility

**Reference:** `checklists/cross-platform-compatibility.md`

### OpenCode Requirements
- [ ] All `AskUserQuestion` labels ≤30 characters
- [ ] Use `${PLUGIN_ROOT}` not `${CLAUDE_PLUGIN_ROOT}` in command file
- [ ] Use `AI_STATE_DIR` env var for state paths, not hardcoded `.claude/`

### Codex Requirements
- [ ] Skill description has trigger phrases (see step 4)
- [ ] YAML frontmatter will be escaped automatically by installer

### Code Patterns
```javascript
// CORRECT - Works on all platforms
const pluginRoot = process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT;
const stateDir = process.env.AI_STATE_DIR || '.claude';

// WRONG - Only works on Claude Code
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
const stateDir = '.claude';
```

## 7. Run Quality Validation

```bash
# Run /enhance on the new command
/enhance plugins/{plugin-name}/commands/new-command.md

# Run tests
npm test
```

## 8. Test Cross-Platform

```bash
# Rebuild package
npm pack

# Test installation
npm install -g ./agentsys-*.tgz
echo "1 2 3" | agentsys  # Install all platforms

# Verify command exists
# Claude Code: /new-command
# OpenCode: /new-command
# Codex CLI: $new-command
# Cursor: auto-loaded from .cursor/commands/
```

## 9. Sync Library (if command uses lib/)

```bash
./scripts/sync-lib.sh
# Or: agentsys-dev sync-lib
```

## Quick Reference

| Platform | Invocation | Label Limit | Trigger Phrases |
|----------|------------|-------------|-----------------|
| Claude Code | `/command` | No limit | Not needed |
| OpenCode | `/command` | **30 chars** | Not needed |
| Codex CLI | `$command` | No limit | **Required** |
| Cursor | Auto-applied | No limit | Not needed |
