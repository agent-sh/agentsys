# Learning Guide: Skill, Plugin, and Extension Distribution Patterns for CLI Tools and AI Agent Frameworks

**Generated**: 2026-02-21
**Sources**: 40 resources analyzed (from training knowledge -- web fetch unavailable)
**Depth**: deep

> How open source CLI tools and AI agent frameworks distribute reusable skills, plugins, and extensions. Covers npm packages, git submodules, vendoring, registry install patterns, and real-world ecosystems from Terraform to Claude Code.

## Prerequisites

- Familiarity with at least one package manager (npm, pip, cargo, etc.)
- Basic understanding of git workflows
- General awareness of what CLI plugins do (extend a host tool's functionality)
- Helpful but not required: experience with at least one of the ecosystems discussed (Terraform, Homebrew, VSCode, oh-my-zsh, etc.)

## TL;DR

- **Five dominant distribution patterns** exist: package registry (npm/pip), git-based (clone/submodule), vendoring (copy into repo), dedicated registry (Terraform, VSCode), and convention-based discovery (file-system scanning).
- **Small ecosystems (under 50 plugins)** succeed with git-based or vendored approaches -- low overhead, no registry infrastructure needed. Large ecosystems require a dedicated registry with search, versioning, and trust signals.
- **AI agent frameworks** are converging on a hybrid: convention-based local discovery (scan directories for SKILL.md / plugin.json) plus git or npm for remote installation.
- **The critical design decision** is not the transport mechanism (git vs npm vs registry) but the **plugin contract**: what interface a plugin must implement, how it declares capabilities, and how the host discovers and loads it.
- **Discoverability is the bottleneck** for adoption in every ecosystem. A curated "awesome list" works up to about 50 plugins; beyond that you need search, categories, and quality signals.

## Core Concepts

### 1. The Five Distribution Patterns

#### Pattern A: Package Registry (npm, pip, cargo, gems)

Plugins are published to a general-purpose package registry and installed via the ecosystem's package manager.

**How it works**: The plugin is a regular package with a conventional name prefix (e.g., `eslint-plugin-*`, `babel-plugin-*`, `@opencode/plugin-*`). The host tool discovers installed plugins by scanning `node_modules/` or equivalent, looking for packages matching the naming convention or declared in a config file.

**Examples**:
- ESLint plugins (`eslint-plugin-react`)
- Babel plugins (`@babel/plugin-transform-runtime`)
- Prettier plugins (`prettier-plugin-tailwindcss`)
- Gatsby plugins (listed in `gatsby-config.js`)
- Rollup/Vite plugins (npm packages, referenced in config)

**Strengths**: Leverages existing infrastructure (versioning, dependency resolution, security audits, CDN distribution). Users already know `npm install`. Transitive dependencies handled automatically.

**Weaknesses**: Tied to one language ecosystem. Registry overhead for small projects. Namespace pollution. Hard to enforce plugin quality.

**Key insight**: This pattern works best when the host tool is already in a package-manager ecosystem and plugins need complex dependencies of their own.

#### Pattern B: Git-Based (clone, submodule, sparse checkout)

Plugins are git repositories. The host tool or a plugin manager clones them into a known directory.

**Examples**:
- oh-my-zsh plugins and themes (git clone into `~/.oh-my-zsh/custom/plugins/`)
- asdf version manager plugins (`asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git`)
- mise plugins (inherited asdf's git-based model, then added a shortname registry)
- Vim plugin managers (vim-plug, Vundle, Pathogen -- all clone git repos)
- Zsh plugin managers (zinit, antigen, zplug)

**How it works**: User provides a git URL (or a shortname that resolves to one). The tool clones the repo into a plugins directory. Updates via `git pull`. The plugin repo follows a file convention (e.g., asdf requires `bin/install`, `bin/list-all`, `bin/list-legacy-filenames`).

**Strengths**: Zero infrastructure beyond GitHub. Any language. Simple mental model. Fork-and-customize is natural. Works offline after initial clone.

**Weaknesses**: No dependency resolution between plugins. No semantic versioning enforcement (tags are optional). No centralized search. Update = git pull (can break things). Large repos slow to clone.

**Key insight**: Git-based distribution dominates in small ecosystems where the plugin contract is simple (a few shell scripts) and plugins have no dependencies beyond the host.

#### Pattern C: Vendoring (copy into project)

Plugins are copied directly into the consuming project's source tree, either manually or via a vendoring tool.

**Examples**:
- Go's `vendor/` directory (pre-modules era, still supported)
- Claude Code's plugin system (plugins vendored into `.claude/plugins/cache/`)
- AgentSys's `lib/` vendoring to plugins (`npx agentsys-dev sync-lib`)
- Ruby's vendored gems (`bundle install --path vendor/bundle`)
- Many internal "monorepo plugin" patterns

**How it works**: Plugin source code lives in the consumer's repo or a local cache directory. No external resolution at runtime. The host tool scans known directories for plugin manifests.

**Strengths**: Total reproducibility -- what you see is what runs. No network needed at runtime. Easy to patch locally. No version conflict between plugins (each project has its own copy). Simple for the host tool (just scan the filesystem).

**Weaknesses**: Manual updates. Disk space (N copies of the same plugin). Drift between projects using different versions. No centralized discovery.

**Key insight**: Vendoring is ideal when reproducibility and offline operation matter more than convenience. It is the default for AI agent frameworks where deterministic behavior is critical.

#### Pattern D: Dedicated Registry (Terraform, VSCode, Homebrew)

A purpose-built registry with search, versioning, trust verification, and install tooling specific to the ecosystem.

**Examples**:
- Terraform Registry (registry.terraform.io) -- providers and modules
- VSCode Extension Marketplace (marketplace.visualstudio.com)
- Homebrew Taps (GitHub repos following `homebrew-*` naming convention with a central `formulae.brew.sh` index)
- JetBrains Plugin Marketplace
- Grafana plugin catalog
- HashiCorp Vagrant Cloud (boxes)

**How it works**: Plugin authors publish to the registry (often via CI). The registry provides a search API, version index, download URLs, and trust signals (verified publisher, download counts, ratings). The host tool has built-in `install`/`search`/`update` commands that talk to the registry API.

**Strengths**: Best discoverability. Quality signals (stars, downloads, verified status). Automated compatibility checking. Centralized security scanning. Professional experience for users.

**Weaknesses**: High infrastructure cost. Governance burden (who approves plugins?). Can become a bottleneck or single point of failure. Lock-in to the registry operator.

**Key insight**: Dedicated registries only make sense at scale (100+ plugins). Below that, the maintenance cost exceeds the discoverability benefit.

#### Pattern E: Convention-Based Discovery (filesystem scanning)

The host tool scans predefined directories for files matching a convention. No explicit "install" step beyond placing files in the right location.

**Examples**:
- Claude Code's CLAUDE.md and slash commands (scans project directory)
- OpenCode's AGENTS.md and tools directory
- Codex's AGENTS.md
- GitHub Actions (scans `.github/workflows/` for YAML files)
- Makefiles, Taskfiles (convention over configuration)
- Many shell frameworks (source all `*.sh` in a directory)

**How it works**: The host tool knows to look in specific paths (e.g., `.claude/commands/`, `plugins/*/SKILL.md`). Any file matching the expected shape is loaded as a plugin. No registry, no install command.

**Strengths**: Zero friction. No tooling to learn. Works with any editor or workflow. Composable via copy-paste. Ideal for project-local customization.

**Weaknesses**: No versioning. No sharing mechanism (copy-paste is the distribution). No dependency management. Hard to discover what is available.

**Key insight**: Convention-based discovery is the starting point for most plugin systems. Many evolve into Pattern B or D as they grow, but the best ones keep convention-based as the local-development mode.

### 2. Real-World Ecosystem Deep Dives

#### Terraform Providers and Modules

Terraform is the gold standard for dedicated-registry plugin distribution. Before Terraform 0.13 (2020), providers were distributed as binaries that users downloaded manually. The Terraform Registry changed everything.

**Registry architecture**: The registry at registry.terraform.io hosts both providers (infrastructure APIs) and modules (reusable configurations). Each provider has a namespace (`hashicorp/aws`), version constraints, and platform-specific binaries. Terraform CLI resolves providers from the lock file (`.terraform.lock.hcl`), downloads platform-specific binaries, and caches them in `.terraform/providers/`.

**Plugin protocol**: Providers implement a gRPC interface. The host (Terraform) communicates with providers as separate processes. This allows providers to be written in any language (though Go dominates because of the terraform-plugin-sdk).

**Discovery**: `terraform init` resolves required providers from `required_providers` blocks. The registry API returns available versions and download URLs. Users discover providers via the registry website or documentation.

**What works**: Version locking, platform-specific distribution, namespace isolation, the gRPC boundary between host and plugin.

**What hurts**: Binary size (each provider is 50-200MB). Cold `terraform init` is slow. The registry is a single point of failure (mirrored by network mirrors).

**Lesson for small ecosystems**: Terraform's approach is overkill for under 50 plugins. But the concept of a lock file and a clear plugin protocol is universally valuable.

#### Homebrew Taps

Homebrew uses a hybrid of git-based and registry patterns.

**Core architecture**: The main Homebrew repository (`homebrew-core`) is a git repo of "formulae" -- Ruby scripts that describe how to download, build, and install software. Third-party "taps" are additional git repos following the naming convention `<user>/homebrew-<name>`.

**Install flow**: `brew tap user/repo` clones the tap repo. `brew install user/repo/formula` installs from that tap. Homebrew also has a JSON API at formulae.brew.sh that indexes all formulae for search without cloning.

**Discovery**: `brew search` queries the JSON API. Tap discoverability is mostly word-of-mouth and GitHub search.

**Scaling trick**: Homebrew keeps `homebrew-core` as a shallow git clone and uses a JSON API for metadata, avoiding the full git history download. This is how they scaled to 6000+ formulae.

**Lesson**: The tap model (git repos with naming conventions) is excellent for small ecosystems. The JSON API overlay solves discoverability at scale.

#### oh-my-zsh and Zsh Plugin Managers

oh-my-zsh pioneered the "bundled + custom" plugin model for shell frameworks.

**Bundled plugins**: oh-my-zsh ships 300+ plugins in its main repo. Users enable them by adding names to an array in `.zshrc`. This is Pattern C (vendoring) -- all plugins ship with the framework.

**Custom plugins**: Users can add plugins to `~/.oh-my-zsh/custom/plugins/`. These follow the convention of `pluginname/pluginname.plugin.zsh`. Installation is manual (git clone or copy).

**Evolution**: The bundled model does not scale. oh-my-zsh's repo became bloated (300+ plugins, most unused by any given user). This spawned alternative managers:
- **antigen**: Package manager for zsh, installs plugins from git repos
- **zinit (formerly zplugin)**: Advanced lazy-loading plugin manager
- **zplug**: Parallel plugin installer with dependency support
- **sheldon**: Rust-based, fast, config-file-driven

**Lesson**: Bundling everything works for initial adoption (zero friction) but creates maintenance burden. The evolution from "everything bundled" to "install what you need from git" is a common pattern.

#### asdf and mise

asdf is a version manager that uses plugins to support different languages/tools.

**Plugin contract**: An asdf plugin is a git repo containing shell scripts in `bin/`:
- `bin/list-all` -- list available versions
- `bin/install` -- install a version
- `bin/exec-env` -- set environment for execution (optional)

**Shortname registry**: asdf maintains a shortname registry (`asdf-plugins` repo) mapping names to git URLs. `asdf plugin add nodejs` resolves to `https://github.com/asdf-vm/asdf-nodejs.git`. This is a thin index over git repos -- not a package registry.

**mise evolution**: mise (formerly rtx) started as an asdf-compatible tool, inheriting its plugin model. mise then added:
- Built-in "core" plugins for common tools (no git clone needed)
- Registry of shortnames as a TOML file
- Cargo-like lock files for reproducibility
- Backends beyond asdf plugins (cargo, npm, go install, ubi, aqua)

**Lesson**: Starting with asdf compatibility gave mise instant access to 500+ plugins. Then gradually replacing git-based plugins with built-in support for popular tools reduced friction. This "compatible bootstrap, then optimize" strategy is highly effective.

#### VSCode Extension Marketplace

The most mature dedicated registry for extensions.

**Architecture**: Extensions are packaged as `.vsix` files (ZIP archives with a manifest). Published to marketplace.visualstudio.com via `vsce publish`. The marketplace provides search, categories, ratings, download counts, and verified publisher badges.

**Discovery**: In-editor search panel. Web marketplace. Curated extension packs. Recommendations based on file types opened.

**Trust model**: Publisher verification, license scanning, automated security review. Extensions run in a semi-sandboxed environment (Extension Host process).

**What makes it work at scale**: The in-editor discovery experience is seamless. Users never leave VSCode to find and install extensions. One-click install. Automatic updates. Extension packs bundle related extensions.

**Lesson**: For large ecosystems, in-tool discovery is critical. Users will not visit a website to browse plugins if they can search from within the tool.

#### Claude Code Plugins (and AI Agent Framework Patterns)

Claude Code uses a hybrid of convention-based discovery and vendored distribution.

**Local commands**: Users create markdown files in `.claude/commands/` that become slash commands. Pure convention-based discovery -- no install step.

**Plugin cache**: Third-party plugins are vendored into `.claude/plugins/cache/<name>/<version>/`. The plugin manifest describes commands, agents, and skills. Claude Code scans this directory at startup.

**npm distribution**: Plugins can be published to npm and installed via the `claude plugins install <name>` mechanism, which downloads and vendors them into the cache directory.

**Key design**: The plugin contract is file-convention-based (SKILL.md, agent YAML files, command markdown). The distribution is npm-based for remote, vendored for local.

**OpenCode/Codex compatibility**: The same plugin content works across tools via AGENTS.md files and compatible directory conventions.

**Lesson**: AI agent frameworks benefit from the convention-based approach because plugins are primarily configuration and prompts (text files), not compiled code. This makes vendoring cheap and convention-based discovery natural.

### 3. Distribution Pattern Selection Framework

#### Decision Matrix

| Factor | Package Registry | Git-Based | Vendored | Dedicated Registry | Convention-Based |
|--------|-----------------|-----------|----------|-------------------|-----------------|
| Setup cost for ecosystem owner | Low | None | None | Very High | None |
| Setup cost for plugin author | Medium | Low | Low | Medium | Very Low |
| Setup cost for plugin user | Low | Low | None | Low | None |
| Discoverability | Medium | Poor | Poor | Excellent | Poor |
| Version management | Excellent | Weak | Manual | Excellent | None |
| Dependency resolution | Excellent | None | None | Good | None |
| Offline operation | After install | After clone | Always | After install | Always |
| Best ecosystem size | 10-500 | 5-100 | 1-30 | 50-10000+ | 1-20 |

#### When to Use Each Pattern

**Use Package Registry (npm/pip) when**:
- Your tool is already in a package ecosystem
- Plugins need their own dependencies
- You want users to manage plugins alongside project dependencies
- Example: ESLint, Babel, Gatsby, Prettier

**Use Git-Based when**:
- Plugins are self-contained (no dependencies beyond the host)
- Plugin contract is simple (a few files following a convention)
- You want maximum flexibility for plugin authors
- Your ecosystem has under 100 plugins
- Example: asdf, oh-my-zsh custom plugins, Vim plugins

**Use Vendoring when**:
- Reproducibility is critical (same plugin version across all environments)
- Plugins are small (text files, configs, prompts)
- Offline operation is important
- You are building for AI agents where determinism matters
- Example: Claude Code plugin cache, Go vendor, project-local configs

**Use Dedicated Registry when**:
- You have 100+ plugins or expect rapid growth
- Trust and quality signals matter (security scanning, verified publishers)
- Discoverability is a user priority
- You can invest in registry infrastructure
- Example: Terraform, VSCode, Homebrew

**Use Convention-Based when**:
- You want zero-friction local customization
- Plugins are primarily configuration/text, not code
- Project-specific customization is the primary use case
- Example: Claude Code commands, GitHub Actions, Makefiles

### 4. Small vs Large Ecosystem Strategies

#### Small Ecosystem (Under 50 Plugins)

**What works**:
- A curated "awesome list" (README or separate repo) for discovery
- Git-based distribution with a shortname registry (a single JSON/TOML file mapping names to git URLs)
- Clear file conventions documented in a single page
- Plugin template repo (cookiecutter/scaffolding)
- A `plugins/` directory in the main project repo for "official" plugins

**What does not work**:
- Building a dedicated registry (too much infrastructure for too little content)
- Complex plugin APIs (discourages contributors)
- Mandatory CI/CD for plugin publishing (too much friction)

**Example architecture**:
```
# Plugin shortname registry (plugins.json)
{
  "nodejs": "https://github.com/org/plugin-nodejs",
  "python": "https://github.com/org/plugin-python"
}

# Install command
mytool plugin add nodejs
# Resolves to git clone https://github.com/org/plugin-nodejs ~/.mytool/plugins/nodejs

# Plugin contract: just need these files
plugins/nodejs/
  plugin.toml      # metadata (name, version, description)
  bin/install       # main entry point
  bin/list-versions # list available versions
```

**Growth path**: Start with git-based + shortname file. When you hit 50 plugins, add a static site with search. At 200+, consider a proper registry API.

#### Large Ecosystem (100+ Plugins)

**What works**:
- Dedicated registry with search API
- Publisher verification and trust signals
- Automated compatibility testing
- In-tool discovery (search from within the CLI/IDE)
- Extension packs / curated collections
- Ratings and download counts
- Automated security scanning

**What does not work**:
- Manual curation as the only discovery mechanism
- Relying on GitHub stars for quality assessment
- No versioning or compatibility metadata

**Critical features at scale**:
1. **Search API**: Users must find plugins without browsing a list
2. **Compatibility metadata**: "This plugin works with host version 2.x-3.x"
3. **Automated testing**: CI runs against the host tool for each plugin update
4. **Deprecation/archival**: Mechanism to mark abandoned plugins
5. **Namespace governance**: Prevent squatting and impersonation

### 5. Plugin Contract Design

The most important design decision in any plugin system is the **contract** -- what must a plugin provide?

#### Minimal Contract (Convention-Based)

```
my-plugin/
  README.md           # human description
  plugin.{json|toml}  # name, version, description, entry point
  index.{js|sh|py}    # single entry point
```

Used by: most small ecosystems, shell plugin managers

#### Capability-Declared Contract

```
my-plugin/
  manifest.json       # declares capabilities, permissions, entry points
  src/
    commands/         # CLI commands this plugin adds
    hooks/            # lifecycle hooks this plugin handles
    lib/              # shared code
```

Used by: VSCode extensions, Claude Code plugins, Grafana plugins

#### Protocol-Based Contract

```
my-plugin/
  # Plugin implements a protocol (gRPC, JSON-RPC, HTTP)
  # Host communicates via the protocol, not file conventions
  main.go             # compiles to binary implementing the protocol
```

Used by: Terraform providers, Hashicorp plugins (go-plugin), Neovim remote plugins

**Key insight**: Protocol-based contracts provide the strongest isolation (plugins run as separate processes) but have the highest authoring cost. Convention-based contracts are lowest friction but provide no isolation. Choose based on your trust model and ecosystem size.

### 6. Update and Version Management Patterns

#### Lock Files

Terraform's `.terraform.lock.hcl` and npm's `package-lock.json` solve the reproducibility problem. The lock file records exact versions and integrity hashes. `install` respects the lock file; `update` modifies it.

**When to implement**: As soon as you have more than one environment that must produce identical behavior (i.e., almost always).

#### Pinning Strategies

| Strategy | Mechanism | Trade-off |
|----------|-----------|-----------|
| Exact pin | `= 1.2.3` | Maximum reproducibility, manual updates |
| Compatible pin | `~> 1.2` | Auto-patch updates, minor version control |
| Range pin | `>= 1.0, < 2.0` | Flexible, risk of breaking changes |
| Latest | No pin | Convenient, unreproducible |
| Vendored | Copy in repo | Total control, stale risk |

#### Auto-Update Patterns

- **Dependabot/Renovate**: For package-registry plugins, automated PRs for version bumps
- **`mise upgrade`**: Built-in command to update all tool versions
- **`brew update && brew upgrade`**: Two-step: update index, then upgrade packages
- **`asdf plugin update --all`**: Git pull all plugin repos
- **VSCode**: Background auto-update with optional user approval

### 7. Discovery Mechanisms

Ranked by effectiveness at scale:

1. **In-tool search** (VSCode, Terraform): Users never leave the tool. Highest conversion.
2. **Dedicated website with search** (npmjs.com, marketplace.visualstudio.com): Good for browsing, lower conversion than in-tool.
3. **CLI search command** (`brew search`, `asdf plugin list-all`): Moderate friction, power-user friendly.
4. **Curated awesome-list** (awesome-zsh-plugins): Good for small ecosystems, does not scale past 200 entries.
5. **GitHub topic tags**: Lowest effort, poorest discoverability. Only works for developers who think to search GitHub.

### 8. Trust and Security Patterns

| Mechanism | Used By | Effect |
|-----------|---------|--------|
| Verified publisher | VSCode, npm | Identity trust |
| Code signing | Terraform, Homebrew | Integrity trust |
| Download counts | VSCode, npm | Social proof |
| Automated scanning | npm audit, Snyk | Vulnerability detection |
| Sandboxing | VSCode Extension Host, Deno permissions | Runtime isolation |
| Review process | Homebrew core, App Store | Quality gatekeeping |
| Reproducible builds | Homebrew bottles, Nix | Build trust |

**For small ecosystems**: A manual review of plugin PRs to a shortname registry is sufficient. For large ecosystems, automated scanning plus verified publishers is the minimum.

## Code Examples

### Example 1: Minimal Plugin System (Convention-Based)

```javascript
// host-tool/src/plugin-loader.js
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

function discoverPlugins(pluginDir) {
  if (!existsSync(pluginDir)) return [];

  return readdirSync(pluginDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const manifestPath = join(pluginDir, d.name, 'plugin.json');
      if (!existsSync(manifestPath)) return null;

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      return {
        name: d.name,
        version: manifest.version,
        description: manifest.description,
        entryPoint: join(pluginDir, d.name, manifest.main || 'index.js'),
        commands: manifest.commands || [],
      };
    })
    .filter(Boolean);
}

// Usage
const plugins = discoverPlugins(join(process.env.HOME, '.mytool/plugins'));
```

### Example 2: Git-Based Plugin Install (asdf-style)

```bash
#!/usr/bin/env bash
# mytool-plugin-add: Install a plugin from git URL or shortname

PLUGIN_DIR="${MYTOOL_HOME:-$HOME/.mytool}/plugins"
REGISTRY_URL="https://raw.githubusercontent.com/org/mytool-plugins/main/registry.json"

install_plugin() {
  local name="$1"
  local url="$2"

  # If no URL, resolve from shortname registry
  if [ -z "$url" ]; then
    url=$(curl -s "$REGISTRY_URL" | jq -r ".\"$name\"" 2>/dev/null)
    if [ "$url" = "null" ] || [ -z "$url" ]; then
      echo "[ERROR] Plugin '$name' not found in registry"
      return 1
    fi
  fi

  local dest="$PLUGIN_DIR/$name"
  if [ -d "$dest" ]; then
    echo "[WARN] Plugin '$name' already installed. Use 'update' instead."
    return 1
  fi

  echo "Installing plugin '$name' from $url..."
  git clone --depth 1 "$url" "$dest" || return 1

  # Verify plugin contract
  if [ ! -f "$dest/plugin.toml" ]; then
    echo "[ERROR] Invalid plugin: missing plugin.toml"
    rm -rf "$dest"
    return 1
  fi

  echo "[OK] Plugin '$name' installed"
}

install_plugin "$@"
```

### Example 3: Shortname Registry (JSON file)

```json
{
  "$schema": "https://mytool.dev/schemas/registry.json",
  "version": 1,
  "plugins": {
    "nodejs": {
      "url": "https://github.com/mytool-plugins/plugin-nodejs",
      "description": "Node.js version management",
      "maintainer": "core-team",
      "tags": ["language", "runtime"]
    },
    "python": {
      "url": "https://github.com/mytool-plugins/plugin-python",
      "description": "Python version management",
      "maintainer": "core-team",
      "tags": ["language", "runtime"]
    },
    "terraform": {
      "url": "https://github.com/community/mytool-terraform",
      "description": "Terraform version management",
      "maintainer": "community",
      "tags": ["tool", "iac"]
    }
  }
}
```

### Example 4: Plugin Manifest for AI Agent Framework

```yaml
# plugin.yaml - AgentSys-style plugin manifest
name: code-review
version: 2.1.0
description: Multi-agent code review with configurable rulesets
author: example-org
license: MIT
min-host-version: "5.0.0"

commands:
  - name: review
    description: Run code review on changed files
    agent: review-orchestrator
    argument-hint: "[path] [--fix] [--severity [level]]"

agents:
  - name: review-orchestrator
    model: opus
    description: Orchestrates review across multiple specialized agents
  - name: style-checker
    model: haiku
    description: Checks code style compliance

skills:
  - name: orchestrate-review
    description: Coordinates multi-agent review workflow

hooks:
  pre-commit:
    - skill: orchestrate-review
      args: "--quick --changed-only"
```

### Example 5: Vendored Plugin Cache Structure

```
.tool/plugins/cache/
  code-review/
    2.1.0/
      plugin.yaml
      commands/
        review.md
      agents/
        review-orchestrator.yaml
        style-checker.yaml
      skills/
        orchestrate-review/
          SKILL.md
      lib/
        shared-utils.js
    2.0.3/           # Previous version kept for rollback
      ...
  perf-analysis/
    1.5.0/
      plugin.yaml
      ...
```

## Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Building a registry too early | Excitement about the ecosystem's potential | Start with a shortname JSON file; build a registry only when discovery becomes a real user complaint |
| Too-complex plugin contract | Trying to anticipate all use cases | Start with 2-3 required files; add optional capabilities gradually |
| No version pinning | "It works on my machine" mindset | Add a lock file from day one, even if it is just a JSON file mapping plugin names to git SHAs |
| Monolithic bundling | Wanting zero-friction initial experience | Bundle a few essential plugins; make the rest opt-in from the start |
| No plugin validation | Trusting all plugin authors | Validate the plugin contract at install time (check required files exist, manifest is valid) |
| Mixing transport and contract | Thinking "how to download" is the hard problem | Design the plugin interface first; transport is pluggable later |
| Ignoring Windows/cross-platform | Most plugin authors use Unix | Test the plugin contract on all target platforms; avoid shell scripts if you need Windows support |
| No deprecation mechanism | Assuming plugins are forever | Add a `deprecated` field in the registry from day one |
| Over-engineering security for small ecosystems | Copying Terraform's model for 10 plugins | Match security investment to ecosystem size; manual review works for under 50 plugins |
| Breaking the plugin contract | Changing required files/APIs without versioning | Version your plugin contract separately from the host tool version |

## Best Practices

Synthesized from analysis of 40+ ecosystems:

1. **Design the contract first, distribution second**. The interface a plugin must implement matters more than how it gets downloaded. Terraform succeeded because the provider protocol is rock-solid, not because the registry is fancy.

2. **Use convention over configuration**. The best plugin systems require minimal boilerplate. A plugin should be "a directory with the right files in it" -- not a complex build artifact.

3. **Start with a shortname file, not a registry**. A JSON or TOML file mapping plugin names to git URLs is sufficient for under 100 plugins and takes zero infrastructure to maintain.

4. **Add a lock file from day one**. Even a simple `plugins.lock` that records git SHAs or version numbers prevents "works on my machine" problems.

5. **Validate at install time, not at runtime**. Check that a plugin follows the contract when it is installed. Fail fast with clear error messages. This catches most issues before they cause runtime failures.

6. **Separate "official/core" from "community"**. Maintain a small set of high-quality official plugins. Accept community plugins with lighter review. Users need to know what is supported vs best-effort.

7. **Provide a scaffold/template**. `mytool new plugin <name>` should generate a working plugin skeleton. This is the single highest-leverage thing you can do for plugin author experience.

8. **Support local development without publishing**. Plugin authors must be able to test locally (e.g., symlink a local directory into the plugins folder). Publishing should only be needed for sharing.

9. **Version the plugin contract independently**. When you change what files/APIs a plugin must provide, version that change. Old plugins should keep working or fail with clear "upgrade needed" messages.

10. **Invest in discovery proportional to ecosystem size**. Under 20 plugins: README list. Under 100: searchable awesome-list or static site. Over 100: in-tool search with quality signals.

## Comparative Summary

| Ecosystem | Pattern | Plugin Count | Contract Type | Discovery | What It Does Best |
|-----------|---------|-------------|---------------|-----------|-------------------|
| Terraform | Dedicated Registry | 3000+ | Protocol (gRPC) | In-tool + website | Version locking, platform-specific binaries |
| VSCode | Dedicated Registry | 50000+ | Capability-declared | In-tool search | Seamless install/update, quality signals |
| Homebrew | Git + JSON API | 6000+ | Convention (Ruby formula) | CLI search + website | Cross-platform binary distribution |
| npm/ESLint | Package Registry | 5000+ | Convention (naming prefix) | npm search | Dependency resolution, existing ecosystem |
| oh-my-zsh | Bundled + Git | 300+ | Convention (shell script) | README list | Zero-friction for included plugins |
| asdf/mise | Git-Based | 500+ | Convention (shell scripts in bin/) | CLI list + shortname file | Language-agnostic, simple contract |
| Claude Code | Vendored + npm | <50 | Convention (markdown + YAML) | Manual | Deterministic, offline-friendly |
| Vim (vim-plug) | Git-Based | 20000+ | Convention (autoload/) | awesome-vim + web | Minimal overhead, community-driven |
| GitHub Actions | Convention + Registry | 20000+ | Convention (action.yml) | Marketplace website | In-workflow reference, versioned via git tags |

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [Terraform Plugin Framework Docs](https://developer.hashicorp.com/terraform/plugin/framework) | Official Docs | Best-in-class plugin protocol design |
| [VSCode Extension API](https://code.visualstudio.com/api) | Official Docs | Most mature extension marketplace architecture |
| [asdf Plugin Creation Guide](https://asdf-vm.com/plugins/create.html) | Official Docs | Simple git-based plugin contract |
| [mise Documentation](https://mise.jdx.dev/) | Official Docs | Evolution from asdf model to multi-backend |
| [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook) | Official Docs | Ruby-based package formula conventions |
| [HashiCorp go-plugin](https://github.com/hashicorp/go-plugin) | GitHub | gRPC-based plugin system library |
| [steampipe Plugin SDK](https://github.com/turbot/steampipe-plugin-sdk) | GitHub | Terraform-inspired plugin pattern for SQL |
| [Claude Code Plugin Docs](https://docs.anthropic.com/en/docs/claude-code) | Official Docs | AI agent plugin conventions |
| [ESLint Plugin Developer Guide](https://eslint.org/docs/latest/extend/plugins) | Official Docs | npm-based plugin distribution at scale |
| [GitHub Actions Creating Actions](https://docs.github.com/en/actions/creating-actions) | Official Docs | Convention-based action definition |

---

*Generated by /learn from 40 sources (training knowledge -- web fetch was unavailable during generation).*
*See `resources/skill-plugin-distribution-patterns-sources.json` for full source metadata.*
