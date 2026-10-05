/**
 * The npm installer fetches each plugin at the commit marketplace.json pins.
 *
 * https.get is replaced by a fake GitHub tarball endpoint that serves real
 * gzipped tar archives, so these tests run the whole fetch path: ref choice,
 * download, `tar` extraction, the archive commit check and the cache markers.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

const {
  fetchPlugin,
  fetchExternalPlugins,
  installPlugin,
  loadMarketplace,
  resolvePluginSource,
  pluginFetchRefs,
  parseGitHubSource,
  archiveCommitFromTarHead,
  readCachedCommit,
  recordInstall,
  loadInstalledJson,
  getPluginCacheDir
} = require('../bin/cli.js');

const SHA_PINNED = 'a29d5a00231ebe2983641f509fcedeee17a61b34';
const SHA_TAG = 'dd4b85f00000000000000000000000000000beef';
const SHA_MAIN = 'be1858a00000000000000000000000000000cafe';

// --- a minimal tar writer: pax global header with the commit, like git archive ---

function tarHeader(name, size, type) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, 'latin1');
  h.write(type === '5' ? '0000755\0' : '0000644\0', 100, 'latin1');
  h.write('0000000\0', 108, 'latin1');
  h.write('0000000\0', 116, 'latin1');
  h.write(size.toString(8).padStart(11, '0') + '\0', 124, 'latin1');
  h.write('00000000000\0', 136, 'latin1');
  h.write('        ', 148, 'latin1');
  h.write(type, 156, 'latin1');
  h.write('ustar\0' + '00', 257, 'latin1');
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'latin1');
  return h;
}

function tarEntry(name, data, type) {
  const body = Buffer.from(data, 'latin1');
  const pad = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([tarHeader(name, body.length, type), body, pad]);
}

/** A GitHub-style tarball: pax header naming `commit`, then <prefix>/ files. */
function githubTarball(commit, prefix, files) {
  const parts = [];
  if (commit) {
    const record = `52 comment=${commit}\n`;
    parts.push(tarEntry('pax_global_header', record, 'g'));
  }
  parts.push(tarEntry(`${prefix}/`, '', '5'));
  for (const [file, content] of Object.entries(files)) {
    parts.push(tarEntry(`${prefix}/${file}`, content, '0'));
  }
  parts.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(parts));
}

// --- fake GitHub tarball endpoint ---

/**
 * repos: { 'owner/repo': { refs: { <ref>: <commit> }, files?: {}, archiveCommit?: fn } }
 * A full commit SHA a repo knows is always servable, as on GitHub.
 */
function fakeGitHub(repos) {
  const requests = [];
  jest.spyOn(https, 'get').mockImplementation((url, options, callback) => {
    const req = new EventEmitter();
    const match = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/tarball\/(.+)$/);
    const res = new PassThrough();
    res.headers = {};
    let body = null;
    if (match) {
      const [, owner, repo, ref] = match;
      requests.push({ repo: `${owner}/${repo}`, ref });
      const known = repos[`${owner}/${repo}`];
      const commits = known ? new Set(Object.values(known.refs)) : new Set();
      const commit = known && (known.refs[ref] || (commits.has(ref) ? ref : null));
      if (commit) {
        const served = known.archiveCommit ? known.archiveCommit(commit) : commit;
        body = githubTarball(served, `${owner}-${repo}-${commit.slice(0, 7)}`, {
          '.claude-plugin/plugin.json': JSON.stringify({ name: repo }),
          'COMMIT': commit,
          ...(known.files || {})
        });
      }
    }
    res.statusCode = body ? 200 : 404;
    setImmediate(() => {
      callback(res);
      res.end(body || undefined);
    });
    return req;
  });
  return requests;
}

