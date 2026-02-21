# Learning Guide: OSS Org Naming Patterns for Developer Tool Ecosystems

**Generated**: 2026-02-20
**Sources**: 24 resources analyzed
**Depth**: medium

---

## Prerequisites

- Basic familiarity with GitHub organizations vs personal accounts
- Awareness of npm scopes (`@scope/package`)
- Understanding that GitHub and npm share flat global namespaces (no hierarchy)

---

## TL;DR

- When your primary name is taken on GitHub, the dominant strategies are: add a `-js`, `-dev`, `-hq`, `-labs`, `-team`, or `with` prefix/suffix — each carries different signals
- Successful ecosystems use a consistent plugin naming convention (`vite-plugin-*`, `@babel/*`, `eslint-plugin-*`) that makes the parent brand the discoverable prefix
- npm scopes (`@yourorg/package`) solve namespace pollution and are now the modern standard over flat `toolname-plugin-feature` names
- Org name credibility comes from the work shipping under it, not the cleverness of the name — abstract/opaque names (unjs, oven-sh, bombshell-dev) work fine once the tools prove themselves
- The `-dev` suffix (vitest-dev, biomejs) signals "development org"; `-labs` signals "experimental/innovative"; `-team` (drizzle-team) signals "we are people, not just a repo"

---

## Core Concepts

### 1. The GitHub Namespace Problem

GitHub has a flat global namespace: every username and org name competes in the same pool. When `vue` was already a user, the Vue.js framework became `vuejs`. When `react` was taken, the React community org became `reactjs`. When `anthropic` was already registered, Anthropic became `anthropics`.

The naming strategies below represent what the open source community has converged on over roughly a decade.

**The core tension**: you want discoverability (name matches your tool), but the obvious name is often taken. Every strategy involves a tradeoff between brevity, clarity, and availability.

### 2. The Major Suffix and Prefix Strategies

Projects that could not claim their bare tool name use one of these patterns:

| Strategy | Examples | Signal |
|----------|----------|--------|
| `+js` suffix | `vuejs`, `reactjs`, `feathersjs`, `storybookjs` | "JavaScript ecosystem project"; most common for JS frameworks pre-2020 |
| `+dev` suffix | `vitest-dev`, `biomejs` (implicit) | "This is the development org"; common for newer JS tools |
| `+labs` suffix | `tremorlabs`, `tailwindlabs` | "Company behind the tool"; implies innovation, commercial entity |
| `+team` suffix | `drizzle-team` | "Humans maintain this"; warm, approachable, sustainability signal |
| `+hq` suffix | Various smaller projects | "Headquarters"; less common, slightly corporate |
| `with` prefix | `withastro` | "Built with X" positioning; readable as verb phrase |
| `-ui` / `-css` descriptor | `shadcn-ui` | Adds product category when personal account holds bare name |
| Company name | `oven-sh` (Bun), `bombshell-dev` (clack) | Parent org owns ecosystem; tool name is repo, not org |
| Abstract collective | `unjs`, `antfu-collective` | Signals community ownership rather than individual |
| Full spelled-out name | `modelcontextprotocol` | Spec/standards bodies; authority over cleverness |

**Key insight**: The `-js` suffix feels dated for projects started after 2022. Newer projects prefer `-dev`, `-team`, or a distinct company/brand name as the org.

### 3. The Company-Behind-the-Tool Pattern

Several of the most credible organizations use the **parent company or brand as the org**, with the tool living as a repo:

- `oven-sh` → `oven-sh/bun` (Oven is the company; Bun is the product)
- `bombshell-dev` → `bombshell-dev/clack` (Bombshell is the brand; clack is the tool)
- `charmbracelet` → `charmbracelet/bubbletea`, `charmbracelet/gum` (Charm is the company; each tool is a repo)
- `tailwindlabs` → `tailwindlabs/tailwindcss` (TailwindLabs is the company)
- `drizzle-team` → `drizzle-team/drizzle-orm` (the team owns the ORM)

