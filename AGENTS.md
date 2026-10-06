# AgentSys

Marketplace, installer and shared library for the agent-sh plugins. Works on Claude Code, OpenCode, Codex CLI, Cursor and Kiro. Plugins live in their own repos in the agent-sh GitHub org and are pinned by commit in `.claude-plugin/marketplace.json`; this repo holds the installer (`bin/cli.js`), the dev CLI (`bin/dev-cli.js`), `lib/` (synced from agent-core), adapters, docs, checklists and the site.

## Critical Rules

1. This is a production project with real users: a breaking change reaches every plugin user at once. A feature or fix ships with tests for the changed behavior, edge cases included, and keeps the docs accurate.
2. Optimize for developers using the plugins in their own repos, not for internal convenience here.
3. Record finished work in CHANGELOG.md and the reply. Summary, audit or completion files (`*_AUDIT.md`, `*_SUMMARY.md`, `*_COMPLETION.md`) clutter the repo, so leave them out.
4. Changes go through a PR to main, except a change of a few lines or an urgent hotfix. PRs give review, CI and an easy rollback.
5. Address every review comment from the auto-reviewers (Copilot, Claude, Gemini, Codex): fix it, or reply with why not. The first reviews arrive about 3 minutes after the PR opens and Claude's can take 10 minutes or more; wait up to 30 minutes in total, then note any reviewer that has not posted and continue. Iterate until no thread is unresolved.
6. Before a multi-file change, read the checklist that applies; multi-file changes have hidden dependencies:
   - Cross-platform work: `checklists/cross-platform-compatibility.md` (the master reference)
   - Release: `checklists/release.md`
   - New command, agent, skill or lib module: `checklists/new-command.md`, `checklists/new-agent.md`, `checklists/new-skill.md`, `checklists/new-lib-module.md`
   - OpenCode plugin update: `checklists/update-opencode-plugin.md`
   - Repo intel changes: `checklists/repo-intel.md`
7. Work is done when every item of that checklist is done. That includes running `/enhance` on new or changed commands, agents, skills, hooks or prompts, checking OpenCode and Codex compatibility, and updating the `bin/cli.js` mappings for a new command or agent. The pre-push hook asks for the `/enhance` confirmation (`ENHANCE_CONFIRMED=1` in non-interactive runs).
8. Status output uses the plain-text markers `[OK]`, `[ERROR]`, `[WARN]`, `[CRITICAL]` and markdown, with no emojis or ASCII-art boxes: they cost tokens and parse worse.
9. gh and git on Windows: escape `$` as `\$` in GraphQL queries, avoid `!=` in jq (use `== "A" or == "B"`), and prefer double quotes with escaped inner quotes over single quotes. `gh pr checks` reports `state` (`SUCCESS`, `FAILURE`, `PENDING`), not `conclusion`. The Windows shell treats `$` and `!` differently and these fail silently.
10. Run the pre-commit and pre-push hooks; when one blocks, fix the reported cause and retry.
11. Fix every failing test you meet, including ones that look out of scope. A green run has to mean everything works.
12. Report script failures before manual fallback. When a project script fails (`npm test`, `npm run ...`, `scripts/*`, `agentsys-dev`, `node bin/dev-cli.js`), report the exact error, find the cause and fix the script. NEVER silently fall back to doing its work by hand: that hides broken tooling.

In prose, write ` - ` (a single dash with spaces), not an em dash or a doubled dash.

## Architecture

<!-- GEN:START:claude-architecture -->
```
lib/          → Shared library (vendored to plugins)
plugins/      → 24 plugins, 50 agents (40 file-based + 10 role-based), 44 skills
adapters/     → Platform adapters (opencode-plugin/, opencode/, codex/)
checklists/   → Action checklists (9 files)
bin/cli.js    → npm CLI installer
```

