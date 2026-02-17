const path = require('path');
const fs = require('fs');
const genDocs = require('../scripts/generate-docs');
const discovery = require('../lib/discovery');

const REPO_ROOT = path.join(__dirname, '..');

beforeEach(() => {
  discovery.invalidateCache();
});

describe('generate-docs', () => {
  describe('injectBetweenMarkers', () => {
    test('replaces content between markers', () => {
      const content = '# Doc\n<!-- GEN:START:test -->\nold content\n<!-- GEN:END:test -->\nfooter';
      const result = genDocs.injectBetweenMarkers(content, 'test', 'new content');
      expect(result).toBe('# Doc\n<!-- GEN:START:test -->\nnew content\n<!-- GEN:END:test -->\nfooter');
    });

    test('returns original content when start marker missing', () => {
      const content = '# Doc\nno markers here\n<!-- GEN:END:test -->';
      const result = genDocs.injectBetweenMarkers(content, 'test', 'new');
      expect(result).toBe(content);
    });

    test('returns original content when end marker missing', () => {
      const content = '<!-- GEN:START:test -->\ncontent without end';
      const result = genDocs.injectBetweenMarkers(content, 'test', 'new');
      expect(result).toBe(content);
    });

    test('returns original content when markers are reversed', () => {
      const content = '<!-- GEN:END:test -->\nmid\n<!-- GEN:START:test -->';
      const result = genDocs.injectBetweenMarkers(content, 'test', 'new');
      expect(result).toBe(content);
    });

    test('handles different section names independently', () => {
      const content = '<!-- GEN:START:a -->\nold-a\n<!-- GEN:END:a -->\n<!-- GEN:START:b -->\nold-b\n<!-- GEN:END:b -->';
      const result = genDocs.injectBetweenMarkers(content, 'a', 'new-a');
      expect(result).toContain('new-a');
      expect(result).toContain('old-b');
    });

    test('handles empty replacement content', () => {
      const content = '<!-- GEN:START:test -->\nold\n<!-- GEN:END:test -->';
      const result = genDocs.injectBetweenMarkers(content, 'test', '');
      expect(result).toBe('<!-- GEN:START:test -->\n\n<!-- GEN:END:test -->');
    });
  });

  describe('generateCommandsTable', () => {
    test('generates a markdown table with header', () => {
      const commands = discovery.discoverCommands(REPO_ROOT);
      const table = genDocs.generateCommandsTable(commands);
      expect(table).toContain('| Command | What it does |');
      expect(table).toContain('|---------|--------------|');
    });

    test('includes all 11 primary commands', () => {
      const commands = discovery.discoverCommands(REPO_ROOT);
      const table = genDocs.generateCommandsTable(commands);
      const expectedCommands = [
        'next-task', 'agnix', 'ship', 'deslop', 'perf',
        'drift-detect', 'audit-project', 'enhance',
        'repo-map', 'sync-docs', 'learn'
      ];
      for (const cmd of expectedCommands) {
        expect(table).toContain(`/${cmd}`);
      }
    });

    test('next-task appears first in the table', () => {
      const commands = discovery.discoverCommands(REPO_ROOT);
      const table = genDocs.generateCommandsTable(commands);
      const lines = table.split('\n');
      // First data row (after header + separator)
      expect(lines[2]).toContain('/next-task');
    });

    test('each row has link and description', () => {
      const commands = discovery.discoverCommands(REPO_ROOT);
      const table = genDocs.generateCommandsTable(commands);
      const dataRows = table.split('\n').slice(2);
      for (const row of dataRows) {
        // Each row should have a markdown link
        expect(row).toMatch(/\[`\/[a-z-]+`\]/);
        // Each row should have a description (not empty after pipe)
        const cols = row.split('|').filter(c => c.trim());
        expect(cols.length).toBeGreaterThanOrEqual(2);
        expect(cols[1].trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('generateSkillsTable', () => {
    test('shows correct total skill count', () => {
      const skills = discovery.discoverSkills(REPO_ROOT);
      const table = genDocs.generateSkillsTable(skills);
      expect(table).toContain(`${skills.length} skills included`);
    });

    test('includes category headers', () => {
      const skills = discovery.discoverSkills(REPO_ROOT);
      const table = genDocs.generateSkillsTable(skills);
      expect(table).toContain('**Performance**');
      expect(table).toContain('**Enhancement**');
      expect(table).toContain('**Workflow**');
      expect(table).toContain('**Cleanup**');
      expect(table).toContain('**Analysis**');
      expect(table).toContain('**Learning**');
      expect(table).toContain('**Linting**');
    });

    test('uses plugin:skill format', () => {
      const skills = discovery.discoverSkills(REPO_ROOT);
      const table = genDocs.generateSkillsTable(skills);
      expect(table).toContain('`perf:perf-analyzer`');
      expect(table).toContain('`enhance:enhance-docs`');
      expect(table).toContain('`next-task:discover-tasks`');
    });

    test('all skills are represented in the table', () => {
      const skills = discovery.discoverSkills(REPO_ROOT);
      const table = genDocs.generateSkillsTable(skills);
      for (const skill of skills) {
        expect(table).toContain(`${skill.plugin}:${skill.name}`);
      }
    });
  });

  describe('generateArchitectureTable', () => {
    test('shows correct counts in header', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const agents = discovery.discoverAgents(REPO_ROOT);
      const skills = discovery.discoverSkills(REPO_ROOT);
      const table = genDocs.generateArchitectureTable(plugins, agents, skills);
      const totalAgents = agents.length + genDocs.ROLE_BASED_AGENT_COUNT;
      expect(table).toContain(`${plugins.length} plugins`);
      expect(table).toContain(`${totalAgents} agents`);
      expect(table).toContain(`${agents.length} file-based`);
      expect(table).toContain(`${skills.length} skills`);
    });

    test('lists all plugins', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const agents = discovery.discoverAgents(REPO_ROOT);
      const skills = discovery.discoverSkills(REPO_ROOT);
      const table = genDocs.generateArchitectureTable(plugins, agents, skills);
      for (const plugin of plugins) {
        expect(table).toContain(`| ${plugin} |`);
      }
    });

    test('audit-project shows role-based agent count', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const agents = discovery.discoverAgents(REPO_ROOT);
      const skills = discovery.discoverSkills(REPO_ROOT);
      const table = genDocs.generateArchitectureTable(plugins, agents, skills);
      // audit-project has 10 role-based agents and 0 file-based
      expect(table).toContain('| audit-project | 10 | 0 |');
    });

    test('ship shows zero agents and skills', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const agents = discovery.discoverAgents(REPO_ROOT);
      const skills = discovery.discoverSkills(REPO_ROOT);
      const table = genDocs.generateArchitectureTable(plugins, agents, skills);
      expect(table).toContain('| ship | 0 | 0 |');
    });
  });

  describe('generateAgentNavTable', () => {
    test('generates navigation table', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const table = genDocs.generateAgentNavTable(agents, plugins);
      expect(table).toContain('| Plugin | Agents | Jump to |');
    });

    test('includes anchor links for all file-based agents', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const table = genDocs.generateAgentNavTable(agents, plugins);
      for (const agent of agents) {
        expect(table).toContain(`[${agent.name}](#${agent.name})`);
      }
    });

    test('includes audit-project role-based agents', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const table = genDocs.generateAgentNavTable(agents, plugins);
      expect(table).toContain('[code-quality-reviewer](#code-quality-reviewer)');
      expect(table).toContain('[devops-reviewer](#devops-reviewer)');
      expect(table).toContain('| audit-project | 10 |');
    });

    test('skips ship plugin (no agents)', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const table = genDocs.generateAgentNavTable(agents, plugins);
      // ship should not appear as a row (has 0 agents)
      const rows = table.split('\n').filter(line => line.startsWith('| ship'));
      expect(rows.length).toBe(0);
    });
  });

  describe('generateAgentCounts', () => {
    test('includes total agent count', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const counts = genDocs.generateAgentCounts(agents, plugins);
      const totalAgents = agents.length + genDocs.ROLE_BASED_AGENT_COUNT;
      expect(counts).toContain(`${totalAgents} agents`);
    });

    test('includes AGENT_COUNT_TOTAL comment', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const counts = genDocs.generateAgentCounts(agents, plugins);
      const totalAgents = agents.length + genDocs.ROLE_BASED_AGENT_COUNT;
      expect(counts).toContain(`<!-- AGENT_COUNT_TOTAL: ${totalAgents} -->`);
    });

    test('counts plugins with agents correctly', () => {
      const agents = discovery.discoverAgents(REPO_ROOT);
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const counts = genDocs.generateAgentCounts(agents, plugins);
      // 12 plugins have agents (all except ship)
      expect(counts).toContain('12 have agents');
    });
  });

  describe('CATEGORY_MAP completeness', () => {
    test('every plugin with skills has a category mapping', () => {
      const skills = discovery.discoverSkills(REPO_ROOT);
      const pluginsWithSkills = new Set(skills.map(s => s.plugin));
      for (const plugin of pluginsWithSkills) {
        expect(genDocs.CATEGORY_MAP).toHaveProperty(plugin);
      }
    });
  });

  describe('PURPOSE_MAP completeness', () => {
    test('every plugin has a purpose mapping', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      for (const plugin of plugins) {
        expect(genDocs.PURPOSE_MAP).toHaveProperty(plugin);
        expect(genDocs.PURPOSE_MAP[plugin].length).toBeGreaterThan(0);
      }
    });
  });

  describe('checkFreshness', () => {
    test('returns fresh when docs are up to date', () => {
      const result = genDocs.checkFreshness();
      expect(result.status).toBe('fresh');
      expect(result.staleFiles).toEqual([]);
    });

    test('returns stale when docs are tampered with', () => {
      const readmePath = path.join(REPO_ROOT, 'README.md');
      const original = fs.readFileSync(readmePath, 'utf8');

      try {
        // Tamper with generated section
        const tampered = original.replace(
          /<!-- GEN:START:readme-skills -->\n[\s\S]*?\n<!-- GEN:END:readme-skills -->/,
          '<!-- GEN:START:readme-skills -->\ntampered content\n<!-- GEN:END:readme-skills -->'
        );
        fs.writeFileSync(readmePath, tampered);
        discovery.invalidateCache();

        const result = genDocs.checkFreshness();
        expect(result.status).toBe('stale');
        expect(result.staleFiles).toContain('README.md');
      } finally {
        // Restore original
        fs.writeFileSync(readmePath, original);
      }
    });
  });

  describe('main', () => {
    test('--check returns 0 when docs are fresh', () => {
      const result = genDocs.main(['--check']);
      expect(result).toBe(0);
    });

    test('default mode returns result object', () => {
      const result = genDocs.main([]);
      expect(result).toHaveProperty('changed');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('diffs');
    });

    test('--dry-run does not modify files', () => {
      const readmePath = path.join(REPO_ROOT, 'README.md');
      const before = fs.readFileSync(readmePath, 'utf8');
      genDocs.main(['--dry-run']);
      const after = fs.readFileSync(readmePath, 'utf8');
      expect(before).toBe(after);
    });
  });

  describe('updateSiteContent', () => {
    test('returns content object with correct agent counts', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const agents = discovery.discoverAgents(REPO_ROOT);
      const skills = discovery.discoverSkills(REPO_ROOT);
      const result = genDocs.updateSiteContent(plugins, agents, skills);
      expect(result).not.toBeNull();
      expect(result.agents.total).toBe(agents.length + genDocs.ROLE_BASED_AGENT_COUNT);
      expect(result.agents.file_based).toBe(agents.length);
      expect(result.agents.role_based).toBe(genDocs.ROLE_BASED_AGENT_COUNT);
    });

    test('stats array reflects discovered counts', () => {
      const plugins = discovery.discoverPlugins(REPO_ROOT);
      const agents = discovery.discoverAgents(REPO_ROOT);
      const skills = discovery.discoverSkills(REPO_ROOT);
      const result = genDocs.updateSiteContent(plugins, agents, skills);

      const pluginStat = result.stats.find(s => s.label === 'Plugins');
      const agentStat = result.stats.find(s => s.label === 'Agents');
      const skillStat = result.stats.find(s => s.label === 'Skills');

      expect(pluginStat.value).toBe(String(plugins.length));
      expect(agentStat.value).toBe(String(agents.length + genDocs.ROLE_BASED_AGENT_COUNT));
      expect(skillStat.value).toBe(String(skills.length));
    });
  });
});
