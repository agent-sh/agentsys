/**
 * Tests for scripts/scaffold.js
 *
 * Tests plugin, agent, skill, and command scaffolding using
 * temporary directories to avoid mutating the real project.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { main, scaffoldPlugin, scaffoldAgent, scaffoldSkill, scaffoldCommand, validateName } = require('../scripts/scaffold.js');

let tmpDir;
let consoleLogSpy;
let consoleErrorSpy;

/**
 * Create a minimal fake project root with package.json and one plugin.
 */
function createFakeProject(dir) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.2.3'
  }, null, 2));
  fs.mkdirSync(path.join(dir, 'plugins'), { recursive: true });
}

/**
 * Create a fake existing plugin directory with required structure.
 */
function createFakePlugin(dir, pluginName) {
  const pluginDir = path.join(dir, 'plugins', pluginName);
  fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(pluginDir, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), JSON.stringify({
    name: pluginName,
    version: '1.0.0'
  }));
  return pluginDir;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
  createFakeProject(tmpDir);
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {
    if (process.platform !== 'win32') {
      throw error;
    }
  }
});

// ---------------------------------------------------------------------------
// validateName
// ---------------------------------------------------------------------------

describe('validateName', () => {
  test('accepts valid lowercase names', () => {
    expect(validateName('my-plugin', 'plugin').valid).toBe(true);
    expect(validateName('a', 'plugin').valid).toBe(true);
    expect(validateName('foo123', 'plugin').valid).toBe(true);
    expect(validateName('0start', 'plugin').valid).toBe(true);
  });

  test('rejects empty name', () => {
    const result = validateName('', 'plugin');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  test('rejects undefined name', () => {
    const result = validateName(undefined, 'agent');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  test('rejects uppercase characters', () => {
    const result = validateName('MyPlugin', 'plugin');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must match');
  });

  test('rejects names starting with hyphen', () => {
    const result = validateName('-bad', 'plugin');
    expect(result.valid).toBe(false);
  });

  test('rejects names with special characters', () => {
    expect(validateName('my_plugin', 'plugin').valid).toBe(false);
    expect(validateName('my.plugin', 'plugin').valid).toBe(false);
    expect(validateName('my plugin', 'plugin').valid).toBe(false);
  });

  test('rejects names exceeding max length', () => {
    const longName = 'a'.repeat(65);
    const result = validateName(longName, 'plugin');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('64');
  });

  test('accepts name at max length', () => {
    const maxName = 'a'.repeat(64);
    expect(validateName(maxName, 'plugin').valid).toBe(true);
  });

  test('includes type in error messages', () => {
    const result = validateName('', 'skill');
    expect(result.error).toContain('skill');
  });
});

// ---------------------------------------------------------------------------
// scaffoldPlugin
// ---------------------------------------------------------------------------

describe('scaffoldPlugin', () => {
  test('creates plugin directory structure', () => {
    const result = scaffoldPlugin('my-plugin', tmpDir);
    // sync-lib.sh fails in temp dir (no scripts/sync-lib.sh), so success=false
    // but all directories and files should still be created
    const pluginDir = path.join(tmpDir, 'plugins', 'my-plugin');
    expect(fs.existsSync(pluginDir)).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, '.claude-plugin'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'commands'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'agents'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'skills'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'lib'))).toBe(true);
    expect(result.errors.some(e => e.includes('sync-lib.sh failed'))).toBe(true);
  });

  test('creates valid plugin.json', () => {
    scaffoldPlugin('my-plugin', tmpDir);
    const pluginJsonPath = path.join(tmpDir, 'plugins', 'my-plugin', '.claude-plugin', 'plugin.json');
    expect(fs.existsSync(pluginJsonPath)).toBe(true);

    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    expect(pluginJson.name).toBe('my-plugin');
    expect(pluginJson.version).toBe('1.2.3');
    expect(pluginJson.license).toBe('MIT');
    expect(pluginJson.description).toBeDefined();
    expect(pluginJson.keywords).toContain('my-plugin');
  });

  test('creates default command file', () => {
    scaffoldPlugin('my-plugin', tmpDir);
    const cmdPath = path.join(tmpDir, 'plugins', 'my-plugin', 'commands', 'my-plugin.md');
    expect(fs.existsSync(cmdPath)).toBe(true);

    const content = fs.readFileSync(cmdPath, 'utf8');
    expect(content).toContain('---');
    expect(content).toContain('description:');
    expect(content).toContain('argument-hint:');
  });

  test('returns created file paths', () => {
    const result = scaffoldPlugin('my-plugin', tmpDir);
    expect(result.files).toContain('plugins/my-plugin/.claude-plugin/plugin.json');
    expect(result.files).toContain('plugins/my-plugin/commands/my-plugin.md');
  });

  test('rejects invalid name', () => {
    const result = scaffoldPlugin('My Plugin', tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('rejects duplicate plugin', () => {
    createFakePlugin(tmpDir, 'existing');
    const result = scaffoldPlugin('existing', tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('already exists');
  });
});

// ---------------------------------------------------------------------------
// scaffoldAgent
// ---------------------------------------------------------------------------

describe('scaffoldAgent', () => {
  test('creates agent file with frontmatter', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldAgent('my-agent', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);

    const agentPath = path.join(tmpDir, 'plugins', 'test-plugin', 'agents', 'my-agent.md');
    expect(fs.existsSync(agentPath)).toBe(true);

    const content = fs.readFileSync(agentPath, 'utf8');
    expect(content).toContain('---');
    expect(content).toContain('name: my-agent');
    expect(content).toContain('model: sonnet');
    expect(content).toContain('tools:');
  });

  test('uses custom model from --model flag', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldAgent('my-agent', ['--plugin', 'test-plugin', '--model', 'opus'], tmpDir);

    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'agents', 'my-agent.md'), 'utf8'
    );
    expect(content).toContain('model: opus');
  });

  test('uses custom description from --description flag', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldAgent('my-agent', ['--plugin', 'test-plugin', '--description', 'My custom desc'], tmpDir);

    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'agents', 'my-agent.md'), 'utf8'
    );
    expect(content).toContain('My custom desc');
  });

  test('requires --plugin flag', () => {
    const result = scaffoldAgent('my-agent', [], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('--plugin');
  });

  test('rejects nonexistent plugin', () => {
    const result = scaffoldAgent('my-agent', ['--plugin', 'nonexistent'], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Plugin not found');
  });

  test('rejects duplicate agent', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldAgent('my-agent', ['--plugin', 'test-plugin'], tmpDir);
    const result = scaffoldAgent('my-agent', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('already exists');
  });

  test('rejects invalid name', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldAgent('BAD NAME', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(false);
  });

  test('returns created file paths', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldAgent('my-agent', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.files).toContain('plugins/test-plugin/agents/my-agent.md');
  });

  test('capitalizes name in heading', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldAgent('my-cool-agent', ['--plugin', 'test-plugin'], tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'agents', 'my-cool-agent.md'), 'utf8'
    );
    expect(content).toContain('# My Cool Agent');
    expect(content).not.toContain('# My Cool Agent Agent');
  });
});

