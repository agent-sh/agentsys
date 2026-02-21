const path = require('path');
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
