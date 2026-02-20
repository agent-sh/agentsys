---
description: Use when user asks to 'lint agent configs', 'validate skills', 'check CLAUDE.md', 'validate hooks', 'lint MCP', or mentions 'agent config issues', 'skill validation'.
codex-description: 'Use when user asks to "lint agent configs", "validate skills", "check CLAUDE.md", "validate hooks", "lint MCP". Validates agent configuration files against 155 rules across 10+ AI tools.'
argument-hint: "[path] [--fix] [--strict] [--target [target]]"
allowed-tools: Task, Read
---

# /agnix - Agent Config Linter

Lint agent configurations before they break your workflow. Validates Skills, Hooks, MCP, Memory, Plugins across Claude Code, Cursor, GitHub Copilot, and Codex CLI.

## Arguments

Parse from $ARGUMENTS or use defaults:

- **Path**: Target path (default: `.`)
- **--fix**: Auto-fix issues
- **--strict**: Treat warnings as errors
- **--target**: `claude-code`, `cursor`, `codex`, or `generic` (default)

## Execution

### Phase 1: Spawn Agnix Agent

```javascript
const args = '$ARGUMENTS'.split(' ').filter(Boolean);
const fix = args.includes('--fix');
const strict = args.includes('--strict');

// Parse --target (supports both --target=value and --target value forms)
const allowedTargets = ['claude-code', 'cursor', 'codex', 'generic'];
let rawTarget = 'generic';
const targetEqIdx = args.findIndex(a => a.startsWith('--target='));
const targetSpaceIdx = args.findIndex(a => a === '--target');
if (targetEqIdx !== -1) {
  rawTarget = args[targetEqIdx].split('=')[1] || 'generic';
} else if (targetSpaceIdx !== -1 && args[targetSpaceIdx + 1] && !args[targetSpaceIdx + 1].startsWith('-')) {
  rawTarget = args[targetSpaceIdx + 1];
}
const target = allowedTargets.includes(rawTarget) ? rawTarget : 'generic';

// Parse path - exclude flags and --target's value, sanitize to prevent injection
const excludeIndices = new Set([targetSpaceIdx, targetSpaceIdx + 1].filter(i => i >= 0));
const path = (args.find((a, i) => !a.startsWith('-') && !excludeIndices.has(i)) || '.').replace(/[\n\r]/g, '');

const result = await Task({
  subagent_type: "agnix:agnix-agent",
  prompt: `Validate agent configurations.
Path: ${path}
Fix: ${fix}
Strict: ${strict}
Target: ${target}

Return structured results between === AGNIX_RESULT === markers.`
});
```

### Phase 2: Parse Agent Results

Extract structured JSON from agent output:

```javascript
function parseAgnix(output) {
  const match = output.match(/=== AGNIX_RESULT ===[\s\S]*?({[\s\S]*?})[\s\S]*?=== END_RESULT ===/);
  return match ? JSON.parse(match[1]) : { errors: 0, warnings: 0, diagnostics: [] };
}

const findings = parseAgnix(result);
```

### Phase 3: Present Results

#### No Issues

```markdown
## Validation Passed

No issues found in agent configurations.

- Files validated: N
- Target: {target}
```

#### Issues Found

```markdown
## Agent Config Issues

| File | Line | Level | Rule | Message |
|------|------|-------|------|---------|
| SKILL.md | 3 | error | AS-004 | Invalid name |
| CLAUDE.md | 15 | warning | PE-003 | Generic instruction |

## Summary

- **Errors**: N
- **Warnings**: N
- **Fixable**: N

## Do Next

- [ ] Run `/agnix --fix` to auto-fix {fixable} issues
- [ ] Review remaining issues manually
```

#### After Fix

```markdown
## Fixed Issues

| File | Line | Rule | Fix Applied |
|------|------|------|-------------|
| SKILL.md | 3 | AS-004 | Renamed to lowercase |

**Fixed**: N issues
**Remaining**: N issues (manual review needed)
```

## Supported Files

| File Type | Examples |
|-----------|----------|
| Skills | `SKILL.md` |
| Memory | `CLAUDE.md`, `AGENTS.md` |
| Hooks | `${STATE_DIR}/settings.json` (Claude: .claude/, OpenCode: .opencode/, Codex: .codex/) |
| MCP | `*.mcp.json` |
| Cursor | `.cursor/rules/*.mdc` |
| Copilot | `.github/copilot-instructions.md` |

## Error Handling

- **agnix not installed**: Show install command `cargo install agnix-cli`
- **Invalid path**: Exit with "Path not found: [path]"
- **Parse errors**: Show raw agnix output

## Links

- [agnix GitHub](https://github.com/agent-sh/agnix)
- [Rules Reference](https://github.com/agent-sh/agnix/blob/main/knowledge-base/VALIDATION-RULES.md)
