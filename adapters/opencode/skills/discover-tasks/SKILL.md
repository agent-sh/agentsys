---
name: discover-tasks
description: "Use when user asks to \"discover tasks\", \"find next task\", \"prioritize issues\", \"what should I work on\", or \"list open issues\". Discovers and ranks tasks from GitHub, GitLab, local files, and custom sources."
version: 5.1.1
allowed-tools: "Bash(gh:*), Bash(glab:*), Bash(git:*), Bash(grep:*), Grep, Read, AskUserQuestion"
---

# discover-tasks

Discover tasks from configured sources, validate them, and present for user selection.

## When to Use

Invoked during Phase 2 of `/next-task` workflow, after policy selection. Also usable standalone when the user wants to discover and select tasks from configured sources.

## Workflow

### Phase 1: Load Policy and Claimed Tasks

*(JavaScript reference - not executable in OpenCode)*

### Phase 2: Fetch Tasks by Source

**Source types:**
- `github` / `gh-issues`: GitHub CLI
- `gh-projects`: GitHub Projects (v2 boards)
- `gitlab`: GitLab CLI
- `local` / `tasks-md`: Local markdown files
- `custom`: CLI/MCP/Skill tool
- `other`: Agent interprets description

**GitHub Issues:**
```bash
# Fetch with pagination awareness
gh issue list --state open \
  --json number,title,body,labels,assignees,createdAt,url \
  --limit 100 > /tmp/gh-issues.json
```

**GitLab Issues:**
```bash
glab issue list --state opened --output json --per-page 100 > /tmp/glab-issues.json
```

**Local tasks.md:**
```bash
for f in PLAN.md tasks.md TODO.md; do
  [ -f "$f" ] && grep -n '^\s*- \[ \]' "$f"
done
```

**GitHub Projects (v2):**
*(JavaScript reference - not executable in OpenCode)*

```bash
# Requires 'project' token scope. If permission error: gh auth refresh -s project
gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 100 > /tmp/gh-project-items.json
```

*(JavaScript reference - not executable in OpenCode)*

[WARN] If `gh project item-list` returns a permission error, tell the user:
`Run: gh auth refresh -s project`

**Custom Source:**
*(JavaScript reference - not executable in OpenCode)*

### Phase 2.5: Collect PR-Linked Issues (GitHub only)

*(JavaScript reference - not executable in OpenCode)*

For GitHub sources (`policy.taskSource?.source === 'github'`, `'gh-issues'`, or `'gh-projects'`), fetch all open PRs and build a Set of issue numbers that already have an associated PR. Skip to Phase 3 for all other sources.

```bash
# Only run when policy.taskSource?.source is 'github', 'gh-issues', or 'gh-projects'
# Note: covers up to 100 open PRs. If repo has more, some linked issues may not be excluded.
gh pr list --state open --json number,title,body,headRefName --limit 100 > /tmp/gh-prs.json
```

*(JavaScript reference - not executable in OpenCode)*

### Phase 3: Filter and Score

**Exclude claimed tasks:**
*(JavaScript reference - not executable in OpenCode)*

**Exclude issues with open PRs (GitHub only):**
*(JavaScript reference - not executable in OpenCode)*

**Apply priority filter** (pass `filtered` through scoring pipeline):
*(JavaScript reference - not executable in OpenCode)*

**Score tasks:**
*(JavaScript reference - not executable in OpenCode)*

### Phase 4: Present to User via AskUserQuestion

**CRITICAL**: Labels MUST be max 30 characters (OpenCode limit).

- Use AskUserQuestion tool for user input


### Phase 5: Update State

- Call `workflowState.completePhase(result)` to advance workflow state


### Phase 6: Post Comment (GitHub only)

**Skip this phase entirely for non-GitHub sources (GitLab, local, custom).** Run for `github`, `gh-issues`, and `gh-projects` sources.

```bash
# Only run for GitHub sources (github, gh-issues, gh-projects). Use policy.taskSource?.source from Phase 1 to check.
gh issue comment "$TASK_ID" --body "[BOT] Workflow started for this issue."
```

## Output Format

```markdown
## Task Selected

**Task**: #{id} - {title}
**Source**: {source}
**URL**: {url}

Proceeding to worktree setup...
```

## Error Handling

If no tasks found:
1. Suggest creating issues
2. Suggest running /audit-project
3. Suggest using 'all' priority filter

## Constraints

- MUST use AskUserQuestion for task selection (not plain text)
- Labels MUST be max 30 characters
- Exclude tasks already claimed by other workflows
- Exclude issues that already have an open PR (GitHub and GitHub Projects sources)
- PR-link detection covers up to 100 open PRs (--limit 100 is the fetch cap)
- Top 5 tasks only
