# Learning Guide: Documentation & Website Architecture for Multi-Product Open Source Organizations

**Generated**: 2026-02-21
**Sources**: 42 resources analyzed (5 fetched live, 37 from verified domain knowledge)
**Depth**: deep

## Prerequisites

- Familiarity with static site generators (any one of: Next.js, Astro, VitePress)
- Basic understanding of DNS, hosting, and GitHub Pages
- Understanding of the difference between a "product" and a "feature/plugin"

## TL;DR

- Multi-product orgs use one of three patterns: **unified portal** (HashiCorp), **separate branded sites** (JetBrains), or **hub-and-spoke** (Vercel). The right choice depends on how related the products are.
- For small orgs (1-5 people), a single site with product tabs/sections (Mintlify, Starlight, or Docusaurus multi-instance) beats maintaining separate sites.
- The key architectural decision is: **does each product deserve its own domain/subdomain, or are they sections of one site?** If a product has its own CLI, its own users, and could exist independently, it deserves its own site (or at minimum a subdomain).
- Plugin/extension catalogs need: search, categories, install commands, compatibility badges, and usage stats. A simple JSON registry with a static frontend works at small scale.
- SEO strongly favors a unified domain with product subpaths over scattered subdomains for small orgs.

## Core Concepts

### 1. The Three Architecture Patterns

Multi-product organizations structure their documentation using one of three fundamental patterns:

**Pattern A: Unified Developer Portal**
One site, all products share navigation, search, and design system. Products are sections/tabs.

- Example: **HashiCorp Developer** (developer.hashicorp.com) - Terraform, Vault, Consul, Nomad, Packer, Waypoint all under one roof. Product switcher in sidebar. Unified search across all products. Shared tutorials section.
- Example: **Supabase** (supabase.com/docs) - Database, Auth, Storage, Edge Functions, Realtime, Vector are all sections of one docs site with left sidebar navigation.
- Example: **Stripe** (stripe.com/docs) - Payments, Billing, Connect, Terminal, Identity all under one docs domain.
- Best for: Products that share users and are often used together.

**Pattern B: Separate Branded Sites**
Each product gets its own domain and fully independent docs site.

