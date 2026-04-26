#!/usr/bin/env node
/**
 * Pin each marketplace sub-plugin entry to a release tag (and commit SHA for
 * defense in depth). Falls back to pinning current default-branch HEAD when a
 * release tag for the declared `version` does not exist on the remote.
 *
 * Rationale: unpinned `source: "url"` entries let `claude plugin install`
 * track the default branch, which is a supply-chain compromise vector. Pinning
 * to a tag (for humans) AND the tag's resolved commit SHA (for integrity)
 * ensures the exact bytes we ship are the exact bytes users get.
 *
 * Usage: node scripts/pin-marketplace.js [--dry-run]
 *
 * Requires: `gh` CLI authenticated against the agent-sh org.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run');
const MARKETPLACE_PATH = path.join(
  __dirname,
  '..',
  '.claude-plugin',
  'marketplace.json',
);

// Seam for tests: callers may override `ghRunner` to stub API responses.
let ghRunner = defaultGhRunner;

function defaultGhRunner(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const e = new Error(`gh ${args.join(' ')} failed: ${stderr || err.message}`);
    e.stderr = stderr;
    throw e;
  }
}

function gh(args) {
  return ghRunner(args);
}

function setGhRunner(fn) {
  ghRunner = typeof fn === 'function' ? fn : defaultGhRunner;
}

function parseOrgRepo(gitUrl) {
  // https://github.com/agent-sh/<name>.git    -> ["agent-sh", "<name>"]
  // https://github.com/agent-sh/<name>        -> ["agent-sh", "<name>"]
  // https://github.com/agent-sh/<name>/       -> ["agent-sh", "<name>"]
  // https://github.com/agent-sh/<name>/.git   -> ["agent-sh", "<name>"]
  // git@github.com:agent-sh/<name>.git        -> ["agent-sh", "<name>"]
  const m = gitUrl.match(
    /github\.com[:/]+([^/]+)\/([^/]+?)\/?(?:\.git)?\/?$/,
  );
  if (!m) throw new Error(`Cannot parse org/repo from ${gitUrl}`);
  return { owner: m[1], repo: m[2] };
}

function resolveTagSha(owner, repo, tag) {
  // Returns the commit SHA the tag resolves to, or null if tag is missing.
  // Uses the singular `git/ref/tags/<tag>` endpoint to get an exact match;
  // the plural `git/refs/tags/<tag>` does prefix matching and can silently
  // return an array when multiple tags share a prefix.
  // Tags may be annotated (object.type === "tag") or lightweight. Annotated
  // tags need a second deref step to the underlying commit.
  let ref;
  try {
    ref = JSON.parse(
      gh(['api', `repos/${owner}/${repo}/git/ref/tags/${tag}`]),
    );
  } catch (err) {
    if (/Not Found|404/i.test(err.stderr || err.message)) return null;
    throw err;
  }
  // Defense in depth: reject unexpected array responses as ambiguous so a
  // future endpoint-behavior shift cannot silently pick the wrong tag.
  if (Array.isArray(ref)) {
    throw new Error(
      `Ambiguous tag lookup for ${owner}/${repo}@${tag}: got array of ${ref.length} refs`,
    );
  }
  if (!ref || !ref.object) return null;
  if (ref.object.type === 'commit') return ref.object.sha;
  if (ref.object.type === 'tag') {
    const annotated = JSON.parse(
      gh(['api', `repos/${owner}/${repo}/git/tags/${ref.object.sha}`]),
    );
    return annotated.object && annotated.object.sha
      ? annotated.object.sha
      : null;
  }
  return null;
}

function defaultBranchHeadSha(owner, repo) {
  // Use HEAD (which the API resolves to the repo's default branch) rather
  // than hardcoding `main`. Works even if the repo still ships `master` or
  // adopts something else later.
  return gh([
    'api',
    `repos/${owner}/${repo}/commits/HEAD`,
    '--jq',
    '.sha',
  ]);
}

function pinPlugin(plugin) {
  const src = plugin.source;
  if (!src || src.source !== 'url' || !src.url) {
    return { status: 'skipped', name: plugin.name };
  }

  const { owner, repo } = parseOrgRepo(src.url);
  const version = plugin.version;
  const tag = version ? `v${version}` : null;

  let sha = null;
  if (tag) {
    sha = resolveTagSha(owner, repo, tag);
  }

  if (sha) {
    src.ref = tag;
    src.commit = sha;
    return { status: 'pinned', name: plugin.name, tag, sha };
  }

  const head = defaultBranchHeadSha(owner, repo);
  // Explicitly clear any stale `ref` from a previous run: if the plugin
  // loses its tag (e.g., deleted for a security rewrite) we must not leave
  // the old tag reference around, since downstream installers that prefer
  // `ref` would otherwise ignore the new commit pin.
  delete src.ref;
  src.commit = head;
  return { status: 'fallback', name: plugin.name, wantedTag: tag, sha: head };
}

function main() {
  const raw = fs.readFileSync(MARKETPLACE_PATH, 'utf8');
  const data = JSON.parse(raw);

  const pinned = [];
  const fallbacks = [];
  const errors = [];

  for (const plugin of data.plugins) {
    try {
      const result = pinPlugin(plugin);
      if (result.status === 'pinned') {
        pinned.push(result);
        console.log(
          `[OK] ${result.name} -> ${result.tag} (${result.sha.slice(0, 10)})`,
        );
      } else if (result.status === 'fallback') {
        fallbacks.push(result);
        console.log(
          `[WARN] ${result.name} has no tag ${result.wantedTag}; pinning default-branch@${result.sha.slice(0, 10)}`,
        );
      }
    } catch (err) {
      errors.push({ name: plugin.name, error: err.message });
      console.error(`[ERROR] ${plugin.name}: ${err.message}`);
    }
  }

  const out = JSON.stringify(data, null, 2) + '\n';

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Not writing marketplace.json');
  } else if (errors.length === 0) {
    fs.writeFileSync(MARKETPLACE_PATH, out);
    console.log(`\n[OK] Wrote ${MARKETPLACE_PATH}`);
  } else {
    console.log(
      '\n[WARN] Not writing marketplace.json because some plugins failed; re-run after resolving errors.',
    );
  }

  console.log(
    `\nSummary: ${pinned.length} pinned to tags, ${fallbacks.length} fell back to default-branch SHA, ${errors.length} errors`,
  );
  if (fallbacks.length > 0) {
    console.log('\nFallback plugins (no release tag yet):');
    for (const f of fallbacks) {
      console.log(`  - ${f.name}: wanted ${f.wantedTag}, pinned ${f.sha}`);
    }
  }
  if (errors.length > 0) {
    console.log('\nFailed plugins:');
    for (const e of errors) {
      console.log(`  - ${e.name}: ${e.error}`);
    }
    return 1;
  }
  return 0;
}

if (require.main === module) {
  try {
    const code = main();
    process.exit(code);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseOrgRepo,
  resolveTagSha,
  defaultBranchHeadSha,
  pinPlugin,
  setGhRunner,
};
