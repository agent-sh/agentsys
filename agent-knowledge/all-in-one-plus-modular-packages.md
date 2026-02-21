# Learning Guide: All-in-One Plus Modular Packages

**Generated**: 2026-02-21
**Sources**: 40 resources analyzed
**Depth**: deep

## Prerequisites

- Familiarity with package managers (npm, pip, cargo, etc.)
- Basic understanding of monorepos vs polyrepos
- Experience publishing or consuming packages from a registry
- Understanding of semantic versioning (semver)

## TL;DR

- The "batteries included but removable" pattern provides a meta-package that re-exports or depends on individual modular packages, letting users choose convenience OR minimal footprint.
- Monorepo tooling (npm/pnpm/yarn workspaces, Lerna, Nx, Turborepo, Rush, Changesets) makes it practical to develop, version, and publish dozens of packages from a single repository.
- Real-world examples span a spectrum: lodash (per-method packages), AWS SDK v3 (@aws-sdk/client-*), Babel (@babel/plugin-*), Angular (@angular/*), Effect (@effect/*), and more.
- Installer CLIs (create-react-app, degit/tiged, npx-based scaffolders) fetch templates from registries or GitHub tarballs, not git clones.
- Version pinning strategies include lockfiles, changesets, fixed vs independent versioning, and workspace protocol references.

## Core Concepts

### 1. The Packaging Spectrum

Open source projects sit on a spectrum from fully monolithic to fully granular:

| Model | Example | Trade-off |
|-------|---------|-----------|
| **Monolithic** | lodash (full), aws-sdk v2 | Simple to adopt, large bundle |
| **Scoped modular** | @aws-sdk/client-s3, @babel/plugin-* | Tree-shakeable, more install commands |
| **Per-function** | lodash.get, lodash.debounce | Minimal footprint, dependency explosion |
| **Core + plugins** | ESLint, webpack, Vite, Pino | Extensible, requires configuration |
| **Meta-package** | jest (wraps @jest/*), Angular | Convenience layer over modular internals |

**Key insight**: Most successful projects offer BOTH a convenience meta-package AND individual packages. Users choose based on their constraints.

### 2. The Meta-Package Pattern

A meta-package is a thin wrapper that re-exports or depends on individual packages:

```json
{
  "name": "my-framework",
  "version": "3.0.0",
  "dependencies": {
    "@my-framework/core": "3.0.0",
    "@my-framework/router": "3.0.0",
    "@my-framework/cli": "3.0.0",
    "@my-framework/utils": "3.0.0"
  }
}
```

The meta-package `index.js` re-exports everything:

```javascript
// my-framework/index.js
export { createApp, defineComponent } from '@my-framework/core';
export { createRouter, useRoute } from '@my-framework/router';
export { cli } from '@my-framework/cli';
```

Users can install `my-framework` for everything, or `@my-framework/core` alone for minimal footprint.

**Real-world examples**:
- **Jest**: `jest` meta-package wraps `@jest/core`, `@jest/expect`, `@jest/globals`, etc.
- **Angular**: `@angular/core`, `@angular/router`, `@angular/forms` are independent but `ng new` installs them together.
- **Effect**: Core `effect` package plus 20+ `@effect/*` packages for platform, SQL, AI, RPC, etc.
- **Astro**: Core `astro` plus `@astrojs/react`, `@astrojs/vue`, `@astrojs/node`, `@astrojs/vercel`, etc.

### 3. Monorepo Tooling for Multi-Package Projects

Publishing multiple packages from one repo requires specialized tooling:

#### Workspace Managers (dependency linking)

| Tool | Workspace Config | Key Feature |
|------|-----------------|-------------|
| **npm workspaces** | `package.json#workspaces` | Built into npm 7+ |
| **pnpm workspaces** | `pnpm-workspace.yaml` | Content-addressable storage, strict isolation |
| **yarn workspaces** | `package.json#workspaces` | Plug'n'Play resolution, zero-installs |
| **bun workspaces** | `package.json#workspaces` | Native speed, compatible with npm |

#### Build Orchestrators (task scheduling)

| Tool | Written In | Key Feature |
|------|-----------|-------------|
| **Turborepo** | Rust | Remote caching, task pipelines |
| **Nx** | TypeScript | Affected analysis, computation caching |
| **Rush** | TypeScript | Enterprise-scale, strict dependency policies |
| **Lerna** | TypeScript | Version/publish commands, now maintained by Nx |

#### Version & Publish Managers

| Tool | Approach | Best For |
|------|----------|----------|
| **Changesets** | Intent-based changelogs | Monorepos with multiple maintainers |
| **Lerna version/publish** | Conventional commits or manual | Established monorepos |
| **semantic-release** | Fully automated from commits | Single packages or coordinated releases |
| **np** | Interactive guided publish | Single package publishing |

### 4. Versioning Strategies

#### Fixed (Locked) Versioning

All packages share one version number. When any package changes, all bump together.

```json
// lerna.json
{
  "version": "3.2.1"
}
```

**Used by**: Babel, Angular, React (within a release)
**Pro**: Simple mental model -- all `@babel/*` packages at 7.24.0 are compatible.
**Con**: Unnecessary version bumps for unchanged packages.

#### Independent Versioning

Each package has its own version. Only changed packages bump.

```json
// lerna.json
{
  "version": "independent"
}
```

**Used by**: AWS SDK v3, Effect, Astro integrations
**Pro**: Precise, no unnecessary bumps.
**Con**: Harder to know which versions are compatible.

#### Workspace Protocol

pnpm and yarn support `workspace:*` to reference sibling packages during development, resolved to actual versions at publish time:

```json
{
  "dependencies": {
    "@my-lib/utils": "workspace:*"
  }
}
```

At publish time, `workspace:*` becomes `^3.2.1` (the actual version). This prevents accidentally publishing with unresolvable local references.

#### Peer Dependencies for Plugin Compatibility

Plugins declare their host as a peer dependency to ensure version compatibility:

```json
{
  "name": "@babel/plugin-transform-classes",
  "peerDependencies": {
    "@babel/core": "^7.0.0"
  }
}
```

### 5. The AWS SDK v2 to v3 Migration (Case Study)

AWS SDK v2 was a single `aws-sdk` package containing every AWS service client. Problems:
- Bundle size was enormous even if you used one service
- No tree-shaking possible
- Cold start penalties in Lambda

AWS SDK v3 introduced modular clients:

```javascript
// v2: monolithic
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// v3: modular
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({});
```

**Architecture changes**:
- Each service is a separate npm package (`@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, etc.)
- Middleware stack replaces the monolithic plugin system
- Shared packages like `@aws-sdk/middleware-retry` are consumed by individual clients
- Tree-shaking dramatically reduces bundle size

### 6. Lodash: Per-Method Packages (Case Study)

Lodash offered the most granular packaging approach in npm history:

| Package | Size | Contents |
|---------|------|----------|
| `lodash` | ~24 kB gzipped | Full library, 300+ methods |
| `lodash-es` | ~24 kB | ES module version (tree-shakeable) |
| `lodash/fp` | ~24 kB | Functional programming variant |
| `lodash.get` | ~1 kB | Single method package |
| `lodash.debounce` | ~1 kB | Single method package |

**Lessons learned**: Per-method packages caused dependency management headaches -- projects could end up with different versions of lodash internals. The ecosystem eventually moved toward ES modules + tree-shaking as a better solution than per-function packages.

### 7. Core + Plugin Architecture

Many tools use a minimal core with an extensible plugin system:

**Babel**: `@babel/core` provides the transformation engine. Plugins (`@babel/plugin-transform-*`) handle specific syntax transforms. Presets (`@babel/preset-env`) bundle common plugin sets.

**ESLint**: Core `eslint` handles linting orchestration. Rules come from plugins (`@eslint/js`, `eslint-plugin-react`). Configs bundle rules into shareable sets.

**Webpack**: Core `webpack` provides module bundling. Loaders preprocess files (TypeScript, CSS). Plugins hook into the build lifecycle.

**Vite**: Core `vite` handles dev server and building. Official plugins like `@vitejs/plugin-legacy` extend capabilities.

**Pino**: Core `pino` does fast JSON logging. `pino-pretty` provides dev formatting. Transports are separate packages run in worker threads.

**Tailwind CSS**: Core `tailwindcss` provides utility classes. Plugins like `@tailwindcss/typography` and `@tailwindcss/forms` add specialized utilities.

### 8. Installer CLI Patterns

Installer CLIs scaffold projects without requiring global installation:

#### npx-Based Scaffolders

```bash
npx create-react-app my-app      # Deprecated but iconic pattern
npx create-next-app my-app       # Next.js scaffolder
npx create-astro                 # Astro scaffolder
npx create-nx-workspace          # Nx workspace scaffolder
```

How it works under the hood:
1. `npx` downloads the package temporarily from npm registry
2. Package exposes a `bin` entry in package.json
3. Binary runs, prompts user for options
4. Generates files from templates (embedded or fetched)
5. Runs `npm install` in the new directory
6. Temporary package is cleaned up

#### Template Cloners (degit/tiged)

```bash
npx degit user/repo my-project
npx tiged user/repo my-project    # Actively maintained fork
```

How it works:
1. Resolves the latest commit on the default branch
2. Downloads the tar archive from GitHub/GitLab API (NOT git clone)
3. Caches tarball locally (`~/.degit/user/repo/hash.tar.gz`)
4. Extracts to target directory
5. No `.git` directory -- clean copy

**Advantages over git clone**: No git history, faster download, works offline from cache, supports subdirectory extraction.

#### Custom CLI Installers

For tools like `agentsys install web-ctl`, the typical architecture:

```javascript
// 1. Parse the install command
const packageName = args[0]; // "web-ctl"

// 2. Resolve package location (multiple strategies)
async function resolve(name) {
  // Strategy A: npm registry
  const pkg = await fetch(`https://registry.npmjs.org/${name}/latest`);

  // Strategy B: GitHub releases
  const release = await fetch(
    `https://api.github.com/repos/org/${name}/releases/latest`
  );
  const asset = release.assets.find(a => a.name.endsWith('.tar.gz'));

  // Strategy C: Custom registry
  const manifest = await fetch(`https://my-registry.dev/${name}/manifest.json`);

  return { tarball: asset.browser_download_url, version: release.tag_name };
}

// 3. Download and extract
const tarball = await download(resolved.tarball);
await extract(tarball, targetDir);

// 4. Run post-install hooks
await runHook('postinstall', targetDir);

// 5. Update local manifest
await updateManifest(name, resolved.version);
```

**GitHub Releases approach**: Build artifacts (tarballs, binaries) are attached to GitHub releases. The CLI queries the GitHub API for the latest release, finds the right asset for the platform, downloads and extracts it.

**npm Registry approach**: The CLI runs `npm pack` or queries the registry API directly, downloads the tarball, and extracts it to a plugin directory.

**Custom registry approach**: A JSON manifest maps package names to download URLs and metadata. The CLI fetches the manifest, resolves the URL, downloads the artifact.

### 9. Building Packages for Dual CJS/ESM Distribution

Modern packages must support both CommonJS and ES Modules:

#### package.json Exports Map

```json
{
  "name": "my-lib",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./utils": {
      "import": "./dist/utils.mjs",
      "require": "./dist/utils.cjs",
      "types": "./dist/utils.d.ts"
    }
  }
}
```

#### Build Tools

| Tool | Status | Approach |
|------|--------|----------|
| **unbuild** | Active | Auto-infers from package.json, rollup-based |
| **pkgroll** | Active | Reads exports field, zero-config rollup |
| **tsup** | Migrating to tsdown | esbuild-based, fast |
| **Rollup** | Active | Low-level, maximum control |

#### Type Checking

Use `@arethetypeswrong/cli` to verify packages resolve correctly across all module resolution modes (node10, node16, bundler). This catches common issues like types not matching the actual module format.

### 10. Workspace Architecture Patterns

#### Cargo Workspaces (Rust)

```toml
# Cargo.toml (root)
[workspace]
members = ["crates/*"]

[workspace.dependencies]
serde = "1.0"

# crates/my-lib/Cargo.toml
[dependencies]
serde.workspace = true  # Inherits version from root
```

Shared `Cargo.lock`, unified build output, configurable default members.

#### Go Modules

Go takes a different approach -- each module is independently versioned with its own `go.mod`. Multi-module repos are possible but less common. The `golang.org/x/*` packages demonstrate the pattern of a standard library extended by independent modules.

#### Python Extras

Python uses `extras_require` for optional dependency groups:

```python
# setup.py
setup(
    name="my-lib",
    install_requires=["core-dep"],
    extras_require={
        "full": ["optional-dep-1", "optional-dep-2"],
        "dev": ["pytest", "mypy"],
    }
)
```

Users install with: `pip install my-lib[full]`

#### Nix

Nixpkgs is a single repository of 120,000+ package definitions. Users declaratively specify which packages they want, and Nix resolves and builds only those. The collection is monolithic in source but selective in installation.

## Code Examples

### Meta-Package with Re-Exports

```javascript
// packages/my-framework/package.json
{
  "name": "my-framework",
  "version": "2.0.0",
  "dependencies": {
    "@my-framework/core": "2.0.0",
    "@my-framework/router": "2.0.0",
    "@my-framework/store": "2.0.0"
  },
  "exports": {
    ".": "./src/index.js",
    "./core": { "import": "@my-framework/core" },
    "./router": { "import": "@my-framework/router" },
    "./store": { "import": "@my-framework/store" }
  }
}

// packages/my-framework/src/index.js
export * from '@my-framework/core';
export * from '@my-framework/router';
export * from '@my-framework/store';
```

### Monorepo with pnpm Workspaces + Changesets

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'plugins/*'
```

```json
// packages/core/package.json
{
  "name": "@my-lib/core",
  "version": "1.3.0",
  "dependencies": {
    "@my-lib/utils": "workspace:^"
  }
}
```

```bash
# Development workflow
pnpm install                  # Links workspace packages
pnpm --filter @my-lib/core build

# Release workflow
npx changeset                 # Create changeset describing changes
npx changeset version         # Bump versions based on changesets
npx changeset publish         # Publish all changed packages to npm
```

### Custom CLI Installer (GitHub Releases)

```javascript
#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { extract } from 'tar';

async function install(packageName) {
  // 1. Query GitHub API for latest release
  const response = await fetch(
    `https://api.github.com/repos/my-org/${packageName}/releases/latest`,
    { headers: { 'Accept': 'application/vnd.github.v3+json' } }
  );
  const release = await response.json();

  // 2. Find platform-appropriate asset
  const platform = `${process.platform}-${process.arch}`;
  const asset = release.assets.find(a => a.name.includes(platform));
  if (!asset) throw new Error(`No binary for ${platform}`);

  // 3. Download tarball
  const download = await fetch(asset.browser_download_url);

  // 4. Extract to plugins directory
  await pipeline(
    download.body,
    extract({ cwd: `./plugins/${packageName}` })
  );

  // 5. Record in manifest
  const manifest = JSON.parse(await readFile('./plugins/manifest.json', 'utf8'));
  manifest[packageName] = { version: release.tag_name, installed: new Date().toISOString() };
  await writeFile('./plugins/manifest.json', JSON.stringify(manifest, null, 2));

  console.log(`Installed ${packageName}@${release.tag_name}`);
}
```

### Plugin Architecture with Peer Dependencies

```json
// Plugin package.json
{
  "name": "@my-tool/plugin-typescript",
  "version": "1.0.0",
  "peerDependencies": {
    "@my-tool/core": "^2.0.0"
  },
  "peerDependenciesMeta": {
    "@my-tool/core": {
      "optional": false
    }
  }
}
```

```javascript
// Plugin implementation
export default function typescriptPlugin(options = {}) {
  return {
    name: 'typescript',
    setup(api) {
      api.onTransform({ filter: /\.tsx?$/ }, async (args) => {
        const result = await transpile(args.contents, options);
        return { contents: result.code };
      });
    }
  };
}
```

## Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|--------------|
| Version mismatch between sibling packages | Independent versioning with implicit compatibility assumptions | Use peer dependencies, fixed versioning, or workspace protocol |
| Publishing with `workspace:*` references | Forgetting to let tooling resolve workspace refs | Use Changesets or Lerna publish which handle resolution |
| Duplicate dependencies in bundle | Multiple packages pull in different versions of shared dep | Use workspace hoisting, peerDependencies, or deduplication |
| Per-method packages becoming unmaintainable | N methods = N packages to version/publish/test | Prefer ES modules + tree-shaking over per-function packages |
| CJS/ESM dual package hazard | Same package loaded as both CJS and ESM creates two instances | Use exports map correctly, test with arethetypeswrong |
| Circular dependencies between packages | Organic growth without dependency graph discipline | Enforce layered architecture, use tools like Nx to detect cycles |
| Breaking changes in plugin API | Plugins depend on internal APIs that change | Use semantic versioning on plugin API, separate public API types |
| Stale lockfile after workspace changes | Adding/removing workspace packages without updating lock | Run `pnpm install` / `npm install` after structural changes |

## Best Practices

Synthesized from 40 sources:

1. **Start monolithic, split when needed**: Ship a single package first. Only modularize when bundle size, team boundaries, or independent release cycles demand it.

2. **Use pnpm workspaces for new monorepos**: Content-addressable storage prevents phantom dependencies. Strict mode catches accidental cross-package imports.

3. **Adopt Changesets for version management**: Intent-based changelogs (written at PR time) scale better than automated commit message parsing for multi-package repos.

4. **Provide a meta-package for convenience**: Even after modularizing, always offer a single-install option that pulls in common packages together.

5. **Use the exports map**: Define explicit entry points in package.json#exports. This enables subpath imports and prevents deep imports into package internals.

6. **Declare plugin hosts as peer dependencies**: Plugins should `peerDependency` their host package to avoid version conflicts and duplicate instances.

7. **Test dual CJS/ESM with arethetypeswrong**: Verify your package resolves correctly across all Node.js module resolution modes before publishing.

8. **Use workspace protocol for internal deps**: `workspace:^` during development, resolved to real versions at publish time.

9. **Prefer tree-shaking over per-function packages**: Modern bundlers handle dead code elimination well. ES module exports are more maintainable than hundreds of micro-packages.

10. **Automate releases in CI**: Use semantic-release or Changesets GitHub Action to remove human error from the publish process.

11. **Cache aggressively in installer CLIs**: degit/tiged cache tarballs locally. Custom CLIs should cache downloaded artifacts with version-based invalidation.

12. **Pin exact versions in lockfiles, use ranges in package.json**: Lockfiles ensure reproducibility. Semver ranges in package.json allow consumers flexibility.

## Further Reading

| Resource | Type | Why Recommended |
|----------|------|-----------------|
| [AWS SDK v3 Migration Guide](https://github.com/aws/aws-sdk-js-v3/blob/main/UPGRADING.md) | Migration Guide | Definitive case study of monolith-to-modular migration |
| [Changesets](https://github.com/changesets/changesets) | Tool | Best-in-class monorepo version management |
| [Lerna](https://lerna.js.org) | Tool | Established monorepo publishing (now maintained by Nx) |
| [Turborepo](https://turbo.build/repo) | Tool | Fast monorepo build orchestration |
| [Nx](https://nx.dev) | Tool | Full-featured monorepo platform with caching |
| [Rush](https://rushstack.io) | Tool | Enterprise-scale monorepo management |
| [pnpm Workspaces](https://pnpm.io/workspaces) | Docs | Recommended workspace manager |
| [degit](https://github.com/Rich-Harris/degit) / [tiged](https://github.com/tiged/tiged) | Tool | Template cloning without git history |
| [pkgroll](https://github.com/privatenumber/pkgroll) | Tool | Zero-config package building from exports map |
| [unbuild](https://github.com/unjs/unbuild) | Tool | Auto-inferred library builds |
| [arethetypeswrong](https://arethetypeswrong.github.io) | Tool | Verify CJS/ESM type correctness |
| [semantic-release](https://github.com/semantic-release/semantic-release) | Tool | Automated versioning from commits |
| [np](https://github.com/sindresorhus/np) | Tool | Interactive npm publish workflow |
| [GoReleaser](https://goreleaser.com) | Tool | Binary distribution via GitHub Releases |
| [Effect](https://github.com/Effect-TS/effect) | Example | Modern scoped-package monorepo architecture |
| [Astro Integrations](https://github.com/withastro/astro) | Example | Core + official integrations pattern |
| [Babel Plugins](https://github.com/babel/babel) | Example | Core + plugin + preset architecture |

---

*Generated by /learn from 40 sources.*
*See `resources/all-in-one-plus-modular-packages-sources.json` for full source metadata.*