describe('fetching plugins at their marketplace pins', () => {
  let tmpHome;
  let origHome;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsys-pins-'));
    origHome = process.env.HOME;
    process.env.HOME = tmpHome;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  const SOURCE = 'https://github.com/agent-sh/learn.git';
  const drifted = () => ({
    'agent-sh/learn': { refs: { 'v1.2.0': SHA_TAG, main: SHA_MAIN, pinned: SHA_PINNED } }
  });
  const cached = (file) => fs.readFileSync(path.join(getPluginCacheDir(), 'learn', file), 'utf8');

  test('a commit pin requests that SHA only, even when the version tag is elsewhere', async () => {
    const requests = fakeGitHub(drifted());
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED });

    expect(requests).toEqual([{ repo: 'agent-sh/learn', ref: SHA_PINNED }]);
    expect(cached('COMMIT')).toBe(SHA_PINNED);
    expect(cached('.commit')).toBe(SHA_PINNED);
    expect(readCachedCommit('learn')).toBe(SHA_PINNED);
  });

  test('a commit pin wins over a ref pin', async () => {
    const requests = fakeGitHub(drifted());
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED, ref: 'v1.2.0' });
    expect(requests.map(r => r.ref)).toEqual([SHA_PINNED]);
    expect(cached('COMMIT')).toBe(SHA_PINNED);
  });

  test('an unpinned entry keeps the old order: v<version>, <version>, main, master', async () => {
    const requests = fakeGitHub({ 'agent-sh/learn': { refs: { master: SHA_MAIN } } });
    await fetchPlugin('learn', SOURCE, '1.2.0');

    expect(requests.map(r => r.ref)).toEqual(['v1.2.0', '1.2.0', 'main', 'master']);
    expect(cached('.ref')).toBe('master');
    // The commit is read from the archive, so an unpinned install is recorded too
    expect(cached('.commit')).toBe(SHA_MAIN);
  });

  test('an unpinned entry stops at the first ref that exists', async () => {
    const requests = fakeGitHub(drifted());
    await fetchPlugin('learn', SOURCE, '1.2.0', {});
    expect(requests.map(r => r.ref)).toEqual(['v1.2.0']);
    expect(cached('.commit')).toBe(SHA_TAG);
  });

  test('a missing pinned commit fails instead of falling back to a tag or main', async () => {
    const requests = fakeGitHub(drifted());
    const missing = 'f'.repeat(40);
    await expect(fetchPlugin('learn', SOURCE, '1.2.0', { commit: missing })).rejects.toThrow(/HTTP 404/);
    expect(requests.map(r => r.ref)).toEqual([missing]);
  });

  test('a ref pin requests that ref only, with no fallback', async () => {
    const requests = fakeGitHub(drifted());
    await expect(fetchPlugin('learn', SOURCE, '1.2.0', { ref: 'v9.9.9' })).rejects.toThrow(/HTTP 404/);
    expect(requests.map(r => r.ref)).toEqual(['v9.9.9']);

    await fetchPlugin('learn', SOURCE, '1.2.0', { ref: 'pinned' });
    expect(cached('.commit')).toBe(SHA_PINNED);
  });

  test('an archive built from another commit than the pin is rejected and not cached', async () => {
    const repos = drifted();
    repos['agent-sh/learn'].archiveCommit = () => SHA_MAIN;
    fakeGitHub(repos);
    await expect(fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED }))
      .rejects.toThrow(`returned commit ${SHA_MAIN} for pinned commit ${SHA_PINNED}`);
    expect(fs.existsSync(path.join(getPluginCacheDir(), 'learn'))).toBe(false);
  });

  test('an archive that does not name its commit is rejected for a commit pin', async () => {
    const repos = drifted();
    repos['agent-sh/learn'].archiveCommit = () => null;
    fakeGitHub(repos);
    await expect(fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED }))
      .rejects.toThrow(`archive for pinned commit ${SHA_PINNED} does not name its commit`);
    expect(fs.existsSync(path.join(getPluginCacheDir(), 'learn'))).toBe(false);

    // Unpinned, the same archive is installed without a recorded commit
    await fetchPlugin('learn', SOURCE, '1.2.0');
    expect(cached('COMMIT')).toBe(SHA_TAG);
    expect(readCachedCommit('learn')).toBeNull();
  });

  test('a malformed commit pin is an error, not an unpinned fetch', async () => {
    const requests = fakeGitHub(drifted());
    await expect(fetchPlugin('learn', SOURCE, '1.2.0', { commit: 'main' }))
      .rejects.toThrow('Invalid commit pin for learn: main');
    expect(requests).toEqual([]);
  });

  test('a reinstall at the same pin reuses the cache; a new pin or an old cache refetches', async () => {
    const requests = fakeGitHub(drifted());
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED });
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED });
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED.slice(0, 7) });
    expect(requests).toHaveLength(1);

    // A cache written before pins were honored has `.version` but no `.commit`
    fs.rmSync(path.join(getPluginCacheDir(), 'learn', '.commit'));
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED });
    expect(requests).toHaveLength(2);

    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_MAIN });
    expect(requests.map(r => r.ref)).toEqual([SHA_PINNED, SHA_PINNED, SHA_MAIN]);
    expect(cached('COMMIT')).toBe(SHA_MAIN);
  });

  test('a first install for a local platform keeps the plugin it fetched and records its commit', async () => {
    // ~/.agentsys is replaced on a first local install; that has to happen
    // before the fetch, or it deletes the plugin it is about to install.
    const pin = resolvePluginSource(loadMarketplace().plugins.find(p => p.name === 'learn').source).commit;
    const skill = '---\nname: learn\ndescription: Use when testing pinned installs.\n---\n\nBody.\n';
    fakeGitHub({
      'agent-sh/learn': { refs: { 'v1.2.0': SHA_TAG, main: SHA_MAIN, pinned: pin }, files: { 'skills/learn/SKILL.md': skill } }
    });

    await installPlugin('learn', { tool: 'kiro', tools: [] });

    expect(readCachedCommit('learn')).toBe(pin);
    expect(loadInstalledJson().plugins.learn).toMatchObject({ commit: pin, platforms: ['kiro'] });
    expect(fs.readFileSync(path.join(tmpHome, '.kiro', 'skills', 'learn', 'SKILL.md'), 'utf8')).toContain('pinned installs');
  });

  test('installed.json records the commit the cache holds', async () => {
    fakeGitHub(drifted());
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED });
    recordInstall('learn', '1.2.0', ['codex'], null, readCachedCommit('learn'));
    recordInstall('local-only', '1.0.0', ['codex'], null, readCachedCommit('local-only'));
    const { plugins } = loadInstalledJson();
    expect(plugins.learn.commit).toBe(SHA_PINNED);
    expect(plugins['local-only']).not.toHaveProperty('commit');
  });
});