This pattern works especially well when you plan to ship multiple tools. The org becomes the brand umbrella, and each repo name can be clean and short.

**Credibility note**: `charmbracelet` demonstrates this perfectly. The org name is stylistically unusual, but `bubbletea` (39k stars), `gum` (22k stars), and `glow` (22k stars) prove that substance beats cleverness. No one questions the name because the software is excellent.

### 4. Ecosystem and Plugin Naming Conventions

Once you have an org, the real ecosystem work is plugin/extension naming. The established patterns:

**Flat prefix pattern** (pre-npm-scopes era, still widely used):
```
vite-plugin-react
babel-plugin-transform-arrow-functions
eslint-plugin-react
prettier-plugin-ruby
rollup-plugin-typescript2
```
The tool name is the discoverability prefix. Anyone searching `vite-plugin` on npm or GitHub finds your ecosystem.

**Scoped package pattern** (modern, recommended for new ecosystems):
```
@babel/core
@babel/plugin-transform-arrow-functions
@babel/preset-env
@inquirer/prompts
@inquirer/select
@clack/prompts
@clack/core
```
Scopes solve namespace pollution on npm (no risk of `babel-plugin-x` colliding with unaffiliated packages) and signal official vs community packages clearly.

**Hybrid pattern** (many mature projects use both):
- Official packages: `@org/package-name`
- Community packages: `tool-plugin-feature` (flat, community convention)
- Example: Babel has `@babel/*` for official, but community still publishes `babel-plugin-*`

**Org-prefix for repos** (official plugins as repos, not just npm):
```
tailwindcss-typography        (tailwindlabs/tailwindcss-typography)
tailwindcss-forms             (tailwindlabs/tailwindcss-forms)
vite-plugin-react             (vitejs/vite-plugin-react)
addon-designs                 (storybookjs/addon-designs)
biome-vscode                  (biomejs/biome-vscode)
```

**Key insight**: The repo naming convention you choose defines what appears in GitHub search. If your org is `mytools` and plugins are `mytools-plugin-*`, searching GitHub for `mytools-plugin` finds your ecosystem. If you use `@mytools/*` as npm scope, that helps npm discoverability but is invisible in GitHub search (which searches repo names, not package names).

### 5. How Successful Projects Grew into Ecosystem Orgs

**Vite (vitejs)**: Started as Evan You's project, moved to `vitejs` org. Official plugins (`vite-plugin-react`, `vite-plugin-vue`) live in the org. Created `vite-ecosystem-ci` (a repo, not a tool) to validate community plugin compatibility. The org is deliberately minimal — core tools only.

**Babel (babel)**: Owned the `babel` org name. Migrated from flat `babel-*` packages to `@babel/*` scoped monorepo. This was a major v7 transition and became a blueprint for ecosystem migrations. The monorepo in `babel/babel` contains 100+ packages.

**Tailwind CSS (tailwindlabs)**: "Labs" signals commercial entity. The company name is `tailwindlabs` but the framework is `tailwindcss`. Official plugins use `tailwindcss-*` naming (not `tailwindlabs-*`), keeping the product name as the brand.

**Nuxt (nuxt)**: Claimed the bare `nuxt` org name. Has a `modules` repo (not a mono-repo, but a registry) that tracks community modules. This shows a third pattern: the org doesn't have to host all plugins — it can host the registry that points to them.

**ESLint (eslint)**: Owns `eslint` org. The community plugin convention is `eslint-plugin-*` (flat). ESLint itself has moved toward official language plugins living in the org as `eslint/json`, `eslint/css`. The plugin naming predates scopes and the ecosystem is too large to migrate.

**Prisma (prisma)**: Owns the bare `prisma` name. Uses descriptive repo names without redundant prefixes (`prisma/studio`, `prisma/language-tools`) because the org itself provides the namespace.

### 6. The npm Scope as Identity

When you register an npm org, you get a scope. The scope and the GitHub org name do not have to match — but aligning them reduces confusion:

