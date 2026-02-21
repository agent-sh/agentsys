/**
 * Tests for scripts/stamp-version.js
 *
 * Uses a temporary directory with mock files to verify stampVersion()
 * reads from package.json and writes correct version to all targets.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { stampVersion, updateJsonFile, updateMarketplaceJson, updateContentJson } = require('../scripts/stamp-version');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-version-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Create a minimal mock repo structure inside tmpDir.
 * Returns the root path.
 */
function createMockRepo(version) {
  // package.json
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'test', version }, null, 2) + '\n'
  );

  // .claude-plugin/plugin.json
  const claudeDir = path.join(tmpDir, '.claude-plugin');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, 'plugin.json'),
    JSON.stringify({ name: 'test', version: '0.0.0' }, null, 2) + '\n'
  );

  // .claude-plugin/marketplace.json (multiple version occurrences)
  fs.writeFileSync(
    path.join(claudeDir, 'marketplace.json'),
    JSON.stringify({
      name: 'test',
      version: '0.0.0',
      plugins: [
        { name: 'a', version: '0.0.0' },
        { name: 'b', version: '0.0.0' }
      ]
    }, null, 2) + '\n'
  );

  // lib/discovery/index.js (minimal stub)
  const libDir = path.join(tmpDir, 'lib', 'discovery');
  fs.mkdirSync(libDir, { recursive: true });
  fs.writeFileSync(
    path.join(libDir, 'index.js'),
    `module.exports = { discoverPlugins: () => ['mock-plugin'] };`
  );

  // plugins/mock-plugin/.claude-plugin/plugin.json
  const pluginDir = path.join(tmpDir, 'plugins', 'mock-plugin', '.claude-plugin');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify({ name: 'mock-plugin', version: '0.0.0' }, null, 2) + '\n'
  );

  // site/content.json
  const siteDir = path.join(tmpDir, 'site');
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(
    path.join(siteDir, 'content.json'),
    JSON.stringify({ meta: { version: '0.0.0' } }, null, 2) + '\n'
  );

  return tmpDir;
}

