# Usage Guide

You shouldn't have to repeat the same requests every session. These commands handle entire workflows - from picking an issue to landing its PR - with just a few interactions. You approve the plan, then the system runs autonomously.

**For deep dives:** See [workflow documentation](./workflows/) for phase-by-phase breakdowns.

---

## Quick Navigation

| Section | Jump to |
|---------|---------|
| [Command Overview](#command-overview) | What each command does |
| [When to Use](#when-to-use-each-command) | Quick decision guide |
| [Command Reference](#command-reference) | Detailed usage for each |
| [Real-World Examples](#real-world-examples) | See it in action |
| [Common Workflows](#common-workflows) | Typical usage patterns |
| [Tips](#tips-for-success) | Get the most out of it |

---

## Command Overview

| Command | Purpose | Scope |
|---------|---------|-------|
| `/deslop` | Clean up debugging code, TODOs | Fast codebase scan |
| `/banthis` | Durable negative behavior memory | Persist banned agent behaviors |
| `/learn` | Research topics online, create learning guides | Topic research with RAG |
| `/skillers` | Workflow pattern learning and automation suggestions | Pattern extraction |
| `/skill-curator` | Create and improve reliable SKILL.md files | Skill authoring and review |
| `/system-prompt-curator` | Create and improve autonomous agent system prompts | Agent prompt curation |
| `/agnix` | Linter for AI agent configs | Rule validation (757 rules) |
| `/foreman` | GitHub issues as a task queue for native agents | Pick, claim, worktree worker, Revuto findings, land |

---

## When to Use Each Command

**Before Committing:**
```bash
/deslop apply
# Cleans up debugging code
```

**After Editing Agent Configs:**
```bash
/agnix
# Lints SKILL.md, CLAUDE.md/AGENTS.md, hooks and MCP configs
```

**When the Repo Has a Ready Issue Queue:**
```bash
/foreman
# Picks, claims, briefs a worktree worker, reads the review and lands
```

---

## Command Reference

### `/deslop`

Remove debugging code, old TODOs, and AI slop from your codebase with a 3-phase detection pipeline.

```bash
/deslop                    # Report mode (safe, no changes)
/deslop apply              # Apply fixes automatically
/deslop apply src/         # Fix issues in src/ only
```

**Architecture:**
- **Phase 1** - Built-in regex patterns (HIGH certainty) - always runs
- **Phase 2** - Multi-pass analyzers (MEDIUM certainty) - context-aware
- **Phase 3** - Optional CLI tools (LOW certainty) - graceful degradation
  - JavaScript/TypeScript: jscpd, madge, escomplex
  - Python: pylint, radon
  - Go: golangci-lint
  - Rust: clippy

**Thoroughness levels:**
- `quick` - Phase 1 only (fastest)
- `normal` - Phase 1 + Phase 2 (default, recommended)
- `deep` - All phases if tools available (most thorough)

**Detects:**
- Console debugging (`console.log`, `print()`, `dbg!()`)
- Old TODOs and commented code
- Placeholder text, magic numbers
- Empty catch blocks, disabled linters
- Placeholder functions
- Excessive documentation
- Phantom references
- Buzzword inflation
- Code smells and over-engineering patterns

---

### `/foreman`

Work a repo's GitHub issues as a task queue: pick the next ready issue, claim it, hand it to a worktree subagent, read Revuto's findings and land the PR at the exact head it checked.

```bash
/foreman                    # Run the queue until nothing is ready
/foreman status             # Counts by label, claims and capacity
/foreman 123                # Work issue #123 only, from claim to land
```

GitHub labels, assignees and comments are the only state, read live on every command. See [workflows/FOREMAN.md](./workflows/FOREMAN.md).

---

### `/agnix`

Lint agent configurations against 757 rules.

```bash
/agnix                       # Validate current project
/agnix --fix                 # Auto-fix fixable issues
/agnix --strict              # Treat warnings as errors
```

---

## Real-World Examples

### Example 1: Clean Up Debugging Code

**Scenario**: Console.log statements and TODOs scattered in your code.

```text
You: /deslop

Claude:
Detected: Node.js project, single-branch workflow

Found 8 issues:
1. src/app.js:15 - console.log("User logged in")
2. src/app.js:42 - // TODO: Add validation
3. src/utils.js:8 - console.log("Debug:", data)
4. src/api.js:23 - // FIXME: This is hacky
5. src/api.js:67 - empty catch block
...

Would you like me to apply fixes?

You: Apply fixes, but keep the console.log in tests

Claude:
[OK]Removed 5 console.log statements
[OK]Removed 2 old TODO comments
[OK]Added logging to empty catch block
[OK]Kept test console.logs

Running tests... [OK]All tests pass
Ready to commit!
```

---

### Example 2: Lint Agent Configs

**Scenario**: You added a skill and changed CLAUDE.md.

```text
You: /agnix

Claude:
Validating: .

skills/review/SKILL.md:3 error: description is missing a trigger phrase
CLAUDE.md:41 warning: conflicting rules about commit messages

Found 1 error, 1 warning

You: Fix them

Claude:
[OK] Added a trigger phrase to the skill description
[OK] Merged the two commit-message rules
Re-run: no issues found
```

---

## Common Workflows

### Starting New Feature

```text
1. *develop feature*
2. /deslop apply      # Clean up
3. /agnix             # Lint any agent configs you touched
4. Push and open the PR with your own flow
```

### Working an Issue Queue

```text
1. Label the ready issues
2. /foreman status    # Check counts and capacity
3. /foreman           # Pick, claim, brief, review, land
```

### Maintenance Day

```text
1. /deslop report     # See all slop
2. /deslop apply      # Clean it up
3. /agnix             # Lint the agent configs
```

---

## Tips for Success

### Tip 1: Start Small

Don't start with `/deslop apply` on the whole codebase!

**Try this order:**
1. `/deslop report` - Just look, no changes
2. `/deslop apply` - Make safe changes
3. `/agnix` - Lint your agent configs

### Tip 2: Use Filters

```bash
/deslop apply src/           # Limit scope
/agnix --target claude-code  # Only Claude Code rules
```

---

## Diagnostics (Local)

When working in this repo directly, you can sanity-check detection and tooling:

```bash
npm run detect   # Platform detection (CI, deploy, project type)
npm run verify   # Tool availability + versions
```

## What Makes This Plugin Special

### Zero Configuration

No setup files. No config. Just install and use.

### Auto-Adapts to Your Project

- Detects: Node.js, Python, Rust, Go
- Detects: GitHub Actions, GitLab CI, CircleCI, Jenkins
- Detects: Railway, Vercel, Netlify, Fly.io
- Uses what you have, skips what you don't

### Evidence-Based

Every finding includes:
- File path and line number
- Actual code quote
- Specific fix suggestion
- Why it matters

---

## Platform Support

### CI Platforms
- GitHub Actions
- GitLab CI
- CircleCI
- Jenkins
- Travis CI

### Deployment Platforms
- Railway
- Vercel
- Netlify
- Fly.io
- Platform.sh
- Render

---

## Next Steps

- **Start with**: `/deslop report` - safest command, immediate value
- **For issues**: https://github.com/agent-sh/agentsys/issues
- **Contributing**: See [CONTRIBUTING.md](../CONTRIBUTING.md)
