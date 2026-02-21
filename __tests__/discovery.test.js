/**
 * NOTE on early-return pattern:
 * Several tests in this file use an early `return` inside the test body instead of
 * `test.skip()` when a required environment condition is not met (e.g. no plugins/
 * directory). This is intentional: early returns are cleaner, avoid the confusing
 * "skipped" status noise in CI output, and keep test intent explicit at the top of
 * each test. Do not replace them with `test.skip` or conditional `describe.skip`.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const discovery = require('../lib/discovery');

const REPO_ROOT = path.join(__dirname, '..');

beforeEach(() => {
  discovery.invalidateCache();
});

describe('discovery module', () => {
  describe('discoverPlugins', () => {
    test('returns empty array when plugins/ dir does not exist', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      expect(plugins).toEqual([]);
    });

    test('returns sorted array', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const sorted = [...plugins].sort();
      expect(plugins).toEqual(sorted);
    });

    test('returns empty array for nonexistent path', () => {
      const plugins = discovery.discoverPlugins('/nonexistent/path');
      expect(plugins).toEqual([]);
    });
  });

  describe('discoverCommands', () => {
    test('returns empty array when no plugins exist', () => {
      const commands = discovery.discoverCommands(REPO_ROOT);
      expect(commands).toEqual([]);
    });
  });

  describe('discoverAgents', () => {
    test('returns empty array when no plugins exist', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      expect(agents).toEqual([]);
    });
  });

  describe('discoverSkills', () => {
    test('returns empty array when no plugins exist', () => {
      const skills = discovery.discoverSkills(REPO_ROOT);
      expect(skills).toEqual([]);
    });
  });

  describe('getCommandMappings', () => {
    test('returns empty array when no plugins exist', () => {
      const mappings = discovery.getCommandMappings(REPO_ROOT);
      expect(mappings).toEqual([]);
    });
  });

  describe('getCodexSkillMappings', () => {
    test('returns empty array when no plugins exist', () => {
      const mappings = discovery.getCodexSkillMappings(REPO_ROOT);
      expect(mappings).toEqual([]);
    });
  });

  describe('getPluginPrefixRegex', () => {
    test('builds regex from discovered plugins', () => {
      const regex = discovery.getPluginPrefixRegex(REPO_ROOT);
      expect(regex).toBeInstanceOf(RegExp);
    });
  });

  describe('parseFrontmatter', () => {
    test('parses simple frontmatter', () => {
      const content = '---\nname: test\ndescription: A test\n---\n# Content';
      const fm = discovery.parseFrontmatter(content);
      expect(fm.name).toBe('test');
      expect(fm.description).toBe('A test');
    });

    test('strips surrounding quotes', () => {
      const content = '---\nname: "quoted"\nother: \'single\'\n---\n';
      const fm = discovery.parseFrontmatter(content);
      expect(fm.name).toBe('quoted');
      expect(fm.other).toBe('single');
    });

    test('returns empty object for no frontmatter', () => {
      expect(discovery.parseFrontmatter('# No frontmatter')).toEqual({});
      expect(discovery.parseFrontmatter('')).toEqual({});
      expect(discovery.parseFrontmatter(null)).toEqual({});
    });

    test('handles colons in values', () => {
      const content = '---\ndescription: Use when: user asks\n---\n';
      const fm = discovery.parseFrontmatter(content);
      expect(fm.description).toBe('Use when: user asks');
    });

    test('parses YAML arrays', () => {
      const content = '---\nname: test-agent\ntools:\n  - Read\n  - Write\n  - Bash(git:*)\nmodel: opus\n---\n# Content';
      const fm = discovery.parseFrontmatter(content);
      expect(fm.name).toBe('test-agent');
      expect(fm.model).toBe('opus');
      expect(Array.isArray(fm.tools)).toBe(true);
      expect(fm.tools).toEqual(['Read', 'Write', 'Bash(git:*)']);
    });

    test('parses YAML arrays with quoted items', () => {
      const content = '---\ntools:\n  - "Read"\n  - \'Write\'\n---\n';
      const fm = discovery.parseFrontmatter(content);
      expect(fm.tools).toEqual(['Read', 'Write']);
    });

    test('handles trailing YAML array at end of frontmatter', () => {
      const content = '---\nname: test\nitems:\n  - one\n  - two\n---\n';
      const fm = discovery.parseFrontmatter(content);
      expect(fm.name).toBe('test');
      expect(fm.items).toEqual(['one', 'two']);
    });
  });

  describe('caching', () => {
    test('returns same results on repeated calls', () => {
      const first = discovery.discoverPlugins(REPO_ROOT);
      const second = discovery.discoverPlugins(REPO_ROOT);
      // When plugins/ exists, caching returns same reference.
      // When plugins/ doesn't exist, returns new empty array each time.
      expect(first).toEqual(second);
    });

    test('invalidateCache forces re-scan', () => {
      const first = discovery.discoverPlugins(REPO_ROOT);
      discovery.invalidateCache();
      const second = discovery.discoverPlugins(REPO_ROOT);
      expect(first).not.toBe(second); // Different reference
      expect(first).toEqual(second); // Same values
    });
  });

  describe('discoverAll', () => {
    test('returns all discovery results', () => {
      const all = discovery.discoverAll(REPO_ROOT);
      expect(all.plugins).toEqual([]);
      expect(all.commands).toEqual([]);
      expect(all.agents).toEqual([]);
      expect(all.skills).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Fixture-based tests: verifies discovery logic with a real temp directory
// ---------------------------------------------------------------------------

describe('discoverPlugins with temp fixture', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discovery-fixture-'));
    discovery.invalidateCache();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    discovery.invalidateCache();
  });

  test('finds a plugin when plugins/<name>/.claude-plugin/plugin.json exists', () => {
    // Create mock plugin structure
    const pluginDir = path.join(tmpDir, 'plugins', 'my-plugin', '.claude-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify({ name: 'my-plugin', version: '1.0.0' }, null, 2)
    );

    const plugins = discovery.discoverPlugins(tmpDir);
    expect(plugins).toContain('my-plugin');
    expect(plugins.length).toBe(1);
  });

  test('discovers commands from plugins/<name>/commands/*.md', () => {
    // Create plugin with a command
    const commandsDir = path.join(tmpDir, 'plugins', 'test-plugin', 'commands');
    fs.mkdirSync(path.join(tmpDir, 'plugins', 'test-plugin', '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'plugins', 'test-plugin', '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'test-plugin', version: '1.0.0' })
    );
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(
      path.join(commandsDir, 'my-command.md'),
      '---\nname: my-command\ndescription: A test command\n---\n# My Command\n'
    );

    const commands = discovery.discoverCommands(tmpDir);
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.some(c => c.name === 'my-command')).toBe(true);
  });

  test('returns sorted plugin names', () => {
    // Create multiple plugins
    for (const name of ['zebra-plugin', 'alpha-plugin', 'middle-plugin']) {
      const dir = path.join(tmpDir, 'plugins', name, '.claude-plugin');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name, version: '1.0.0' }));
    }

    const plugins = discovery.discoverPlugins(tmpDir);
    const sorted = [...plugins].sort();
    expect(plugins).toEqual(sorted);
  });
});
