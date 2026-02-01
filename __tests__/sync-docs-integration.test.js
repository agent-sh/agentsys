const fs = require('fs');
const path = require('path');

describe('sync-docs integration', () => {
  const pluginDir = path.join(__dirname, '..', 'plugins', 'sync-docs');

  describe('plugin structure', () => {
    test('has exactly 1 agent', () => {
      const agentsDir = path.join(pluginDir, 'agents');
      const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      expect(agents.length).toBe(1);
      expect(agents[0]).toBe('sync-docs-agent.md');
    });

    test('has exactly 1 skill', () => {
      const skillsDir = path.join(pluginDir, 'skills');
      const skills = fs.readdirSync(skillsDir).filter(f =>
        fs.statSync(path.join(skillsDir, f)).isDirectory()
      );
      expect(skills.length).toBe(1);
      expect(skills[0]).toBe('sync-docs');
    });

    test('plugin.json matches filesystem', () => {
      const pluginJson = JSON.parse(fs.readFileSync(
        path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8'
      ));
      expect(pluginJson.agents.length).toBe(1);
      expect(pluginJson.skills.length).toBe(1);
    });
  });

  describe('agent structure', () => {
    const agentPath = path.join(pluginDir, 'agents', 'sync-docs-agent.md');
    let content;

    beforeAll(() => {
      content = fs.readFileSync(agentPath, 'utf8');
    });

    test('has valid YAML frontmatter', () => {
      expect(content.startsWith('---')).toBe(true);
      const endIndex = content.indexOf('---', 3);
      expect(endIndex).toBeGreaterThan(3);
    });

    test('specifies model as sonnet', () => {
      expect(content).toMatch(/model:\s*sonnet/);
    });

    test('does not have Task tool (no subagent spawning)', () => {
      const toolsMatch = content.match(/tools:\s*([^\n]+)/);
      if (toolsMatch) {
        expect(toolsMatch[1]).not.toContain('Task');
      }
    });

    test('references the sync-docs skill', () => {
      expect(content).toContain('sync-docs');
      expect(content).toContain('Skill');
    });

    test('defines output format with markers', () => {
      expect(content).toContain('SYNC_DOCS_RESULT');
      expect(content).toContain('END_RESULT');
    });
  });

  describe('skill structure', () => {
    const skillPath = path.join(pluginDir, 'skills', 'sync-docs', 'SKILL.md');
    let content;

    beforeAll(() => {
      content = fs.readFileSync(skillPath, 'utf8');
    });

    test('has valid YAML frontmatter', () => {
      expect(content.startsWith('---')).toBe(true);
      expect(content).toMatch(/name:\s*sync-docs/);
    });

    test('documents all 5 phases', () => {
      expect(content).toContain('Phase 1');
      expect(content).toContain('Phase 2');
      expect(content).toContain('Phase 3');
      expect(content).toContain('Phase 4');
      expect(content).toContain('Phase 5');
    });

    test('references validation scripts', () => {
      expect(content).toContain('validate-counts.js');
      expect(content).toContain('validate-cross-platform-docs.js');
    });

    test('references docs-patterns collector', () => {
      expect(content).toContain('docs-patterns');
      expect(content).toContain('findRelatedDocs');
    });

    test('defines output format with markers', () => {
      expect(content).toContain('SYNC_DOCS_RESULT');
      expect(content).toContain('END_RESULT');
    });

    test('supports all scopes', () => {
      expect(content).toContain('recent');
      expect(content).toContain('all');
      expect(content).toContain('before-pr');
    });
  });

  describe('command structure', () => {
    const cmdPath = path.join(pluginDir, 'commands', 'sync-docs.md');
    let content;

    beforeAll(() => {
      content = fs.readFileSync(cmdPath, 'utf8');
    });

    test('has valid YAML frontmatter', () => {
      expect(content.startsWith('---')).toBe(true);
      expect(content).toMatch(/description:/);
    });

    test('spawns sync-docs-agent', () => {
      expect(content).toContain('sync-docs:sync-docs-agent');
    });

    test('has parseSyncDocsResult implementation', () => {
      expect(content).toContain('parseSyncDocsResult');
      expect(content).toContain('SYNC_DOCS_RESULT');
    });

    test('delegates fixes to simple-fixer', () => {
      expect(content).toContain('simple-fixer');
    });
  });

  describe('lib/collectors integration', () => {
    const collectorsPath = path.join(pluginDir, 'lib', 'collectors');

    test('has docs-patterns.js', () => {
      expect(fs.existsSync(path.join(collectorsPath, 'docs-patterns.js'))).toBe(true);
    });

    test('exports from index.js', () => {
      const indexPath = path.join(pluginDir, 'lib', 'index.js');
      const content = fs.readFileSync(indexPath, 'utf8');
      // index.js exports collectors, which contains docsPatterns
      expect(content).toContain('collectors');
    });
  });
});
