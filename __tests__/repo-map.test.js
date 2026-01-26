/**
 * Tests for repo-map cache utilities
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const cache = require('../lib/repo-map/cache');

describe('repo-map cache', () => {
  let tempDir;
  const originalStateDir = process.env.AI_STATE_DIR;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-map-test-'));
    process.env.AI_STATE_DIR = '.test-state';
  });

  afterAll(() => {
    process.env.AI_STATE_DIR = originalStateDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('save and load map', () => {
    const map = {
      version: '1.0.0',
      generated: new Date().toISOString(),
      git: { commit: 'abc123', branch: 'main' },
      project: { languages: ['javascript'] },
      stats: { totalFiles: 0, totalSymbols: 0 },
      files: {},
      dependencies: {}
    };

    cache.save(tempDir, map);
    const loaded = cache.load(tempDir);

    expect(loaded).toBeTruthy();
    expect(loaded.version).toBe('1.0.0');
    expect(loaded.updated).toBeDefined();
  });

  test('mark and clear stale', () => {
    cache.markStale(tempDir);
    expect(cache.isMarkedStale(tempDir)).toBe(true);

    cache.clearStale(tempDir);
    expect(cache.isMarkedStale(tempDir)).toBe(false);
  });
});
