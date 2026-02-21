# agent-sh Org Architecture Plan

> Tracking doc for the agent-sh GitHub organization buildout.
> All issues live in [agent-sh/agentsys](https://github.com/agent-sh/agentsys/issues).

## Current State

| Repo | Purpose | Status |
|------|---------|--------|
| [agentsys](https://github.com/agent-sh/agentsys) | Marketplace + installer (plugins now in standalone repos) | Active |
| [agnix](https://github.com/agent-sh/agnix) | Agent config linter (CLI + LSP + IDE extensions) | Active |
| [web-ctl](https://github.com/agent-sh/web-ctl) | Browser automation plugin (Playwright-based, persistent sessions, auth handoff) | Active |
| [agent-core](https://github.com/agent-sh/agent-core) | Shared libs — synced to all repos on merge | Created |
| [agent-knowledge](https://github.com/agent-sh/agent-knowledge) | Research guides and RAG indexes | Active (10 guides) |
| [.github](https://github.com/agent-sh/.github) | Org profile, shared templates, reusable workflows | Active |
| [next-task](https://github.com/agent-sh/next-task) | Master workflow orchestration plugin | Active |
| [ship](https://github.com/agent-sh/ship) | PR creation and deployment plugin | Active |
| [deslop](https://github.com/agent-sh/deslop) | AI slop cleanup plugin | Active |
| [audit-project](https://github.com/agent-sh/audit-project) | Multi-agent code review plugin | Active |
| [enhance](https://github.com/agent-sh/enhance) | Code quality analyzers plugin | Active |
| [perf](https://github.com/agent-sh/perf) | Performance investigation plugin | Active |
| [drift-detect](https://github.com/agent-sh/drift-detect) | Plan drift detection plugin | Active |
| [sync-docs](https://github.com/agent-sh/sync-docs) | Documentation sync plugin | Active |
| [repo-map](https://github.com/agent-sh/repo-map) | AST repo mapping plugin | Active |
| [learn](https://github.com/agent-sh/learn) | Topic research and learning guides plugin | Active |
| [consult](https://github.com/agent-sh/consult) | Cross-tool AI consultation plugin | Active |
| [debate](https://github.com/agent-sh/debate) | Multi-perspective debate analysis plugin | Active |

**Org**: [github.com/agent-sh](https://github.com/agent-sh)
**npm scope**: `@agentsys` (claimed on npmjs.com, not yet used)
**Sites**: [agentsys](https://agent-sh.github.io/agentsys/) | [agnix](https://agent-sh.github.io/agnix/)

---

## Completed Work

### Org Creation & Migration
- [x] Created `agent-sh` GitHub org (naming: signals shell/terminal tooling, like oven-sh)
- [x] Transferred `agentsys` repo from `avifenesh/agentsys` → `agent-sh/agentsys`
- [x] Transferred `agnix` repo from `avifenesh/agnix` → `agent-sh/agnix`
- [x] Transferred `web-ctl` repo from `avifenesh/web-ctl` → `agent-sh/web-ctl`
- [x] Claimed `@agentsys` npm scope on npmjs.com
- [x] Updated git remote: `origin → https://github.com/agent-sh/agentsys.git`

### Post-Migration Fixes
- [x] Re-enabled CodeQL default setup on agentsys (disabled by transfer) — PR #248
- [x] Updated all repo links from `avifenesh/*` → `agent-sh/*` across 58 files — PR [#249](https://github.com/agent-sh/agentsys/pull/249)
- [x] Updated agnix README links — PR [agnix#543](https://github.com/agent-sh/agnix/pull/543)
- [x] Re-deployed GitHub Pages for agentsys (Deploy Site workflow)
- [x] Re-deployed GitHub Pages for agnix (Docs Website workflow)
- [x] HTTPS enforcement on agentsys Pages (agnix cert provisioning)

### Feature: GitHub Projects as Task Source (#247)
- [x] Added `gh-projects` as 6th task source in next-task workflow
- [x] `needsProjectFollowUp()` + `getProjectQuestions()` for project number/owner
- [x] Input validation (integer check, owner regex, scientific notation rejection)
- [x] Merged via PR [#248](https://github.com/agent-sh/agentsys/pull/248), issue auto-closed

### Research Completed (5 deep guides in `agent-knowledge/`)
- [x] `skill-plugin-distribution-patterns.md` — 40 sources: npm/git/vendoring/registry patterns
- [x] `monorepo-to-multirepo-migration.md` — Subtree splits, version sync, history preservation
- [x] `all-in-one-plus-modular-packages.md` — 40 sources: AWS SDK v3, Babel, lodash, installer CLIs
- [x] `github-org-project-management.md` — 15 sources: Projects v2, GraphQL API, automations, real org patterns
- [x] `github-org-structure-patterns.md` — 18 sources: 7 real orgs analyzed, .github repo, CODEOWNERS, reusable workflows
- [x] `oss-org-naming-patterns.md` — 24 sources: naming conventions for OSS orgs

### web-ctl Architecture Design (#241)
- [x] Researched: terminal browsers, Playwright CLI, session persistence
- [x] Architecture: Skill → `scripts/web-ctl.js` → Playwright `launchPersistentContext`
- [x] Security model: AES-256-GCM, OS keyring, HKDF per-session DEK
- [x] Constraint: no MCP server, skill-based (low context cost)
- [x] Updated issue #241 with full architecture spec

### Issues Created
- [x] #241 — web-ctl plugin (architecture updated)
- [x] #245 — Org/marketplace strategy (updated with agent-sh decision)
- [x] #246 — GitHub Releases + plugins.json distribution
- [x] #247 — GitHub Projects as task source (merged/closed)

---

## Planning Tracks

### 1. Repo Structure & Plugin Graduation
**Issue**: [#250](https://github.com/agent-sh/agentsys/issues/250)
**Status**: Complete
**Depends on**: #256 (cross-repo sync)

**Implemented:**
- [x] All 13 plugins extracted to standalone repos under agent-sh org
- [x] `plugins/` directory removed from agentsys monorepo
- [x] `scripts/graduate-plugin.js` — extraction script for future plugins
- [x] `bin/cli.js` updated to fetch plugins from GitHub at install time
- [x] marketplace `requires` field added for peer dependency tracking
- [x] agent-core sync pipeline extended to all 13 plugin repos

---

### 2. Plugin Distribution Registry
**Issue**: [#251](https://github.com/agent-sh/agentsys/issues/251)
**Status**: Complete
**Related**: #246 (closed, superseded)

**Implemented:**
- [x] `agentsys install <plugin>[@version]` with transitive dep resolution
- [x] `agentsys remove <plugin>` with dep-in-use warnings
- [x] `agentsys search [term]` with filtered table output
- [x] `installed.json` manifest at `~/.agentsys/installed.json`
- [x] Core version compatibility check (warns on mismatch)
- [x] GitHub tarball fetching with cache at `~/.agentsys/plugins/`
- [x] `agentsys list` and `agentsys update` subcommands

---

### 3. GitHub Projects v2 Board
**Issue**: [#252](https://github.com/agent-sh/agentsys/issues/252)
**Status**: Complete
**Depends on**: None

Org-level project board spanning all repos. Custom fields, views, automations.

**Implemented:**
- [x] Board: https://github.com/orgs/agent-sh/projects/1
- [x] Custom fields: Priority (P0-P3), Effort (S/M/L/XL), Component, Target
- [x] Org issue types: task, bug, feature, RFC
- [x] Auto-add workflow in agentsys, agnix, web-ctl (PR #257, agnix #546)
- [ ] Auto-archive (configure via board UI: Settings → Workflows)
- [ ] Additional views (roadmap, per-repo filtered)

---

### 4. .github Repo & Shared Infrastructure
**Issue**: [#253](https://github.com/agent-sh/agentsys/issues/253)
**Status**: Complete
**Depends on**: None

Org profile README, shared templates, reusable CI workflows, CODEOWNERS.

**Implemented:**
- [x] Org profile README ("Code does code work. AI does AI work.")
- [x] CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, CODEOWNERS
- [x] Issue templates: bug.yml, feature.yml, config.yml
- [x] Reusable workflows: ci-node.yml, codeql.yml, sync-core.yml
- [ ] Pin repos on org profile (GitHub UI only — no API)

---

### 5. Versioning & Release Coordination
**Issue**: [#254](https://github.com/agent-sh/agentsys/issues/254)
**Status**: Complete (baseline established)
**Depends on**: #250 (repo structure) — now complete

**Implemented:**
- [x] Independent semver for all 13 standalone plugin repos
- [x] marketplace `requires` field encodes agentsys compatibility range
- [x] agentsys installer uses `requires` to validate compatibility at install time

**Remaining:**
- [ ] Cross-repo release coordination process (tooling)
- [ ] @agentsys npm scope usage (if/when)

---

### 6. Documentation & Website
**Issue**: [#255](https://github.com/agent-sh/agentsys/issues/255)
**Status**: Planning
**Depends on**: #253 (.github repo)

Org landing page, per-repo docs, plugin catalog.

**Key decisions needed:**
- [ ] Unified site vs per-repo (current: per-repo)
- [ ] Domain: agent-sh.github.io vs custom domain
- [ ] Plugin catalog page design

---

### 7. Cross-Repo Sync & Compatibility
**Issue**: [#256](https://github.com/agent-sh/agentsys/issues/256)
**Status**: Complete (pipeline working)
**Depends on**: None

CI-driven vendor sync from agent-core → all consumer repos.

**Implemented:**
- [x] Decision: vendored lib/ (not npm) — Claude Code needs plain files
- [x] agent-core repo created + seeded with lib/
- [x] Inline sync workflow (agent-core pushes PR to agentsys on lib/ change)
- [x] Tested end-to-end: push to agent-core → PR opens in agentsys
- [x] Org secrets: SYNC_TOKEN + PROJECT_TOKEN (ALL visibility)
- [ ] Add more consumer repos to sync matrix as plugins graduate

---

## Pending Work

- [ ] Build web-ctl plugin (#241 — architecture done, implementation pending)
- [ ] #255 — Documentation & Website (org landing page, plugin catalog)
- [ ] Pin repos on org profile (GitHub UI only)
- [ ] Auto-archive on project board (board UI)
- [ ] Enable HTTPS on agnix Pages (cert provisioning — deploy triggered)
- [ ] File GitHub squatting claim for `agentsys` org name
- [ ] Add verified domain to agent-sh org (when domain registered)
- [x] Set org avatar
- [x] Merge link-fix PRs
- [x] Close resolved issues (#245, #246, #250-#254, #256)
- [x] agnix Claude Code plugin (agnix#550)

---

## Execution Order

```
Phase 1 (Immediate — no dependencies):  [DONE]
  #252  GitHub Projects v2 Board
  #253  .github Repo & Shared Infrastructure
  #256  Cross-Repo Sync (research/decision)

Phase 2 (After Phase 1 decisions):  [DONE]
  #250  Repo Structure & Graduation Criteria  ← all 13 plugins extracted
  #254  Versioning & Release Coordination     ← baseline + requires field

Phase 3 (After Phase 2):
  #251  Plugin Distribution Registry          ← next
  #255  Documentation & Website

Parallel (independent):
  #241  web-ctl Plugin Implementation
  #246  Plugin Distribution (Option C — GitHub Releases)
```

## Research Available

| Guide | File | Sources |
|-------|------|---------|
| Skill/Plugin Distribution Patterns | agent-knowledge/skill-plugin-distribution-patterns.md | 40 |
| Monorepo → Multi-Repo Migration | agent-knowledge/monorepo-to-multirepo-migration.md | training |
| All-in-One + Modular Packages | agent-knowledge/all-in-one-plus-modular-packages.md | 40 |
| GitHub Org Project Management | agent-knowledge/github-org-project-management.md | 15 |
| GitHub Org Structure Patterns | agent-knowledge/github-org-structure-patterns.md | 18 |
| OSS Org Naming Patterns | agent-knowledge/oss-org-naming-patterns.md | 24 |

---

*Created: 2026-02-21*
*Last updated: 2026-02-21 (Phase 1-3 complete, 6/7 tracks done)*
