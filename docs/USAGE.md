# Usage Guide

You shouldn't have to repeat the same requests every session. These commands handle entire workflows—from picking a task to merging a PR—with just a few interactions. You approve the plan, then the system runs autonomously.

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
| `/audit-project` | Multi-agent code review | Thorough analysis |
| `/drift-detect` | Compare docs to actual code | Plan drift detection |
| `/enhance` | Analyze prompts, plugins, agents, docs, hooks, skills | Quality improvement |
| `/sync-docs` | Sync docs with code changes | Documentation sync |
| `/perf` | Performance investigation workflow | Baselines, profiling, evidence |
| `/banthis` | Durable negative behavior memory | Persist banned agent behaviors |
| `/learn` | Research topics online, create learning guides | Topic research with RAG |
| `/consult` | Cross-tool AI consultation | Second opinion from other AI tools |
| `/debate` | Structured multi-round debate between AI tools | AI dialectic with verdict |
| `/skillers` | Workflow pattern learning and automation suggestions | Pattern extraction |
| `/skill-curator` | Create and improve reliable SKILL.md files | Skill authoring and review |
| `/system-prompt-curator` | Create and improve autonomous agent system prompts | Agent prompt curation |
| `/onboard` | Codebase onboarding - project orientation | Newcomer guidance |
| `/can-i-help` | Contributor guidance - match skills to project needs | Contributor matching |
| `/agnix` | Linter for AI agent configs | Rule validation (457 rules) |
| `/prepare-delivery` | Pre-ship validation checks; never pushes or opens a PR | Tests, build, lint verification |
| `/foreman` | GitHub issues as a task queue for native agents | Pick, claim, worktree worker, Revuto findings, land |

---

## When to Use Each Command

**Before Committing:**
```bash
/deslop apply
# Cleans up debugging code
```

**Before Creating PR:**
```bash
/audit-project
# Catches issues early
```

**Before Pushing:**
```bash
/prepare-delivery
# Runs the pre-ship gates locally; push and open the PR with your own flow
```

---

## Command Reference

### `/deslop`

Remove debugging code, old TODOs, and AI slop from your codebase with a 3-phase detection pipeline.

```bash
/deslop                    # Report mode (safe, no changes)
/deslop apply              # Apply fixes automatically
/deslop apply src/ 10      # Fix 10 issues in src/ only
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

### `/audit-project`

Comprehensive multi-agent code review that adapts to your project.

```bash
/audit-project                   # Full review with all agents
/audit-project --quick           # Single-pass review
/audit-project --domain security # Security review only
/audit-project --recent          # Only recent changes
```

**8 Specialized Roles (2 always active, 6 conditional):**

| Agent | When Active | Focus Area |
|-------|-------------|------------|
| security-expert | Always | Vulnerabilities, auth, secrets |
| performance-engineer | Always | N+1 queries, memory, blocking ops |
| test-quality-guardian | If tests exist | Coverage, edge cases, mocking |
| architecture-reviewer | If 50+ files | Modularity, patterns, SOLID |
| database-specialist | If DB detected | Queries, indexes, transactions |
| api-designer | If API detected | REST, errors, pagination |
| frontend-specialist | If frontend detected | Components, state, UX |
| devops-reviewer | If CI/CD detected | Pipelines, configs, secrets |

Only relevant agents run based on your codebase - no wasted analysis.

---

### `/sync-docs`

Sync documentation with actual code state. Find outdated references, update CHANGELOG, flag stale examples.

```bash
/sync-docs                    # Report mode (safe, no changes)
/sync-docs apply              # Apply auto-fixable issues
/sync-docs report src/        # Check docs related to src/
/sync-docs --all              # Full codebase scan
```

**Phases:**
1. Get changed files (since last commit to main, or all with `--all`)
2. Find related documentation (references to changed files)
3. Analyze issues (outdated imports, removed exports, version mismatches)
4. Check CHANGELOG (undocumented commits)
5. Report findings or apply fixes

**Auto-fixable (apply mode):**
- Outdated version numbers
- CHANGELOG entries for undocumented commits

**Flagged for manual review:**
- Removed exports referenced in docs
- Code examples that may need context updates

---

### `/perf`

Structured performance investigation with baselines, profiling, and evidence‑backed decisions.

```bash
/perf                 # Start new investigation
/perf --resume        # Resume previous investigation
```

**Phase flags (advanced):**

```bash
/perf --phase baseline --command "npm run bench" --version v1.2.0
/perf --phase breaking-point --command "npm run bench" --param-min 1 --param-max 500
/perf --phase constraints --command "npm run bench" --cpu 1 --memory 1GB
/perf --phase hypotheses --hypotheses-file perf-hypotheses.json
/perf --phase code-paths
/perf --phase optimization --change "reduce allocations"
/perf --phase decision --verdict stop --rationale "no measurable improvement"
/perf --phase consolidation --version v1.2.0
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

