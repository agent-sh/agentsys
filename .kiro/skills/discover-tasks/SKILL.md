---
name: discover-tasks
description: "Use when the user asks to discover tasks, find the next task, prioritize issues, or list open work. Discovers and ranks tasks from GitHub, GitHub Projects, GitLab, local task files, and custom sources."
version: 5.2.0
allowed-tools: "Bash(gh:*), Bash(glab:*), Bash(git:*), Bash(grep:*), Grep, Read, AskUserQuestion"
---

# discover-tasks

Fetch open tasks from the configured source, drop the ones someone is already on, rank the rest, and offer the top 5. Used by `task-discoverer` in `/next-task` Phase 2, and directly by users.

Input is a policy: `taskSource` (`{ source, ... }`) and `priorityFilter` (`all`, `bugs`, `security`, `features`). Standalone with no policy, ask which source to use, defaulting to GitHub issues of the current repo.

## Fetch

Fetch up to 100 open items. Write scratch files to the OS temp dir and delete them when done.

| Source | Command |
|---|---|
| `github`, `gh-issues` | `gh issue list --state open --json number,title,body,labels,assignees,createdAt,url --limit 100` |
| `gh-projects` | `gh project item-list <projectNumber> --owner <owner> --format json --limit 100`. Keep items whose `content.type` is `ISSUE`. A permission error means the token lacks the project scope: tell the user to run `gh auth refresh -s project`. |
| `gitlab` | `glab issue list --state opened --output json --per-page 100` |
| `local`, `tasks-md` | Unchecked items (`- [ ]`) in `PLAN.md`, `tasks.md`, `TODO.md`, ID is `<file stem>-<line>`, for example `todo-12` |
| `custom` | The cached tool's `list_issues` command from `getToolCapabilities(<tool>)` in `$HOME/.agentsys/plugins/next-task/lib/sources/source-cache.js` |
| `other` | Interpret the user's free-text description of where tasks live |

## Exclude

- **Claimed.** IDs in the main checkout's `<stateDir>/tasks.json` (`readTasks()` in `lib/state/workflow-state.js`) belong to another running workflow.
- **Already has an open PR** (GitHub sources). One call: `gh pr list --state open --json number,title,body,headRefName --limit 100`. An issue is linked if a PR body has a closing keyword (`close[sd]?`, `fix(e[sd])?`, `resolve[sd]?` followed by `#N`), the title has `(#N)`, or the branch ends in `-N`. The branch-suffix rule is a heuristic (a branch like `release-2026` false-matches issue 2026), so prefer the first two when they disagree.

## Filter and rank

Priority filter matches labels by substring: `bugs` = bug, fix, error, defect; `security` = security, vulnerability, cve; `features` = enhancement, feature, improvement. `all` keeps everything. If the filter leaves nothing, say so and rank the unfiltered list.

Rank by urgency, then by how quickly the task can land:

| Signal | Score |
|---|---|
| critical or p0 label | +100 |
| high or p1 label | +50 |
| security label | +40 |
| small or quick label | +20 |
| bug open more than 30 days | +10 |

Break ties with your own judgment of scope from the title and body, and say why in one line per task.

## Offer

Label each option `#<id>: <title>` cut to 30 characters (OpenCode truncates longer labels), with the score and top two labels as the description. When you can talk to the user, ask with AskUserQuestion (single select) or a numbered list in plain text. When you run as a subagent, return the ranked list instead and let the caller ask.

After a selection in standalone use, print:

```
## Task Selected
Task: #<id> - <title>
Source: <source>
URL: <url>
```

No tasks: suggest a broader priority filter, creating issues, or running `/audit-project`.
