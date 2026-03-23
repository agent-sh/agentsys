---
name: repo-intel
description: "Use when user asks to \"run repo intel\", \"generate repo map\", \"analyze repo\", \"query hotspots\", \"check ownership\", or \"bus factor\". Unified static analysis - git history, AST symbols, project metadata."
argument-hint: "[action] [--force]"
---

# Repo Intel Skill

Unified static analysis - git history intelligence, AST symbol mapping, and project metadata via agent-analyzer.

## Parse Arguments

```javascript
const args = '$ARGUMENTS'.split(' ').filter(Boolean);
const action = args.find(a => !a.startsWith('--')) || 'status';
const force = args.includes('--force');
```

## Primary Responsibilities

1. **Initialize** on demand (`/repo-intel init`)
2. **Update** incrementally (`/repo-intel update`)
3. **Query** git history data (`/repo-intel query hotspots`)
4. **Check status** and staleness (`/repo-intel status`)
5. **Validate output** with the map-validator agent

## Core Data Contract

Repo intel data is stored in the platform state directory:

- Claude Code: `.claude/repo-intel.json`, `.claude/repo-map.json`
- OpenCode: `.opencode/repo-intel.json`, `.opencode/repo-map.json`
- Codex CLI: `.codex/repo-intel.json`, `.codex/repo-map.json`

## Behavior Rules

- **Never** install dependencies without explicit user consent
- **Always** validate output with `map-validator` after init/update
- **Prefer** incremental update unless data is stale or history rewritten

## When to Suggest Repo Intel

If a user asks for drift detection, documentation alignment, or repo analysis and repo-intel data is missing:

```
Repo intel data not found. For better analysis, run:
  /repo-intel init
```

## Staleness Signals

- Data commit not found (rebased)
- Branch changed
- Git hooks marked stale
- Commits behind HEAD

## Output Expectations

Keep outputs concise:

- **init/update**: file count, symbol count, commit, warnings
- **query**: formatted query results
- **status**: staleness, commits behind, last updated