### Example 2: Get Code Review Before PR

**Scenario**: Finished login feature, want thorough review.

```text
You: /audit-project

Claude:
Detected: React + TypeScript project
Launching specialized review agents...

Review Complete! Found 4 issues:

CRITICAL (1):
1. Security: src/api/auth.ts:45
   Issue: Password sent in URL parameters
   Fix: Use POST body instead

HIGH (2):
2. React: src/components/LoginForm.tsx:23
   Issue: Missing useCallback (causes re-renders)

3. Testing: tests/login.test.tsx:15
   Issue: Missing test for failed login

MEDIUM (1):
4. Performance: src/hooks/useAuth.ts:10
   Issue: Expensive calculation every render

Would you like me to fix these?

You: Yes, fix all review issues

Claude:
Round 1: [OK]Fixed security issue
Round 2: [OK]Fixed React performance + added tests
Round 3: [OK]Re-verified - no open issues remain

Code is ready to ship!
```

---

### Example 3: Quick Security Audit

**Scenario**: Quick security check before release.

```text
You: /audit-project --domain security --quick

Claude:
Running focused security review...

Found 2 security issues:

CRITICAL:
1. src/api/users.js:34 - SQL Injection
   Code: db.query(`SELECT * FROM users WHERE id = ${req.params.id}`)
   Fix: Use parameterized queries

HIGH:
2. src/middleware/auth.js:12 - Weak JWT secret
   Code: jwt.sign(payload, 'secret123')
   Fix: Use env variable

Would you like me to fix these?

You: Yes, fix both

Claude:
[OK]Fixed SQL injection
[OK]Fixed JWT secret
[OK]Added JWT_SECRET to .env.example

Security issues resolved!
```

---

## Common Workflows

### Starting New Feature

```text
1. *develop feature*
2. /deslop apply      # Clean up
3. /audit-project           # Get feedback
4. /prepare-delivery         # Pre-ship gates, then push and open the PR
```

### Code Review Flow

```text
1. /audit-project --quick   # Quick check
2. Fix issues
3. /audit-project           # Full review
4. Iterate until clean
5. /prepare-delivery         # Pre-ship gates, then push and open the PR
```

### Maintenance Day

```text
1. /deslop report     # See all slop
2. /deslop apply      # Clean it up
3. /audit-project           # Full audit
```

---

## Tips for Success

### Tip 1: Start Small

Don't start with `/deslop apply` on the whole codebase!

**Try this order:**
1. `/deslop report` - Just look, no changes
2. `/deslop apply` - Make safe changes
3. `/audit-project --quick` - Quick feedback
4. `/prepare-delivery` - Run the pre-ship gates

### Tip 2: Combine Commands

```text
You: Run /deslop, then /audit-project, then /prepare-delivery

Claude:
1. Cleaning up slop... [OK]Removed 5 issues
2. Running review... [OK]Fixed 2 issues
3. Running the pre-ship gates... [OK]Ready to push

Your code is cleaned, reviewed, and ready to push!
```

### Tip 3: Use Filters

```bash
/audit-project --domain security   # Security review only
/deslop apply src/ 10        # Limit scope
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

### Comprehensive Validation

- Runs tests
- Checks types
- Validates deployments
- Monitors errors
- **Automatic rollback** if production fails

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
