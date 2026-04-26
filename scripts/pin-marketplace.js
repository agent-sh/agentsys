#!/usr/bin/env node
/**
 * Pin each marketplace sub-plugin entry to a release tag (and commit SHA for
 * defense in depth). Falls back to pinning current HEAD commit on main when a
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

function gh(args) {
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

function parseOrgRepo(gitUrl) {
  // https://github.com/agent-sh/<name>.git -> ["agent-sh", "<name>"]
  const m = gitUrl.match(/github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) throw new Error(`Cannot parse org/repo from ${gitUrl}`);
  return { owner: m[1], repo: m[2] };
}

function resolveTagSha(owner, repo, tag) {
  // Returns the commit SHA the tag resolves to, or null if tag is missing.
  // Tags may be annotated (object.type === "tag") or lightweight. Annotated
  // tags need a second deref step to the underlying commit.
  let ref;
  try {
    ref = JSON.parse(
      gh(['api', `repos/${owner}/${repo}/git/refs/tags/${tag}`]),
    );
  } catch (err) {
    if (/Not Found|404/i.test(err.stderr || err.message)) return null;
    throw err;
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

function headSha(owner, repo) {
  return gh([
    'api',
    `repos/${owner}/${repo}/commits/main`,
    '--jq',
    '.sha',
  ]);
}

function main() {
  const raw = fs.readFileSync(MARKETPLACE_PATH, 'utf8');
  const data = JSON.parse(raw);

  const pinned = [];
  const fallbacks = [];

  for (const plugin of data.plugins) {
    const src = plugin.source;
    if (!src || src.source !== 'url' || !src.url) continue;

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
      pinned.push({ name: plugin.name, tag, sha });
      console.log(`[OK] ${plugin.name} -> ${tag} (${sha.slice(0, 10)})`);
    } else {
      const head = headSha(owner, repo);
      src.commit = head;
      // No `ref` because there is no stable tag; commit SHA is the pin.
      fallbacks.push({ name: plugin.name, wantedTag: tag, sha: head });
      console.log(
        `[WARN] ${plugin.name} has no tag ${tag} on ${owner}/${repo}; pinning main@${head.slice(0, 10)}`,
      );
    }
  }

  const out = JSON.stringify(data, null, 2) + '\n';

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Not writing marketplace.json');
  } else {
    fs.writeFileSync(MARKETPLACE_PATH, out);
    console.log(`\n[OK] Wrote ${MARKETPLACE_PATH}`);
  }

  console.log(
    `\nSummary: ${pinned.length} pinned to tags, ${fallbacks.length} fell back to main commit SHA`,
  );
  if (fallbacks.length > 0) {
    console.log('\nFallback plugins (no release tag yet):');
    for (const f of fallbacks) {
      console.log(`  - ${f.name}: wanted ${f.wantedTag}, pinned ${f.sha}`);
    }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }
}
