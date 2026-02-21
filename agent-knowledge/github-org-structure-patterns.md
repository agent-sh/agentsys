# Learning Guide: GitHub Organization Structure Patterns for Developer Tool Ecosystems

**Generated**: 2026-02-21
**Sources**: 18 resources analyzed
**Depth**: deep

## Prerequisites

- Familiarity with GitHub repositories and basic git workflows
- Understanding of GitHub Actions concepts (workflows, triggers)
- Basic knowledge of open source project conventions (CONTRIBUTING, CODE_OF_CONDUCT)

## TL;DR

- The `.github` org (public repo) is the control plane for org-wide defaults: community health files, reusable workflows, profile README, and starter workflows
- Real-world orgs fall into two archetypes: **focused** (few high-quality repos, e.g. oven-sh/Bun) and **ecosystem** (many small packages, e.g. unjs, sindresorhus)
- Reusable workflows (`workflow_call`) are the primary mechanism for DRY CI across many repos in an org
- CODEOWNERS + working groups (teams) is the dominant governance pattern for monorepos
- AI usage disclosure policies are becoming a new category of org-level community health file

## Core Concepts

### The `.github` Repository as Org Control Plane

Every GitHub org has a special `.github` repository that acts as the configuration and defaults layer for the entire org.

**Profile README** (`profile/README.md`):
- Public-facing org description shown on the org's GitHub page
- Supports full markdown: badges, images, links, embedded stats
- A separate `.github-private` repo can hold a `profile/README.md` visible only to org members — useful for internal runbooks and links

**Default Community Health Files**:
The `.github` repo (which MUST be public to cascade org-wide) can define default files that apply to every repo in the org that does not override them:

| File | Purpose |
|------|---------|
| `CODE_OF_CONDUCT.md` | Community behavior standards |
| `CONTRIBUTING.md` | How to contribute |
| `FUNDING.yml` | Sponsorship links |
| `GOVERNANCE.md` | Decision-making processes |
| `SECURITY.md` | Vulnerability reporting policy |
| `SUPPORT.md` | Where to get help |
| Issue templates | Default issue forms |
| PR templates | Default PR descriptions |

**Important caveat**: If any individual repo has ANY files in its own `.github/ISSUE_TEMPLATE/` directory, the org-level issue template defaults no longer apply to that repo. The override is all-or-nothing per file type.

**What cannot be org defaults**: License files must be defined per-repo.

### Org-Level Pinned Repositories

Orgs can pin up to 6 repositories on their public profile page. A separate set of up to 6 pins can be configured for the member-only view. Use pins to surface:
- The primary product repo
- The standard library or docs repo
- Developer tooling repos (actions, setup tools, homebrew taps)
- Community/contribution entry points (roadmap, good-first-issues)

### Reusable GitHub Actions Workflows

Reusable workflows eliminate CI duplication across many repos in an org. They use the `workflow_call` trigger.

**Reference syntax**:
```yaml
jobs:
  call-shared-workflow:
    uses: myorg/.github/.github/workflows/ci.yml@main
    with:
      node-version: "22"
    secrets: inherit
```

**Key constraints and features**:
- Maximum 10 nesting levels (reusable workflows calling other reusable workflows)
- Permissions can only be maintained or reduced, never elevated
- `secrets: inherit` passes the caller's secrets implicitly — preferred for org-internal workflows
- Matrix strategies are supported in callers
- Inputs and outputs are typed (string, boolean, number, choice)

**Pattern**: Keep reusable workflows in the org `.github` repo under `.github/workflows/`, then reference `{owner}/.github/.github/workflows/{name}.yml@{ref}`.

### Starter Workflows

Starter workflows appear in the "Actions" tab of new repos as suggested templates. They live in the `.github` repo under `workflow-templates/`.

Each starter workflow requires two files:
- `workflow-templates/{name}.yml` — the workflow definition
- `workflow-templates/{name}.properties.json` — metadata (name, description, iconName, categories)

**Five categories**: CI, Deployments, Automation, Code-scanning, Pages

Variable substitution is supported: `$default-branch` resolves to the repo's default branch, `$cron-daily` to a daily cron expression.

### CODEOWNERS and Working Groups