// ---------------------------------------------------------------------------
// scaffoldSkill
// ---------------------------------------------------------------------------

describe('scaffoldSkill', () => {
  test('creates skill directory with SKILL.md', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldSkill('my-skill', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);

    const skillDir = path.join(tmpDir, 'plugins', 'test-plugin', 'skills', 'my-skill');
    expect(fs.existsSync(skillDir)).toBe(true);
    expect(fs.statSync(skillDir).isDirectory()).toBe(true);

    const skillPath = path.join(skillDir, 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
  });

  test('SKILL.md has valid frontmatter', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldSkill('my-skill', ['--plugin', 'test-plugin'], tmpDir);

    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'skills', 'my-skill', 'SKILL.md'), 'utf8'
    );
    expect(content).toContain('---');
    expect(content).toContain('name: my-skill');
    expect(content).toContain('version: 1.0.0');
    expect(content).toContain('argument-hint:');
  });

  test('skill directory name matches frontmatter name', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldSkill('my-skill', ['--plugin', 'test-plugin'], tmpDir);

    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'skills', 'my-skill', 'SKILL.md'), 'utf8'
    );
    // Extract name from frontmatter
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    expect(nameMatch).not.toBeNull();
    expect(nameMatch[1]).toBe('my-skill');
  });

  test('uses custom description', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldSkill('my-skill', ['--plugin', 'test-plugin', '--description', 'Custom desc'], tmpDir);

    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'skills', 'my-skill', 'SKILL.md'), 'utf8'
    );
    expect(content).toContain('Custom desc');
  });

  test('requires --plugin flag', () => {
    const result = scaffoldSkill('my-skill', [], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('--plugin');
  });

  test('rejects nonexistent plugin', () => {
    const result = scaffoldSkill('my-skill', ['--plugin', 'nonexistent'], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Plugin not found');
  });

  test('rejects duplicate skill', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldSkill('my-skill', ['--plugin', 'test-plugin'], tmpDir);
    const result = scaffoldSkill('my-skill', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('already exists');
  });

  test('rejects invalid name', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldSkill('BAD', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(false);
  });

  test('returns created file paths', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldSkill('my-skill', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.files).toContain('plugins/test-plugin/skills/my-skill/SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// scaffoldCommand
// ---------------------------------------------------------------------------

describe('scaffoldCommand', () => {
  test('creates command markdown file', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldCommand('my-cmd', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);

    const cmdPath = path.join(tmpDir, 'plugins', 'test-plugin', 'commands', 'my-cmd.md');
    expect(fs.existsSync(cmdPath)).toBe(true);
  });

  test('command file has valid frontmatter', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldCommand('my-cmd', ['--plugin', 'test-plugin'], tmpDir);

    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'commands', 'my-cmd.md'), 'utf8'
    );
    expect(content).toContain('---');
    expect(content).toContain('description:');
    expect(content).toContain('argument-hint:');
    expect(content).toContain('allowed-tools:');
  });

  test('requires --plugin flag', () => {
    const result = scaffoldCommand('my-cmd', [], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('--plugin');
  });

  test('rejects nonexistent plugin', () => {
    const result = scaffoldCommand('my-cmd', ['--plugin', 'nonexistent'], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Plugin not found');
  });

  test('rejects duplicate command', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldCommand('my-cmd', ['--plugin', 'test-plugin'], tmpDir);
    const result = scaffoldCommand('my-cmd', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('already exists');
  });

  test('rejects invalid name', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldCommand('BAD CMD', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.success).toBe(false);
  });

  test('returns created file paths', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldCommand('my-cmd', ['--plugin', 'test-plugin'], tmpDir);
    expect(result.files).toContain('plugins/test-plugin/commands/my-cmd.md');
  });
});

