---
name: repo-mapping
description: "Use when user asks to \"create repo map\", \"generate repo map\", \"update repo map\", \"repo map status\", or \"map symbols/imports\". Builds and validates an AST-based repo map using ast-grep."
---

# Repo Mapping Skill

Build and maintain a cached AST-based map of repository symbols and imports using ast-grep.

## Primary Responsibilities

1. **Generate map** on demand (`/repo-map init`)
2. **Update map** incrementally (`/repo-map update`)
3. **Check status** and staleness (`/repo-map status`)
4. **Validate output** with the map-validator agent

## Core Data Contract

Repo map is stored in the platform state directory:

- Claude Code: `.claude/repo-map.json`
- OpenCode: `.opencode/repo-map.json`
- Codex CLI: `.codex/repo-map.json`

Minimal structure:

```json
{
  "version": "1.0.0",
  "generated": "2026-01-25T12:00:00Z",
  "updated": "2026-01-25T12:05:00Z",
  "git": { "commit": "abc123", "branch": "main" },
  "project": { "languages": ["typescript", "python"] },
  "stats": { "totalFiles": 142, "totalSymbols": 847 },
  "files": {
    "src/auth/login.ts": {
      "hash": "deadbeef1234abcd",
      "language": "typescript",
      "symbols": { "exports": [], "functions": [], "classes": [] },
      "imports": [ { "source": "./utils", "kind": "named" } ]
    }
  }
}
```

## Behavior Rules

- **Never** run ast-grep without user approval if it is not installed
- **Never** install dependencies without explicit user consent
- **Always** validate map output with `map-validator` after init/update
- **Prefer** incremental update unless map is stale or history rewritten

## When to Suggest Repo Map

If a user asks for drift detection, documentation alignment, or repo analysis and repo-map is missing:

```
Repo map not found. For better analysis, run:
  /repo-map init
```

## Staleness Signals

- Map commit not found (rebased)
- Branch changed
- Git hooks marked stale
- Commits behind HEAD

## Output Expectations

Keep outputs concise:

- **init/update**: file count, symbol count, commit, warnings
- **status**: staleness, commits behind, last updated