```
GitHub org: vitejs       npm scope: (none used, flat vite-plugin-*)
GitHub org: babel        npm scope: @babel
GitHub org: SBoudrias    npm scope: @inquirer  (personal account, named scope)
GitHub org: bombshell-dev npm scope: @clack
GitHub org: antfu-collective npm scope: (individual packages under various scopes)
```

**Best practice for new projects (2024+)**:
1. Register `@yourorgname` npm scope matching your GitHub org
2. Publish `@yourorgname/core`, `@yourorgname/cli`, `@yourorgname/plugin-x`
3. This creates a clear signal: anything under `@yourorgname` is official

npm scoped packages must be lowercase and follow `@scope/package-name` where both scope and name match `[a-z0-9-._~!$&'()*+,;=:@]` (effectively: lowercase letters, numbers, hyphens, dots).

### 7. What Makes a GitHub Org Name Feel Credible vs Try-Hard

**Credibility signals**:
- The org name is clean, lowercase, and easy to type
- It either matches the project/company name exactly, or uses a recognized convention (js, dev, labs, team)
- The README/description is professional without being marketing-speak
- Stars, contributors, and commit activity are visible
- Verified domain in the org profile
- MIT or Apache-2.0 license (signals you want people to use it)
- Pinned repos showcase the actual tools, not meta-content

**Try-hard signals**:
- Name is excessively clever or requires explanation unrelated to the tool
- Org created recently with 1-2 repos, attempting ecosystem naming before the ecosystem exists
- Claims to be a "framework", "platform", or "ecosystem" in description when it is a library
- Plugin or contrib template repos set up before any community exists
- Version numbers in org names or repo names
- Multiple repos that are all stubs

**The "abstract name" exception**: Names like `unjs` (Unified JavaScript), `oven-sh`, `bombshell-dev`, `charmbracelet`, and `antfu-collective` are abstract or unusual — but they work because:
1. The org produced genuinely useful tools first
2. The naming is internally consistent (unjs has the `un*` prefix theme)
3. There is a clear website/brand behind it

**The CLI/agent tooling context**: For CLI tools and agent tooling specifically, naming that signals **reliability and professional maintenance** matters more than cleverness. Developers integrating a tool into their workflow need confidence it will be maintained. Names like `drizzle-team` (people behind it) or `vitest-dev` (dev org) signal ongoing stewardship better than a cute name with no backing.

### 8. The "Collective" and Multi-Maintainer Pattern

When a project outgrows a single person, the org becomes a stewardship signal:

**antfu-collective**: Anthony Fu created this to house tools that are now maintained by a team, distinct from his personal projects. The name signals "started by antfu, now community-owned."

**reactjs vs facebook/react**: Meta owns `facebook/react` (the actual repo), but the `reactjs` org houses documentation, localization, and community tooling. This separation is governance, not just naming.

**withastro**: Astro chose `withastro` (a verb phrase: "build with Astro") rather than `astro` (the adjective/noun) because `astro` was taken. The `with` prefix became a semantic feature — it communicates the framework's value proposition.

---

## Code Examples

### npm Package Naming Patterns

```json
// Modern scoped package setup (package.json)
{
  "name": "@mytool/core",
  "version": "1.0.0",
  "description": "Core library for MyTool"
}

// Official plugin naming
{
  "name": "@mytool/plugin-react",
  "peerDependencies": {
    "@mytool/core": ">=1.0.0"
  }
}

// Community plugin convention (flat naming)
{
  "name": "mytool-plugin-svelte",
  "keywords": ["mytool", "mytool-plugin"]
}
```

### GitHub Org Structure Pattern (hub-and-spoke)

```
org: mytooldev (since "mytool" was taken)
  repos:
    mytool          ← core tool (clean name inside the org namespace)
    mytool-docs     ← documentation site
    mytool-vscode   ← editor integration
    plugins         ← monorepo for official plugins
    ecosystem-ci    ← compatibility testing
    awesome-mytool  ← community curated list

npm scope: @mytool (registered separately, org name mismatch is fine)
  packages:
    @mytool/core
    @mytool/plugin-react
    @mytool/plugin-vue
    @mytool/cli
```