CODEOWNERS files define who must review changes to specific paths. The **last matching pattern wins** (bottom-to-top precedence).

**Tauri's two-team pattern** (simple and effective):
```
# .github/CODEOWNERS
* @tauri-apps/wg-tauri
.github @tauri-apps/wg-devops
```

This gives the main working group ownership of all code, while the DevOps working group exclusively owns CI and tooling changes — preventing accidental breakage of infrastructure by feature contributors.

**Common patterns**:
- `docs/ @org/docs-team` — separate docs ownership
- `*.rs @org/core-team` — language-specific ownership
- `/packages/plugin-* @org/plugin-maintainers` — plugin subsystem

### GitHub Pages for Orgs

| Type | Repo Name | URL |
|------|-----------|-----|
| Org site | `<owner>.github.io` | `https://<owner>.github.io` |
| Project site | any repo | `https://<owner>.github.io/<repo>` |

One org site per account. Custom domains are supported on all tiers. Free plan limits Pages to public repos.

## Real-World Org Archetypes

### The Focused Minimal Org (oven-sh / Bun)

- ~7 visible repos: primary product, community list, setup action, homebrew tap, essential forks
- High signal-to-noise: every repo has clear purpose
- Pinned repos do the navigation work
- Setup tooling (`setup-bun`) is a first-class citizen in the org

**When to use**: Single primary product with companion tooling. Avoid repo sprawl that dilutes contributor attention.

### The Ecosystem Org (denoland / Deno)

- 216+ repos: runtime, standard library, framework (Fresh), toolchains, bindings
- Standard library (`deno_std`) is its own monorepo, separately versioned
- Distinct registries: Deno now publishes std to JSR (JavaScript Registry) alongside npm
- Verified domain lends authority to the org

**When to use**: Platform-level products where many independent but related modules need separate release cycles.

### The Framework Org (withastro / Astro)

- ~51 repos: core framework, docs site, compiler (separate language), roadmap (RFC process), deployment action, Starlight docs builder
- `roadmap` repo used for public RFCs and planning — community-facing project management
- pnpm workspaces for monorepo dependency management
- `astro-action` for GitHub Pages deployment

**When to use**: Frameworks with distinct subsystems (compiler, runtime, CLI) that benefit from separate contribution histories but shared releases.

### The Working Group Org (tauri-apps)

- Working groups as GitHub Teams: `wg-tauri`, `wg-devops`
- CODEOWNERS maps paths to working groups
- Monorepo with clear subsystem ownership

**When to use**: Mature projects with specialized contributor groups. Teams enforce review requirements automatically.

### The Utility Library Ecosystem (unjs / sindresorhus)

- Dozens to hundreds of small, focused packages
- Each package is its own repo with its own release cycle
- Org profile README serves as the package index
- Contributing to any package follows org-wide defaults from `.github`

**When to use**: Utility ecosystems where each package solves one problem and has independent users.

## Contributing Guide Patterns

### Setup Complexity Tiers

**Lightweight** (JS/TS projects like Astro):
- Requires: Node >=22.12, pnpm >=10.28
- GitHub Codespaces support for zero-install onboarding
- Single `pnpm install && pnpm build` setup

**Heavy** (compiled projects like Bun):
- Requires: LLVM 21.1.8 (specific version), Zig (auto-installed by build script)
- 10-30 minute first setup expectation set explicitly
- Debug build alias (`bun bd`) documented prominently

### Priority Labels

Astro uses a p1-p5 priority scale for issues. This is more expressive than simple priority/non-priority and helps maintainers triage community PRs.

### Branch Targeting Conventions

Biome targets changes to `main` or `next` depending on stability. This should be explicitly documented — contributors who target the wrong branch create merge conflicts.

### AI Contribution Policies

Emerging pattern (Biome, OXC): explicit AI usage disclosure in CONTRIBUTING.md:

- **Biome approach**: AI disclosure as the first section — sets tone before anything else
- **OXC approach**: AI accountability policy — contributor is responsible for all AI-generated code quality, must review and test it, cannot use AI generation as excuse for quality issues

This is becoming a community health default to consider for new orgs in 2025+.

### Just Commands (Biome pattern)

Using `just` (Justfile) for project commands standardizes the contributor experience across platforms:
```
just build
just test
just lint
```
Avoids npm script confusion and works identically in all shells.

