# Usage Guide

Complete guide to using awesome-slash commands with real-world examples.

---

## Command Overview

| Command | Purpose | Time |
|---------|---------|------|
| `/deslop-around` | Clean up debugging code, TODOs | 30-60 sec |
| `/next-task` | Find and implement prioritized tasks | 10-30 min |
| `/project-review` | Multi-agent code review | 2-5 min |
| `/ship` | Complete PR workflow to production | 5-15 min |

---

## When to Use Each Command

**Starting Your Day:**
```
/next-task
# Shows prioritized tasks from GitHub issues
```

**Before Committing:**
```
/deslop-around apply
# Cleans up debugging code
```

**Before Creating PR:**
```
/project-review
# Catches issues early
```

**Ready to Deploy:**
```
/ship
# Handles everything: PR, CI, merge, deploy, validate
```

---

## Command Reference

### `/deslop-around`

Remove debugging code, old TODOs, and AI slop from your codebase.

```bash
/deslop-around                    # Report mode (safe, no changes)
/deslop-around apply              # Apply fixes automatically
/deslop-around apply src/ 10      # Fix 10 issues in src/ only
```

**Detects:**
- Console debugging (`console.log`, `print()`, `dbg!()`)
- Old TODOs and commented code
- Placeholder text, magic numbers
- Empty catch blocks, disabled linters

---

### `/next-task`

Complete task-to-production automation with state management.

```bash
/next-task                        # Start new workflow with policy selection
/next-task --status               # Check current workflow state
/next-task --resume               # Resume from last checkpoint
/next-task --abort                # Cancel workflow and cleanup
/next-task bug                    # Filter by task type
/next-task --implement            # Start implementing selected task
```

**13-Phase Workflow:**
1. Policy Selection → Ask user preferences
2. Task Discovery → Find and prioritize tasks
3. Worktree Setup → Create isolated environment
4. Exploration → Deep codebase analysis
5. Planning → Design implementation plan
6. **User Approval → Get plan approval (LAST human interaction)**
7. Implementation → Execute the plan
8. Pre-Review Gates → deslop-work + test-coverage-checker
9. Review Loop → Multi-agent review until approved
10. Delivery Validation → Autonomous completion check
11. Docs Update → Auto-update documentation
12. Ship → PR creation, CI monitoring, merge
13. Cleanup → Remove worktree, update state

---

### `/project-review`

Comprehensive multi-agent code review.

```bash
/project-review                   # Full review with all agents
/project-review --quick           # Single-pass review
/project-review --domain security # Security review only
/project-review --recent          # Only recent changes
```

**8 Specialized Agents:**
- Security
- Performance
- Architecture
- Testing
- Error Handling
- Code Quality
- Type Safety
- Documentation

---

### `/ship`

Complete PR workflow from commit to production.

```bash
/ship                             # Full workflow
/ship --dry-run                   # Preview without executing
/ship --strategy rebase           # Use rebase instead of squash
/ship --state-file PATH           # Integrate with next-task workflow
```

**12-Phase Workflow:**
1. Pre-flight checks and platform detection
2. Commit with AI-generated message
3. Create PR with context
4. Wait for CI
5. Multi-agent review
6. Merge PR
7. Deploy to development
8. Validate development
9. Deploy to production
10. Validate production
11. Cleanup
12. Completion report

---

## Real-World Examples

### Example 1: Clean Up Debugging Code

**Scenario**: Console.log statements and TODOs scattered in your code.

```
You: /deslop-around

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
✓ Removed 5 console.log statements
✓ Removed 2 old TODO comments
✓ Added logging to empty catch block
✓ Kept test console.logs

Running tests... ✓ All tests pass
Ready to commit!
```

---

### Example 2: Find What to Work On Next

**Scenario**: 20 GitHub issues, need to prioritize.

```
You: /next-task

Claude:
Analyzing tasks from GitHub Issues...
Found 20 open issues

Top 5 Priority Tasks:

1. [P1] Fix authentication timeout bug (#142)
   Status: Not implemented
   Priority Score: 85
   Estimated effort: Small (30 minutes)
   Files: src/auth/session.ts

2. [P2] Add dark mode to settings (#89)
   Status: Partially done
   Priority Score: 60
   Estimated effort: Medium (2 hours)
   Files: src/components/Settings.tsx

Which task would you like to work on?

You: /next-task --implement

Claude:
Creating branch: fix/auth-timeout-bug-142
Investigating implementation...
Found issue: Session timeout hardcoded to 5 minutes

Implementing fix...
✓ Fix implemented
✓ Tests written and passing
✓ Ready to ship
```

