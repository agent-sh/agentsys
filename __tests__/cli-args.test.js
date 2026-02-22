/**
 * Tests for CLI argument parsing in bin/cli.js
 */

const path = require('path');
const fs = require('fs');

// Import parseArgs directly from cli.js (now exported for testing)
const { parseArgs, VALID_TOOLS, installForCursor } = require('../bin/cli.js');

describe('CLI argument parsing', () => {
  // Save original process.exit and restore after each test
  const originalExit = process.exit;
  const originalError = console.error;

  beforeEach(() => {
    // Mock process.exit to throw instead of exiting
    process.exit = jest.fn((code) => {
      throw new Error(`process.exit(${code})`);
    });
    // Suppress error output during tests
    console.error = jest.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalError;
  });

  describe('default values', () => {
    test('returns default values for empty args', () => {
      const result = parseArgs([]);

      expect(result.help).toBe(false);
      expect(result.version).toBe(false);
      expect(result.remove).toBe(false);
      expect(result.development).toBe(false);
      expect(result.stripModels).toBe(true);
      expect(result.tool).toBeNull();
      expect(result.tools).toEqual([]);
    });
  });

  describe('--help / -h', () => {
    test('parses --help', () => {
      const result = parseArgs(['--help']);
      expect(result.help).toBe(true);
    });

    test('parses -h', () => {
      const result = parseArgs(['-h']);
      expect(result.help).toBe(true);
    });
  });

  describe('--version / -v', () => {
    test('parses --version', () => {
      const result = parseArgs(['--version']);
      expect(result.version).toBe(true);
    });

    test('parses -v', () => {
      const result = parseArgs(['-v']);
      expect(result.version).toBe(true);
    });
  });

  describe('--remove / --uninstall', () => {
    test('parses --remove', () => {
      const result = parseArgs(['--remove']);
      expect(result.remove).toBe(true);
    });

    test('parses --uninstall', () => {
      const result = parseArgs(['--uninstall']);
      expect(result.remove).toBe(true);
    });
  });

  describe('--development / --dev', () => {
    test('parses --development', () => {
      const result = parseArgs(['--development']);
      expect(result.development).toBe(true);
    });

    test('parses --dev', () => {
      const result = parseArgs(['--dev']);
      expect(result.development).toBe(true);
    });
  });

  describe('model stripping flags', () => {
    test('stripModels defaults to true', () => {
      const result = parseArgs([]);
      expect(result.stripModels).toBe(true);
    });

    test('--no-strip sets stripModels to false', () => {
      const result = parseArgs(['--no-strip']);
      expect(result.stripModels).toBe(false);
    });

    test('-ns sets stripModels to false', () => {
      const result = parseArgs(['-ns']);
      expect(result.stripModels).toBe(false);
    });

    test('--strip-models keeps stripModels true (legacy)', () => {
      const result = parseArgs(['--strip-models']);
      expect(result.stripModels).toBe(true);
    });
  });

  describe('--tool', () => {
    test('parses --tool claude', () => {
      const result = parseArgs(['--tool', 'claude']);
      expect(result.tool).toBe('claude');
    });

    test('parses --tool opencode', () => {
      const result = parseArgs(['--tool', 'opencode']);
      expect(result.tool).toBe('opencode');
    });

    test('parses --tool codex', () => {
      const result = parseArgs(['--tool', 'codex']);
      expect(result.tool).toBe('codex');
    });

    test('handles case insensitivity', () => {
      const result = parseArgs(['--tool', 'CLAUDE']);
      expect(result.tool).toBe('claude');
    });

    test('exits with error for invalid tool names', () => {
      expect(() => parseArgs(['--tool', 'invalid'])).toThrow('process.exit(1)');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid tool'));
    });

    test('ignores --tool without value', () => {
      const result = parseArgs(['--tool']);
      expect(result.tool).toBeNull();
    });
  });

  describe('--tools', () => {
    test('parses single tool', () => {
      const result = parseArgs(['--tools', 'claude']);
      expect(result.tools).toEqual(['claude']);
    });

    test('parses comma-separated tools', () => {
      const result = parseArgs(['--tools', 'claude,opencode']);
      expect(result.tools).toEqual(['claude', 'opencode']);
    });

    test('parses comma-separated with spaces', () => {
      const result = parseArgs(['--tools', 'claude, opencode, codex']);
      expect(result.tools).toEqual(['claude', 'opencode', 'codex']);
    });

    test('handles case insensitivity', () => {
      const result = parseArgs(['--tools', 'CLAUDE,OpenCode']);
      expect(result.tools).toEqual(['claude', 'opencode']);
    });

    test('exits with error for invalid tools in list', () => {
      expect(() => parseArgs(['--tools', 'claude,invalid,opencode'])).toThrow('process.exit(1)');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid tool'));
    });
  });

  describe('combined flags', () => {
    test('parses multiple flags together', () => {
      const result = parseArgs(['--tool', 'opencode', '--no-strip', '--dev']);

      expect(result.tool).toBe('opencode');
      expect(result.stripModels).toBe(false);
      expect(result.development).toBe(true);
    });

    test('parses --tools with --no-strip', () => {
      const result = parseArgs(['--tools', 'claude,codex', '-ns']);

      expect(result.tools).toEqual(['claude', 'codex']);
      expect(result.stripModels).toBe(false);
    });
  });
});

