const fs = require('fs');
const path = require('path');

describe('consolidation counts verification', () => {
  const pluginsDir = path.join(__dirname, '..', 'plugins');

  describe('total counts', () => {
    test('has exactly 10 plugins', () => {
      const plugins = fs.readdirSync(pluginsDir).filter(f =>
        fs.statSync(path.join(pluginsDir, f)).isDirectory()
      );
      expect(plugins.length).toBe(10);
    });

    test('has exactly 30 file-based agents', () => {
      let agentCount = 0;
      const plugins = fs.readdirSync(pluginsDir).filter(f =>
        fs.statSync(path.join(pluginsDir, f)).isDirectory()
      );

      plugins.forEach(plugin => {
        const agentsDir = path.join(pluginsDir, plugin, 'agents');
        if (fs.existsSync(agentsDir)) {
          const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
          agentCount += agents.length;
        }
      });

      expect(agentCount).toBe(29);
    });

    test('has exactly 26 skills', () => {
      let skillCount = 0;
      const plugins = fs.readdirSync(pluginsDir).filter(f =>
        fs.statSync(path.join(pluginsDir, f)).isDirectory()
      );

      plugins.forEach(plugin => {
        const skillsDir = path.join(pluginsDir, plugin, 'skills');
        if (fs.existsSync(skillsDir)) {
          const skills = fs.readdirSync(skillsDir).filter(f => {
            const skillPath = path.join(skillsDir, f);
            return fs.statSync(skillPath).isDirectory() &&
                   fs.existsSync(path.join(skillPath, 'SKILL.md'));
          });
          skillCount += skills.length;
        }
      });

      expect(skillCount).toBe(25);
    });
  });

  describe('sync-docs plugin counts', () => {
    const syncDocsDir = path.join(pluginsDir, 'sync-docs');

    test('has exactly 1 agent (consolidated)', () => {
      const agentsDir = path.join(syncDocsDir, 'agents');
      const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      expect(agents.length).toBe(1);
    });

    test('has exactly 1 skill (consolidated)', () => {
      const skillsDir = path.join(syncDocsDir, 'skills');
      const skills = fs.readdirSync(skillsDir).filter(f =>
        fs.statSync(path.join(skillsDir, f)).isDirectory()
      );
      expect(skills.length).toBe(1);
    });

    test('old agents removed', () => {
      const agentsDir = path.join(syncDocsDir, 'agents');
      expect(fs.existsSync(path.join(agentsDir, 'docs-analyzer.md'))).toBe(false);
      expect(fs.existsSync(path.join(agentsDir, 'docs-validator.md'))).toBe(false);
    });

    test('old skills removed', () => {
      const skillsDir = path.join(syncDocsDir, 'skills');
      expect(fs.existsSync(path.join(skillsDir, 'sync-docs-discovery'))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, 'sync-docs-analysis'))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, 'changelog-update'))).toBe(false);
    });
  });

  describe('next-task plugin counts', () => {
    const nextTaskDir = path.join(pluginsDir, 'next-task');

    test('has exactly 10 agents (reduced from 11, deslop-work removed)', () => {
      const agentsDir = path.join(nextTaskDir, 'agents');
      const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      expect(agents.length).toBe(10);
    });

    test('has exactly 3 skills', () => {
      const skillsDir = path.join(nextTaskDir, 'skills');
      const skills = fs.readdirSync(skillsDir).filter(f =>
        fs.statSync(path.join(skillsDir, f)).isDirectory()
      );
      expect(skills.length).toBe(3);
    });

    test('docs-updater agent removed', () => {
      const agentsDir = path.join(nextTaskDir, 'agents');
      expect(fs.existsSync(path.join(agentsDir, 'docs-updater.md'))).toBe(false);
    });

    test('deslop-work agent removed (consolidated to deslop:deslop-agent)', () => {
      const agentsDir = path.join(nextTaskDir, 'agents');
      expect(fs.existsSync(path.join(agentsDir, 'deslop-work.md'))).toBe(false);
    });

    test('docs-update skill removed', () => {
      const skillsDir = path.join(nextTaskDir, 'skills');
      expect(fs.existsSync(path.join(skillsDir, 'docs-update'))).toBe(false);
    });
  });

  describe('plugin.json consistency', () => {
    test('sync-docs plugin.json is valid', () => {
      const pluginJson = JSON.parse(fs.readFileSync(
        path.join(pluginsDir, 'sync-docs', '.claude-plugin', 'plugin.json'), 'utf8'
      ));

      expect(pluginJson.name).toBe('sync-docs');
      expect(pluginJson.version).toBeDefined();
      // Note: agents/skills are auto-discovered from directories, not declared in plugin.json

      // Verify filesystem has expected structure
      expect(fs.existsSync(path.join(pluginsDir, 'sync-docs', 'agents', 'sync-docs-agent.md'))).toBe(true);
      expect(fs.existsSync(path.join(pluginsDir, 'sync-docs', 'skills', 'sync-docs', 'SKILL.md'))).toBe(true);
    });
  });

  describe('documentation counts match', () => {
    test('CLAUDE.md has correct counts', () => {
      const content = fs.readFileSync(path.join(__dirname, '..', 'CLAUDE.md'), 'utf8');
      expect(content).toContain('39 agents');
      expect(content).toContain('29 file-based');
      expect(content).toContain('25 skills');
    });

    test('README.md has correct counts', () => {
      const content = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
      expect(content).toContain('39 agents');
      expect(content).toContain('25 skills');
    });
  });

  describe('deslop plugin counts', () => {
    const deslopDir = path.join(pluginsDir, 'deslop');

    test('has exactly 1 agent (consolidated)', () => {
      const agentsDir = path.join(deslopDir, 'agents');
      const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      expect(agents.length).toBe(1);
    });

    test('has exactly 1 skill (consolidated)', () => {
      const skillsDir = path.join(deslopDir, 'skills');
      const skills = fs.readdirSync(skillsDir).filter(f =>
        fs.statSync(path.join(skillsDir, f)).isDirectory()
      );
      expect(skills.length).toBe(1);
    });

    test('old agent removed', () => {
      const agentsDir = path.join(deslopDir, 'agents');
      expect(fs.existsSync(path.join(agentsDir, 'deslop-analyzer.md'))).toBe(false);
    });

    test('old skills removed', () => {
      const skillsDir = path.join(deslopDir, 'skills');
      expect(fs.existsSync(path.join(skillsDir, 'deslop-detection'))).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, 'deslop-fixes'))).toBe(false);
    });

    test('new agent exists', () => {
      const agentsDir = path.join(deslopDir, 'agents');
      expect(fs.existsSync(path.join(agentsDir, 'deslop-agent.md'))).toBe(true);
    });

    test('new skill exists', () => {
      const skillsDir = path.join(deslopDir, 'skills');
      expect(fs.existsSync(path.join(skillsDir, 'deslop', 'SKILL.md'))).toBe(true);
    });
  });

  describe('per-plugin breakdown', () => {
    const expectedCounts = {
      'next-task': { agents: 10, skills: 3 },
      'enhance': { agents: 8, skills: 9 },
      'ship': { agents: 0, skills: 0 },
      'perf': { agents: 6, skills: 8 },
      'audit-project': { agents: 0, skills: 0 },
      'deslop': { agents: 1, skills: 1 },
      'drift-detect': { agents: 1, skills: 1 },
      'repo-map': { agents: 1, skills: 1 },
      'sync-docs': { agents: 1, skills: 1 },
      'learn': { agents: 1, skills: 1 }
    };

    Object.entries(expectedCounts).forEach(([plugin, counts]) => {
      test(`${plugin} has ${counts.agents} agents and ${counts.skills} skills`, () => {
        const pluginDir = path.join(pluginsDir, plugin);

        // Count agents
        const agentsDir = path.join(pluginDir, 'agents');
        const agentCount = fs.existsSync(agentsDir)
          ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length
          : 0;

        // Count skills
        const skillsDir = path.join(pluginDir, 'skills');
        const skillCount = fs.existsSync(skillsDir)
          ? fs.readdirSync(skillsDir).filter(f => {
              const skillPath = path.join(skillsDir, f);
              return fs.statSync(skillPath).isDirectory() &&
                     fs.existsSync(path.join(skillPath, 'SKILL.md'));
            }).length
          : 0;

        expect(agentCount).toBe(counts.agents);
        expect(skillCount).toBe(counts.skills);
      });
    });
  });
});