---

### Example 3: Get Code Review Before PR

**Scenario**: Finished login feature, want thorough review.

```
You: /project-review

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

You: Yes, fix critical and high priority

Claude:
Round 1: ✓ Fixed security issue
Round 2: ✓ Fixed React performance + added tests
Round 3: ✓ Re-verified - no critical issues remain

Code is ready to ship!
```

---

### Example 4: Ship Feature to Production

**Scenario**: Feature finished, want to deploy.

```
You: /ship

Claude:
Starting complete PR workflow...

Phase 1: Pre-flight checks
✓ Detected: GitHub Actions CI
✓ Detected: Railway deployment
✓ On branch: feature/add-dark-mode

Phase 2: Committing
Generated commit: "feat(ui): add dark mode toggle"
✓ Committed as: abc123f

Phase 3: Creating PR
✓ Created PR #156
URL: https://github.com/youruser/repo/pull/156

Phase 4: Waiting for CI...
✓ All checks passed (2m 34s)

Phase 5: Review agents...
✓ code-reviewer: approved
✓ test-analyzer: approved (95% coverage)

Phase 6: Merging
✓ Merged PR #156 to main

Phase 7-8: Deploying to development...
✓ Deployed to: https://app-dev.railway.app
✓ Validation passed

Phase 9-10: Deploying to production...
✓ Deployed to: https://app.railway.app
✓ Production healthy

✓ DEPLOYMENT COMPLETE!
Total time: 8 minutes
```

---

### Example 5: Quick Security Audit

**Scenario**: Quick security check before release.

```
You: /project-review --domain security --quick

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
✓ Fixed SQL injection
✓ Fixed JWT secret
✓ Added JWT_SECRET to .env.example

Security issues resolved!
```

---

## Common Workflows

### Starting New Feature

```
1. /next-task --implement    # Pick task and start
2. *develop feature*
3. /deslop-around apply      # Clean up
4. /project-review           # Get feedback
5. /ship                     # Deploy
```

### Code Review Flow

```
1. /project-review --quick   # Quick check
2. Fix issues
3. /project-review           # Full review
4. Iterate until clean
5. /ship                     # Deploy
```

### Maintenance Day

```
1. /deslop-around report     # See all slop
2. /deslop-around apply      # Clean it up
3. /next-task                # See priorities
4. /project-review           # Full audit
```

### Ship Your Work

```
1. /ship --dry-run           # Preview
2. /ship                     # Full workflow
```

---

## Tips for Success

### Tip 1: Start Small

Don't start with `/ship` on production immediately!

**Try this order:**
1. `/deslop-around report` - Just look, no changes
2. `/next-task` - See task prioritization
3. `/deslop-around apply` - Make safe changes
4. `/project-review --quick` - Quick feedback
5. `/ship --dry-run` - Preview the workflow
6. `/ship` - Full deployment

### Tip 2: Let Claude Explain

```
You: Can you explain what /ship will do in my project?

Claude: *analyzes your project*
I see you have:
- GitHub Actions CI
- Railway deployment
- Single-branch workflow

Here's what /ship will do:
1. Commit your changes
2. Create PR to main
3. Wait for GitHub Actions
4. Run code review
5. Merge to main
6. Railway auto-deploys
7. Validate deployment
```

### Tip 3: Combine Commands

```
You: Run /deslop-around, then /project-review, then /ship

Claude:
1. Cleaning up slop... ✓ Removed 5 issues
2. Running review... ✓ Fixed 2 issues
3. Shipping to production... ✓ Complete!

Your code is cleaned, reviewed, and deployed!
```

### Tip 4: Use Filters

```
/next-task bug              # Focus on bugs only
/project-review --domain security   # Security review only
/deslop-around apply src/ 10        # Limit scope
```

---

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

- **Start with**: `/deslop-around report` - safest command, immediate value
- **For issues**: https://github.com/avifenesh/awesome-slash/issues
- **Contributing**: See [CONTRIBUTING.md](../CONTRIBUTING.md)
