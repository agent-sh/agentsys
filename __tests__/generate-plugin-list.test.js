'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'generate-plugin-list.js');

// A scratch copy of the repo pieces the generator reads and writes, so the
// tests never touch the checked-in scripts/plugins.txt.
function scratchRepo(pluginsTxt) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-list-'));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, '.claude-plugin'));
  fs.copyFileSync(scriptPath, path.join(root, 'scripts', 'generate-plugin-list.js'));
  fs.copyFileSync(
    path.join(repoRoot, '.claude-plugin', 'marketplace.json'),
    path.join(root, '.claude-plugin', 'marketplace.json')
  );
  if (pluginsTxt !== undefined) fs.writeFileSync(path.join(root, 'scripts', 'plugins.txt'), pluginsTxt);
  return root;
}

function run(root, args = []) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'generate-plugin-list.js'), ...args], {
    encoding: 'utf8',
  });
}

const checkedIn = fs.readFileSync(path.join(repoRoot, 'scripts', 'plugins.txt'), 'utf8');
const scratch = [];

afterEach(() => {
  while (scratch.length) fs.rmSync(scratch.pop(), { recursive: true, force: true });
});

describe('generate-plugin-list', () => {
  test('writes the checked-in plugins.txt byte for byte from marketplace.json', () => {
    const root = scratchRepo();
    scratch.push(root);
    const result = run(root);
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(root, 'scripts', 'plugins.txt'), 'utf8')).toBe(checkedIn);
  });

  test('lists every marketplace plugin once, sorted, one per line', () => {
    const { renderPluginList } = require(scriptPath);
    const marketplace = {
      plugins: [{ name: 'perf' }, { name: 'ada-spark' }, { name: 'deslop' }],
    };
    expect(renderPluginList(marketplace)).toBe('ada-spark\ndeslop\nperf\n');
  });

  test('--check passes on a fresh file and changes nothing', () => {
    const root = scratchRepo(checkedIn);
    scratch.push(root);
    const result = run(root, ['--check']);
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(root, 'scripts', 'plugins.txt'), 'utf8')).toBe(checkedIn);
  });

  test('--check fails on a stale file and leaves it as it was', () => {
    const stale = checkedIn.replace('deslop\n', '');
    const root = scratchRepo(stale);
    scratch.push(root);
    const result = run(root, ['--check']);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('plugins.txt');
    expect(fs.readFileSync(path.join(root, 'scripts', 'plugins.txt'), 'utf8')).toBe(stale);
  });

  test('--check fails when plugins.txt is missing', () => {
    const root = scratchRepo();
    scratch.push(root);
    expect(run(root, ['--check']).status).toBe(1);
  });

  test('checkFreshness reports the checked-in file fresh for preflight', () => {
    const { checkFreshness } = require(scriptPath);
    expect(checkFreshness().status).toBe('fresh');
  });

  test('preflight runs the plugin list check when the marketplace changes', () => {
    const { runGapChecks } = require('../scripts/preflight');
    const names = runGapChecks(new Set(), ['.claude-plugin/marketplace.json'], {}).map((r) => r.name);
    expect(names).toContain('gap:plugin-list-freshness');
    const all = runGapChecks(new Set(), [], { all: true }).map((r) => r.name);
    expect(all).toContain('gap:plugin-list-freshness');
  });
});
