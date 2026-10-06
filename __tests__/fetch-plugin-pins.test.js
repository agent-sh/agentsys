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
  installForKiro,
  loadInstalledJson,
  getPluginCacheDir
} = require('../bin/cli.js');

const SHA_PINNED = 'a29d5a00231ebe2983641f509fcedeee17a61b34';
const SHA_TAG = 'dd4b85f00000000000000000000000000000beef';
const SHA_MAIN = 'be1858a00000000000000000000000000000cafe';

// --- a minimal tar writer: pax global header with the commit, like git archive ---

function tarHeader(name, size, type, linkname = '') {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, 'latin1');
  h.write(linkname, 157, 100, 'latin1');
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

function tarEntry(name, data, type, linkname) {
  const body = Buffer.from(data, 'latin1');
  const pad = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([tarHeader(name, body.length, type, linkname), body, pad]);
}

/** A GitHub-style tarball: pax header naming `commit`, then <prefix>/ files ({ symlink } is a link). */
function githubTarball(commit, prefix, files) {
  const parts = [];
  if (commit) {
    const record = `52 comment=${commit}\n`;
    parts.push(tarEntry('pax_global_header', record, 'g'));
  }
  parts.push(tarEntry(`${prefix}/`, '', '5'));
  for (const [file, content] of Object.entries(files)) {
    parts.push(content && content.symlink
      ? tarEntry(`${prefix}/${file}`, '', '2', content.symlink)
      : tarEntry(`${prefix}/${file}`, content, '0'));
  }
  parts.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(parts));
}

// --- fake GitHub tarball endpoint ---