describe('pluginFetchRefs', () => {
  const parsed = parseGitHubSource('https://github.com/agent-sh/learn.git', '1.2.0');

  test('pins are exact', () => {
    expect(pluginFetchRefs(parsed, '1.2.0', { commit: SHA_PINNED, ref: 'v1.2.0' }))
      .toEqual({ refs: [SHA_PINNED], exact: true });
    expect(pluginFetchRefs(parsed, '1.2.0', { ref: 'v1.2.0' })).toEqual({ refs: ['v1.2.0'], exact: true });
  });

  test('a URL #ref is exact, no pin falls back', () => {
    const withRef = parseGitHubSource('https://github.com/agent-sh/learn.git#dev', '1.2.0');
    expect(pluginFetchRefs(withRef, '1.2.0')).toEqual({ refs: ['dev'], exact: true });
    expect(pluginFetchRefs(parsed, '1.2.0')).toEqual({ refs: ['v1.2.0', '1.2.0', 'main', 'master'], exact: false });
  });
});

describe('archiveCommitFromTarHead', () => {
  test('reads the pax comment and ignores archives without one', () => {
    const withHeader = zlib.gunzipSync(githubTarball(SHA_PINNED, 'x', { a: 'b' }));
    const without = zlib.gunzipSync(githubTarball(null, 'x', { a: 'b' }));
    expect(archiveCommitFromTarHead(withHeader)).toBe(SHA_PINNED);
    expect(archiveCommitFromTarHead(without)).toBeNull();
    expect(archiveCommitFromTarHead(Buffer.alloc(10))).toBeNull();
  });
});

describe('current marketplace pins', () => {
  let tmpHome;
  let origHome;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsys-pins-'));
    origHome = process.env.HOME;
    process.env.HOME = tmpHome;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  const marketplace = loadMarketplace();
  const remote = marketplace.plugins
    .map(plugin => ({ plugin, source: resolvePluginSource(plugin.source) }))
    .filter(({ source }) => source && source.type === 'remote');

  test('every remote plugin carries a full commit pin', () => {
    expect(remote.length).toBeGreaterThan(0);
    for (const { plugin, source } of remote) {
      expect([plugin.name, source.commit]).toEqual([plugin.name, expect.stringMatching(/^[0-9a-f]{40}$/)]);
    }
  });

  test('a full install fetches every plugin at its pinned commit, not its tag or main', async () => {
    // Every repo also has a v<version> tag and a main branch at other commits
    const repos = {};
    for (const { plugin, source } of remote) {
      const { owner, repo } = parseGitHubSource(source.value, plugin.version, plugin.name);
      const refs = { [`v${plugin.version}`]: SHA_TAG, main: SHA_MAIN, pinned: source.commit };
      if (source.ref) refs[source.ref] = source.commit;
      repos[`${owner}/${repo}`] = { refs };
    }
    const requests = fakeGitHub(repos);

    await fetchExternalPlugins([], marketplace);

    expect(requests).toHaveLength(remote.length);
    for (const { plugin, source } of remote) {
      const { owner, repo } = parseGitHubSource(source.value, plugin.version, plugin.name);
      expect(requests).toContainEqual({ repo: `${owner}/${repo}`, ref: source.commit });
      expect(readCachedCommit(plugin.name)).toBe(source.commit);
    }
  });
});

// Network check against GitHub itself: AGENTSYS_NETWORK_TESTS=1 npx jest fetch-plugin-pins
const networkDescribe = process.env.AGENTSYS_NETWORK_TESTS === '1' ? describe : describe.skip;

networkDescribe('current marketplace pins on GitHub (network)', () => {
  let tmpHome;
  let origHome;

  beforeAll(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsys-pins-net-'));
    origHome = process.env.HOME;
    process.env.HOME = tmpHome;
  });

  afterAll(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test('every pin downloads an archive of its pinned commit', async () => {
    const marketplace = loadMarketplace();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await fetchExternalPlugins([], marketplace);
    for (const plugin of marketplace.plugins) {
      const source = resolvePluginSource(plugin.source);
      if (!source || source.type !== 'remote') continue;
      const ref = fs.readFileSync(path.join(getPluginCacheDir(), plugin.name, '.ref'), 'utf8');
      expect([plugin.name, ref, readCachedCommit(plugin.name)]).toEqual([plugin.name, source.commit, source.commit]);
    }
  }, 300000);
});
