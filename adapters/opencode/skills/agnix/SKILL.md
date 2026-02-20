---
name: agnix
description: "Use when user asks to 'lint agent configs', 'validate skills', 'check CLAUDE.md', 'validate hooks', 'lint MCP'. Validates agent configuration files against 155 rules across 10+ AI tools."
version: 5.1.0
argument-hint: "[path] [--fix] [--strict] [--target=claude-code|cursor|codex]"
---

> **OpenCode Note**: Invoke agents using `@agent-name` syntax.
> Available agents: task-discoverer, exploration-agent, planning-agent,
> implementation-agent, deslop-agent, delivery-validator, sync-docs-agent, consult-agent
> Example: `@exploration-agent analyze the codebase`


# agnix

Lint agent configurations before they break your workflow. Validates Skills, Hooks, MCP, Memory, Plugins across 10+ AI tools including Claude Code, Cursor, GitHub Copilot, Codex CLI, OpenCode, Gemini CLI, Cline, Windsurf, Kiro, and Amp.

## Parse Arguments

*(JavaScript reference - not executable in OpenCode)*

## When to Use

Invoke when user asks to:
- "Lint my agent configs"
- "Validate my skills"
- "Check my CLAUDE.md"
- "Validate hooks"
- "Lint MCP configs"
- "Fix agent configuration issues"
- "Check if my SKILL.md is correct"

## Prerequisites

agnix must be installed. Check with:
```bash
agnix --version
```

If not installed:
```bash
cargo install agnix-cli
```

## Execution

### 1. Validate Project

```bash
agnix .
```

### 2. If Issues Found and Fix Requested

```bash
agnix --fix .
```

### 3. Re-validate to Confirm

```bash
agnix .
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `agnix .` | Validate current project |
| `agnix --fix .` | Auto-fix issues |
| `agnix --strict .` | Treat warnings as errors |
| `agnix --target claude-code .` | Only Claude Code rules |
| `agnix --target cursor .` | Only Cursor rules |
| `agnix --watch .` | Watch mode - re-validate on changes |
| `agnix --format json .` | JSON output |
| `agnix --format sarif .` | SARIF for GitHub Code Scanning |

## Supported Files

| File Type | Examples |
|-----------|----------|
| Skills | `SKILL.md` |
| Memory | `CLAUDE.md`, `AGENTS.md` |
| Hooks | `${STATE_DIR}/settings.json` |
| MCP | `*.mcp.json` |
| Cursor | `.cursor/rules/*.mdc` |
| Copilot | `.github/copilot-instructions.md` |

## Output Format

```
CLAUDE.md:15:1 warning: Generic instruction 'Be helpful' [fixable]
  help: Remove generic instructions. Claude already knows this.

skills/review/SKILL.md:3:1 error: Invalid name [fixable]
  help: Use lowercase letters and hyphens only

Found 1 error, 1 warning (2 fixable)
```

Exit codes:
- `0` - No errors (warnings allowed)
- `1` - Errors found
- `2` - Invalid arguments

## Rule Categories

| Prefix | Category | Examples |
|--------|----------|----------|
| AS-* | Agent Skills | Name format, triggers, description |
| CC-* | Claude Code | Hooks, memory, plugins |
| MCP-* | MCP Protocol | Server config, tool definitions |
| PE-* | Prompt Engineering | Generic instructions, redundancy |
| XP-* | Cross-Platform | Compatibility across tools |
| AGM-* | AGENTS.md | Structure, sections |
| COP-* | GitHub Copilot | Instructions format |
| CUR-* | Cursor | MDC format, rules |

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Invalid skill name | Use lowercase with hyphens: `my-skill` |
| Directory/name mismatch | Rename directory to match `name:` field |
| Generic instructions | Remove "be helpful", "be accurate" |
| Missing trigger phrase | Add "Use when..." to description |

## Integration

This skill is standalone and can be invoked directly via `/agnix`.

For CI integration, see the [GitHub Action](https://github.com/agent-sh/agnix#github-action).

## Links

- [GitHub](https://github.com/agent-sh/agnix)
- [Rules Reference](https://github.com/agent-sh/agnix/blob/main/knowledge-base/VALIDATION-RULES.md)
- [Configuration](https://github.com/agent-sh/agnix/blob/main/docs/CONFIGURATION.md)