// ---------------------------------------------------------------------------
// main (CLI entry point)
// ---------------------------------------------------------------------------

describe('main', () => {
  test('shows usage when no args', () => {
    const code = main([]);
    expect(code).toBe(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  test('shows usage when only type provided', () => {
    const code = main(['plugin']);
    expect(code).toBe(1);
  });

  test('rejects unknown type', () => {
    const code = main(['unknown', 'name']);
    expect(code).toBe(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown type'));
  });
});

// ---------------------------------------------------------------------------
// Flag parsing (--flag=value syntax)
// ---------------------------------------------------------------------------

describe('flag parsing', () => {
  test('supports --plugin=value syntax for agent', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    const result = scaffoldAgent('eq-agent', ['--plugin=test-plugin'], tmpDir);
    expect(result.success).toBe(true);
    expect(result.files).toContain('plugins/test-plugin/agents/eq-agent.md');
  });

  test('supports --model=value syntax', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldAgent('model-agent', ['--plugin=test-plugin', '--model=haiku'], tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'agents', 'model-agent.md'), 'utf8'
    );
    expect(content).toContain('model: haiku');
  });

  test('supports --description=value syntax', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldAgent('desc-agent', ['--plugin=test-plugin', '--description=Inline desc'], tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'agents', 'desc-agent.md'), 'utf8'
    );
    expect(content).toContain('Inline desc');
  });
});

