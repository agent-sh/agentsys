# /foreman Workflow

Short reference for the `/foreman` loop, from the foreman plugin pinned in `.claude-plugin/marketplace.json`. The plugin's [README](https://github.com/agent-sh/foreman#readme) and `skills/foreman/SKILL.md` are the source of truth.

**TL;DR:** foreman works a repo's open GitHub issues as a task queue. One main session picks the next ready issue, claims it, and spawns a worktree subagent from its brief. Revuto reviews the PR. foreman lands it at the exact head it checked, through the repo's own land command. It replaces next-task and tower-crane.

---

## Quick Navigation

| Section | Jump to |
|---------|---------|
| [Arguments](#arguments) | What `/foreman` accepts |
| [The Loop](#the-loop) | Capacity to land |
| [Review](#review) | Revuto findings, caps and self-review |
| [Land](#land) | What has to hold before a merge |
| [Config](#config) | `.foreman.json` |
| [Platforms](#platforms) | Claude Code, OpenCode, Codex |

---

## Overview

There is no daemon and no state store. Labels, assignees and comments on GitHub are the state, so several sessions can share one queue. Every command reads GitHub live, and nothing is cached.

`scripts/foreman.js` does every deterministic step. The session does the judgment, and native worktree subagents do the implementing. foreman ships no agents of its own and never spawns a reviewer subagent: review is Revuto's.

Exit codes of every CLI command: 0 done, 1 not now (nothing ready, no capacity, pending), 2 refused by a rule, 3 error.

## Arguments

```bash
/foreman              # Run the loop until nothing is ready and no worker is running
/foreman status       # Counts by label, claims, quiet claims and capacity. Changes nothing
/foreman stats        # PRs that hit the Revuto cap, self-reviews, manual Revuto requests
/foreman 123          # Work issue #123 only: claim to land or release
```

## The Loop

1. `doctor` checks node, `gh` auth, git, the repo, the config and the labels (`--fix` creates missing labels).
2. `capacity` checks load1, CPU pressure, available memory and live claims against `agents_max`. No capacity means no spawn.
3. `pick` takes the next ready issue: urgent first, then oldest. It skips held, decision, blocked and claimed issues, and any whose `Depends on` issues are still open.
4. `claim` assigns the issue, swaps `status:ready` for `status:in-progress` and posts a claim comment. The first claim comment wins a race.
5. `brief` prints the worker brief. The session spawns one worktree subagent per issue with that brief, in parallel up to `agents_max`.
6. On the worker's report the session opens the PR and moves the issue to review, or releases it to rework or held.
7. Every hour, `stale --retake` returns other sessions' idle claims to the queue.

## Review

Revuto reviews every push on its own, with a per-PR round cap (`review.rounds_max`, 3 by default).

- A real finding (P0-P2, or unrated) goes back to a worker on the same branch.
- A wrong finding gets a reply in its thread, which marks it addressed.
- A lows-only round is fixed and lands with no new round.
- A title, doc or small clear fix lands with `--trivial`.
- When Revuto is capped or unavailable, the session reads the whole diff itself, fixes what it finds, records it with `self-review`, and lands with `--decided-by-session`.

## Land

`land N --pr P --head SHA` refuses unless:

- the PR is open and its head is SHA
- every check at that head is green, and every `required_checks` name is among them (a cancelled, failed or never-reported check is not green)
- there is no merge conflict and no unaddressed Revuto finding
- the landing comment passes the `comment_forbidden` scan

Then it runs the repo's land command (rerun once if main moves), posts the comment, squash-merges with `--match-head-commit SHA` and closes the issue. The squash body drops Co-Authored-By trailers and the "Generated with" footer.

## Config

`.foreman.json` is optional, version-controlled, and sits in the repo root. Every key has a default, and unknown keys are refused. The main keys: `labels`, `depends_pattern`, `agents_max`, `load_hold`, `cpu_pressure_hold`, `mem_min_gb`, `stale_claim_hours`, `check`, `land`, `required_checks`, `allow_no_checks`, `merge_admin`, `review.*`, `comment_forbidden`. See the plugin README for each default.

## Platforms

| Platform | Support |
|----------|---------|
| Claude Code | Full loop |
| OpenCode | `/foreman status` and `stats`, and every CLI command. The loop's worktree subagents need Claude Code |
| Codex CLI | `$foreman status` and `stats`, and every CLI command. The loop's worktree subagents need Claude Code |

Requires Node.js 22+, an authenticated `gh`, `git` and `waitfor`. `run-long` needs systemd user units (Linux).