describe('VALID_TOOLS constant', () => {
  test('contains expected tools', () => {
    expect(VALID_TOOLS).toEqual(['claude', 'opencode', 'codex', 'cursor']);
  });
});

describe('CLI integration', () => {
  const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
  const cliSource = fs.readFileSync(cliPath, 'utf8');

  test('cli.js file exists', () => {
    expect(fs.existsSync(cliPath)).toBe(true);
  });

  test('cli.js has shebang', () => {
    expect(cliSource.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  test('cli.js exports parseArgs and VALID_TOOLS for testing', () => {
    expect(cliSource.includes('module.exports')).toBe(true);
    expect(cliSource.includes('parseArgs')).toBe(true);
    expect(cliSource.includes('VALID_TOOLS')).toBe(true);
  });

  test('cli.js only runs main when executed directly', () => {
    expect(cliSource.includes('require.main === module')).toBe(true);
  });

  test('cli.js has installForClaudeDevelopment function', () => {
    expect(cliSource.includes('function installForClaudeDevelopment()')).toBe(true);
  });

  test('cli.js has installForOpenCode function', () => {
    expect(cliSource.includes('function installForOpenCode(')).toBe(true);
  });

  test('cli.js has installForCodex function', () => {
    expect(cliSource.includes('function installForCodex(')).toBe(true);
  });

  test('cli.js has installForCursor function', () => {
    expect(cliSource.includes('function installForCursor(')).toBe(true);
  });
});

describe('installForCursor', () => {
  const os = require('os');
  let tmpDir;
  let originalCwd;
  let originalLog;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-install-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    originalLog = console.log;
    console.log = jest.fn();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    console.log = originalLog;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupInstallDir(commands) {
    const installDir = path.join(tmpDir, 'install');
    const pluginName = 'test-plugin';
    const pluginDir = path.join(installDir, 'plugins', pluginName);
    const pluginJsonDir = path.join(pluginDir, '.claude-plugin');
    const commandsDir = path.join(pluginDir, 'commands');
    fs.mkdirSync(pluginJsonDir, { recursive: true });
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(pluginJsonDir, 'plugin.json'), '{}');
    for (const [filename, content] of Object.entries(commands)) {
      fs.writeFileSync(path.join(commandsDir, filename), content);
    }
    return installDir;
  }

  test('writes .mdc files to .cursor/rules/ for commands with descriptions', () => {
    const installDir = setupInstallDir({
      'my-cmd.md': '---\ndescription: A test command\n---\n# My Command\nBody content'
    });

    // Need to invalidate discovery cache
    const discovery = require('../lib/discovery');
    discovery.invalidateCache();

    installForCursor(installDir);

    const rulesDir = path.join(tmpDir, '.cursor', 'rules');
    const files = fs.readdirSync(rulesDir);
    const mdcFiles = files.filter(f => f.endsWith('.mdc'));
    expect(mdcFiles.length).toBe(1);
    expect(mdcFiles[0]).toBe('agentsys-test-plugin-my-cmd.mdc');

    const content = fs.readFileSync(path.join(rulesDir, mdcFiles[0]), 'utf8');
    expect(content).toContain('A test command');
    expect(content).toContain('Body content');
  });

  test('skips commands without description', () => {
    const installDir = setupInstallDir({
      'no-desc.md': '---\ntype: command\n---\nBody'
    });

    const discovery = require('../lib/discovery');
    discovery.invalidateCache();

    installForCursor(installDir);

    const rulesDir = path.join(tmpDir, '.cursor', 'rules');
    const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.mdc'));
    expect(files.length).toBe(0);
  });

  test('cleans up old agentsys-*.mdc files on reinstall', () => {
    // Pre-create an old .mdc file
    const rulesDir = path.join(tmpDir, '.cursor', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, 'agentsys-old-plugin-old-cmd.mdc'), 'old content');

    const installDir = setupInstallDir({
      'new-cmd.md': '---\ndescription: New command\n---\nNew body'
    });

    const discovery = require('../lib/discovery');
    discovery.invalidateCache();

    installForCursor(installDir);

    const files = fs.readdirSync(rulesDir);
    expect(files).not.toContain('agentsys-old-plugin-old-cmd.mdc');
    expect(files).toContain('agentsys-test-plugin-new-cmd.mdc');
  });
});
