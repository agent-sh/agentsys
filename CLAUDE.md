# agentsys

> A modular runtime and orchestration system for AI agents - works with Claude Code, OpenCode, and Codex CLI

## Critical Rules

1. **Plain text output** - No emojis, no ASCII art. Use `[OK]`, `[ERROR]`, `[WARN]`, `[CRITICAL]` for status markers.
2. **No unnecessary files** - Don't create summary files, plan files, audit files, or temp docs.
3. **Task is not done until tests pass** - Every feature/fix must have quality tests.
4. **Create PRs for non-trivial changes** - No direct pushes to main.
5. **Always run git hooks** - Never bypass pre-commit or pre-push hooks.
6. **Use single dash for em-dashes** - In prose, use ` - ` (single dash with spaces), never ` -- `.
7. **Report script failures before manual fallback** - When any project script fails (npm test/run/build, scripts/*, agentsys-dev, node bin/dev-cli.js), you MUST:
   - Report the failure with exact error output to the user
   - Diagnose the root cause of the failure
   - Fix the script/tooling issue, not work around it manually
   - NEVER silently fall back to doing the work by hand
8. **Token efficiency** - Be concise. Save tokens over decorations.

## Model Selection

| Model | When to Use |
|-------|-------------|
| **Opus** | Complex reasoning, analysis, planning |
| **Sonnet** | Validation, pattern matching, most agents |
| **Haiku** | Mechanical execution, no judgment needed |

## Core Priorities

1. User DX (plugin users first)
2. Worry-free automation
3. Token efficiency
4. Quality output
5. Simplicity

## Commands

- `/next-task` - Task workflow: discovery, implementation, PR, merge
- `/ship` - PR creation, CI monitoring, merge
- `/enhance` - Run enhancement analyzers
- `/audit-project` - Multi-agent code review
- `/deslop` - Clean AI slop patterns
- `/drift-detect` - Compare plan vs implementation
- `/perf` - Performance investigation
- `/repo-map` - Generate AST-based repo map
- `/sync-docs` - Update documentation to match code

## Dev Commands

```bash
npm test          # Run tests
npm run validate  # All validators
```

## References

- Part of the [agentsys](https://github.com/agent-sh/agentsys) ecosystem
- https://agentskills.io
