---
name: discover-tasks
description: "Use when user asks to \"discover tasks\", \"find next task\", or \"prioritize issues\". Discovers and ranks tasks from GitHub, GitLab, local files, and custom sources."
version: 5.1.1
---

# discover-tasks

Discover tasks from configured sources, validate them, and present for user selection.

## Workflow

### Phase 1: Load Policy and Claimed Tasks

*(JavaScript reference - not executable in OpenCode)*

### Phase 2: Fetch Tasks by Source

**Source types:**
- `github` / `gh-issues`: GitHub CLI
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

**Custom Source:**
*(JavaScript reference - not executable in OpenCode)*

### Phase 2.5: Collect PR-Linked Issues (GitHub only)

For GitHub sources, fetch all open PRs and build a Set of issue numbers that already have an associated PR. For non-GitHub sources, set `prLinkedIssues` to an empty Set and skip this phase.

```bash
gh pr list --state open --json number,title,body,headRefName --limit 100 > /tmp/gh-prs.json
```

*(JavaScript reference - not executable in OpenCode)*

### Phase 3: Filter and Score

**Exclude claimed tasks:**
*(JavaScript reference - not executable in OpenCode)*

**Exclude issues with open PRs (GitHub only):**
*(JavaScript reference - not executable in OpenCode)*

**Apply priority filter:**
*(JavaScript reference - not executable in OpenCode)*

**Score tasks:**
*(JavaScript reference - not executable in OpenCode)*

### Phase 4: Present to User via AskUserQuestion

**CRITICAL**: Labels MUST be max 30 characters (OpenCode limit).

- Use AskUserQuestion tool for user input


### Phase 5: Update State

- Call `workflowState.completePhase(result)` to advance workflow state


### Phase 6: Post Comment (GitHub only)

```bash
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
- Exclude issues that already have an open PR (GitHub source only)
- Top 5 tasks only
