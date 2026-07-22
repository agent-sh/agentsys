const fs = require('fs');
const os = require('os');
const path = require('path');

const discovery = require('../lib/discovery');
const transforms = require('../lib/adapter-transforms');
const { installForCursor, installForKiro } = require('../bin/cli');

describe('Cursor and Kiro adapter installers', () => {
  let tempDir;
  let installDir;
  let originalHome;
  let logSpy;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsys-platform-install-'));
    installDir = path.join(tempDir, 'install');
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const pluginDir = path.join(installDir, 'plugins', 'test-plugin');
    fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'commands'), { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'skills', 'test-skill'), { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'agents'), { recursive: true });

    fs.writeFileSync(
      path.join(pluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'test-plugin', version: '1.0.0' })
    );
    fs.writeFileSync(
      path.join(pluginDir, 'commands', 'test-command.md'),
      '---\ndescription: Test command\n---\nRun ${CLAUDE_PLUGIN_ROOT}/scripts/test.js\n'
    );
    fs.writeFileSync(
      path.join(pluginDir, 'skills', 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test skill\n---\nUse ${CLAUDE_PLUGIN_ROOT}/lib/test.js\n'
    );
    fs.writeFileSync(
      path.join(pluginDir, 'agents', 'test-agent.md'),
      '---\nname: test-agent\ndescription: Test agent\ntools: Read, Write\n---\nReview the repository.\n'
    );

    discovery.invalidateCache();
  });

  afterEach(() => {
    discovery.invalidateCache();
    logSpy.mockRestore();
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('exports every adapter API used by the CLI', () => {
    for (const name of ['getCursorRuleMappings', 'getKiroSteeringMappings']) {
      expect(discovery[name]).toEqual(expect.any(Function));
    }

    for (const name of [
      'transformRuleForCursor',
      'transformSkillForCursor',
      'transformCommandForCursor',
      'transformSkillForKiro',
      'transformCommandForKiro',
      'transformAgentForKiro',
      'generateCombinedReviewerAgent'
    ]) {
      expect(transforms[name]).toEqual(expect.any(Function));
    }
  });

  test('installs Cursor commands and skills into an isolated home', () => {
    expect(() => installForCursor(installDir)).not.toThrow();

    const command = fs.readFileSync(
      path.join(tempDir, '.cursor', 'commands', 'test-command.md'),
      'utf8'
    );
    const skill = fs.readFileSync(
      path.join(tempDir, '.cursor', 'skills', 'test-skill', 'SKILL.md'),
      'utf8'
    );

    expect(command).not.toContain('${CLAUDE_PLUGIN_ROOT}');
    expect(skill).not.toContain('${CLAUDE_PLUGIN_ROOT}');
  });

  test('installs Kiro prompts, skills, and agents into an isolated home', () => {
    expect(() => installForKiro(installDir)).not.toThrow();

    const prompt = fs.readFileSync(
      path.join(tempDir, '.kiro', 'prompts', 'test-command.md'),
      'utf8'
    );
    const skill = fs.readFileSync(
      path.join(tempDir, '.kiro', 'skills', 'test-skill', 'SKILL.md'),
      'utf8'
    );
    const agent = JSON.parse(
      fs.readFileSync(path.join(tempDir, '.kiro', 'agents', 'test-agent.json'), 'utf8')
    );

    expect(prompt).toContain('inclusion: manual');
    expect(prompt).not.toContain('${CLAUDE_PLUGIN_ROOT}');
    expect(skill).not.toContain('${CLAUDE_PLUGIN_ROOT}');
    expect(agent).toMatchObject({
      name: 'test-agent',
      description: 'Test agent',
      tools: ['read', 'write']
    });
  });
});
