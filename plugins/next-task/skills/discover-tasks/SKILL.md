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

```javascript
// Use relative path from skill directory to plugin lib
// Path: skills/discover-tasks/ -> ../../lib/state/workflow-state.js
const workflowState = require('../../lib/state/workflow-state.js');

const state = workflowState.readState();
const policy = state.policy;

// Load claimed tasks from registry
const claimedTasks = workflowState.readTasks().tasks || [];
const claimedIds = new Set(claimedTasks.map(t => t.id));
```

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
```bash
# Requires 'project' token scope. If permission error: gh auth refresh -s project
gh project item-list <projectNumber> --owner <owner> --format json --limit 100 > /tmp/gh-project-items.json
```

```javascript
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('/tmp/gh-project-items.json', 'utf8'));
const items = (raw.items || []);

// Filter to ISSUE type only (exclude PULL_REQUEST, DRAFT_ISSUE)
const issues = items
  .filter(item => item.content && item.content.type === 'ISSUE')
  .map(item => ({
    number: item.content.number,
    title: item.content.title,
    body: item.content.body || '',
    labels: (item.content.labels || []),
    url: item.content.url,
    createdAt: item.content.createdAt
  }));
```

[WARN] If `gh project item-list` returns a permission error, tell the user:
`Run: gh auth refresh -s project`

**Custom Source:**
```javascript
const { sources } = require('../../lib');
const capabilities = sources.getToolCapabilities(toolName);
// Execute capabilities.commands.list_issues
```

### Phase 2.5: Collect PR-Linked Issues (GitHub only)

```javascript
// Default for non-GitHub sources - always defined so Phase 3 filter is safe
let prLinkedIssues = new Set();
```

For GitHub sources (`policy.taskSource === 'github'`, `'gh-issues'`, or `'gh-projects'`), fetch all open PRs and build a Set of issue numbers that already have an associated PR. Skip to Phase 3 for all other sources.

```bash
# Only run when policy.taskSource is 'github', 'gh-issues', or 'gh-projects'
# Note: covers up to 100 open PRs. If repo has more, some linked issues may not be excluded.
gh pr list --state open --json number,title,body,headRefName --limit 100 > /tmp/gh-prs.json
```

```javascript
const fs = require('fs');
try {
  const prs = JSON.parse(fs.readFileSync('/tmp/gh-prs.json', 'utf8') || '[]');

  for (const pr of prs) {
    // 1. Branch name suffix: fix/some-thing-123 extracts 123
    // Note: heuristic - branches like "release-2026" will false-positive on issue #2026.
    // Patterns 2 and 3 are more precise; this is a best-effort supplement.
    const branchMatch = (pr.headRefName || '').match(/-(\d+)$/);
    if (branchMatch) prLinkedIssues.add(branchMatch[1]);

    // 2. PR body closing keywords (GitHub's full keyword set, with word boundary)
    if (pr.body) {
      const bodyMatches = pr.body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi);
      for (const m of bodyMatches) prLinkedIssues.add(m[1]);
    }

    // 3. PR title (#N) convention - capture all occurrences
    const titleMatches = (pr.title || '').matchAll(/\(#(\d+)\)/g);
    for (const m of titleMatches) prLinkedIssues.add(m[1]);
  }
} catch (e) {
  console.log('[WARN] Could not parse open PRs, skipping PR-link filter:', e.message);
  prLinkedIssues = new Set();
}
```

### Phase 3: Filter and Score

**Exclude claimed tasks:**
```javascript
const available = tasks.filter(t => !claimedIds.has(String(t.number || t.id)));
```

**Exclude issues with open PRs (GitHub only):**
```javascript
const filtered = available.filter(t => {
  const id = String(t.number || t.id);
  if (prLinkedIssues.has(id)) {
    console.log(`[INFO] Skipping #${id} - already has an open PR`);
    return false;
  }
  return true;
});
```

**Apply priority filter** (pass `filtered` through scoring pipeline):
```javascript
const LABEL_MAPS = {
  bugs: ['bug', 'fix', 'error', 'defect'],
  security: ['security', 'vulnerability', 'cve'],
  features: ['enhancement', 'feature', 'improvement']
};

function filterByPriority(tasks, filter) {
  if (filter === 'continue' || filter === 'all') return tasks;
  const targetLabels = LABEL_MAPS[filter] || [];
  return tasks.filter(t => {
    const labels = (t.labels || []).map(l => (l.name || l).toLowerCase());
    return targetLabels.some(target => labels.some(l => l.includes(target)));
  });
}

const prioritized = filterByPriority(filtered, policy.priorityFilter);
// Assign score to each task so it is available for display in the UI
const topTasks = prioritized.map(t => ({ ...t, score: scoreTask(t) })).sort((a, b) => b.score - a.score);
```

**Score tasks:**
```javascript
function scoreTask(task) {
  let score = 0;
  const labels = (task.labels || []).map(l => (l.name || l).toLowerCase());

  // Priority labels
  if (labels.some(l => l.includes('critical') || l.includes('p0'))) score += 100;
  if (labels.some(l => l.includes('high') || l.includes('p1'))) score += 50;
  if (labels.some(l => l.includes('security'))) score += 40;

  // Quick wins
  if (labels.some(l => l.includes('small') || l.includes('quick'))) score += 20;

  // Age (older bugs get priority)
  if (task.createdAt) {
    const ageInDays = (Date.now() - new Date(task.createdAt)) / 86400000;
    if (labels.includes('bug') && ageInDays > 30) score += 10;
  }

  return score;
}
```

### Phase 4: Present to User via AskUserQuestion

**CRITICAL**: Labels MUST be max 30 characters (OpenCode limit).

```javascript
function truncateLabel(num, title) {
  const prefix = `#${num}: `;
  const maxLen = 30 - prefix.length;
  return title.length > maxLen
    ? prefix + title.substring(0, maxLen - 1) + '...'
    : prefix + title;
}

const options = topTasks.slice(0, 5).map(task => ({
  label: truncateLabel(task.number, task.title),
  description: `Score: ${task.score} | ${(task.labels || []).slice(0, 2).join(', ')}`
}));

AskUserQuestion({
  questions: [{
    header: "Select Task",
    question: "Which task should I work on?",
    options,
    multiSelect: false
  }]
});
```

### Phase 5: Update State

```javascript
workflowState.updateState({
  task: {
    id: String(selectedTask.number),
    source: policy.taskSource,
    title: selectedTask.title,
    description: selectedTask.body || '',
    labels: selectedTask.labels?.map(l => l.name || l) || [],
    url: selectedTask.url
  }
});

workflowState.completePhase({
  tasksAnalyzed: tasks.length,
  selectedTask: selectedTask.number
});
```

### Phase 6: Post Comment (GitHub only)

**Skip this phase entirely for non-GitHub sources (GitLab, local, custom).** Run for `github`, `gh-issues`, and `gh-projects` sources.

```bash
# Only run for GitHub sources (github, gh-issues, gh-projects). Use policy.taskSource from Phase 1 to check.
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