// ---------------------------------------------------------------------------
// Template content validation
// ---------------------------------------------------------------------------

describe('template content', () => {
  test('command template includes codex-description', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldCommand('tmpl-cmd', ['--plugin', 'test-plugin'], tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'commands', 'tmpl-cmd.md'), 'utf8'
    );
    expect(content).toContain('codex-description:');
  });

  test('skill template references $ARGUMENTS', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldSkill('tmpl-skill', ['--plugin', 'test-plugin'], tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'skills', 'tmpl-skill', 'SKILL.md'), 'utf8'
    );
    expect(content).toContain('$ARGUMENTS');
  });

  test('agent template includes workflow and output format sections', () => {
    createFakePlugin(tmpDir, 'test-plugin');
    scaffoldAgent('tmpl-agent', ['--plugin', 'test-plugin'], tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', 'agents', 'tmpl-agent.md'), 'utf8'
    );
    expect(content).toContain('## Workflow');
    expect(content).toContain('## Output Format');
  });

  test('plugin.json includes author block', () => {
    scaffoldPlugin('author-test', tmpDir);
    const pkg = JSON.parse(fs.readFileSync(
      path.join(tmpDir, 'plugins', 'author-test', '.claude-plugin', 'plugin.json'), 'utf8'
    ));
    expect(pkg.author).toEqual({
      name: 'Avi Fenesh',
      email: '[email protected]',
      url: 'https://github.com/avifenesh'
    });
    expect(pkg.homepage).toBe('https://github.com/agent-sh/agentsys#author-test');
    expect(pkg.repository).toBe('https://github.com/agent-sh/agentsys');
  });
});

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe('scaffold module structure', () => {
  const modulePath = path.join(__dirname, '..', 'scripts', 'scaffold.js');
  const source = fs.readFileSync(modulePath, 'utf8');

  test('has shebang', () => {
    expect(source.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  test('has require.main guard', () => {
    expect(source).toContain('require.main === module');
  });

  test('exports all expected functions', () => {
    expect(typeof main).toBe('function');
    expect(typeof scaffoldPlugin).toBe('function');
    expect(typeof scaffoldAgent).toBe('function');
    expect(typeof scaffoldSkill).toBe('function');
    expect(typeof scaffoldCommand).toBe('function');
    expect(typeof validateName).toBe('function');
  });

  test('uses execFileSync not execSync for security', () => {
    expect(source).toContain('execFileSync');
    expect(source).not.toMatch(/\bexecSync\b/);
  });
});

// ---------------------------------------------------------------------------
// dev-cli integration
// ---------------------------------------------------------------------------

describe('dev-cli integration', () => {
  const { COMMANDS, NEW_SUBCOMMANDS } = require('../bin/dev-cli.js');

  test('new command exists in COMMANDS', () => {
    expect(COMMANDS).toHaveProperty('new');
    expect(COMMANDS['new'].subcommands).toBe(NEW_SUBCOMMANDS);
  });

  test('NEW_SUBCOMMANDS has all four types', () => {
    expect(Object.keys(NEW_SUBCOMMANDS).sort()).toEqual(['agent', 'command', 'plugin', 'skill']);
  });

  test('each subcommand handler is a function', () => {
    for (const sub of Object.values(NEW_SUBCOMMANDS)) {
      expect(typeof sub.handler).toBe('function');
      expect(typeof sub.description).toBe('string');
    }
  });
});
