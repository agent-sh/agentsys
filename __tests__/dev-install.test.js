/**
 * Tests for scripts/dev-install.js
 */

const fs = require('fs');
const path = require('path');

const devInstallPath = path.join(__dirname, '..', 'scripts', 'dev-install.js');
const devInstallSource = fs.readFileSync(devInstallPath, 'utf8');

describe('dev-install script', () => {
  describe('script structure', () => {
    test('file exists', () => {
      expect(fs.existsSync(devInstallPath)).toBe(true);
    });

    test('has shebang', () => {
      expect(devInstallSource.startsWith('#!/usr/bin/env node')).toBe(true);
    });

    test('defines PLUGINS via discovery', () => {
      expect(devInstallSource.includes('discovery.discoverPlugins')).toBe(true);
    });

    test('uses discovery module', () => {
      expect(devInstallSource.includes("require(")).toBe(true);
      expect(devInstallSource.includes("discovery")).toBe(true);
    });

    test('defines installClaude function', () => {
      expect(devInstallSource.includes('function installClaude()')).toBe(true);
    });

    test('defines installOpenCode function', () => {
      expect(devInstallSource.includes('function installOpenCode()')).toBe(true);
    });

    test('defines installCodex function', () => {
      expect(devInstallSource.includes('function installCodex()')).toBe(true);
    });

    test('defines cleanAll function', () => {
      expect(devInstallSource.includes('function cleanAll()')).toBe(true);
    });

    test('defines copyToAwesomeSlash function', () => {
      expect(devInstallSource.includes('function copyToAwesomeSlash()')).toBe(true);
    });
  });

  describe('CLI argument handling', () => {
    test('handles --clean flag', () => {
      expect(devInstallSource.includes("args.includes('--clean')")).toBe(true);
    });

    test('handles specific tool arguments', () => {
      expect(devInstallSource.includes("validTools.includes(")).toBe(true);
    });

    test('defaults to all tools when no args', () => {
      expect(devInstallSource.includes('tools = validTools')).toBe(true);
    });
  });

  describe('target directories', () => {
    test('defines CLAUDE_PLUGINS_DIR', () => {
      expect(devInstallSource.includes('CLAUDE_PLUGINS_DIR')).toBe(true);
      expect(devInstallSource.includes(".claude', 'plugins'")).toBe(true);
    });

    test('defines OPENCODE_CONFIG_DIR using XDG path', () => {
      // Should use ~/.config/opencode/ (XDG) not ~/.opencode/
      expect(devInstallSource.includes('OPENCODE_CONFIG_DIR')).toBe(true);
      expect(devInstallSource.includes('getOpenCodeConfigDir')).toBe(true);
      expect(devInstallSource.includes(".config', 'opencode'")).toBe(true);
    });

    test('defines LEGACY_OPENCODE_DIR for cleanup', () => {
      // Legacy path kept for cleaning up old installations
      expect(devInstallSource.includes('LEGACY_OPENCODE_DIR')).toBe(true);
      expect(devInstallSource.includes(".opencode'")).toBe(true);
    });

    test('defines CODEX_DIR', () => {
      expect(devInstallSource.includes('CODEX_DIR')).toBe(true);
      expect(devInstallSource.includes(".codex'")).toBe(true);
    });

    test('defines AWESOME_SLASH_DIR', () => {
      expect(devInstallSource.includes('AWESOME_SLASH_DIR')).toBe(true);
      expect(devInstallSource.includes(".awesome-slash'")).toBe(true);
    });
  });

  describe('getOpenCodeConfigDir() logic', () => {
    // Extract and test the function logic directly
    const path = require('path');

    function getOpenCodeConfigDir(env) {
      const HOME = env.HOME || env.USERPROFILE;
      const xdgConfigHome = env.XDG_CONFIG_HOME;
      if (xdgConfigHome && xdgConfigHome.trim()) {
        return path.join(xdgConfigHome, 'opencode');
      }
      return path.join(HOME, '.config', 'opencode');
    }

    test('uses XDG_CONFIG_HOME when set', () => {
      const result = getOpenCodeConfigDir({
        HOME: '/home/user',
        XDG_CONFIG_HOME: '/custom/config'
      });
      expect(result).toBe(path.join('/custom/config', 'opencode'));
    });

    test('falls back to ~/.config/opencode when XDG_CONFIG_HOME unset', () => {
      const result = getOpenCodeConfigDir({
        HOME: '/home/user'
      });
      expect(result).toBe(path.join('/home/user', '.config', 'opencode'));
    });

    test('falls back when XDG_CONFIG_HOME is empty string', () => {
      const result = getOpenCodeConfigDir({
        HOME: '/home/user',
        XDG_CONFIG_HOME: ''
      });
      expect(result).toBe(path.join('/home/user', '.config', 'opencode'));
    });

    test('falls back when XDG_CONFIG_HOME is whitespace only', () => {
      const result = getOpenCodeConfigDir({
        HOME: '/home/user',
        XDG_CONFIG_HOME: '   '
      });
      expect(result).toBe(path.join('/home/user', '.config', 'opencode'));
    });

    test('uses USERPROFILE on Windows when HOME not set', () => {
      const result = getOpenCodeConfigDir({
        USERPROFILE: 'C:\\Users\\user'
      });
      expect(result).toBe(path.join('C:\\Users\\user', '.config', 'opencode'));
    });

    test('script implementation matches expected pattern', () => {
      // Verify the script has the exact logic we tested above
      expect(devInstallSource).toMatch(/if\s*\(\s*xdgConfigHome\s*&&\s*xdgConfigHome\.trim\(\)\s*\)/);
      expect(devInstallSource).toMatch(/path\.join\s*\(\s*xdgConfigHome\s*,\s*['"]opencode['"]\s*\)/);
      expect(devInstallSource).toMatch(/path\.join\s*\(\s*HOME\s*,\s*['"]\.config['"]\s*,\s*['"]opencode['"]\s*\)/);
    });
  });

  describe('installation logic', () => {
    test('uses shared transforms for OpenCode', () => {
      // Should use shared adapter-transforms module (stripModels: true by default)
      expect(devInstallSource.includes('transforms.transformBodyForOpenCode')).toBe(true);
      expect(devInstallSource.includes('transforms.transformAgentFrontmatterForOpenCode')).toBe(true);
    });

    test('uses shared transforms for commands', () => {
      expect(devInstallSource.includes('transforms.transformCommandFrontmatterForOpenCode')).toBe(true);
    });

    test('removes marketplace for Claude', () => {
      expect(devInstallSource.includes('plugin marketplace remove')).toBe(true);
    });

    test('copies to ~/.awesome-slash for OpenCode/Codex', () => {
      expect(devInstallSource.includes('copyToAwesomeSlash')).toBe(true);
    });
  });

  describe('output', () => {
    test('logs with [dev-install] prefix', () => {
      expect(devInstallSource.includes('[dev-install]')).toBe(true);
    });

    test('shows summary at end', () => {
      expect(devInstallSource.includes('Summary:')).toBe(true);
    });

    test('shows clean command', () => {
      expect(devInstallSource.includes('node scripts/dev-install.js --clean')).toBe(true);
    });
  });
});