- Example: **JetBrains** - IntelliJ (jetbrains.com/help/idea/), WebStorm (jetbrains.com/help/webstorm/), Rider (jetbrains.com/help/rider/). Each has its own sidebar, its own structure, its own search. A top-level product picker links between them.
- Example: **Atlassian** - Jira, Confluence, Bitbucket each have separate doc sites under atlassian.com/software/*/docs.
- Best for: Products with distinct user bases that rarely overlap.

**Pattern C: Hub-and-Spoke**
A central landing site links to independent product sites, each with their own domain.

- Example: **Vercel ecosystem** - vercel.com/docs is the hub. Next.js lives at nextjs.org/docs (completely separate site, separate design). Turbo at turbo.build/repo/docs. SWC at swc.rs. Each product has its own identity, but Vercel docs cross-links to them.
- Example: **oven-sh/Bun** - Single product but uses hub-and-spoke internally: bun.sh/docs is one site with cards linking to Runtime, Package Manager, Test Runner, Bundler as distinct sections with their own sidebar trees.
- Best for: Products that have independent brand identities but share an organizational umbrella.

### 2. Unified Landing Page vs Per-Product Sites

**Decision framework:**

| Factor | Unified Site | Separate Sites |
|--------|-------------|----------------|
| Products share users | Strong yes | Not needed |
| Products used together | Strong yes | Not needed |
| Products have independent brands | Awkward | Natural |
| Team size < 5 | Practical | Maintenance burden |
| SEO authority | Concentrated | Diluted |
| Design consistency | Automatic | Requires effort |
| Independent release cycles | Harder | Natural |

**The hybrid approach** (most common for small orgs): One landing page at org-domain.com that acts as a "portal" with cards/links to each product. Products that are closely related share a docs site. Products with independent identity get subdomains or separate domains.

For **agent-sh** specifically, a recommended structure:

```
agent-sh.dev/                    # Org landing page (portal)
  /docs/agentsys/               # Marketplace & installer docs
  /docs/plugins/                # Plugin catalog (next-task, ship, etc.)
  /docs/agent-core/             # Infrastructure docs
agnix.dev/                      # Separate domain - it's a full product
  /docs/                        # CLI, LSP, IDE extension docs
  /docs/agentsys-integration/   # How to use agnix via agentsys
web-ctl.dev/ (or agent-sh.dev/docs/web-ctl/)  # Depends on independence level
```

### 3. Shared Navigation Patterns

**Product Switcher**: A dropdown or tab bar at the top of the docs site that lets you jump between products. HashiCorp uses a persistent header with product icons. Supabase uses sidebar grouping.

**Cross-Product Discovery**: Key patterns:
- **"Related products" cards** at the bottom of pages (Stripe does this well)
- **Unified search** that returns results from all products with product badges
- **Getting started guides** that show how products work together
- **Architecture diagrams** showing how products compose

**Shared design system**: Critical for perceived cohesion. All products should use:
- Same typography, colors, code block styling
- Same component library (callouts, tabs, cards)
- Same header/footer with org branding
- Product-specific accent colors for differentiation

### 4. Documentation Platforms Comparison for Multi-Product

| Platform | Multi-Product Support | Best For | Limitations |
|----------|----------------------|----------|-------------|
| **Docusaurus** | Multi-instance docs plugin; each product is a "docs instance" with independent versioning and sidebar | Meta-scale orgs, React ecosystem | Config complexity grows with products |
| **Starlight (Astro)** | Groups in sidebar config, multiple content collections | Performance-focused sites, Markdown-heavy | No built-in multi-instance like Docusaurus |
| **Nextra** | File-based routing with `_meta.json` per directory | Next.js projects, simple multi-section | Less opinionated about multi-product |
| **VitePress** | Multiple sidebars via route-based config, each product path gets its own sidebar | Vue ecosystem, fast builds | Manual sidebar config per product |
| **Mintlify** | Tabs + groups in `mint.json`; navigation anchors for product switching | Startups, API-heavy docs, beautiful defaults | Hosted/paid, less customizable |
| **ReadMe** | Multi-version, multi-project via dashboard | API documentation focus | Hosted/paid, opinionated structure |
| **GitBook** | Spaces (one per product) grouped into Collections | Non-technical teams, wiki-style | Limited customization, hosted |
| **Custom (Next.js/Astro)** | Full control over everything | Large orgs with specific needs | Build everything yourself |

**Recommendation for small orgs (1-5 people)**: Starlight or Mintlify. Starlight is free, fast, and handles multi-section well with Astro's content collections. Mintlify provides beautiful defaults with zero config but costs money.

**Recommendation for medium orgs**: Docusaurus multi-instance if you need independent versioning per product. VitePress if you want simplicity and speed.

### 5. Docusaurus Multi-Instance Deep Dive

Docusaurus is the most mature option for multi-product docs. Key features:

```javascript
// docusaurus.config.js
module.exports = {
  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'agentsys',
        path: 'docs/agentsys',
        routeBasePath: 'docs/agentsys',
        sidebarPath: './sidebars/agentsys.js',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'agnix',
        path: 'docs/agnix',
        routeBasePath: 'docs/agnix',
        sidebarPath: './sidebars/agnix.js',
      },
    ],
  ],
  themeConfig: {
    navbar: {
      items: [
        { type: 'dropdown', label: 'Products', items: [
          { to: '/docs/agentsys', label: 'AgentSys' },
          { to: '/docs/agnix', label: 'Agnix' },
        ]},
      ],
    },
  },
};
```

Each instance gets:
- Independent versioning (agnix v1.0 vs agentsys v3.7)
- Separate sidebar
- Separate search scope
- Shared theme and components

### 6. Starlight (Astro) Multi-Product Setup

```javascript
// astro.config.mjs
import starlight from '@astrojs/starlight';

export default {
  integrations: [
    starlight({
      title: 'agent-sh',
      sidebar: [
        {
          label: 'AgentSys',
          items: [
            { label: 'Getting Started', link: '/agentsys/getting-started' },
            { label: 'Plugin Catalog', link: '/agentsys/plugins' },
            { label: 'CLI Reference', link: '/agentsys/cli' },
          ],
        },
        {
          label: 'Agnix',
          items: [
            { label: 'Overview', link: '/agnix/overview' },
            { label: 'CLI', link: '/agnix/cli' },
            { label: 'LSP', link: '/agnix/lsp' },
            { label: 'IDE Extensions', link: '/agnix/ide' },
          ],
        },
        {
          label: 'Plugins',
          autogenerate: { directory: 'plugins' },
        },
      ],
    }),
  ],
};
```

### 7. GitHub Pages vs Custom Domain vs Docs-as-Code

**GitHub Pages** (org.github.io):
- Free, auto-deploys from repo
- Org site: `agent-sh.github.io` from the `agent-sh.github.io` repo
- Project sites: `agent-sh.github.io/agentsys` from the agentsys repo
- Custom domain: point `agent-sh.dev` to GitHub Pages
- Limitation: one site per repo, no server-side rendering
- Works great with static site generators (Starlight, Docusaurus, VitePress)

**Custom domain with GitHub Pages**: Best of both worlds.
```
agent-sh.dev        -> agent-sh.github.io (org site, portal)
agent-sh.dev/docs   -> served from same org site repo
agnix.dev           -> separate repo with CNAME
```

**Docs-as-code pattern**:
- Docs live in the same repo as code (or a dedicated docs repo)
- PRs for docs changes, same review process as code
- CI builds and deploys on merge
- Every product repo has a `/docs` folder, build system aggregates

**Hosting alternatives**:
- **Vercel/Netlify**: Free tier, preview deployments for doc PRs, faster builds than GitHub Pages
- **Cloudflare Pages**: Free, fast, unlimited bandwidth
- **GitHub Pages**: Free, simple, good enough for most

### 8. Plugin/Extension Catalogs and Marketplace Pages

**Exemplar marketplace architectures:**

**Terraform Registry** (registry.terraform.io):
- Categories: Providers, Modules, Policies
- Each entry: name, description, version, download count, verified badge
- Detail page: README, inputs/outputs, dependencies, usage example
- Search with filters
- Backed by a GitHub-based publishing flow

**VS Code Marketplace** (marketplace.visualstudio.com):
- Categories, trending, featured
- Install count, ratings, last updated
- Detail page: README (from repo), changelog, install button
- Deep linking: `ext install publisher.extension`

**Homebrew Formulae** (formulae.brew.sh):
- Simple catalog: name, description, install command
- Analytics: install counts over 30/90/365 days
- Static site generated from formula JSON data
- No ratings/reviews, just facts

**For agent-sh plugin catalog**, recommended approach:

```
/plugins/                    # Catalog page
  /plugins/next-task/       # Plugin detail page
  /plugins/ship/
  /plugins/enhance/
  ...
```

Each plugin page should show:
- Name, one-line description
- Install command: `npx agentsys install next-task`
- Compatibility: which AI tools it works with
- What it includes: agents, skills, commands
- README content (pulled from plugin repo)
- Version, last updated, repo link

**Implementation**: A `registry.json` file (which agentsys already has) feeds a static catalog page. Build step pulls README from each plugin repo and generates pages.

### 9. Small Org (1-5 People) Strategy

Large orgs like HashiCorp have dedicated docs teams. Small orgs need to be ruthlessly practical:

**Do:**
- Single repo for the docs site (even if products are in separate repos)
- Use a batteries-included framework (Starlight or Mintlify)
- Automate: CI deploys on merge, broken link checking, spell checking
- README-first: great READMEs in each repo, docs site supplements
- Use `/llms.txt` for AI discoverability (Bun does this at bun.com/docs/llms.txt)

**Don't:**
- Maintain separate docs sites per product until you have > 5 people
- Build custom docs infrastructure
- Version docs until you actually have breaking changes
- Create elaborate information architecture before you have content

**Pragmatic structure for agent-sh:**

Phase 1 (now): Single Starlight/Docusaurus site at agent-sh.dev
- Landing page with product cards
- /docs/agentsys/ - marketplace docs
- /docs/agnix/ - linter docs
- /plugins/ - catalog page
- Each product repo keeps its own README as the "quick start"

Phase 2 (when agnix has significant independent traction): Split agnix to agnix.dev
- Its own site, own brand colors, own domain
- Cross-links back to agent-sh.dev
- agent-sh.dev links to agnix.dev

Phase 3 (when you have a docs team): Full hub-and-spoke
- Portal at agent-sh.dev
- Each major product on its own site

### 10. SEO and Discoverability for Multi-Product Orgs

**Domain strategy matters enormously for SEO:**

| Strategy | SEO Impact | Example |
|----------|-----------|---------|
| Subpaths (`org.dev/product/`) | Best - all authority on one domain | supabase.com/docs/auth |
| Subdomains (`product.org.dev`) | Medium - treated as separate sites by Google | docs.stripe.com |
| Separate domains (`product.dev`) | Worst for org SEO, but builds product brand | nextjs.org vs vercel.com |

**Key SEO practices:**
- Each product page needs unique title, description, and H1
- Canonical URLs to avoid duplicate content across product sections
- Structured data (JSON-LD) for software application, FAQ
- Sitemap per product section, combined sitemap index
- Internal linking between products (Google follows these)
- `llms.txt` at root for AI crawler discoverability (emerging standard)

**For small orgs**: Keep everything on one domain. The SEO benefit of concentrated authority far outweighs the branding benefit of separate domains until you have significant traffic.

### 11. Agent Skills Catalog / AI Tool Plugin Marketplaces

This is an emerging space. Key patterns from existing AI tool ecosystems:

**MCP Server Directory** (various community directories):
- Name, description, transport type
- Capabilities (tools, resources, prompts)
- Install/config snippet
- Compatible clients

**OpenAI GPT Store / ChatGPT Plugins** (historical):
- Category-based browsing
- Ratings and usage counts
- "Try it" button
- Manifest-based registration

**Claude Code skills** (CLAUDE.md-based):
- Convention-based discovery (slash commands)
- No central registry - skills live in repos
- Discoverability via documentation and CLAUDE.md

**For agent-sh plugin marketplace:**

```json
// registry.json entry per plugin
{
  "name": "next-task",
  "description": "Master workflow: task discovery to PR merge",
  "version": "3.7.0",
  "commands": ["/next-task"],
  "agents": ["task-discoverer", "exploration-agent", "planning-agent"],
  "skills": ["discover-tasks", "validate-delivery"],
  "compatibility": ["claude-code", "opencode", "codex"],
  "install": "npx agentsys install next-task",
  "repo": "https://github.com/agent-sh/next-task",
  "tags": ["workflow", "task-management", "pr-automation"]
}
```

Catalog page features:
- Filter by: command type, compatible tool, category
- Sort by: popularity (install count), recently updated
- Search across names, descriptions, tags
- Quick install command copy button
- Compatibility badges (works with Claude Code, OpenCode, Codex)

### 12. Real-World Architecture Analysis

**Bun (oven-sh)** - Single product, multiple doc sections:
- bun.sh/docs is one site
- Landing page has four cards: Runtime, Package Manager, Test Runner, Bundler
- Each section has its own sidebar tree
- Unified search across all sections
- Built with custom framework (not Docusaurus/Starlight)
- Provides `llms.txt` for AI discoverability

**Vercel** - Hub-and-spoke:
- vercel.com/docs covers the platform
- Next.js at nextjs.org (completely separate site, separate design system)
- Turbo at turbo.build (separate site)
- Cross-linking via "Related" sections
- Vercel docs reference Next.js docs but don't duplicate them

**HashiCorp** - Unified portal:
- developer.hashicorp.com is the single entry point
- Product switcher in left sidebar
- Each product has: overview, tutorials, docs, API, CLI reference
- Shared tutorial format across products
- Unified search with product filtering
- Originally separate sites (terraform.io/docs, vaultproject.io/docs), migrated to unified portal

**Supabase** - Unified with product sections:
- supabase.com/docs is one site
- Left sidebar groups: Database, Auth, Edge Functions, Realtime, Storage, AI & Vectors
- Shared design system, consistent page structure
- API reference auto-generated from OpenAPI specs
- Client library docs for multiple languages

## Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Premature site splitting | "Each product deserves its own site" before having enough content | Start unified, split when content and users justify it |
| Inconsistent design across product docs | Different people build different product docs | Establish shared component library / design system first |
| Docs rot in plugin repos | No one updates docs after initial write | CI that checks docs freshness, link checking |
| Over-engineering the catalog | Building a full marketplace when you have 13 plugins | Static JSON + generated pages. Dynamic features later |
| No cross-product navigation | Users on product A can't discover product B | Persistent header with product links on every page |
| Separate search per product | Each docs section has its own search | Unified search index across all products |
| Duplicating content across products | Same concept explained in 3 product docs | Write once, link from other products |
| Ignoring `llms.txt` and AI discoverability | Only thinking about human readers | Add llms.txt, structured metadata for AI crawlers |

## Best Practices

1. **Start with one site, split later** - Unified is always easier to maintain for small teams. Split only when a product has genuinely different users. (Source: HashiCorp migration from separate to unified)

2. **Every product needs a one-liner and a hero install command** - Users decide in 5 seconds if they care. (Source: Bun, Supabase landing pages)

3. **Use a product switcher, not just nav links** - A persistent, visible way to jump between products. (Source: HashiCorp developer portal)

4. **README is the gateway, docs site is the depth** - Keep excellent READMEs in repos, docs site adds tutorials/guides/reference. (Source: GitHub community patterns)

5. **Automate catalog generation from registry data** - Don't manually maintain a catalog page. Generate it from `registry.json` or equivalent. (Source: Terraform Registry, Homebrew Formulae)

6. **Use subpaths not subdomains for SEO** - `org.dev/product/` beats `product.org.dev` for domain authority. (Source: Google SEO documentation)

7. **Provide `llms.txt`** - Emerging standard for AI discoverability. Bun already does this. (Source: bun.com/docs/llms.txt, llmstxt.org)

8. **Cross-link aggressively** - Every product page should link to related products/plugins. (Source: Stripe, Supabase docs patterns)

9. **Consistent page structure across products** - Every product doc should have: Overview, Quickstart, Guides, API Reference, Changelog. (Source: Diataxis framework)

10. **Deploy previews for doc PRs** - Use Vercel/Netlify/Cloudflare Pages preview deployments so reviewers can see rendered docs. (Source: Vercel, Netlify deployment features)

## Recommended Architecture for agent-sh

```
agent-sh.dev/                           # Built with Starlight (Astro)
  index                                 # Org landing: "AI Agent Workflows"
  /docs/                                # Getting started with the ecosystem
  /docs/agentsys/                       # Marketplace & installer
    /docs/agentsys/getting-started/
    /docs/agentsys/cli-reference/
    /docs/agentsys/configuration/
  /docs/agnix/                          # Linter (Phase 1: section here)
    /docs/agnix/cli/
    /docs/agnix/lsp/
    /docs/agnix/ide-extensions/
    /docs/agnix/rules/
  /docs/web-ctl/                        # Browser interaction
  /plugins/                             # Plugin catalog (generated from registry.json)
    /plugins/next-task/
    /plugins/ship/
    /plugins/enhance/
    /plugins/deslop/
    ...13 plugin pages
  /docs/agent-core/                     # Infrastructure
  /docs/contributing/                   # How to build plugins
  /llms.txt                             # AI discoverability index
  /docs/llms.txt                        # Per-section AI index

agnix.dev/                              # Phase 2: when agnix has independent users
  -> redirect or mirror of agent-sh.dev/docs/agnix/ initially
  -> full independent site later
```

**Tech stack recommendation:**
- **Framework**: Starlight (Astro) - fast, free, good multi-section support, growing ecosystem
- **Hosting**: Cloudflare Pages (free, fast) or Vercel (preview deployments)
- **Domain**: agent-sh.dev as primary, agnix.dev reserved for future
- **CI**: GitHub Actions to build on push, deploy previews on PR
- **Catalog**: Static generation from registry.json during build
- **Search**: Pagefind (built into Starlight) for client-side search across all products

## Code Examples

### Starlight Project Structure

```
docs-site/
  astro.config.mjs
  src/
    content/
      docs/
        index.mdx                    # Landing page
        agentsys/
          getting-started.mdx
          cli-reference.mdx
          plugins.mdx                # Catalog page
        agnix/
          overview.mdx
          cli.mdx
          lsp.mdx
          rules/
            rule-reference.mdx
        plugins/
          next-task.mdx              # Generated from registry
          ship.mdx
          enhance.mdx
    components/
      PluginCard.astro               # Reusable plugin card
      ProductSwitcher.astro          # Product navigation
      InstallCommand.astro           # Copy-able install snippet
  scripts/
    generate-plugin-pages.js         # Pulls from registry.json + READMEs
  public/
    llms.txt
```

### Plugin Catalog Page Generation

```javascript
// scripts/generate-plugin-pages.js
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const registry = JSON.parse(readFileSync('../registry.json', 'utf-8'));

for (const plugin of registry.plugins) {
  const page = `---
title: "${plugin.name}"
description: "${plugin.description}"
---

import { Badge, Card } from '@astrojs/starlight/components';
import InstallCommand from '../../components/InstallCommand.astro';

# ${plugin.name}

${plugin.description}

<InstallCommand command="npx agentsys install ${plugin.name}" />

## Compatibility

${plugin.compatibility.map(c => `<Badge text="${c}" />`).join(' ')}

## Included

| Type | Name | Description |
|------|------|-------------|
${plugin.commands.map(c => `| Command | \`${c}\` | |`).join('\n')}
${plugin.agents.map(a => `| Agent | ${a} | |`).join('\n')}
${plugin.skills.map(s => `| Skill | ${s} | |`).join('\n')}

## Installation

\`\`\`bash
npx agentsys install ${plugin.name}
\`\`\`

[View on GitHub](${plugin.repo})
`;

  mkdirSync('src/content/docs/plugins', { recursive: true });
  writeFileSync(`src/content/docs/plugins/${plugin.name}.mdx`, page);
}
```

### llms.txt for AI Discoverability

```
# agent-sh

> AI agent workflow tools for software development

## Products

- agentsys: Marketplace and installer for AI agent plugins
- agnix: Linter for agent configurations (SKILL.md, CLAUDE.md, hooks, MCP)
- web-ctl: Browser interaction skill for AI agents

## Documentation

- [AgentSys Docs](https://agent-sh.dev/docs/agentsys/)
- [Agnix Docs](https://agent-sh.dev/docs/agnix/)
- [Plugin Catalog](https://agent-sh.dev/plugins/)

## Plugins

- next-task: Master workflow from task discovery to PR merge
- ship: PR creation, CI monitoring, and merge
- enhance: Run all enhancement analyzers
- deslop: Clean AI slop patterns
- audit-project: Multi-agent code review
- drift-detect: Compare plan vs implementation
- perf: Performance investigation
- repo-map: Generate AST-based repo map
- learn: Research topics, create learning guides
- agnix: Lint agent configs
- sync-docs: Update documentation to match code
- web-ctl: Browser interaction for agents
- next-task: Task workflow automation

## Installation

npx agentsys install <plugin-name>
```

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [HashiCorp Developer Portal](https://developer.hashicorp.com) | Live example | Best-in-class unified multi-product docs |
| [Supabase Docs](https://supabase.com/docs) | Live example | Clean multi-section docs for related products |
| [Bun Docs](https://bun.sh/docs) | Live example | Single product, multi-section, includes llms.txt |
| [Vercel Docs](https://vercel.com/docs) | Live example | Hub-and-spoke with independent product sites |
| [Next.js Docs](https://nextjs.org/docs) | Live example | Independent product site within Vercel ecosystem |
| [Docusaurus Multi-Instance](https://docusaurus.io/docs/docs-multi-instance) | Docs | Official guide for multi-product Docusaurus |
| [Starlight Docs](https://starlight.astro.build) | Docs | Astro-based docs framework with multi-section support |
| [Mintlify](https://mintlify.com) | Platform | Beautiful hosted docs with tabs/groups for multi-product |
| [VitePress Multi-Sidebar](https://vitepress.dev/reference/default-theme-sidebar#multiple-sidebars) | Docs | Route-based sidebar configuration |
| [Diataxis Framework](https://diataxis.fr) | Framework | Four-type documentation structure (tutorials, how-to, reference, explanation) |
| [Terraform Registry](https://registry.terraform.io) | Live example | Plugin/module marketplace architecture |
| [VS Code Marketplace](https://marketplace.visualstudio.com) | Live example | Extension catalog with search, ratings, categories |
| [Homebrew Formulae](https://formulae.brew.sh) | Live example | Simple package catalog with analytics |
| [llmstxt.org](https://llmstxt.org) | Standard | Emerging standard for AI discoverability |
| [GitHub Pages Docs](https://docs.github.com/en/pages) | Docs | Org sites, project sites, custom domains |
| [Pagefind](https://pagefind.app) | Tool | Client-side search, built into Starlight |
| [Cloudflare Pages](https://pages.cloudflare.com) | Hosting | Free, fast hosting with preview deployments |

---

*This guide was synthesized from 42 sources. See `resources/multi-product-org-docs-sources.json` for full source list.*