/**
 * repos: { 'owner/repo': { refs: { <ref>: <commit> }, files?: {}, archiveCommit?: fn, cut?: bool, manifest?: false } }
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
          // manifest: false serves a repo without a root plugin.json
          ...(known.manifest === false ? {} : { '.claude-plugin/plugin.json': JSON.stringify({ name: repo }) }),
          'COMMIT': commit,
          ...(known.files || {})
        });
        if (known.cut) body = body.subarray(0, Math.floor(body.length * 0.75));
      }
    }
    res.statusCode = body ? 200 : 404;
    const known = match && repos[`${match[1]}/${match[2]}`];
    setImmediate(() => {
      callback(res);
      if (body && known && known.reset) {
        // the connection drops part way through the download
        res.write(body.subarray(0, Math.floor(body.length / 2)));
        setImmediate(() => res.emit('error', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })));
        return;
      }
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

  test('a connection reset mid-download fails the fetch instead of hanging, and leaves nothing', async () => {
    const learn = marketplaceRepo('learn');
    fakeGitHub({
      [learn.repo]: {
        refs: { pinned: learn.commit },
        files: { 'noise.bin': crypto.randomBytes(256 * 1024).toString('latin1') },
        reset: true
      }
    });
    await expect(fetchPlugin('learn', SOURCE, '1.2.0', { commit: learn.commit })).rejects.toThrow(/ECONNRESET/);
    expect(fs.existsSync(path.join(getPluginCacheDir(), 'learn'))).toBe(false);
    expect(fs.readdirSync(path.join(tmpHome, '.agentsys')).filter(e => e.includes('learn'))).toEqual([]);
  });

  test('when the copy fallback fails and the staging dir cannot be removed, no partial cache is left', async () => {
    fakeGitHub(drifted());
    const realCp = fs.cpSync;
    const realRm = fs.rmSync;
    jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    });
    let copied = false;
    jest.spyOn(fs, 'cpSync').mockImplementationOnce((from, to, opts) => {
      realCp(from, to, opts);
      copied = true;
      throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
    });
    // only the cleanup after the failed copy is blocked, as on Windows with a scanner holding files
    jest.spyOn(fs, 'rmSync').mockImplementation((target, opts) => {
      if (copied && String(target).includes('.fetch-learn')) {
        throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
      }
      return realRm(target, opts);
    });
    await expect(fetchPlugin('learn', SOURCE, '1.2.0', { commit: SHA_PINNED })).rejects.toThrow(/EBUSY/);
    fs.rmSync.mockRestore();
    expect(fs.existsSync(path.join(getPluginCacheDir(), 'learn'))).toBe(false);
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
      // a git-subdir plugin (agnix) is the folder its path names
      const files = source.path ? { [`${source.path}/README.md`]: plugin.name } : {};
      repos[`${owner}/${repo}`] = { refs, files };
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

describe('plugins resolved the way Claude Code reads the marketplace', () => {
  let tmpHome;
  let origHome;
  let origXdg;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsys-layout-'));
    origHome = process.env.HOME;
    origXdg = process.env.XDG_CONFIG_HOME;
    process.env.HOME = tmpHome;
    // OpenCode installs under $XDG_CONFIG_HOME when it is set
    delete process.env.XDG_CONFIG_HOME;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.HOME = origHome;
    if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = origXdg;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  const LOCAL = { tool: null, tools: ['kiro', 'opencode', 'codex', 'cursor'] };
  const home = (...parts) => path.join(tmpHome, ...parts);
  const read = (...parts) => fs.readFileSync(home(...parts), 'utf8');
  const command = (text) => `---\ndescription: ${text}\ncodex-description: Use when ${text}\n---\n\n${text}\n`;
  const agent = (name) => `---\nname: ${name}\ndescription: Agent for ${name}\ntools:\n  - Read\n---\n\nBody.\n`;
  const skill = (name, text) => `---\nname: ${name}\ndescription: Use when ${text}\n---\n\n${text}\n`;
  const entry = (name) => loadMarketplace().plugins.find(p => p.name === name);

  test.each(['can-i-help', 'onboard'])('%s, which has no plugin.json at its pin, installs its command, agent and skill', async (name) => {
    const { repo, commit } = marketplaceRepo(name);
    fakeGitHub({
      [repo]: {
        refs: { pinned: commit },
        manifest: false,
        files: {
          [`commands/${name}.md`]: command(`running ${name}`),
          [`agents/${name}-agent.md`]: agent(`${name}-agent`),
          [`skills/${name}/SKILL.md`]: skill(name, `${name} skill`)
        }
      }
    });
    // A cache dir the marketplace does not list stays undiscovered without a plugin.json
    fs.mkdirSync(home('.agentsys', 'plugins', 'stray', 'skills', 'stray'), { recursive: true });
    fs.writeFileSync(home('.agentsys', 'plugins', 'stray', 'skills', 'stray', 'SKILL.md'), skill('stray', 'stray'));

    await installPlugin(name, LOCAL);

    expect(read('.kiro', 'prompts', `${name}.md`)).toContain(`running ${name}`);
    expect(fs.existsSync(home('.kiro', 'agents', `${name}-agent.json`))).toBe(true);
    expect(read('.kiro', 'skills', name, 'SKILL.md')).toContain(`${name} skill`);
    expect(read('.config', 'opencode', 'commands', `${name}.md`)).toContain(`running ${name}`);
    expect(fs.existsSync(home('.config', 'opencode', 'agents', `${name}-agent.md`))).toBe(true);
    expect(read('.config', 'opencode', 'skills', name, 'SKILL.md')).toContain(`${name} skill`);
    // Codex: the command keeps the name, so $<name> is the command
    expect(read('.codex', 'skills', name, 'SKILL.md')).toContain(`running ${name}`);
    expect(read('.cursor', 'commands', `${name}.md`)).toContain(`running ${name}`);
    expect(read('.cursor', 'skills', name, 'SKILL.md')).toContain(`${name} skill`);

    // The plugin.json comes from the marketplace entry, so installed skills name the plugin and version
    expect(JSON.parse(read('.agentsys', 'plugins', name, '.claude-plugin', 'plugin.json')))
      .toEqual({ name, version: entry(name).version, description: entry(name).description });
    expect(JSON.parse(read('.kiro', 'skills', name, '.agentsys-skill')))
      .toMatchObject({ plugin: name, version: entry(name).version });

    for (const dir of ['.kiro', '.cursor', '.codex']) {
      expect(fs.existsSync(home(dir, 'skills', 'stray'))).toBe(false);
    }
  });

  test('agnix installs its command, agent and skill from plugin/, as Claude Code does', async () => {
    // agnix's git-subdir source names plugin/, so Claude Code installs that
    // folder: the /agnix command, agnix-agent and the agnix skill. The skill at
    // the repo root is not part of it.
    const { repo, commit } = marketplaceRepo('agnix');
    const requests = fakeGitHub({
      [repo]: {
        refs: { pinned: commit },
        manifest: false,
        files: {
          'README.md': 'repo readme',
          'skills/agnix/SKILL.md': skill('agnix', 'repo root skill'),
          'plugin/.claude-plugin/plugin.json': JSON.stringify({ name: 'agnix', version: entry('agnix').version }),
          'plugin/commands/agnix.md': command('plugin folder command'),
          'plugin/agents/agnix-agent.md': agent('agnix-agent'),
          'plugin/skills/agnix/SKILL.md': skill('agnix', 'plugin folder skill')
        }
      }
    });

    await installPlugin('agnix', LOCAL);

    expect(requests).toEqual([{ repo, ref: commit }]);
    expect(read('.kiro', 'prompts', 'agnix.md')).toContain('plugin folder command');
    expect(fs.existsSync(home('.kiro', 'agents', 'agnix-agent.json'))).toBe(true);
    expect(read('.config', 'opencode', 'commands', 'agnix.md')).toContain('plugin folder command');
    expect(fs.existsSync(home('.config', 'opencode', 'agents', 'agnix-agent.md'))).toBe(true);
    expect(read('.cursor', 'commands', 'agnix.md')).toContain('plugin folder command');
    for (const dir of [['.kiro'], ['.config', 'opencode'], ['.cursor']]) {
      expect(read(...dir, 'skills', 'agnix', 'SKILL.md')).toContain('plugin folder skill');
    }
    // Codex: the skill shares the command's name, so $agnix is the command
    expect(read('.codex', 'skills', 'agnix', 'SKILL.md')).toContain('plugin folder command');

    // The cache is the plugin/ folder, with the plugin.json agnix ships there
    const cache = path.join(getPluginCacheDir(), 'agnix');
    expect(read('.agentsys', 'plugins', 'agnix', '.path')).toBe('plugin');
    expect(readCachedCommit('agnix')).toBe(commit);
    expect(fs.existsSync(path.join(cache, 'README.md'))).toBe(false);
    expect(read('.agentsys', 'plugins', 'agnix', 'skills', 'agnix', 'SKILL.md')).toContain('plugin folder skill');
    expect(JSON.parse(read('.agentsys', 'plugins', 'agnix', '.claude-plugin', 'plugin.json')))
      .toEqual({ name: 'agnix', version: entry('agnix').version });
  });

  test('agnix names its plugin/ folder; onboard and can-i-help are their repo root', () => {
    const agnix = entry('agnix').source;
    expect(resolvePluginSource(agnix)).toEqual({
      type: 'remote', value: 'https://github.com/agent-sh/agnix.git', path: 'plugin', commit: agnix.sha
    });
    for (const name of ['onboard', 'can-i-help']) {
      const source = resolvePluginSource(entry(name).source);
      expect([name, source.type, source.path]).toEqual([name, 'remote', undefined]);
    }
  });

  test('a git-subdir source keeps its folder, and owner/repo is a GitHub repo', () => {
    expect(resolvePluginSource({
      source: 'git-subdir', url: 'https://github.com/acme/mono.git', path: 'tools/plugin', commit: SHA_PINNED
    })).toEqual({ type: 'remote', value: 'https://github.com/acme/mono.git', path: 'tools/plugin', commit: SHA_PINNED });
    expect(resolvePluginSource({ source: 'git-subdir', url: 'acme/mono', path: 'p', ref: 'v1' }))
      .toEqual({ type: 'remote', value: 'https://github.com/acme/mono', path: 'p', ref: 'v1' });
    // sha, the key Claude Code installs from, wins over commit, as for a url source
    expect(resolvePluginSource({ source: 'git-subdir', url: MONO_URL, path: 'p', sha: SHA_PINNED, commit: SHA_MAIN }))
      .toEqual({ type: 'remote', value: MONO_URL, path: 'p', commit: SHA_PINNED });
  });

  const MONO_URL = 'https://github.com/acme/mono.git';
  const monoRepo = () => ({
    'acme/mono': {
      refs: { pinned: SHA_PINNED },
      manifest: false,
      files: {
        'README.md': 'repo readme',
        'tools/plugin/commands/mono.md': command('mono command'),
        'tools/plugin/skills/mono/SKILL.md': skill('mono', 'mono skill')
      }
    }
  });

  test('a git-subdir source installs the plugin from its folder', async () => {
    const requests = fakeGitHub(monoRepo());
    const marketplace = {
      plugins: [{
        name: 'mono',
        version: '1.0.0',
        description: 'Plugin in a monorepo folder',
        source: { source: 'git-subdir', url: MONO_URL, path: './tools/plugin/', commit: SHA_PINNED }
      }]
    };

    await fetchExternalPlugins(['mono'], marketplace);
    const cache = path.join(getPluginCacheDir(), 'mono');
    expect(fs.existsSync(path.join(cache, 'skills', 'mono', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(cache, 'README.md'))).toBe(false);
    expect(fs.readFileSync(path.join(cache, '.path'), 'utf8')).toBe('tools/plugin');
    expect(readCachedCommit('mono')).toBe(SHA_PINNED);
    expect(JSON.parse(fs.readFileSync(path.join(cache, '.claude-plugin', 'plugin.json'), 'utf8')))
      .toEqual({ name: 'mono', version: '1.0.0', description: 'Plugin in a monorepo folder' });
    expect(fs.readdirSync(home('.agentsys'))).toEqual(['plugins']);

    installForKiro(home('.agentsys'));
    expect(read('.kiro', 'skills', 'mono', 'SKILL.md')).toContain('mono skill');
    expect(read('.kiro', 'prompts', 'mono.md')).toContain('mono command');

    // Same folder reuses the cache; a cache of another folder (or the root) is fetched again
    await fetchPlugin('mono', MONO_URL, '1.0.0', { commit: SHA_PINNED }, { path: 'tools/plugin' });
    expect(requests).toHaveLength(1);
    await fetchPlugin('mono', MONO_URL, '1.0.0', { commit: SHA_PINNED });
    expect(requests).toHaveLength(2);
    expect(fs.existsSync(path.join(cache, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(cache, '.path'))).toBe(false);
  });

  test('a folder outside the repo or missing from it is an error and leaves nothing', async () => {
    const requests = fakeGitHub(monoRepo());
    for (const bad of ['../escape', 'tools/../../escape', '/abs', 'C:\\abs']) {
      await expect(fetchPlugin('mono', MONO_URL, '1.0.0', { commit: SHA_PINNED }, { path: bad }))
        .rejects.toThrow(`Invalid plugin path for mono: ${bad}`);
    }
    expect(requests).toEqual([]);

    await expect(fetchPlugin('mono', MONO_URL, '1.0.0', { commit: SHA_PINNED }, { path: 'nope' }))
      .rejects.toThrow(`acme/mono at ${SHA_PINNED} has no folder nope`);
    // no staging dir and no cache
    expect(fs.readdirSync(home('.agentsys'))).toEqual([]);
  });

  // Windows tar needs extra rights to create symlinks
  (process.platform === 'win32' ? test.skip : test)('a folder reached through a symlink out of the repo is refused', async () => {
    const outside = home('.agentsys', 'outside', 'b');
    fs.mkdirSync(path.join(outside, 'skills', 'x'), { recursive: true });
    fs.writeFileSync(path.join(outside, 'skills', 'x', 'SKILL.md'), skill('x', 'outside the repo'));
    const repos = monoRepo();
    // extracted to ~/.agentsys/.fetch-mono/a, so ../outside is ~/.agentsys/outside
    repos['acme/mono'].files.a = { symlink: '../outside' };
    fakeGitHub(repos);

    await expect(fetchPlugin('mono', MONO_URL, '1.0.0', { commit: SHA_PINNED }, { path: 'a/b' }))
      .rejects.toThrow(`acme/mono at ${SHA_PINNED}: folder a/b leads out of the repo`);
    expect(fs.existsSync(path.join(outside, 'skills', 'x', 'SKILL.md'))).toBe(true);
    expect(fs.readdirSync(home('.agentsys'))).toEqual(['outside']);
  });

  (process.platform === 'win32' ? test.skip : test)('a plugin.json is never written through a symlink', async () => {
    const outside = home('.agentsys', 'outside');
    fs.mkdirSync(outside, { recursive: true });
    const linked = (files) => ({ refs: { pinned: SHA_PINNED }, manifest: false, files });
    const requests = fakeGitHub({
      // .claude-plugin points out of the archive, at a directory with no plugin.json
      'acme/dirlink': linked({ '.claude-plugin': { symlink: '../outside' } }),
      // plugin.json is a dangling link out of the archive
      'acme/filelink': linked({ '.claude-plugin/plugin.json': { symlink: '../../outside/plugin.json' } }),
      'acme/plain': linked({})
    });
    const fetchFrom = (name) => fetchPlugin(name, `https://github.com/acme/${name}.git`, '1.0.0', { commit: SHA_PINNED });

    await expect(fetchFrom('dirlink')).rejects.toThrow('Not writing a plugin.json for dirlink: .claude-plugin is a symlink');
    await expect(fetchFrom('filelink'))
      .rejects.toThrow('Not writing a plugin.json for filelink: .claude-plugin/plugin.json is a symlink');
    expect(fs.readdirSync(outside)).toEqual([]);
    expect(fs.readdirSync(home('.agentsys'))).toEqual(['outside']);

    // and on cache reuse
    await fetchFrom('plain');
    const cachedManifestDir = path.join(getPluginCacheDir(), 'plain', '.claude-plugin');
    fs.rmSync(cachedManifestDir, { recursive: true });
    fs.symlinkSync(outside, cachedManifestDir);
    await expect(fetchFrom('plain')).rejects.toThrow('Not writing a plugin.json for plain: .claude-plugin is a symlink');
    expect(requests.filter(r => r.repo === 'acme/plain')).toHaveLength(1);
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  test('a cache without plugin.json from an earlier version gets one without a refetch', async () => {
    const { repo, commit } = marketplaceRepo('can-i-help');
    const requests = fakeGitHub({ [repo]: { refs: { pinned: commit }, manifest: false } });
    const source = resolvePluginSource(entry('can-i-help').source);
    await fetchPlugin('can-i-help', source.value, '0.2.0', { commit }, { description: 'Contributor guidance' });
    const manifest = path.join(getPluginCacheDir(), 'can-i-help', '.claude-plugin', 'plugin.json');
    fs.rmSync(manifest);

    await fetchPlugin('can-i-help', source.value, '0.2.0', { commit }, { description: 'Contributor guidance' });
    expect(requests).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(manifest, 'utf8')))
      .toEqual({ name: 'can-i-help', version: '0.2.0', description: 'Contributor guidance' });
  });

  test('a plugin.json the plugin ships is kept as it is', async () => {
    fakeGitHub({ 'agent-sh/learn': { refs: { pinned: SHA_PINNED } } });
    await fetchPlugin('learn', 'https://github.com/agent-sh/learn.git', '1.2.0', { commit: SHA_PINNED },
      { description: 'from the marketplace' });
    expect(fs.readFileSync(path.join(getPluginCacheDir(), 'learn', '.claude-plugin', 'plugin.json'), 'utf8'))
      .toBe(JSON.stringify({ name: 'learn' }));
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
