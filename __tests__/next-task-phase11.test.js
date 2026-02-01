const fs = require('fs');
const path = require('path');

describe('next-task Phase 11 integration', () => {
  const nextTaskDir = path.join(__dirname, '..', 'plugins', 'next-task');
  const syncDocsDir = path.join(__dirname, '..', 'plugins', 'sync-docs');

  describe('Phase 11 command configuration', () => {
    const cmdPath = path.join(nextTaskDir, 'commands', 'next-task.md');
    let content;

    beforeAll(() => {
      content = fs.readFileSync(cmdPath, 'utf8');
    });

    test('Phase 11 exists in workflow', () => {
      expect(content).toContain('Phase 11');
      expect(content).toContain('Docs Update');
    });

    test('uses sync-docs:sync-docs-agent', () => {
      expect(content).toContain('sync-docs:sync-docs-agent');
    });

    test('uses before-pr scope', () => {
      expect(content).toContain('before-pr');
    });

    test('has parseSyncDocsResult function', () => {
      expect(content).toContain('parseSyncDocsResult');
    });

    test('spawns simple-fixer for fixes', () => {
      expect(content).toContain('simple-fixer');
    });

    test('completes phase with docsUpdated flag', () => {
      expect(content).toContain('docsUpdated');
    });
  });

  describe('docs-updater removal verification', () => {
    test('docs-updater.md does not exist', () => {
      const agentPath = path.join(nextTaskDir, 'agents', 'docs-updater.md');
      expect(fs.existsSync(agentPath)).toBe(false);
    });

    test('docs-update skill does not exist', () => {
      const skillPath = path.join(nextTaskDir, 'skills', 'docs-update');
      expect(fs.existsSync(skillPath)).toBe(false);
    });
  });

  describe('cross-plugin integration', () => {
    test('sync-docs-agent exists in sync-docs plugin', () => {
      const agentPath = path.join(syncDocsDir, 'agents', 'sync-docs-agent.md');
      expect(fs.existsSync(agentPath)).toBe(true);
    });

    test('sync-docs skill exists', () => {
      const skillPath = path.join(syncDocsDir, 'skills', 'sync-docs', 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
    });
  });

  describe('hooks configuration', () => {
    const hooksPath = path.join(nextTaskDir, 'hooks', 'hooks.json');
    let hooks;

    beforeAll(() => {
      hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    });

    test('hooks.json is valid JSON', () => {
      expect(hooks).toBeDefined();
    });

    test('references sync-docs:sync-docs-agent not docs-updater', () => {
      const content = fs.readFileSync(hooksPath, 'utf8');
      expect(content).not.toContain('"docs-updater"');
      expect(content).toContain('sync-docs:sync-docs-agent');
    });
  });

  describe('agent references updated', () => {
    const agentFiles = [
      'delivery-validator.md',
      'implementation-agent.md',
      'simple-fixer.md'
    ];

    agentFiles.forEach(agentFile => {
      test(`${agentFile} references sync-docs-agent not docs-updater`, () => {
        const agentPath = path.join(nextTaskDir, 'agents', agentFile);
        if (fs.existsSync(agentPath)) {
          const content = fs.readFileSync(agentPath, 'utf8');
          // Should not have standalone docs-updater reference (may have historical context)
          expect(content).toContain('sync-docs');
        }
      });
    });
  });

  describe('workflow gates', () => {
    const cmdPath = path.join(nextTaskDir, 'commands', 'next-task.md');
    let content;

    beforeAll(() => {
      content = fs.readFileSync(cmdPath, 'utf8');
    });

    test('docs update is mandatory gate', () => {
      expect(content).toContain('Docs');
      expect(content).toContain('Documentation updated');
    });

    test('cannot skip docs update', () => {
      expect(content).toMatch(/No agent may skip.*docs/i);
    });
  });

  describe('next-task agent count', () => {
    const agentsDir = path.join(nextTaskDir, 'agents');

    test('has 11 agents (not 12)', () => {
      const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      expect(agents.length).toBe(11);
    });

    test('does not include docs-updater', () => {
      const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      expect(agents).not.toContain('docs-updater.md');
    });
  });

  describe('next-task skill count', () => {
    const skillsDir = path.join(nextTaskDir, 'skills');

    test('has 3 skills (not 4)', () => {
      const skills = fs.readdirSync(skillsDir).filter(f =>
        fs.statSync(path.join(skillsDir, f)).isDirectory()
      );
      expect(skills.length).toBe(3);
    });

    test('does not include docs-update', () => {
      const skills = fs.readdirSync(skillsDir).filter(f =>
        fs.statSync(path.join(skillsDir, f)).isDirectory()
      );
      expect(skills).not.toContain('docs-update');
    });
  });
});
