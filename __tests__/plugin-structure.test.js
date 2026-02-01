/**
 * Tests for plugin structure validation
 * Ensures all plugins have correct structure after refactoring
 */

const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, '..', 'plugins');

describe('plugin structure', () => {
  describe('deslop plugin', () => {
    const deslopDir = path.join(pluginsDir, 'deslop');
    const pluginJsonPath = path.join(deslopDir, '.claude-plugin', 'plugin.json');

    test('has plugin.json', () => {
      expect(fs.existsSync(pluginJsonPath)).toBe(true);
    });

    test('plugin.json is valid JSON', () => {
      const content = fs.readFileSync(pluginJsonPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('plugin.json has agents array', () => {
      const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      expect(pluginJson.agents).toBeDefined();
      expect(Array.isArray(pluginJson.agents)).toBe(true);
    });

    test('plugin.json has skills array', () => {
      const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      expect(pluginJson.skills).toBeDefined();
      expect(Array.isArray(pluginJson.skills)).toBe(true);
    });

    test('has deslop-analyzer agent', () => {
      const agentPath = path.join(deslopDir, 'agents', 'deslop-analyzer.md');
      expect(fs.existsSync(agentPath)).toBe(true);
    });

    test('deslop-analyzer.md has valid frontmatter', () => {
      const agentPath = path.join(deslopDir, 'agents', 'deslop-analyzer.md');
      const content = fs.readFileSync(agentPath, 'utf8');

      expect(content.startsWith('---')).toBe(true);
      expect(content.includes('name:')).toBe(true);
      expect(content.includes('description:')).toBe(true);
      expect(content.includes('model:')).toBe(true);
    });

    test('has deslop-detection skill', () => {
      const skillPath = path.join(deslopDir, 'skills', 'deslop-detection', 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
    });

    test('deslop-detection skill has valid frontmatter', () => {
      const skillPath = path.join(deslopDir, 'skills', 'deslop-detection', 'SKILL.md');
      const content = fs.readFileSync(skillPath, 'utf8');

      expect(content.startsWith('---')).toBe(true);
      expect(content.includes('name: deslop-detection')).toBe(true);
      expect(content.includes('description:')).toBe(true);
    });

    test('has deslop-fixes skill', () => {
      const skillPath = path.join(deslopDir, 'skills', 'deslop-fixes', 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
    });

    test('deslop-fixes skill has valid frontmatter', () => {
      const skillPath = path.join(deslopDir, 'skills', 'deslop-fixes', 'SKILL.md');
      const content = fs.readFileSync(skillPath, 'utf8');

      expect(content.startsWith('---')).toBe(true);
      expect(content.includes('name: deslop-fixes')).toBe(true);
      expect(content.includes('description:')).toBe(true);
    });

    test('agent references skill', () => {
      const agentPath = path.join(deslopDir, 'agents', 'deslop-analyzer.md');
      const content = fs.readFileSync(agentPath, 'utf8');

      expect(content.includes('deslop-detection')).toBe(true);
    });
  });

  describe('sync-docs plugin', () => {
    const syncDocsDir = path.join(pluginsDir, 'sync-docs');
    const pluginJsonPath = path.join(syncDocsDir, '.claude-plugin', 'plugin.json');

    test('has plugin.json', () => {
      expect(fs.existsSync(pluginJsonPath)).toBe(true);
    });

    test('plugin.json is valid JSON', () => {
      const content = fs.readFileSync(pluginJsonPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('plugin.json has agents array', () => {
      const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      expect(pluginJson.agents).toBeDefined();
      expect(Array.isArray(pluginJson.agents)).toBe(true);
    });

    test('plugin.json has skills array', () => {
      const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      expect(pluginJson.skills).toBeDefined();
      expect(Array.isArray(pluginJson.skills)).toBe(true);
    });

    test('has sync-docs-agent (unified agent)', () => {
      const agentPath = path.join(syncDocsDir, 'agents', 'sync-docs-agent.md');
      expect(fs.existsSync(agentPath)).toBe(true);
    });

    test('sync-docs-agent.md has valid frontmatter', () => {
      const agentPath = path.join(syncDocsDir, 'agents', 'sync-docs-agent.md');
      const content = fs.readFileSync(agentPath, 'utf8');

      expect(content.startsWith('---')).toBe(true);
      expect(content.includes('name:')).toBe(true);
      expect(content.includes('model:')).toBe(true);
    });

    test('has sync-docs skill (unified skill)', () => {
      const skillPath = path.join(syncDocsDir, 'skills', 'sync-docs', 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
    });

    test('sync-docs skill has valid frontmatter', () => {
      const skillPath = path.join(syncDocsDir, 'skills', 'sync-docs', 'SKILL.md');
      const content = fs.readFileSync(skillPath, 'utf8');

      expect(content.startsWith('---')).toBe(true);
      expect(content.includes('name: sync-docs')).toBe(true);
      expect(content.includes('description:')).toBe(true);
    });

    test('plugin.json references unified agent and skill', () => {
      const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));

      expect(pluginJson.agents).toContain('agents/sync-docs-agent.md');
      expect(pluginJson.skills).toContain('skills/sync-docs/SKILL.md');
      expect(pluginJson.agents.length).toBe(1);
      expect(pluginJson.skills.length).toBe(1);
    });
  });

  describe('all plugins have lib/', () => {
    const plugins = ['next-task', 'ship', 'deslop', 'audit-project', 'drift-detect', 'enhance', 'sync-docs', 'repo-map', 'perf'];

    for (const plugin of plugins) {
      test(`${plugin} has lib/ directory`, () => {
        const libDir = path.join(pluginsDir, plugin, 'lib');
        expect(fs.existsSync(libDir)).toBe(true);
      });

      test(`${plugin}/lib has index.js`, () => {
        const indexPath = path.join(pluginsDir, plugin, 'lib', 'index.js');
        expect(fs.existsSync(indexPath)).toBe(true);
      });

      test(`${plugin}/lib has collectors/`, () => {
        const collectorsDir = path.join(pluginsDir, plugin, 'lib', 'collectors');
        expect(fs.existsSync(collectorsDir)).toBe(true);
      });

      test(`${plugin}/lib has repo-map/`, () => {
        const repoMapDir = path.join(pluginsDir, plugin, 'lib', 'repo-map');
        expect(fs.existsSync(repoMapDir)).toBe(true);
      });

      test(`${plugin}/lib/repo-map has usage-analyzer.js`, () => {
        const usageAnalyzerPath = path.join(pluginsDir, plugin, 'lib', 'repo-map', 'usage-analyzer.js');
        expect(fs.existsSync(usageAnalyzerPath)).toBe(true);
      });
    }
  });

  describe('lib/collectors structure', () => {
    const collectorsDir = path.join(__dirname, '..', 'lib', 'collectors');

    test('has index.js', () => {
      expect(fs.existsSync(path.join(collectorsDir, 'index.js'))).toBe(true);
    });

    test('has github.js', () => {
      expect(fs.existsSync(path.join(collectorsDir, 'github.js'))).toBe(true);
    });

    test('has documentation.js', () => {
      expect(fs.existsSync(path.join(collectorsDir, 'documentation.js'))).toBe(true);
    });

    test('has codebase.js', () => {
      expect(fs.existsSync(path.join(collectorsDir, 'codebase.js'))).toBe(true);
    });

    test('has docs-patterns.js', () => {
      expect(fs.existsSync(path.join(collectorsDir, 'docs-patterns.js'))).toBe(true);
    });
  });

  describe('lib/repo-map structure', () => {
    const repoMapDir = path.join(__dirname, '..', 'lib', 'repo-map');

    test('has index.js', () => {
      expect(fs.existsSync(path.join(repoMapDir, 'index.js'))).toBe(true);
    });

    test('has usage-analyzer.js', () => {
      expect(fs.existsSync(path.join(repoMapDir, 'usage-analyzer.js'))).toBe(true);
    });

    test('index.js exports usage-analyzer functions', () => {
      const indexContent = fs.readFileSync(path.join(repoMapDir, 'index.js'), 'utf8');

      expect(indexContent.includes('buildUsageIndex')).toBe(true);
      expect(indexContent.includes('findUsages')).toBe(true);
      expect(indexContent.includes('findUnusedExports')).toBe(true);
      expect(indexContent.includes('findOrphanedInfrastructure')).toBe(true);
    });
  });
});
