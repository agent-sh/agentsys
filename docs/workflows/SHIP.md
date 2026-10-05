# /ship Workflow

Complete technical reference for the `/ship` workflow, from the ship plugin pinned in `.claude-plugin/marketplace.json`.

**TL;DR:** Takes the current branch to a merged PR, and on multi-branch repos through a validated production deploy. Waits on CI with `gh pr checks --watch` instead of polling, waits only for the review bots recent PRs show, and fixes or answers every review comment. Rolls production back with `git revert` when validation fails.

---

## Quick Navigation

| Section | Jump to |
|---------|---------|
| [Arguments](#arguments) | Flags `/ship` accepts |
| [Workflow Phases](#workflow-phases) | All phases from commit to merge |
| [Review Feedback Handling](#review-feedback-handling) | How every comment gets fixed or answered |
| [Error Handling](#error-handling) | Exit codes and recovery |
| [Integration with /next-task](#integration-with-next-task) | What changes when called from the workflow |
| [Platform Detection Details](#platform-detection-details) | CI and deploy detection |
| [Example Flow](#example-flow) | Full walkthrough |

**Related docs:**
- [/next-task Workflow](./NEXT-TASK.md) - The full workflow that calls /ship
- [Agent Reference](../reference/AGENTS.md) - ci-monitor, ci-fixer details

---

## Overview

`/ship` takes your current branch from uncommitted changes (or already committed) to a merged PR with green checks and every review comment fixed or answered.

**Why this design:** Shipping is more than opening a PR. It is waiting for CI, reading what reviewers said, deciding how to respond, pushing fixes, and waiting again. `/ship` does all of that. The run is done when the PR is merged (or, on a repo you cannot merge to, ready for the maintainers), CI is green on the merged head, review feedback is handled, and anything the run created locally is cleaned up.

**Constraints the workflow keeps:**
- It never force-pushes a branch other people build on. Production rollback uses `git revert`, not a reset.
- It stages files by name and never stages `.env` files, keys or credentials.
- It cleans up only what this run (or the `/next-task` run that called it) created: its worktree, its local branch, its task entry. Other worktrees and branches may be another agent's live work.
- On a repo where you lack write access (a fork PR to an upstream project), it does not merge, does not resolve maintainers' threads, and replies only where a maintainer asked something. It stops at "ready for review".
- It posts to an issue tracker only when the run came from `/next-task` with a GitHub task source.

Without a `Task` tool it does review and fix work inline, and without `AskUserQuestion` it asks in plain text. No other plugin is required.

---

## Arguments

| Flag | Meaning |
|------|---------|
| `--strategy squash\|merge\|rebase` | Merge strategy. Default `squash` |
| `--skip-tests` | Skip the local test run before pushing. CI still has to pass |
| `--dry-run` | Print the plan and stop. Changes nothing |
| `--state-file PATH` | The `/next-task` flow state. Present means `/next-task` already ran review, deslop and docs |
| `--base BRANCH` | PR target. Default: `git.baseBranch` from the flow state with `--state-file`, else the repo default branch |

---

## Workflow Phases

### Phase 1: Pre-flight

The plugin's scripts detect the environment:

```bash
PLATFORM=$(node "${CLAUDE_PLUGIN_ROOT}/lib/platform/detect-platform.js")   # ci, deployment, branchStrategy, mainBranch, packageManager
TOOLS=$(node "${CLAUDE_PLUGIN_ROOT}/lib/platform/verify-tools.js")         # .gh.available etc.
```

- Stops with install and `gh auth login` instructions if `gh` is missing.
- Stops if the current branch is the target branch: shipping needs a feature branch.
- Resolves the target: `--base`, then the flow state's `git.baseBranch`, then `mainBranch`. An interactive run confirms a target that differs from the repo default; under `--state-file` the flow state is trusted.
- `branchStrategy: multi-branch` (a dev and a production branch, `stable` by default) turns on Phases 7 to 10.
- Checks write access once with `gh repo view <base-repo> --json viewerPermission`. `ADMIN`, `MAINTAIN` or `WRITE` means it can merge. On a fork, `<base-repo>` is the upstream parent.

`--dry-run` prints the plan and stops:

```
## Dry Run
Branch: <current> -> <target>
Workflow: single-branch|dev-prod | CI: <ci> | Deploy: <deployment>
Will: commit <n> files | push | open PR | monitor CI and reviews | merge (<strategy>) | deploy
```

---

### Phase 2: Commit

Only runs when `git status --porcelain` shows changes. Unless `--skip-tests` is set, it runs the project's test command first and stops on a failure. It stages the relevant files by path and writes a conventional commit message that matches the repo's history (`git log --oneline -10`).

---

### Phase 3: Push and Open the PR

```bash
git push -u origin <branch>
gh pr list --head <branch>          # reuse an open PR for the branch
gh pr create --base <target> ...    # otherwise open one
```

The PR uses the repo's PR template if it has one. The body says what changed, why, and how it was tested, and links the issue (`Closes #N`) when there is one.

---

### Phase 4: CI and Review Loop

Runs on every `/ship`, including runs from `/next-task`: CI and external reviewers only see the code once the PR exists. Each round waits for CI, fixes failures, collects feedback, handles it, and pushes.

**Waiting for CI** blocks on the checks instead of polling on a timer:

```bash
gh pr checks "$PR" --watch --interval 30   # returns when all checks finish, non-zero if any failed
```

It runs in the background when the harness supports that, so feedback can be read meanwhile. If `gh` reports no checks at all, the repo has no CI: that is noted and the loop moves on.

**On a CI failure** it reads the failing job's log (`gh run view <run-id> --log-failed`), fixes the cause, commits, pushes, and waits again. With `next-task:ci-fixer` installed and a `Task` tool available it may hand the fix to ci-fixer with the check name and log excerpt; otherwise it fixes the failure itself. It never weakens a test, disables a lint rule or skips a check to get green.

**Waiting for review bots:** there is no fixed wait. Many AI reviewers (a Claude or Codex review workflow, CodeRabbit, Gemini, Copilot) run as checks, so `--watch` already covers them. Some post as a GitHub App with no check run. If recent merged PRs in the repo show such a bot reviewing, `/ship` waits for that bot's review of the current head commit, in one bounded background wait:

```bash
HEAD_SHA=$(gh pr view "$PR" --json headRefOid -q .headRefOid)
timeout 900 bash -c 'until [ "$(gh pr view "$0" --json reviews -q "[.reviews[] | select(.author.login == \"$1\" and .commit.oid == \"$2\")] | length")" -gt 0 ]; do sleep 30; done' "$PR" "$BOT_LOGIN" "$HEAD_SHA"
```

Only that bot's review of that commit counts: a human review, another bot, its own thread replies, or the bot's review of an older push do not. After 15 minutes it proceeds and mentions the missing review in the report. No sign of review bots on recent PRs means no wait.

**Collecting feedback:** unresolved review threads from GraphQL, plus top-level review bodies and PR comments (`gh pr view "$PR" --json reviews,comments`), since some reviewers put findings there. A `CHANGES_REQUESTED` review counts as open feedback.

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes { id isResolved path line comments(first: 20) { nodes { id databaseId author { login } body } } }
        }
      }
    }
  }' -f owner="$OWNER" -f repo="$REPO" -F pr="$PR" \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

How each item is handled is in [Review Feedback Handling](#review-feedback-handling). Fixes are committed with a message that names the change, then the next round starts. A round with replies only still ends with a check that nothing new arrived. Each round prints:

```
[CI/Review] round <n>: CI <passed|failed|none> | fixed <a> | answered <b> | open <c>
```

**Exit condition:** all required checks pass and every review thread is fixed or answered. On a repo you own that means zero unresolved threads and no outstanding "changes requested". After 5 rounds without converging, it stops and reports what is left.

---

### Phase 5: Standalone Review

**Skipped under `--state-file`** when the flow state shows the `/next-task` review loop approved.

Otherwise it reviews the diff (`git diff <target>...HEAD`) once for correctness, security, performance and test coverage: a single pass, inline or in one `general-purpose` subagent. For a large diff (roughly 500+ changed lines or 15+ files) it may split the concerns across up to 3 parallel subagents when `Task` is available. Critical and high findings get fixed; medium ones when the fix is small and clearly correct; low ones are optional. It re-reviews only the changed hunks, at most 2 more rounds. Pushed fixes send it back to Phase 4.

---

### Phase 6: Merge

Only with write access. Before merging it checks:

1. `gh pr view <n> --json mergeable,mergeStateStatus` reports `MERGEABLE`
2. No unresolved review threads
3. Checks are green on the current head

Inside a worktree, `gh pr merge --delete-branch` tries to check out the base branch locally and fails, so the merge is split:

```bash
if [ -f "$(git rev-parse --show-toplevel)/.git" ]; then   # .git is a file inside a worktree
  gh pr merge "$PR" --"$STRATEGY"
  git push origin --delete "$BRANCH" || echo "[WARN] remote branch not deleted"
else
  gh pr merge "$PR" --"$STRATEGY" --delete-branch
  git checkout "$TARGET" && git pull --ff-only origin "$TARGET"
fi
MERGE_SHA=$(gh pr view "$PR" --json mergeCommit -q .mergeCommit.oid)
```

Merge strategy options:
- `squash` (default) - Combines all commits
- `merge` - Creates a merge commit
- `rebase` - Rebases onto the target

If the repo has a cached `repo-intel.json`, it is refreshed through the agentsys runtime (`repoMap.update`), and skipped silently when the runtime or the map is missing.

---

### Phases 7-10: Deploy and Validate (Multi-branch Only)

Single-branch repos skip these: the merge is the deploy. Every deploy wait is bounded with `timeout` and runs in the background when the harness supports it.

| Platform | Wait | Ready when |
|----------|------|------------|
| Vercel | `vercel inspect <deploy-url> --wait --timeout 10m` | `readyState` is `READY` (failure: `ERROR`) |
| Netlify | `timeout 600 netlify watch` | deploy `.state` is `ready` (failure: `error`) |
| Railway | `railway deployment list --json`, then a bounded wait on `railway deployment get <id> --json` | `.status` is `SUCCESS` (failure: `FAILED`) |
| None detected | The merge is the deploy | - |

**Development (Phases 7 and 8):** after the merge, it waits for the development deploy and validates it: a health probe (`curl` on `<dev-url>/health`, where 200, 301 or 302 passes), the platform status above, and the `smoke-test` script from `package.json` with `SMOKE_TEST_URL=<dev-url>` when there is one. Any failure stops the run before production.

**Production (Phase 9):** promotion needs a branch checkout, so it does not run from a worktree. It records the current production head, merges the target into the production branch with `--no-ff` (one merge commit, which is what rollback reverts) and pushes. A rejected push stops the run, since validating the old deploy would report a false success. If an earlier run rolled production back, it reverts that revert first; otherwise the new fix would ship without the feature it fixes.

**Validate production (Phase 10):** the same health probe, platform status, and `smoke-test:prod` script. The decision rests on the platform status API and the HTTP probe, never on counting words like "error" in logs: logs echo user input, so anyone who can get a string logged could force a rollback. With no platform API, it falls back to the conclusion of the last deploy workflow runs on the production branch.

**Rollback:**

```bash
git checkout "$PROD_BRANCH" && git pull --ff-only origin "$PROD_BRANCH"
git revert -m 1 --no-edit "$PROD_MERGE_SHA"
git push origin "$PROD_BRANCH"
```

A revert is a normal push, so nobody else's commits on the production branch are rewritten. Under `--state-file` the revert SHA is recorded in the flow state, because the next promotion has to revert it first. If the push is rejected because someone else pushed meanwhile, it stops and hands over to the user.

---

### Phase 11: Cleanup

Only after a merge (`gh pr view <n> --json state` is `MERGED`). If the PR is still open (no write access, or the run stopped early), the worktree, branch and task entry stay, and the issue stays open.

- Under `--state-file`: if the flow state's `git.worktreePath` is the worktree `/next-task` created for this task, it removes it from the main checkout with `git worktree remove` (no `--force`; a worktree with uncommitted changes is left and reported), deletes its local branch, and releases the task entry with `releaseTask()`.
- Standalone, outside a worktree: switches to the target branch and deletes the merged local branch.
- Standalone, inside a worktree this run did not create: leaves it.
- GitHub task from `/next-task`: comments on the issue with the PR number and merge commit, then closes it with `gh issue close <id> --reason completed`.

Merged branches are deleted with `git branch -D`: after a squash or rebase merge git does not see the branch as merged, and the PR state already confirms the merge. Only branches this run shipped are deleted.

---

### Phase 12: Report

```
## Shipped
PR: #<n> <url> | Merged to <target> at <sha> (or: ready for maintainer review)
CI: <passed checks> | Review: <threads fixed>/<threads answered>
Deploy: <dev url> [OK] | <prod url> [OK]   (or: single-branch, merge is the deploy)
Cleanup: <what was removed, what was left and why>
```

Then it prints the completion line `/next-task` reads:

```json
{"ok": true, "nextPhase": "completed", "status": "shipped"}
```

---

## Review Feedback Handling

Every review thread, review body and PR comment that asks for something gets fixed or answered. Each item is judged on its merits:

| Feedback | Action |
|----------|--------|
| Correct and in scope | Fix it. Nits count when the fix is cheap and clearly right |
| Wrong, or already handled | Reply once with the reason, pointing at the line or commit. No code change to appease a wrong comment |
| Correct but out of scope | Reply saying so. A follow-up issue is opened only on a repo you own |
| A question | Answer it |

On a repo you own, each thread is resolved after it is fixed or answered, and review is re-requested from anyone who requested changes. On a repo you do not own, threads are never resolved (the maintainer decides), replies go only where a maintainer or a reviewer they rely on asked something, and everything else is folded into the PR body.

```bash
gh api -X POST "repos/$OWNER/$REPO/pulls/$PR/comments/$COMMENT_DATABASE_ID/replies" -f body="$REPLY"
gh api graphql -f query='mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }' -f id="$THREAD_ID"
```

---

## Error Handling

When a phase fails, `/ship` stops that phase, reports what failed with the evidence (command, exit code, relevant log lines) and gives the recovery step. Re-running `/ship` resumes safely: it reuses the open PR and picks up at the CI and review loop.

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | Merged (or ready for maintainer review on a repo without write access) |
| 1 | General failure |
| 2 | CI failure |
| 3 | Review loop did not converge |
| 4 | Deploy failure |
| 5 | Rollback triggered |

**Recovery:**

| Failure | Recovery |
|---------|----------|
| `gh` missing or not authenticated | Install from https://cli.github.com, then `gh auth login` |
| On the target branch | Create a feature branch and re-run |
| Push rejected | Auth: `gh auth status`. Protected branch: push a feature branch. Behind remote: `git pull --rebase origin <branch>`, never a force push over someone else's commits |
| PR creation failed | Existing PR: `gh pr list --head <branch>`. No commits: `git log <target>..HEAD` |
| CI failure it could not fix | Fix and push, then re-run `/ship` |
| Merge conflict with the target | `git fetch origin && git merge origin/<target>`, resolve, push, re-run. Rebase only if the branch is yours alone, then `git push --force-with-lease` |
| Review loop did not converge in 5 rounds | Fix, answer, or ask the reviewer to close the open threads |
| Deploy failed | Fix and re-run. Production was not touched if the failure was in development |
| Production validation failed | Rollback already ran. Fix forward and ship again: the next promotion reverts the revert commit first |
| Worktree could not be removed | Left in place on purpose (usually uncommitted changes). Inspect it, then `git worktree remove <path>` |

To abandon a shipped but unmerged PR: `gh pr close <n>`, then `git push origin --delete <branch>`.

---

## Integration with /next-task

`/next-task` calls `/ship --state-file <worktree>/<state-dir>/flow.json --base <base>` at the Merged, Deployed and Production stopping points.

**Skipped:**
- Phase 5 (standalone review), when the flow state shows the `/next-task` review loop approved. `/next-task` has also run deslop and the docs sync by then; `/ship` runs neither itself

**Still runs:**
- Phase 4 (CI and review loop): external reviewers comment after the PR exists

**Also changes:**
- The target defaults to `git.baseBranch` from the flow state
- After the merge it removes the task's worktree, releases the task entry, and comments on and closes the issue for a GitHub task source

---

## Platform Detection Details

**CI platforms** (first match wins):

| Platform | Detected by |
|----------|-------------|
| GitHub Actions | `.github/workflows/` |
| GitLab CI | `.gitlab-ci.yml` |
| CircleCI | `.circleci/config.yml` |
| Jenkins | `Jenkinsfile` |
| Travis CI | `.travis.yml` |

The CI wait reads the PR's checks through `gh pr checks`, so it sees any CI that reports to the GitHub PR.

**Deploy platforms** (first match wins):

| Platform | Detected by |
|----------|-------------|
| Railway | `railway.json`, `railway.toml` |
| Vercel | `vercel.json` |
| Netlify | `netlify.toml`, `.netlify` |
| Fly.io | `fly.toml` |
| Platform.sh | `.platform.app.yaml` |
| Render | `render.yaml` |

Deploy waits and status checks exist for Vercel, Netlify and Railway. Fly.io, Platform.sh and Render are detected, but the deploy reference has no wait commands for them.

---

## Usage Examples

```bash
/ship                       # Full workflow
/ship --dry-run             # Preview without executing
/ship --strategy rebase     # Use rebase instead of squash
/ship --base develop        # Target a non-default branch
/ship --skip-tests          # Skip the local test run (CI still has to pass)
```

---

## Example Flow

```
User: /ship

[Pre-flight]
→ CI: github-actions | Deploy: railway | single-branch
→ Branch: feature/add-dark-mode -> main | write access [OK]

[Commit]
→ Tests pass [OK]
→ Committed: "feat(ui): add dark mode toggle"

[Push & PR]
→ Pushed to origin/feature/add-dark-mode
→ Created PR #156

[CI and reviews]
→ gh pr checks --watch: lint, test, build passed
→ Recent PRs show a review bot without a check run: waiting for its review of the head commit
→ 4 comments from 3 reviewers: 2 fixed, 1 answered, 1 replied as already handled
[CI/Review] round 1: CI passed | fixed 2 | answered 2 | open 0
[CI/Review] round 2: CI passed | fixed 0 | answered 0 | open 0

[Merge]
→ MERGEABLE, 0 unresolved threads, checks green
→ Merged PR #156 to main

[Cleanup]
→ Deleted feature branch

## Shipped
PR: #156 | Merged to main at a1b2c3d
```

---

## Navigation

[← Back to Documentation Index](../README.md) | [Main README](../../README.md)

**Related:**
- [/next-task Workflow](./NEXT-TASK.md) - The full workflow that calls /ship
- [Agent Reference](../reference/AGENTS.md) - ci-monitor, ci-fixer details
