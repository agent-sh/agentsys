/**
 * Tests for lib/repo-map/installer.js
 *
 * The installer was migrated from ast-grep to agent-analyzer.
 * It now delegates to the binary module for auto-download.
 */

const {
  checkInstalled,
  checkInstalledSync,
  getCommand,
  getInstallInstructions,
  getMinimumVersion,
  meetsMinimumVersion
} = require('../lib/repo-map/installer');

describe('repo-map/installer', () => {
  describe('getMinimumVersion', () => {
    test('returns a valid semver string', () => {
      const version = getMinimumVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('returns 0.3.0 as minimum', () => {
      expect(getMinimumVersion()).toBe('0.3.0');
    });
  });

  describe('meetsMinimumVersion', () => {
    test('always returns true (version check handled by binary module)', () => {
      expect(meetsMinimumVersion()).toBe(true);
      expect(meetsMinimumVersion(null)).toBe(true);
      expect(meetsMinimumVersion('0.3.0')).toBe(true);
      expect(meetsMinimumVersion('1.0.0')).toBe(true);
    });
  });

  describe('getInstallInstructions', () => {
    test('returns non-empty string', () => {
      const instructions = getInstallInstructions();
      expect(typeof instructions).toBe('string');
      expect(instructions.length).toBeGreaterThan(0);
    });

    test('mentions agent-analyzer', () => {
      const instructions = getInstallInstructions();
      expect(instructions).toContain('agent-analyzer');
    });

    test('mentions automatic download', () => {
      const instructions = getInstallInstructions();
      expect(instructions.toLowerCase()).toContain('automatically');
    });
  });

  describe('checkInstalledSync', () => {
    test('returns object with found property', () => {
      const result = checkInstalledSync();
      expect(result).toHaveProperty('found');
      expect(typeof result.found).toBe('boolean');
    });

    test('returns tool as agent-analyzer', () => {
      const result = checkInstalledSync();
      expect(result.tool).toBe('agent-analyzer');
    });

    test('returns version when found', () => {
      const result = checkInstalledSync();
      if (result.found) {
        expect(result).toHaveProperty('version');
        expect(typeof result.version).toBe('string');
      }
    });
  });

  describe('checkInstalled', () => {
    test('returns promise', () => {
      const result = checkInstalled();
      expect(result).toBeInstanceOf(Promise);
    });

    test('resolves to object with found property', async () => {
      const result = await checkInstalled();
      expect(result).toHaveProperty('found');
      expect(typeof result.found).toBe('boolean');
    });

    test('returns tool as agent-analyzer', async () => {
      const result = await checkInstalled();
      expect(result.tool).toBe('agent-analyzer');
    });
  });

  describe('getCommand', () => {
    test('returns null (stub - binary module handles execution)', () => {
      expect(getCommand()).toBeNull();
    });
  });

  describe('integration', () => {
    test('checkInstalledSync and checkInstalled return consistent results', async () => {
      const syncResult = checkInstalledSync();
      const asyncResult = await checkInstalled();

      expect(syncResult.found).toBe(asyncResult.found);
      if (syncResult.found && asyncResult.found) {
        expect(syncResult.version).toBe(asyncResult.version);
      }
    });
  });
});
