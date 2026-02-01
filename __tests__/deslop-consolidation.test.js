/**
 * Tests for deslop consolidation
 * Verifies unified agent/skill structure and cross-plugin integration
 */

const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, '..', 'plugins');
const deslopDir = path.join(pluginsDir, 'deslop');
const nextTaskDir = path.join(pluginsDir, 'next-task');

describe('deslop consolidation', () => {
  describe('unified skill structure', () => {
    const skillPath = path.join(deslopDir, 'skills', 'deslop', 'SKILL.md');
    let skillContent;

    beforeAll(() => {
      skillContent = fs.readFileSync(skillPath, 'utf8');
    });

    test('skill file exists', () => {
      expect(fs.existsSync(skillPath)).toBe(true);
    });

    test('has valid frontmatter', () => {
      expect(skillContent.startsWith('---')).toBe(true);
      expect(skillContent).toContain('name: deslop');
      expect(skillContent).toContain('description:');
      expect(skillContent).toContain('argument-hint:');
    });

    test('supports report and apply modes', () => {
      expect(skillContent).toContain('report');
      expect(skillContent).toContain('apply');
    });

    test('supports scope options (all, diff, path)', () => {
      expect(skillContent).toContain('all');
      expect(skillContent).toContain('diff');
      expect(skillContent).toMatch(/scope/i);
    });

    test('supports thoroughness levels', () => {
      expect(skillContent).toContain('quick');
      expect(skillContent).toContain('normal');
      expect(skillContent).toContain('deep');
    });

    test('documents certainty levels', () => {
      expect(skillContent).toContain('HIGH');
      expect(skillContent).toContain('MEDIUM');
      expect(skillContent).toContain('LOW');
    });

    test('documents output format with markers', () => {
      expect(skillContent).toContain('DESLOP_RESULT');
      expect(skillContent).toContain('END_RESULT');
    });

    test('documents repo-map integration', () => {
      expect(skillContent).toContain('repo-map');
      expect(skillContent).toMatch(/orphan|unused/i);
    });
  });

  describe('unified agent structure', () => {
    const agentPath = path.join(deslopDir, 'agents', 'deslop-agent.md');
    let agentContent;

    beforeAll(() => {
      agentContent = fs.readFileSync(agentPath, 'utf8');
    });

    test('agent file exists', () => {
      expect(fs.existsSync(agentPath)).toBe(true);
    });

    test('has valid frontmatter', () => {
      expect(agentContent.startsWith('---')).toBe(true);
      expect(agentContent).toContain('name: deslop-agent');
      expect(agentContent).toContain('model:');
      expect(agentContent).toContain('tools:');
    });

    test('uses sonnet model', () => {
      expect(agentContent).toContain('model: sonnet');
    });

    test('has required tools', () => {
      expect(agentContent).toContain('Bash');
      expect(agentContent).toContain('Skill');
      expect(agentContent).toContain('Read');
    });

    test('invokes deslop skill', () => {
      expect(agentContent).toMatch(/Skill.*deslop/i);
    });

    test('returns structured output with markers', () => {
      expect(agentContent).toContain('DESLOP_RESULT');
      expect(agentContent).toContain('END_RESULT');
    });

    test('supports diff scope for next-task integration', () => {
      expect(agentContent).toContain('diff');
    });
  });

  describe('command structure', () => {
    const cmdPath = path.join(deslopDir, 'commands', 'deslop.md');
    let cmdContent;

    beforeAll(() => {
      cmdContent = fs.readFileSync(cmdPath, 'utf8');
    });

    test('spawns deslop-agent', () => {
      expect(cmdContent).toContain('deslop:deslop-agent');
    });

    test('spawns simple-fixer for apply mode', () => {
      expect(cmdContent).toContain('simple-fixer');
    });

    test('parses agent results', () => {
      expect(cmdContent).toContain('parseDeslop');
    });
  });

  describe('plugin.json consistency', () => {
    const pluginJsonPath = path.join(deslopDir, '.claude-plugin', 'plugin.json');
    let pluginJson;

    beforeAll(() => {
      pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    });

    test('has exactly 1 agent', () => {
      expect(pluginJson.agents.length).toBe(1);
    });

    test('has exactly 1 skill', () => {
      expect(pluginJson.skills.length).toBe(1);
    });

    test('references deslop-agent.md', () => {
      expect(pluginJson.agents).toContain('agents/deslop-agent.md');
    });

    test('references deslop skill', () => {
      expect(pluginJson.skills).toContain('skills/deslop/SKILL.md');
    });

    test('referenced agent exists', () => {
      const agentPath = path.join(deslopDir, pluginJson.agents[0]);
      expect(fs.existsSync(agentPath)).toBe(true);
    });

    test('referenced skill exists', () => {
      const skillPath = path.join(deslopDir, pluginJson.skills[0]);
      expect(fs.existsSync(skillPath)).toBe(true);
    });
  });

  describe('old files removed', () => {
    test('deslop-analyzer.md removed', () => {
      const oldAgentPath = path.join(deslopDir, 'agents', 'deslop-analyzer.md');
      expect(fs.existsSync(oldAgentPath)).toBe(false);
    });

    test('deslop-detection skill removed', () => {
      const oldSkillPath = path.join(deslopDir, 'skills', 'deslop-detection');
      expect(fs.existsSync(oldSkillPath)).toBe(false);
    });

    test('deslop-fixes skill removed', () => {
      const oldSkillPath = path.join(deslopDir, 'skills', 'deslop-fixes');
      expect(fs.existsSync(oldSkillPath)).toBe(false);
    });

    test('deslop-work agent removed from next-task', () => {
      const oldAgentPath = path.join(nextTaskDir, 'agents', 'deslop-work.md');
      expect(fs.existsSync(oldAgentPath)).toBe(false);
    });
  });

  describe('next-task cross-plugin integration', () => {
    const nextTaskCmdPath = path.join(nextTaskDir, 'commands', 'next-task.md');
    let nextTaskContent;

    beforeAll(() => {
      nextTaskContent = fs.readFileSync(nextTaskCmdPath, 'utf8');
    });

    test('Phase 8 uses deslop:deslop-agent', () => {
      expect(nextTaskContent).toContain('deslop:deslop-agent');
    });

    test('Phase 8 uses scope=diff', () => {
      expect(nextTaskContent).toMatch(/scope.*diff/i);
    });

    test('Phase 8 parses deslop results', () => {
      expect(nextTaskContent).toContain('parseDeslop');
    });

    test('Phase 8 spawns simple-fixer for fixes', () => {
      expect(nextTaskContent).toContain('simple-fixer');
    });

    test('does not reference old deslop-work agent', () => {
      expect(nextTaskContent).not.toContain('next-task:deslop-work');
    });

    test('workflow gates mention deslop-agent', () => {
      expect(nextTaskContent).toContain('deslop-agent');
    });
  });

  describe('detection script intact', () => {
    const detectScript = path.join(deslopDir, 'scripts', 'detect.js');

    test('detect.js exists', () => {
      expect(fs.existsSync(detectScript)).toBe(true);
    });

    test('detect.js is valid JavaScript syntax', () => {
      // Use vm.Script for syntax-only check (avoids executing main())
      const vm = require('vm');
      const code = fs.readFileSync(detectScript, 'utf8');
      expect(() => {
        new vm.Script(code, { filename: detectScript });
      }).not.toThrow();
    });
  });
});
