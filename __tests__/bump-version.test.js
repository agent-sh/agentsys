/**
 * Tests for scripts/bump-version.js
 *
 * Tests the validation logic and interface.
 * Does NOT test actual npm execution (requires integration setup).
 */

const { main } = require('../scripts/bump-version');

// Mock console methods to suppress output during tests
let consoleLogSpy;
let consoleErrorSpy;

beforeEach(() => {
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe('bump-version', () => {
  describe('help text', () => {
    test('displays help with --help flag', () => {
      const code = main(['--help']);
      expect(code).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('Version Bump Tool');
      expect(output).toContain('Usage:');
      expect(output).toContain('Examples:');
    });

    test('displays help with -h flag', () => {
      const code = main(['-h']);
      expect(code).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('Version Bump Tool');
    });

    test('displays help when no args provided', () => {
      const code = main([]);
      expect(code).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('Version Bump Tool');
    });
  });

  describe('version validation', () => {
    test('accepts valid stable version format', () => {
      // Mock execFileSync to prevent actual npm execution
      const child_process = require('child_process');
      const originalExecFileSync = child_process.execFileSync;
      child_process.execFileSync = jest.fn();

      const code = main(['3.7.3']);
      expect(code).toBe(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // Restore
      child_process.execFileSync = originalExecFileSync;
    });

    test('accepts valid prerelease version with rc', () => {
      const child_process = require('child_process');
      const originalExecFileSync = child_process.execFileSync;
      child_process.execFileSync = jest.fn();

      const code = main(['3.7.3-rc.1']);
      expect(code).toBe(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      child_process.execFileSync = originalExecFileSync;
    });

    test('accepts valid prerelease version with beta', () => {
      const child_process = require('child_process');
      const originalExecFileSync = child_process.execFileSync;
      child_process.execFileSync = jest.fn();

      const code = main(['3.8.0-beta.1']);
      expect(code).toBe(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      child_process.execFileSync = originalExecFileSync;
    });

    test('accepts valid prerelease version with alpha', () => {
      const child_process = require('child_process');
      const originalExecFileSync = child_process.execFileSync;
      child_process.execFileSync = jest.fn();

      const code = main(['1.0.0-alpha.1']);
      expect(code).toBe(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      child_process.execFileSync = originalExecFileSync;
    });

    test('rejects invalid version format - missing patch', () => {
      const code = main(['3.7']);
      expect(code).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid version format: 3.7')
      );
    });

    test('rejects invalid version format - non-numeric', () => {
      const code = main(['v3.7.3']);
      expect(code).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid version format: v3.7.3')
      );
    });

    test('rejects invalid version format - missing minor', () => {
      const code = main(['3']);
      expect(code).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid version format: 3')
      );
    });

    test('rejects invalid version format - arbitrary text', () => {
      const code = main(['invalid']);
      expect(code).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid version format: invalid')
      );
    });

    test('rejects invalid version format - spaces', () => {
      const code = main(['3.7.3 rc.1']);
      expect(code).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid version format: 3.7.3 rc.1')
      );
    });
  });

  describe('module exports', () => {
    test('exports main function', () => {
      expect(typeof main).toBe('function');
    });

    test('main function accepts args parameter', () => {
      const code = main(['--help']);
      expect(typeof code).toBe('number');
    });
  });
});