### Plugin Registry Pattern (Nuxt-style)

```
org: mytool
  repos:
    mytool          ← framework
    modules         ← registry (JSON list of community modules)
    module-builder  ← scaffolding for community module authors
    examples        ← reference implementations

Community modules live in their own orgs, listed in mytool/modules registry.
```

### Choosing Between Naming Strategies (Decision Tree)

```
Is your bare name available on GitHub?
  YES → Claim it immediately, align npm scope
  NO  → What is your context?

    Are you a company/team with multiple tools?
      YES → Use company/brand name as org (oven-sh, charmbracelet, tailwindlabs)
            Tool names become clean repo names within the org

    Are you an individual or small team with ONE main tool?
      → Add suffix to tool name:
        - New project (2023+): prefer -dev or -team
        - JS framework: -js still acceptable but dated
        - Commercial entity: -labs, -hq
        - Community project: -collective, just describe it

    Is it a standards body or protocol spec?
      → Use full spelled-out name (modelcontextprotocol, tc39)
```

---

## Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Registering org name before tool exists | Squatting on good names | Validate the project first; names can be changed |
| npm scope and GitHub org name diverge confusingly | npm org was available when GitHub wasn't | Accept the mismatch, document it clearly in README |
| Plugin naming without a scheme | No upfront planning | Pick `@org/plugin-x` or `toolname-plugin-x` at v0.1, stick to it |
| Org name requires explanation in every README | Too clever / abstract | Names that need a glossary entry hurt onboarding |
| Copying ecosystem structure before community exists | Premature architecture | Set up the registry/monorepo when you have 3+ active plugins |
| `-js` suffix for non-JavaScript tools | Historical pattern cargo-culted | Use `-dev`, `-team`, or project-neutral suffix |
| Claiming org but leaving it private | Security squatting / confusion | Either make the org public with a pinned description or skip it |
| Org description says "ecosystem" with 2 repos | Credibility gap | Let stars and contributors prove scale before claiming it |

---

## Best Practices

1. **Claim both your bare name and fallback variants immediately** — register `mytool`, `mytooljs`, `mytool-dev` on GitHub and npm, even if unused, to prevent squatting. Transfer the unused ones to a redirect later.

2. **Align your npm scope with your GitHub org name** (or document the mismatch clearly). `@drizzle` npm scope + `drizzle-team` GitHub org creates no confusion because `drizzle-team`'s README links to `@drizzle` on npm.

3. **Use scoped npm packages for official plugins** and document the community convention for unofficial ones. Example: "Official plugins are `@mytool/plugin-*`; community plugins should follow `mytool-plugin-*`."

4. **Put the canonical tool name as the repo name inside the org**, not the org name. `vitejs/vite` reads better than `vitejs/vitejs`. The org provides the namespace; the repo can be clean.

5. **Ship the tools before building the ecosystem scaffolding.** Credibility flows from shipped, starred tools. An org with 1k stars on its main repo earns more trust than an org with 0-star plugin template stubs.

6. **For CLI and agent tooling**: favor names that signal reliability. `drizzle-team` and `vitest-dev` communicate "maintained by real people actively developing this" which matters when someone is evaluating whether to depend on your tool in their workflow.

7. **Add a verified domain to your GitHub org profile.** This takes minutes and adds significant authority signal, especially for developer tools where the domain is the documentation home.

8. **The "awesome-mytool" repo signals community health.** Creating and maintaining it, or linking to it from the org profile, shows users there is a community, not just an org.

9. **Keep the plugin naming convention in your docs from day 1.** ESLint has `eslint-plugin-*` documented clearly; Vite has `vite-plugin-*`. Community plugins self-organize around documented conventions.

