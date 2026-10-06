/**
 * The npm installer fetches each plugin at the commit marketplace.json pins.
 *
 * https.get is replaced by a fake GitHub tarball endpoint that serves real
 * gzipped tar archives, so these tests run the whole fetch path: ref choice,
 * download, `tar` extraction, the archive commit check and the cache markers.
 */

const crypto = require('crypto');
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
  removePlugin,
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
 * repos: { 'owner/repo': { refs: { <ref>: <commit> }, files?: {}, archiveCommit?: fn, cut?: bool } }
 * A full commit SHA a repo knows is always servable, as on GitHub. `cut`
 * serves the first three quarters of the gzip stream, like a dropped download.
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
        if (known.cut) body = body.subarray(0, Math.floor(body.length * 0.75));
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

/** The fake repo key and pinned commit of a marketplace plugin. */
function marketplaceRepo(name) {
  const plugin = loadMarketplace().plugins.find(p => p.name === name);
  const source = resolvePluginSource(plugin.source);
  const { owner, repo } = parseGitHubSource(source.value, plugin.version, name);
  return { repo: `${owner}/${repo}`, commit: source.commit };
}

const skillFile = (name) => `---\nname: ${name}\ndescription: Use when testing pinned installs.\n---\n\nBody.\n`;

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
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED.toUpperCase() });
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

  test('an install whose pinned fetch fails installs and records nothing', async () => {
    const pin = resolvePluginSource(loadMarketplace().plugins.find(p => p.name === 'learn').source).commit;
    const skill = '---\nname: learn\ndescription: Use when testing pinned installs.\n---\n\nBody.\n';
    fakeGitHub({
      'agent-sh/learn': {
        refs: { 'v1.2.0': SHA_TAG, pinned: pin },
        files: { 'skills/learn/SKILL.md': skill },
        archiveCommit: () => null
      }
    });

    await expect(installPlugin('learn', { tool: 'kiro', tools: [] }))
      .rejects.toThrow('Not installing learn: failed to fetch learn');

    expect(loadInstalledJson().plugins).not.toHaveProperty('learn');
    expect(fs.existsSync(path.join(tmpHome, '.kiro', 'skills', 'learn'))).toBe(false);
  });

  test('an abbreviated commit pin is an error, so a pin names exactly one commit', async () => {
    const requests = fakeGitHub(drifted());
    for (const pin of [SHA_PINNED.slice(0, 7), SHA_PINNED.slice(0, 39), `${SHA_PINNED}0`]) {
      await expect(fetchPlugin('learn', SOURCE, '1.2.0', { commit: pin }))
        .rejects.toThrow(`Invalid commit pin for learn: ${pin}`);
    }
    expect(requests).toEqual([]);

    // A full pin does not match a cache or an archive at another commit with the same prefix
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED });
    const samePrefix = SHA_PINNED.slice(0, 7) + '0'.repeat(33);
    await expect(fetchPlugin('learn', SOURCE, '1.2.0', { commit: samePrefix })).rejects.toThrow(/HTTP 404/);
    expect(requests.map(r => r.ref)).toEqual([SHA_PINNED, samePrefix]);
  });

  test('a cut-off download leaves no cache dir, and a later install does not install it', async () => {
    const learn = marketplaceRepo('learn');
    const deslop = marketplaceRepo('deslop');
    fakeGitHub({
      [learn.repo]: {
        refs: { pinned: learn.commit },
        files: {
          'skills/learn/SKILL.md': skillFile('learn'),
          // Incompressible, so the cut lands inside it, after the files above
          'noise.bin': crypto.randomBytes(256 * 1024).toString('latin1')
        },
        cut: true
      },
      [deslop.repo]: { refs: { pinned: deslop.commit }, files: { 'skills/deslop/SKILL.md': skillFile('deslop') } }
    });

    await expect(installPlugin('learn', { tool: 'kiro', tools: [] }))
      .rejects.toThrow('Not installing learn: failed to fetch learn');
    expect(console.error.mock.calls.flat().join('\n')).toMatch(/Failed to fetch learn: tar extraction failed/);
    expect(fs.existsSync(path.join(getPluginCacheDir(), 'learn'))).toBe(false);
    // The partial extraction is gone too, not left beside the cache
    expect(fs.readdirSync(path.join(tmpHome, '.agentsys')).filter(e => e.includes('learn'))).toEqual([]);

    await installPlugin('deslop', { tool: 'kiro', tools: [] });
    expect(fs.existsSync(path.join(tmpHome, '.kiro', 'skills', 'deslop', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, '.kiro', 'skills', 'learn'))).toBe(false);
    expect(Object.keys(loadInstalledJson().plugins)).toEqual(['deslop']);
  });

  test('a fetch whose rename into the cache fails still installs, by copying', async () => {
    fakeGitHub(drifted());
    jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    });
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED });
    expect(cached('COMMIT')).toBe(SHA_PINNED);
    expect(readCachedCommit('learn')).toBe(SHA_PINNED);
    expect(fs.readdirSync(path.join(tmpHome, '.agentsys'))).toEqual(['plugins']);
  });

  test('cache markers shipped inside an archive are replaced, never trusted', async () => {
    const repos = drifted();
    repos['agent-sh/learn'].files = { '.commit': SHA_PINNED, '.ref': SHA_PINNED, '.version': '1.2.0' };
    // Unpinned, from an archive that does not name its commit
    repos['agent-sh/learn'].archiveCommit = () => null;
    const requests = fakeGitHub(repos);

    await fetchPlugin('learn', SOURCE, '1.2.0');
    expect(cached('COMMIT')).toBe(SHA_TAG);
    expect(readCachedCommit('learn')).toBeNull();
    expect(cached('.ref')).toBe('v1.2.0');

    // So a pinned install fetches its commit instead of reusing that tree
    delete repos['agent-sh/learn'].archiveCommit;
    await fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED });
    expect(requests.map(r => r.ref)).toEqual(['v1.2.0', SHA_PINNED]);
    expect(cached('COMMIT')).toBe(SHA_PINNED);
  });

  test('a first local install keeps the records of plugins installed before it', async () => {
    const learn = marketplaceRepo('learn');
    fakeGitHub({ [learn.repo]: { refs: { pinned: learn.commit }, files: { 'skills/learn/SKILL.md': skillFile('learn') } } });
    // A Claude-only `agentsys install deslop` records deslop and sets up no local files
    recordInstall('deslop', '1.0.0', ['claude']);
    expect(fs.existsSync(path.join(tmpHome, '.agentsys', 'lib'))).toBe(false);

    await installPlugin('learn', { tool: 'kiro', tools: [] });
    expect(Object.keys(loadInstalledJson().plugins).sort()).toEqual(['deslop', 'learn']);

    // `agentsys remove deslop` finds it; PATH is emptied so no real `claude` runs
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`process.exit(${code})`); });
    const origPath = process.env.PATH;
    process.env.PATH = '';
    try {
      removePlugin('deslop');
    } finally {
      process.env.PATH = origPath;
    }
    expect(Object.keys(loadInstalledJson().plugins)).toEqual(['learn']);
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