### Changesets for Versioning

Biome and others use Changesets for coordinated multi-package version management. Contributors add a changeset file alongside their PR describing the change type (major/minor/patch), and release automation assembles the changelog.

## Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Org defaults silently overridden | Repo has any file in `.github/ISSUE_TEMPLATE/` | Audit all repos; prefer org defaults where possible |
| `.github` repo is private | Created as private by default | Must be public for defaults to cascade |
| CODEOWNERS pattern order wrong | Assuming first match wins | Remember: last matching pattern wins |
| Reusable workflow permissions escalation | Caller tries to grant more than caller has | Permissions are only reducible, never elevated |
| Workflow nesting beyond 10 levels | Over-decomposed reusable workflows | Flatten; use composite actions for deeply nested logic |
| Pinned repos not updated post-launch | Set once and forgotten | Review pins at each major release |
| Contributing guide assumes one platform | Windows contributors fail silently | Test setup steps on Windows or document platform limits |

## Best Practices

1. **Create `.github` repo first** — Before any other repo. It's the org's foundation. (Source: GitHub Docs)
2. **Pin repos strategically** — Primary product + setup action + docs + roadmap covers most navigation needs. (Source: oven-sh, withastro patterns)
3. **Use working groups as GitHub Teams** — Map CODEOWNERS to teams, not individuals. Individuals leave; teams persist. (Source: tauri-apps)
4. **Set contributing guide setup time expectations explicitly** — "This takes 10-30 minutes" prevents contributor abandonment. (Source: Bun contributing guide)
5. **Add AI contribution policy early** — Easier to establish norms before your first AI-assisted PR than after. (Source: Biome, OXC)
6. **Use `secrets: inherit` for org-internal reusable workflows** — Avoids secret enumeration and future maintenance. (Source: GitHub Actions docs)
7. **Separate the standard library / docs into its own repo** — Deno, Astro, and others all do this. Separate release cadence, separate contributors. (Source: denoland, withastro)
8. **Use a `roadmap` repo for public RFCs** — Gives contributors a place to discuss direction without polluting the main issue tracker. (Source: withastro)
9. **Verify your org's domain** — GitHub org domain verification adds authority and enables SAML SSO. (Source: denoland example)
10. **Consider Changesets from day one** — Retrofitting automated versioning is painful; starting with it is cheap. (Source: Biome pattern)

## Org Structure Decision Guide

```
Single product?
├── Yes → Focused minimal org (oven-sh model)
│         Repos: product + setup-action + homebrew-tap + awesome-list
└── No → Multiple products?
         ├── Related subsystems → Framework org (withastro model)
         │   Repos: core + compiler + docs + action + roadmap
         ├── Many small utilities → Ecosystem org (unjs model)
         │   Each utility = own repo, org README = index
         └── Large platform → Ecosystem org (denoland model)
             Repos: runtime + std + frameworks + toolchains
```

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [GitHub: Default community health files](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file) | Official Docs | Primary reference for `.github` repo mechanics |
| [GitHub: Reusing workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows) | Official Docs | Complete `workflow_call` reference with constraints |
| [GitHub: Starter workflows](https://docs.github.com/en/actions/using-workflows/creating-starter-workflows-for-your-organization) | Official Docs | How to create org-level workflow templates |
| [withastro org](https://github.com/withastro) | Example | Framework org archetype with roadmap pattern |
| [tauri-apps CODEOWNERS](https://github.com/tauri-apps/tauri/blob/dev/.github/CODEOWNERS) | Example | Working group CODEOWNERS pattern |
| [biomejs CONTRIBUTING.md](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) | Example | AI disclosure + just commands pattern |
| [oxc-project CONTRIBUTING.md](https://github.com/oxc-project/oxc/blob/main/CONTRIBUTING.md) | Example | AI accountability policy |
| [denoland org](https://github.com/denoland) | Example | Large ecosystem org structure |
| [unjs org](https://github.com/unjs) | Example | Utility ecosystem, many small packages |
| [GitHub: About CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) | Official Docs | CODEOWNERS syntax and precedence rules |

---

*This guide was synthesized from 18 sources. See `resources/github-org-structure-patterns-sources.json` for full source list.*