| Plugin | Agents | Skills | Purpose |
|--------|--------|--------|---------|
| next-task | 8 | 1 | Master workflow orchestration |
| prepare-delivery | 3 | 4 | Pre-ship quality gates |
| gate-and-ship | 0 | 0 | Quality gates then ship |
| ship | 1 | 1 | PR creation and deployment |
| deslop | 1 | 1 | AI slop cleanup |
| audit-project | 10 | 1 | Multi-agent code review |
| drift-detect | 1 | 1 | Plan drift detection |
| enhance | 8 | 9 | Code quality analyzers |
| sync-docs | 1 | 1 | Documentation sync |
| repo-intel | 3 | 1 | Unified static analysis |
| banthis | 0 | 1 | Durable negative behavior memory |
| perf | 6 | 8 | Performance investigation |
| learn | 1 | 1 | Topic research and learning guides |
| agnix | 1 | 1 | Agent config linting |
| consult | 1 | 1 | Cross-tool AI consultation |
| debate | 1 | 1 | Multi-perspective debate analysis |
| skill-curator | 0 | 1 | Skill authoring and review |
| system-prompt-curator | 0 | 1 | System prompt curation |
| skillers | 2 | 2 | Workflow pattern learning |
| onboard | 1 | 1 | Codebase onboarding |
| can-i-help | 1 | 1 | Contributor guidance |
| zig-lsp | 0 | 0 |  |
| mojo | 0 | 1 |  |
| ada-spark | 0 | 1 |  |
<!-- GEN:END:claude-architecture -->

Pattern: command, then agent, then skill (orchestration, invocation, implementation).

## Commands

User-facing commands are listed in [README.md](./README.md). Dev CLI (`npx agentsys-dev <command>` or `node bin/dev-cli.js <command>`):

```bash
npx agentsys-dev status                 # version, counts, branch
npx agentsys-dev validate [name]        # all validators, or one (plugins, counts, ...)
npx agentsys-dev test                   # test suite (npm test)
npx agentsys-dev preflight [--all|--release]  # change-aware checklist checks
npx agentsys-dev gen-docs [--check]     # regenerate GEN blocks; --check fails if stale (CI)
npx agentsys-dev bump <version>         # bump every version file
npx agentsys-dev new plugin|agent|skill|command <name> [--plugin=<plugin>]
npx agentsys-dev --help                 # everything else
```

Most have npm aliases (`npm test`, `npm run validate`, `npm run preflight`, `npm run gen-docs:check`, `npm run bump`). CI also runs `scripts/expand-templates.js --check` and `scripts/gen-adapters.js --check`. `agentsys` runs the installer.

## Agents, skills and models

[docs/reference/AGENTS.md](./docs/reference/AGENTS.md) lists every agent with its model and tools; [README.md](./README.md#skills) lists the skills. Agents invoke skills, and skills hold the implementation.

Model families: opus (Claude Opus 5.5) for judgment where errors compound, sonnet (Claude Sonnet 5.5) for validation and most agents, haiku (Claude Haiku 4.5) for mechanical work. An agent with no `model` key inherits the caller's.

`/next-task` runs its phases in order: exploration-agent, planning-agent, user approval of the plan, implementation-agent, pre-review gates, review loop, delivery-validator, sync-docs-agent, then `/ship`. A phase whose plugin is not installed uses the inline fallback in next-task's `commands/next-task.md`.

## State files

| File | Location | Purpose |
|------|----------|---------|
| `tasks.json` | `{stateDir}/` | Active task registry |
| `flow.json` | `{stateDir}/` (worktree) | Workflow progress |
| `preference.json` | `{stateDir}/sources/` | Cached task source |
| `suppressions.json` | `~/.<claude\|opencode\|codex>/enhance/` | Auto-learned suppressions |

`stateDir` is `.claude/`, `.opencode/`, `.codex/`, `.cursor/` or `.kiro/` by platform.

## Priorities

In order: experience of plugin users, worry-free automation, token efficiency, output quality, simplicity.