describe('stampVersion', () => {
  test('stamps version from package.json to all target files', () => {
    const root = createMockRepo('2.5.0');

    const code = stampVersion(root);
    expect(code).toBe(0);

    // Root plugin.json
    const rootPlugin = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
    expect(rootPlugin.version).toBe('2.5.0');

    // Marketplace (root version only, plugin versions are independent)
    const marketplace = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
    expect(marketplace.version).toBe('2.5.0');
    // Plugin versions are now independent (not stamped by root version)

    // Plugin plugin.json - no longer stamped by root version (plugins have independent versions)

    // Site content.json
    const content = JSON.parse(fs.readFileSync(path.join(root, 'site', 'content.json'), 'utf8'));
    expect(content.meta.version).toBe('2.5.0');
  });

  test('returns 1 when package.json is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-missing-'));
    try {
      const code = stampVersion(root);
      expect(code).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('handles missing target files gracefully', () => {
    // Only create package.json, no other files
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2) + '\n'
    );

    // Need lib/discovery stub
    const libDir = path.join(tmpDir, 'lib', 'discovery');
    fs.mkdirSync(libDir, { recursive: true });
    fs.writeFileSync(
      path.join(libDir, 'index.js'),
      `module.exports = { discoverPlugins: () => [] };`
    );

    // Should not throw
    const code = stampVersion(tmpDir);
    expect(code).toBe(0);
  });

  test('handles prerelease versions', () => {
    const root = createMockRepo('3.0.0-rc.1');
    const code = stampVersion(root);
    expect(code).toBe(0);

    const rootPlugin = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
    expect(rootPlugin.version).toBe('3.0.0-rc.1');
  });

  test('ignores plugin.json in plugins/ (independent versions)', () => {
    const root = createMockRepo('1.0.0');

    // Even with a corrupt plugin.json, stamp-version should succeed
    // because it no longer touches plugin-level files
    const pluginJsonPath = path.join(root, 'plugins', 'mock-plugin', '.claude-plugin', 'plugin.json');
    fs.writeFileSync(pluginJsonPath, '{ "name": "mock-plugin", "version": "0.0.0"'); // Missing closing brace

    // Should NOT throw — plugins are independent now
    const code = stampVersion(root);
    expect(code).toBe(0);
  });

  test('throws error when package.json is malformed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-malformed-pkg-'));

    try {
      // Create malformed package.json
      fs.writeFileSync(
        path.join(root, 'package.json'),
        '{ "name": "test", "version": "1.0.0"' // Missing closing brace
      );

      // Need lib/discovery stub
      const libDir = path.join(root, 'lib', 'discovery');
      fs.mkdirSync(libDir, { recursive: true });
      fs.writeFileSync(
        path.join(libDir, 'index.js'),
        `module.exports = { discoverPlugins: () => [] };`
      );

      // Should throw when trying to read malformed package.json
      expect(() => {
        stampVersion(root);
      }).toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('updateJsonFile', () => {
  test('updates version in JSON file', () => {
    const filePath = path.join(tmpDir, 'test.json');
    fs.writeFileSync(filePath, JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2) + '\n');

    const result = updateJsonFile(filePath, '2.0.0');
    expect(result).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(content.version).toBe('2.0.0');
  });

  test('returns false for missing file', () => {
    const result = updateJsonFile(path.join(tmpDir, 'nonexistent.json'), '1.0.0');
    expect(result).toBe(false);
  });

  test('throws error for malformed JSON', () => {
    const filePath = path.join(tmpDir, 'malformed.json');
    fs.writeFileSync(filePath, '{ "name": "test", "version": "1.0.0"'); // Missing closing brace

    expect(() => {
      updateJsonFile(filePath, '2.0.0');
    }).toThrow();
  });
});

describe('updateMarketplaceJson', () => {
  test('replaces all version occurrences', () => {
    const filePath = path.join(tmpDir, 'marketplace.json');
    fs.writeFileSync(filePath, JSON.stringify({
      version: '1.0.0',
      plugins: [
        { name: 'a', version: '1.0.0' },
        { name: 'b', version: '1.0.0' }
      ]
    }, null, 2));

    const result = updateMarketplaceJson(filePath, '2.0.0');
    expect(result).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(content.version).toBe('2.0.0');
    expect(content.plugins[0].version).toBe('2.0.0');
    expect(content.plugins[1].version).toBe('2.0.0');
  });

  test('returns false for missing file', () => {
    const result = updateMarketplaceJson(path.join(tmpDir, 'missing.json'), '1.0.0');
    expect(result).toBe(false);
  });
});

describe('updateContentJson', () => {
  test('updates meta.version via regex', () => {
    const filePath = path.join(tmpDir, 'content.json');
    fs.writeFileSync(filePath, JSON.stringify({
      meta: { title: 'test', version: '1.0.0' },
      other: { data: true }
    }, null, 2) + '\n');

    const result = updateContentJson(filePath, '3.0.0');
    expect(result).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(content.meta.version).toBe('3.0.0');
  });

  test('preserves formatting (no JSON.stringify reformatting)', () => {
    const filePath = path.join(tmpDir, 'content.json');
    const original = '{\n  "meta": { "version": "1.0.0", "title": "test" }\n}\n';
    fs.writeFileSync(filePath, original);

    updateContentJson(filePath, '2.0.0');

    const result = fs.readFileSync(filePath, 'utf8');
    // Should only change the version value, not reformat the JSON
    expect(result).toBe('{\n  "meta": { "version": "2.0.0", "title": "test" }\n}\n');
  });

  test('returns false for missing file', () => {
    const result = updateContentJson(path.join(tmpDir, 'missing.json'), '1.0.0');
    expect(result).toBe(false);
  });
});
