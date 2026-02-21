/**
 * Tests for CLI subcommands: search, install, remove, list
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  parseArgs,
  searchPlugins,
  loadMarketplace,
  satisfiesRange,
  loadInstalledJson,
  saveInstalledJson,
  recordInstall,
  recordRemove,
  getInstalledJsonPath,
  detectInstalledPlatforms
} = require('../bin/cli.js');

describe('CLI subcommand parsing', () => {
  const originalExit = process.exit;
  const originalError = console.error;

  beforeEach(() => {
    process.exit = jest.fn((code) => {
      throw new Error(`process.exit(${code})`);
    });
    console.error = jest.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalError;
  });

  test('parses "install next-task"', () => {
    const result = parseArgs(['install', 'next-task']);
    expect(result.subcommand).toBe('install');
    expect(result.subcommandArg).toBe('next-task');
  });

  test('parses "install next-task@1.2.0"', () => {
    const result = parseArgs(['install', 'next-task@1.2.0']);
    expect(result.subcommand).toBe('install');
    expect(result.subcommandArg).toBe('next-task@1.2.0');
  });

  test('parses "install next-task --tool claude"', () => {
    const result = parseArgs(['install', 'next-task', '--tool', 'claude']);
    expect(result.subcommand).toBe('install');
    expect(result.subcommandArg).toBe('next-task');
    expect(result.tool).toBe('claude');
  });

  test('parses "remove deslop"', () => {
    const result = parseArgs(['remove', 'deslop']);
    expect(result.subcommand).toBe('remove');
    expect(result.subcommandArg).toBe('deslop');
  });

  test('parses "search" without term', () => {
    const result = parseArgs(['search']);
    expect(result.subcommand).toBe('search');
    expect(result.subcommandArg).toBeNull();
  });

  test('parses "search perf"', () => {
    const result = parseArgs(['search', 'perf']);
    expect(result.subcommand).toBe('search');
    expect(result.subcommandArg).toBe('perf');
  });

  test('parses "list" subcommand', () => {
    const result = parseArgs(['list']);
    expect(result.subcommand).toBe('list');
  });

  test('parses "update" subcommand', () => {
    const result = parseArgs(['update']);
    expect(result.subcommand).toBe('update');
  });
});

describe('searchPlugins', () => {
  const originalLog = console.log;
  let logOutput;

  beforeEach(() => {
    logOutput = [];
    console.log = jest.fn((...args) => logOutput.push(args.join(' ')));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  test('lists all plugins when no term given', () => {
    searchPlugins(undefined);
    const output = logOutput.join('\n');
    expect(output).toContain('next-task');
    expect(output).toContain('deslop');
    expect(output).toContain('13 plugin(s) found');
  });

  test('filters by name', () => {
    searchPlugins('perf');
    const output = logOutput.join('\n');
    expect(output).toContain('perf');
    expect(output).toContain('1 plugin(s) found');
  });

  test('filters by description', () => {
    searchPlugins('slop');
    const output = logOutput.join('\n');
    expect(output).toContain('deslop');
  });

  test('shows message when no results', () => {
    searchPlugins('zzzznonexistent');
    const output = logOutput.join('\n');
    expect(output).toContain('No plugins found');
  });
});

describe('satisfiesRange', () => {
  test('>=1.0.0 satisfied by 5.1.0', () => {
    expect(satisfiesRange('5.1.0', '>=1.0.0')).toBe(true);
  });

  test('>=1.0.0 satisfied by 1.0.0', () => {
    expect(satisfiesRange('1.0.0', '>=1.0.0')).toBe(true);
  });

  test('>=2.0.0 not satisfied by 1.9.9', () => {
    expect(satisfiesRange('1.9.9', '>=2.0.0')).toBe(false);
  });

  test('null range always passes', () => {
    expect(satisfiesRange('1.0.0', null)).toBe(true);
  });

  test('undefined range always passes', () => {
    expect(satisfiesRange('1.0.0', undefined)).toBe(true);
  });

  test('unknown format always passes', () => {
    expect(satisfiesRange('1.0.0', '~1.0.0')).toBe(true);
  });
});

describe('installed.json operations', () => {
  let tmpDir;
  let origHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsys-test-'));
    origHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loadInstalledJson returns empty when file missing', () => {
    const data = loadInstalledJson();
    expect(data).toEqual({ plugins: {} });
  });

  test('recordInstall creates and updates installed.json', () => {
    recordInstall('deslop', '1.0.0', ['claude']);
    const data = loadInstalledJson();
    expect(data.plugins.deslop).toBeDefined();
    expect(data.plugins.deslop.version).toBe('1.0.0');
    expect(data.plugins.deslop.platforms).toEqual(['claude']);
    expect(data.plugins.deslop.installedAt).toBeTruthy();
  });

  test('recordRemove removes plugin from installed.json', () => {
    recordInstall('deslop', '1.0.0', ['claude']);
    recordRemove('deslop');
    const data = loadInstalledJson();
    expect(data.plugins.deslop).toBeUndefined();
  });

  test('multiple plugins in installed.json', () => {
    recordInstall('deslop', '1.0.0', ['claude']);
    recordInstall('perf', '1.0.0', ['opencode']);
    const data = loadInstalledJson();
    expect(Object.keys(data.plugins)).toEqual(['deslop', 'perf']);
  });
});

describe('loadMarketplace', () => {
  test('loads marketplace.json with 13 plugins', () => {
    const marketplace = loadMarketplace();
    expect(marketplace.plugins).toBeDefined();
    expect(marketplace.plugins.length).toBe(13);
  });

  test('all plugins have name, source, version', () => {
    const marketplace = loadMarketplace();
    for (const p of marketplace.plugins) {
      expect(p.name).toBeTruthy();
      expect(p.source).toBeTruthy();
      expect(p.version).toBeTruthy();
    }
  });
});
