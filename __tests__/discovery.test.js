const path = require('path');
const discovery = require('../lib/discovery');

const REPO_ROOT = path.join(__dirname, '..');

beforeEach(() => {
  discovery.invalidateCache();
});

describe('discovery module', () => {
  describe('discoverPlugins', () => {
    test('discovers exactly 12 plugins', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      expect(plugins.length).toBe(12);
    });

    test('discovers all known plugin names', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const expected = [
        'agnix', 'audit-project', 'consult', 'deslop', 'drift-detect', 'enhance',
        'learn', 'next-task', 'perf', 'repo-map', 'ship', 'sync-docs'
      ];
      expect(plugins).toEqual(expected);
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
    test('discovers exactly 18 commands', () => {
      const commands = discovery.discoverCommands(REPO_ROOT);
      expect(commands.length).toBe(18);
    });

    test('each command has name, plugin, file, and frontmatter', () => {
      const commands = discovery.discoverCommands(REPO_ROOT);
      for (const cmd of commands) {
        expect(cmd).toHaveProperty('name');
        expect(cmd).toHaveProperty('plugin');
        expect(cmd).toHaveProperty('file');
        expect(cmd).toHaveProperty('frontmatter');
        expect(cmd.file).toMatch(/\.md$/);
      }
    });

    test('primary commands have descriptions in frontmatter', () => {
      const commands = discovery.discoverCommands(REPO_ROOT);
      const primaryNames = [
        'enhance', 'next-task', 'ship', 'deslop', 'audit-project',
        'drift-detect', 'repo-map', 'perf', 'sync-docs', 'learn', 'agnix'
      ];
      for (const name of primaryNames) {
        const cmd = commands.find(c => c.name === name);
        expect(cmd).toBeDefined();
        expect(cmd.frontmatter.description).toBeTruthy();
      }
    });
  });

  describe('discoverAgents', () => {
    test('discovers exactly 31 file-based agents', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      expect(agents.length).toBe(31);
    });

    test('each agent has name, plugin, file, and frontmatter', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      for (const agent of agents) {
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('plugin');
        expect(agent).toHaveProperty('file');
        expect(agent).toHaveProperty('frontmatter');
        expect(agent.file).toMatch(/\.md$/);
      }
    });

    test('agents are attributed to correct plugins', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const nextTaskAgents = agents.filter(a => a.plugin === 'next-task');
      expect(nextTaskAgents.length).toBe(10);

      const enhanceAgents = agents.filter(a => a.plugin === 'enhance');
      expect(enhanceAgents.length).toBe(8);

      const perfAgents = agents.filter(a => a.plugin === 'perf');
      expect(perfAgents.length).toBe(6);
    });

    test('agents have model field in frontmatter', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const modelsFound = new Set();
      for (const agent of agents) {
        if (agent.frontmatter.model) {
          modelsFound.add(agent.frontmatter.model);
        }
      }
      expect(modelsFound.has('opus')).toBe(true);
      expect(modelsFound.has('sonnet')).toBe(true);
      expect(modelsFound.has('haiku')).toBe(true);
    });

    test('agents have tools array in frontmatter', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const exploration = agents.find(a => a.name === 'exploration-agent');
      expect(exploration).toBeDefined();
      expect(Array.isArray(exploration.frontmatter.tools)).toBe(true);
      expect(exploration.frontmatter.tools).toContain('Read');
    });
  });

  describe('discoverSkills', () => {
    test('discovers exactly 27 skills', () => {
      const skills = discovery.discoverSkills(REPO_ROOT);
      expect(skills.length).toBe(27);
    });

    test('each skill has name, plugin, dir, and frontmatter', () => {
      const skills = discovery.discoverSkills(REPO_ROOT);
      for (const skill of skills) {
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('plugin');
        expect(skill).toHaveProperty('dir');
        expect(skill).toHaveProperty('frontmatter');
      }
    });
  });

  describe('getCommandMappings', () => {
    test('returns tuples of [targetFile, plugin, sourceFile]', () => {
      const mappings = discovery.getCommandMappings(REPO_ROOT);
      expect(mappings.length).toBe(18);
      for (const [target, plugin, source] of mappings) {
        expect(target).toMatch(/\.md$/);
        expect(typeof plugin).toBe('string');
        expect(source).toMatch(/\.md$/);
      }
    });
  });

  describe('getCodexSkillMappings', () => {
    test('returns tuples of [name, plugin, file, description]', () => {
      const mappings = discovery.getCodexSkillMappings(REPO_ROOT);
      expect(mappings.length).toBe(18);
      for (const [name, plugin, file, desc] of mappings) {
        expect(typeof name).toBe('string');
        expect(typeof plugin).toBe('string');
        expect(file).toMatch(/\.md$/);
        expect(typeof desc).toBe('string');
      }
    });

    test('primary commands have codex-description', () => {
      const mappings = discovery.getCodexSkillMappings(REPO_ROOT);
      const primaryNames = [
        'enhance', 'next-task', 'ship', 'deslop', 'audit-project',
        'drift-detect', 'repo-map', 'perf', 'delivery-approval',
        'sync-docs', 'learn', 'agnix'
      ];
      for (const name of primaryNames) {
        const mapping = mappings.find(m => m[0] === name);
        expect(mapping).toBeDefined();
        expect(mapping[3]).toContain('Use when user asks to');
      }
    });
  });

  describe('getPluginPrefixRegex', () => {
    test('builds regex matching all plugin names', () => {
      const regex = discovery.getPluginPrefixRegex(REPO_ROOT);
      expect(regex).toBeInstanceOf(RegExp);
      expect('next-task').toMatch(regex);
      expect('enhance').toMatch(regex);
      expect('nonexistent-plugin').not.toMatch(regex);
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
      expect(first).toBe(second); // Same reference = cached
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
      expect(all.plugins.length).toBe(12);
      expect(all.commands.length).toBe(18);
      expect(all.agents.length).toBe(31);
      expect(all.skills.length).toBe(27);
    });
  });
});
