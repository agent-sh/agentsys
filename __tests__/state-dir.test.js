const fs = require('fs');
const path = require('path');
const os = require('os');

const { getStateDir, clearCache } = require('../lib/platform/state-dir');

describe('state-dir', () => {
  const originalEnv = { ...process.env };
  let tempDirs = [];

  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    clearCache();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs = [];
  });

  function makeTempDir(prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  test('caches state dir per basePath', () => {
    const baseA = makeTempDir('state-dir-a-');
    const baseB = makeTempDir('state-dir-b-');

    fs.mkdirSync(path.join(baseA, '.opencode'));
    fs.mkdirSync(path.join(baseB, '.codex'));

    expect(getStateDir(baseA)).toBe('.opencode');
    expect(getStateDir(baseB)).toBe('.codex');
  });

  test('clearCache refreshes detection for the same basePath', () => {
    const base = makeTempDir('state-dir-clear-');

    fs.mkdirSync(path.join(base, '.opencode'));
    expect(getStateDir(base)).toBe('.opencode');

    fs.rmSync(path.join(base, '.opencode'), { recursive: true, force: true });
    fs.mkdirSync(path.join(base, '.codex'));

    clearCache();
    expect(getStateDir(base)).toBe('.codex');
  });

  test('AI_STATE_DIR overrides without populating cache', () => {
    const base = makeTempDir('state-dir-env-');

    fs.mkdirSync(path.join(base, '.opencode'));
    process.env.AI_STATE_DIR = '.custom';

    expect(getStateDir(base)).toBe('.custom');

    delete process.env.AI_STATE_DIR;
    expect(getStateDir(base)).toBe('.opencode');
  });
});
