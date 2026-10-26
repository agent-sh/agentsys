'use strict';

const fs = require('fs');
const path = require('path');

// ship, repo-intel and gate-and-ship left the marketplace and their repos
// were deleted, with agent-core, the old lib/ sync source (2026-10-26).
// agentsys must not offer, install, pin or document them, and lib/ is
// maintained here.
const repoRoot = path.join(__dirname, '..');
const REMOVED = ['ship', 'repo-intel', 'gate-and-ship'];
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

function walk(rel, exts, out = []) {
  const full = path.join(repoRoot, rel);
  if (!fs.existsSync(full)) return out;
  if (fs.statSync(full).isFile()) {
    out.push(rel);
    return out;
  }
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) walk(child, exts, out);
    else if (exts.includes(path.extname(entry.name))) out.push(child);
  }
  return out;
}

// What a user reads or installs from: the marketplace, the installer, the
// adapters, the docs and the site. CHANGELOG.md and changelogs/ keep history.
const OFFERED = [
  'README.md', 'AGENTS.md', 'SECURITY.md', 'CONTRIBUTING.md',
  '.claude-plugin', '.codex-plugin', '.github/ISSUE_TEMPLATE',
  'bin', 'adapters', 'docs', 'agent-docs', 'checklists', 'site', 'meta', 'scripts'
].flatMap(rel => walk(rel, ['.md', '.json', '.js', '.ts', '.html', '.yml', '.txt']));

function hits(pattern) {
  const found = [];
  for (const rel of OFFERED) {
    read(rel).split('\n').forEach((line, i) => {
      if (pattern.test(line)) found.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  return found;
}

test('the marketplace and plugins.txt list none of the removed plugins', () => {
  const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
  const names = marketplace.plugins.map(p => p.name);
  for (const name of REMOVED) expect(names).not.toContain(name);
  expect(marketplace.description).toMatch(new RegExp(`^${names.length} specialized plugins`));
  const listed = read('scripts/plugins.txt').split('\n').filter(Boolean);
  for (const name of REMOVED) expect(listed).not.toContain(name);
  for (const p of marketplace.plugins) {
    for (const name of REMOVED) expect(JSON.stringify(p.source)).not.toContain(`agent-sh/${name}.git`);
  }
});

test('the Codex plugin metadata names none of the removed commands', () => {
  const codex = read('.codex-plugin/plugin.json');
  expect(codex).not.toMatch(/\/(ship|gate-and-ship|repo-intel)\b/);
  expect(JSON.parse(codex).interface.capabilities).not.toContain('deployment');
});

test('the docs generator knows none of the removed plugins or the release skill', () => {
  const source = read('scripts/generate-docs.js');
  for (const name of REMOVED) expect(source).not.toContain(`'${name}'`);
  expect(source).not.toMatch(/'release'/);
});

test('no offered file runs a removed command', () => {
  // `/ship`, `$ship`, `/gate-and-ship`, `/repo-intel` and ship's `/release`,
  // but not a path such as `commands/deslop.md` or `scripts/release.js`.
  // site/content.json recent_releases keeps the 5.6.0 notes as history.
  const history = 'site/content.json: "New /repo-intel plugin (originally /git-map)';
  const found = hits(/(?<![\w./}-])[/$](ship|gate-and-ship|repo-intel|release)(?![\w-]|\.\w)/)
    .filter(h => !h.replace(/:\d+:/, ':').startsWith(history));
  expect(found).toEqual([]);
});

test('no offered file installs or links a removed plugin repo', () => {
  expect(hits(/\b(ship|repo-intel|gate-and-ship)@agentsys\b/)).toEqual([]);
  expect(hits(/agent-sh\/(ship|repo-intel|gate-and-ship|agent-core)(?![\w-])/)).toEqual([]);
  expect(hits(/\b(release-agent|map-validator|repo-intel-summarizer|repo-intel-weighter)\b/)).toEqual([]);
});

test('the ship workflow page is gone', () => {
  expect(fs.existsSync(path.join(repoRoot, 'docs', 'workflows', 'SHIP.md'))).toBe(false);
});

test('lib/ has no repo-intel enrichment or embedder, which only the repo-intel plugin drove', () => {
  for (const rel of ['lib/repo-intel/enrich.js', 'lib/repo-intel/embed', 'lib/binary/shared-helpers.js']) {
    expect(fs.existsSync(path.join(repoRoot, rel))).toBe(false);
  }
  const repoIntel = require('../lib/repo-intel');
  expect(repoIntel.applyDescriptors).toBeUndefined();
  expect(repoIntel.applySummary).toBeUndefined();
  expect(Object.keys(repoIntel)).not.toContain('embed');
  expect(typeof repoIntel.init).toBe('function');
  expect(typeof repoIntel.queries.hotspots).toBe('function');
});

test('a missing repo-intel map says how to build it without a removed command', () => {
  const { RepoIntelMissingError } = require('../lib/repo-intel/queries');
  const message = new RepoIntelMissingError('/r/.claude/repo-intel.json').message;
  expect(message).toContain('agent-analyzer repo-intel init');
  expect(message).toContain('/r/.claude/repo-intel.json');
  expect(message).not.toMatch(/agentsys repo-intel|\/repo-intel(?!\.json)/);
});

test('the OpenCode workflow guard does not send users to /ship', () => {
  const plugin = read('adapters/opencode-plugin/index.ts');
  expect(plugin).not.toMatch(/\/ship\b|"shipping"/);
});

test('nothing checks or syncs lib/ against agent-core', () => {
  const preflight = require('../scripts/preflight');
  expect(preflight.checkLibPluginSync).toBeUndefined();
  expect(preflight.checkLibStagedTogether).toBeUndefined();
  const { COMMANDS } = require('../bin/dev-cli');
  expect(COMMANDS).not.toHaveProperty('test-transform');
  expect(fs.existsSync(path.join(repoRoot, 'scripts', 'test-transform.js'))).toBe(false);
  // docs/ORG_ARCHITECTURE.md keeps the retired sync track as history.
  const live = hits(/agent-core/).filter(h => !h.startsWith(path.join('docs', 'ORG_ARCHITECTURE.md') + ':'));
  expect(live).toEqual([]);
  expect(hits(/agent-core/).length).toBeGreaterThan(0);
  for (const rel of ['lib/binary/index.js', 'lib/binary/version.js', 'lib/agentsys.js', 'lib/repo-intel/installer.js', 'lib/repo-map/installer.js', 'jest.config.js']) {
    expect(read(rel)).not.toMatch(/agent-core/);
  }
});
