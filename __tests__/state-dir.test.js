const fs = require('fs');
const path = require('path');
const os = require('os');

const { getStateDir, getStateDirPath, getPlatformName, clearCache } = require('../lib/platform/state-dir');

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

  describe('getStateDir detection', () => {
    test('returns .claude when no state directories exist', () => {
      const base = makeTempDir('state-dir-empty-');
      expect(getStateDir(base)).toBe('.claude');
    });

    test('detects .opencode directory', () => {
      const base = makeTempDir('state-dir-opencode-');
      fs.mkdirSync(path.join(base, '.opencode'));
      expect(getStateDir(base)).toBe('.opencode');
    });

    test('detects .codex directory', () => {
      const base = makeTempDir('state-dir-codex-');
      fs.mkdirSync(path.join(base, '.codex'));
      expect(getStateDir(base)).toBe('.codex');
    });

    test('detects .kiro directory', () => {
      const base = makeTempDir('state-dir-kiro-');
      fs.mkdirSync(path.join(base, '.kiro'));
      expect(getStateDir(base)).toBe('.kiro');
    });

    test('defaults to .claude when only .claude directory exists', () => {
      const base = makeTempDir('state-dir-claude-');
      fs.mkdirSync(path.join(base, '.claude'));
      // .claude is the default, not detected by directory existence
      expect(getStateDir(base)).toBe('.claude');
    });

    test('OPENCODE_CONFIG env var takes priority over directory detection', () => {
      const base = makeTempDir('state-dir-opencode-env-');
      fs.mkdirSync(path.join(base, '.codex'));
      process.env.OPENCODE_CONFIG = '/some/path';
      expect(getStateDir(base)).toBe('.opencode');
      delete process.env.OPENCODE_CONFIG;
    });

    test('OPENCODE_CONFIG_DIR env var takes priority over directory detection', () => {
      const base = makeTempDir('state-dir-opencode-config-dir-');
      fs.mkdirSync(path.join(base, '.codex'));
      process.env.OPENCODE_CONFIG_DIR = '/some/path';
      expect(getStateDir(base)).toBe('.opencode');
      delete process.env.OPENCODE_CONFIG_DIR;
    });

    test('CODEX_HOME env var detects codex', () => {
      const base = makeTempDir('state-dir-codex-env-');
      process.env.CODEX_HOME = '/some/codex/path';
      expect(getStateDir(base)).toBe('.codex');
      delete process.env.CODEX_HOME;
    });
  });

  describe('priority order when multiple exist', () => {
    test('.opencode takes priority over .codex', () => {
      const base = makeTempDir('state-dir-priority-oc-');
      fs.mkdirSync(path.join(base, '.opencode'));
      fs.mkdirSync(path.join(base, '.codex'));
      expect(getStateDir(base)).toBe('.opencode');
    });

    test('.opencode takes priority over .claude', () => {
      const base = makeTempDir('state-dir-priority-ocl-');
      fs.mkdirSync(path.join(base, '.opencode'));
      fs.mkdirSync(path.join(base, '.claude'));
      expect(getStateDir(base)).toBe('.opencode');
    });

    test('.codex takes priority over .claude', () => {
      const base = makeTempDir('state-dir-priority-cc-');
      fs.mkdirSync(path.join(base, '.codex'));
      fs.mkdirSync(path.join(base, '.claude'));
      expect(getStateDir(base)).toBe('.codex');
    });

    test('.codex takes priority over .kiro', () => {
      const base = makeTempDir('state-dir-priority-ck-');
      fs.mkdirSync(path.join(base, '.codex'));
      fs.mkdirSync(path.join(base, '.kiro'));
      expect(getStateDir(base)).toBe('.codex');
    });

    test('.kiro takes priority over .claude', () => {
      const base = makeTempDir('state-dir-priority-kc-');
      fs.mkdirSync(path.join(base, '.kiro'));
      fs.mkdirSync(path.join(base, '.claude'));
      expect(getStateDir(base)).toBe('.kiro');
    });

    test('all three exist: .opencode wins', () => {
      const base = makeTempDir('state-dir-priority-all-');
      fs.mkdirSync(path.join(base, '.opencode'));
      fs.mkdirSync(path.join(base, '.codex'));
      fs.mkdirSync(path.join(base, '.claude'));
      expect(getStateDir(base)).toBe('.opencode');
    });

    test('AI_STATE_DIR env overrides all directory detection', () => {
      const base = makeTempDir('state-dir-env-override-');
      fs.mkdirSync(path.join(base, '.opencode'));
      fs.mkdirSync(path.join(base, '.codex'));
      process.env.AI_STATE_DIR = '.mystate';
      expect(getStateDir(base)).toBe('.mystate');
      delete process.env.AI_STATE_DIR;
    });

    test('OPENCODE_CONFIG takes priority over CODEX_HOME', () => {
      const base = makeTempDir('state-dir-env-priority-');
      process.env.OPENCODE_CONFIG = '/opencode/path';
      process.env.CODEX_HOME = '/codex/path';
      expect(getStateDir(base)).toBe('.opencode');
      delete process.env.OPENCODE_CONFIG;
      delete process.env.CODEX_HOME;
    });
  });

  describe('getStateDirPath', () => {
    test('returns full path to state directory', () => {
      const base = makeTempDir('state-dir-path-');
      fs.mkdirSync(path.join(base, '.opencode'));
      expect(getStateDirPath(base)).toBe(path.join(base, '.opencode'));
    });

    test('returns full path with default .claude', () => {
      const base = makeTempDir('state-dir-path-default-');
      expect(getStateDirPath(base)).toBe(path.join(base, '.claude'));
    });
  });

  describe('getPlatformName', () => {
    test('returns opencode for .opencode directory', () => {
      const base = makeTempDir('platform-opencode-');
      fs.mkdirSync(path.join(base, '.opencode'));
      expect(getPlatformName(base)).toBe('opencode');
    });

    test('returns codex for .codex directory', () => {
      const base = makeTempDir('platform-codex-');
      fs.mkdirSync(path.join(base, '.codex'));
      expect(getPlatformName(base)).toBe('codex');
    });

    test('returns kiro for .kiro directory', () => {
      const base = makeTempDir('platform-kiro-');
      fs.mkdirSync(path.join(base, '.kiro'));
      expect(getPlatformName(base)).toBe('kiro');
    });

    test('returns claude as default', () => {
      const base = makeTempDir('platform-claude-');
      expect(getPlatformName(base)).toBe('claude');
    });

    test('returns custom when AI_STATE_DIR is set', () => {
      const base = makeTempDir('platform-custom-');
      process.env.AI_STATE_DIR = '.mystate';
      expect(getPlatformName(base)).toBe('custom');
      delete process.env.AI_STATE_DIR;
    });
  });

  describe('file vs directory handling', () => {
    test('ignores .opencode if it is a file, not directory', () => {
      const base = makeTempDir('state-dir-file-');
      fs.writeFileSync(path.join(base, '.opencode'), 'not a directory');
      expect(getStateDir(base)).toBe('.claude');
    });

    test('ignores .codex if it is a file, not directory', () => {
      const base = makeTempDir('state-dir-file-codex-');
      fs.writeFileSync(path.join(base, '.codex'), 'not a directory');
      expect(getStateDir(base)).toBe('.claude');
    });

    test('ignores .kiro if it is a file, not directory', () => {
      const base = makeTempDir('state-dir-file-kiro-');
      fs.writeFileSync(path.join(base, '.kiro'), 'not a directory');
      expect(getStateDir(base)).toBe('.claude');
    });
  });
});
