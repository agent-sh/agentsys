# Contributing to AgentSys

## Approval Process

**All PRs require approval from the repo owner (@avifenesh).** There are no other maintainers.

PRs may receive AI-assisted reviews (Copilot, Claude, Gemini, Codex) at the owner's discretion. **If you receive review comments, you must address ALL of them before merge** - no exceptions.

---

## What Matters Here

**This is a plugin for OTHER projects** - workflow automation for Claude Code, Codex CLI, and OpenCode users.

### Core Priorities (In Order)

1. **User DX** - Experience when using this plugin in external projects
2. **Worry-free automation** - Users trust the plugin to run autonomously
3. **Token efficiency** - Agents should be efficient, not verbose
4. **Quality output** - Code written by agents must be production-ready
5. **Simplicity** - Remove complexity that doesn't serve users

### What To Avoid

- **Overengineering** - No config systems nobody asked for
- **Internal tooling** - Don't optimize for developing THIS repo
- **Complexity creep** - Every abstraction must justify itself
- **Summary files** - No `*_AUDIT.md`, `*_SUMMARY.md` - clutter

---

## Before You Start

### Multi-File Changes

For changes touching multiple files, **read the relevant checklist first**:

| Change Type | Checklist |
|-------------|-----------|
| New slash command | `checklists/new-command.md` |
| New agent | `checklists/new-agent.md` |
| New lib module | `checklists/new-lib-module.md` |

### Library Architecture

`lib/` is the canonical source. Plugins get copies.

```bash
# Edit in lib/
vim lib/patterns/pipeline.js

# Sync to all plugins
./scripts/sync-lib.sh
# Or: agentsys-dev sync-lib

# Commit both
git add lib/ plugins/*/lib/
git commit -m "fix(lib): description"
```

### Adapter Generation

Platform adapters (`adapters/opencode/`, `adapters/codex/`) are auto-generated from plugin source.
Files with `AUTO-GENERATED` headers must not be manually edited.

After changing plugins, regenerate adapters:

```bash
npm run gen-adapters
# Or: npx agentsys-dev gen-adapters
```

CI validates adapter freshness on every push.

---

## Pull Request Process

### 1. Create PR

```bash
git checkout -b feature/your-change
# make changes
npm test
git add -A && git commit -m "feat(scope): description"
git push -u origin feature/your-change
gh pr create --base main
```

### 2. Address Review Comments

Every comment must be addressed:
- **Critical/High** → Fix immediately
- **Medium/Minor** → Fix (shows quality)
- **Questions** → Answer with explanation
- **False positives** → Reply explaining why, then resolve

**Never ignore a comment. Never leave threads unresolved.**

### 3. Iterate Until Clean

Repeat until:
- [ ] CI passes
- [ ] Zero unresolved comment threads
- [ ] No "changes requested" reviews

### 4. Owner Review

Once clean, the repo owner will review and merge.

---

## Coding Standards

### Keep It Simple

- Flat data structures over nested objects
- No abstractions until needed three times
- Delete unused code completely
- One file doing one thing well

### JavaScript

- ES2020+, `const` over `let`
- async/await over callbacks
- Handle errors explicitly
- JSDoc for exports

### Agent Prompts

- Concise - every token costs
- Specific - vague prompts waste iterations
- Constrained - prevent scope creep

---

## Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] CHANGELOG.md updated
- [ ] Checklist read (if multi-file change)
- [ ] All review comments addressed
- [ ] No unnecessary complexity

---

## Getting Help

- **Questions**: [Discussions](https://github.com/agent-sh/agentsys/discussions)
- **Bugs**: [Issues](https://github.com/agent-sh/agentsys/issues)