10. **If you use a parent company name as the org** (like `oven-sh` for Bun), ensure the domain `oven.sh` or equivalent is prominently linked from the org. The org name will be opaque to new visitors; the domain resolves the mystery.

---

## Patterns Reference

### The Suffix Taxonomy

| Suffix | Signal | Best For |
|--------|--------|----------|
| (none) | Owns the concept / high authority | Top-tier projects, lucky squatters |
| `-js` | "JavaScript project" | Pre-2022 JS frameworks (dated now) |
| `-dev` | "Development organization" | Modern tools, testing frameworks |
| `-hq` | "Headquarters / canonical home" | Mid-sized projects, single tools |
| `-labs` | "Company, innovation-focused" | Commercial orgs, design systems |
| `-team` | "Humans behind the project" | ORMs, infra tools, warm branding |
| `-ui` | "User interface component scope" | Component libs when UI is core identity |
| `-collective` | "Community-owned, not one person" | Personal brand scaling to team |
| `with{name}` | "Build with X" verb positioning | Frameworks describing their role |
| `{company}` | Parent brand as org | Multi-tool shops, commercial entities |

### Known Naming Workaround Gallery

| Project | Ideal Name | Actual Org | Strategy |
|---------|-----------|------------|----------|
| Vue.js | vue | vuejs | +js suffix |
| React | react | reactjs (community) | +js suffix |
| Vite | vite | vitejs | +js suffix |
| Vitest | vitest | vitest-dev | -dev suffix |
| Astro | astro | withastro | with- prefix |
| Biome | biome | biomejs | +js suffix |
| Storybook | storybook | storybookjs | +js suffix |
| Tailwind | tailwind | tailwindlabs | -labs suffix (company) |
| Drizzle ORM | drizzle | drizzle-team | -team suffix |
| Bun | bun | oven-sh | parent company name |
| Clack | clack | bombshell-dev | parent brand name |
| shadcn/ui | shadcn | shadcn-ui | descriptor suffix |
| Anthropic | anthropic | anthropics | +s (minimal change) |
| Deno | deno | denoland | +land (playful) |
| pkgx | pkgx | pkgxdev | +dev suffix |

---

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [vitejs org](https://github.com/vitejs) | GitHub Org | Canonical example of +js suffix with clean internal naming |
| [tailwindlabs org](https://github.com/tailwindlabs) | GitHub Org | Best example of -labs company org with tool-name repos |
| [withastro org](https://github.com/withastro) | GitHub Org | The "with" prefix strategy and multi-tool org structure |
| [charmbracelet org](https://github.com/charmbracelet) | GitHub Org | Company-as-org with thematic tool naming |
| [drizzle-team org](https://github.com/drizzle-team) | GitHub Org | -team suffix credibility pattern |
| [vitest-dev org](https://github.com/vitest-dev) | GitHub Org | -dev suffix for modern JS tooling |
| [unjs org](https://github.com/unjs) | GitHub Org | Abstract collective name that works because of shipping |
| [antfu-collective org](https://github.com/antfu-collective) | GitHub Org | Personal brand scaling to community stewardship |
| [modelcontextprotocol org](https://github.com/modelcontextprotocol) | GitHub Org | Full-name org for protocol/spec authority |
| [oven-sh org](https://github.com/oven-sh) | GitHub Org | Parent company as org; clean repo names within |
| [bombshell-dev org](https://github.com/bombshell-dev) | GitHub Org | Creative parent brand name for CLI tooling |
| [babel org](https://github.com/babel) | GitHub Org | @babel/* scoped monorepo migration blueprint |
| [nuxt org](https://github.com/nuxt) | GitHub Org | Registry-based ecosystem (not monorepo) model |
| [anthropics org](https://github.com/anthropics) | GitHub Org | +s suffix pattern; SDK naming conventions |
| [shadcn-ui org](https://github.com/shadcn-ui) | GitHub Org | Descriptor suffix when personal account holds bare name |

---

*Generated by /learn from 24 sources.*
*See `resources/oss-org-naming-patterns-sources.json` for full source metadata.*
