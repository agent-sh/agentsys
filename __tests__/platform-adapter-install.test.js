const fs = require('fs');
const os = require('os');
const path = require('path');

const discovery = require('../lib/discovery');
const transforms = require('../lib/adapter-transforms');
const { installForOpenCode, installForCodex, installForCursor, installForKiro } = require('../bin/cli');

describe('platform adapter installers', () => {
  let tempDir;
  let installDir;
  let originalHome;
  let originalXdgConfigHome;
  let logSpy;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsys-platform-install-'));
    installDir = path.join(tempDir, 'install');
    originalHome = process.env.HOME;
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.HOME = tempDir;
    delete process.env.XDG_CONFIG_HOME;
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
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
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

  // Each platform loads skills from its own skills directory, away from the
  // plugin. `pluginRoot` is how `${CLAUDE_PLUGIN_ROOT}` reads after the
  // platform's transform: OpenCode keeps a `${PLUGIN_ROOT}` placeholder.
  const skillPlatforms = [
    ['OpenCode', installForOpenCode, ['.config', 'opencode', 'skills'], () => '${PLUGIN_ROOT}'],
    ['Codex', installForCodex, ['.codex', 'skills'], (installPath) => installPath],
    ['Cursor', installForCursor, ['.cursor', 'skills'], (installPath) => installPath],
    ['Kiro', installForKiro, ['.kiro', 'skills'], (installPath) => installPath]
  ];

  test.each(skillPlatforms)(
    'installs whole %s skill directories with paths that work outside the plugin',
    (_platform, install, skillsDir, pluginRoot) => {
      const pluginDir = path.join(installDir, 'plugins', 'test-plugin');
      const skillDir = path.join(pluginDir, 'skills', 'test-skill');
      fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
      fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
      fs.mkdirSync(path.join(pluginDir, 'references'), { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
        '---',
        'name: test-skill',
        'description: Test skill',
        '---',
        '`scripts/run.js` is at the plugin root, two directories up from this skill.',
        'Details: [guide](references/guide.md). Shared: [categories](../../references/shared.md#rules).',
        'Docs: [site](https://example.com/x). Outside the plugin: [repo](../../../README.md).',
        'Same text: [../../references/shared.md](../../references/shared.md).',
        ''
      ].join('\n'));
      fs.writeFileSync(
        path.join(skillDir, 'references', 'guide.md'),
        '`<plugin>` is the plugin root, two directories up from the skill. Run ${CLAUDE_PLUGIN_ROOT}/scripts/run.js.\n' +
        'Back: [skill](../SKILL.md), [shared](../../../references/shared.md).\n' +
        'Runner: Glob `**/consult/*/acp/run.js`.\n'
      );
      const binary = Buffer.from([0x23, 0x21, 0x00, 0xff]);
      fs.writeFileSync(path.join(skillDir, 'scripts', 'helper.bin'), binary);
      fs.writeFileSync(path.join(pluginDir, 'references', 'shared.md'), '# Shared\n');

      // A file from an earlier install must not survive a reinstall.
      const destSkill = path.join(tempDir, ...skillsDir, 'test-skill');
      fs.mkdirSync(destSkill, { recursive: true });
      fs.writeFileSync(path.join(destSkill, 'stale.md'), 'old');

      install(installDir);

      const installPath = path.join(installDir, 'plugins', 'test-plugin');
      const skill = fs.readFileSync(path.join(destSkill, 'SKILL.md'), 'utf8');
      const guide = fs.readFileSync(path.join(destSkill, 'references', 'guide.md'), 'utf8');

      expect(skill).toContain('name: test-skill');
      expect(skill).toContain(`is at the plugin root, \`${installPath}\`.`);
      expect(skill).toContain('[guide](references/guide.md)');
      expect(skill).toContain(`[categories](${installPath}/references/shared.md#rules)`);
      expect(skill).toContain('[site](https://example.com/x)');
      expect(skill).toContain('[repo](../../../README.md)');
      expect(skill).toContain(`[${installPath}/references/shared.md](${installPath}/references/shared.md)`);
      expect(guide).toContain(`is the plugin root, \`${installPath}\`.`);
      expect(guide).toContain(`Run ${pluginRoot(installPath)}/scripts/run.js.`);
      expect(guide).toContain('[skill](../SKILL.md)');
      expect(guide).toContain(`[shared](${installPath}/references/shared.md)`);
      expect(guide).toContain('`**/consult/**/acp/run.js`');
      expect(fs.readFileSync(path.join(destSkill, 'scripts', 'helper.bin'))).toEqual(binary);
      expect(fs.existsSync(path.join(destSkill, 'stale.md'))).toBe(false);
    }
  );

  test('keeps Codex command skills over plugin skills of the same name', () => {
    const pluginDir = path.join(installDir, 'plugins', 'test-plugin');
    fs.mkdirSync(path.join(pluginDir, 'skills', 'test-command', 'references'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'skills', 'test-command', 'SKILL.md'),
      '---\nname: test-command\ndescription: Skill behind the command\n---\nSkill body.\n'
    );
    fs.writeFileSync(path.join(pluginDir, 'skills', 'test-command', 'references', 'notes.md'), '# Notes\n');
    fs.mkdirSync(path.join(pluginDir, 'skills', 'no-description'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'skills', 'no-description', 'SKILL.md'),
      '---\nname: no-description\n---\nBody.\n'
    );

    installForCodex(installDir);

    const skillsDir = path.join(tempDir, '.codex', 'skills');
    const command = fs.readFileSync(path.join(skillsDir, 'test-command', 'SKILL.md'), 'utf8');
    expect(command).toContain('name: test-command');
    expect(command).toContain('description: "Test command"');
    expect(command).not.toContain('Skill body.');
    expect(fs.existsSync(path.join(skillsDir, 'test-command', 'references'))).toBe(false);
    expect(fs.existsSync(path.join(skillsDir, 'test-skill', 'SKILL.md'))).toBe(true);
    // Codex needs a description to list a skill.
    expect(fs.existsSync(path.join(skillsDir, 'no-description'))).toBe(false);
  });

  test('installs only the requested skill for a Codex component install', () => {
    installForCodex(installDir, { filter: { agents: [], skills: [], commands: ['test-command'] } });
    expect(fs.existsSync(path.join(tempDir, '.codex', 'skills', 'test-command', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.codex', 'skills', 'test-skill'))).toBe(false);

    installForCodex(installDir, { filter: { agents: [], skills: ['test-skill'], commands: [] } });
    expect(fs.existsSync(path.join(tempDir, '.codex', 'skills', 'test-skill', 'SKILL.md'))).toBe(true);
  });

  test('points Kiro agents and prompts at the install layout instead of the versioned cache', () => {
    const pluginDir = path.join(installDir, 'plugins', 'test-plugin');
    fs.writeFileSync(path.join(pluginDir, 'agents', 'test-agent.md'), [
      '---',
      'name: test-agent',
      'description: Test agent',
      'tools: Read',
      '---',
      'Read `${CLAUDE_PLUGIN_ROOT}/skills/test-skill/SKILL.md`. If it appears unexpanded, Glob for `**/test-plugin/*/skills/test-skill/SKILL.md`.',
      'Find the consult runner with Glob `**/consult/*/acp/run.js`.',
      ''
    ].join('\n'));
    fs.writeFileSync(
      path.join(pluginDir, 'commands', 'test-command.md'),
      '---\ndescription: Test command\n---\n' +
      'Find the runner with `ls ${CLAUDE_PLUGIN_ROOT}/../../consult/*/acp/run.js` (or Glob `**/consult/*/acp/run.js`).\n'
    );

    installForKiro(installDir);

    const installPath = path.join(installDir, 'plugins', 'test-plugin');
    const agent = JSON.parse(
      fs.readFileSync(path.join(tempDir, '.kiro', 'agents', 'test-agent.json'), 'utf8')
    );
    const prompt = fs.readFileSync(path.join(tempDir, '.kiro', 'prompts', 'test-command.md'), 'utf8');

    expect(agent.prompt).toContain(`Read \`${installPath}/skills/test-skill/SKILL.md\``);
    expect(agent.prompt).toContain('`**/test-plugin/**/skills/test-skill/SKILL.md`');
    expect(agent.prompt).toContain('`**/consult/**/acp/run.js`');
    expect(prompt).toContain(`\`ls ${path.join(installDir, 'plugins')}/consult/acp/run.js\``);
    expect(prompt).toContain('`**/consult/**/acp/run.js`');
    expect(prompt).not.toContain('/*/');
  });

  test('points OpenCode, Codex and Cursor commands at the install layout instead of the versioned cache', () => {
    const pluginDir = path.join(installDir, 'plugins', 'test-plugin');
    fs.writeFileSync(
      path.join(pluginDir, 'commands', 'test-command.md'),
      '---\ndescription: Test command\n---\n' +
      'Find the runner with `ls ${CLAUDE_PLUGIN_ROOT}/../../consult/*/acp/run.js` (or Glob `**/consult/*/acp/run.js`).\n'
    );
    fs.writeFileSync(path.join(pluginDir, 'agents', 'test-agent.md'), [
      '---',
      'name: test-agent',
      'description: Test agent',
      'tools: Read',
      '---',
      'If `${CLAUDE_PLUGIN_ROOT}` appears unexpanded, Glob for `**/test-plugin/*/skills/test-skill/SKILL.md`.',
      ''
    ].join('\n'));

    installForOpenCode(installDir);
    installForCodex(installDir);
    installForCursor(installDir);

    const pluginsDir = path.join(installDir, 'plugins');
    const codex = fs.readFileSync(path.join(tempDir, '.codex', 'skills', 'test-command', 'SKILL.md'), 'utf8');
    const cursor = fs.readFileSync(path.join(tempDir, '.cursor', 'commands', 'test-command.md'), 'utf8');
    for (const command of [codex, cursor]) {
      expect(command).toContain(`\`ls ${pluginsDir}/consult/acp/run.js\``);
      expect(command).toContain('`**/consult/**/acp/run.js`');
      expect(command).not.toContain('/*/');
    }

    // OpenCode keeps a ${PLUGIN_ROOT} placeholder, so only the globs change.
    const opencodeDir = path.join(tempDir, '.config', 'opencode');
    const command = fs.readFileSync(path.join(opencodeDir, 'commands', 'test-command.md'), 'utf8');
    const agent = fs.readFileSync(path.join(opencodeDir, 'agents', 'test-agent.md'), 'utf8');
    expect(command).toContain('`**/consult/**/acp/run.js`');
    expect(agent).toContain('`**/test-plugin/**/skills/test-skill/SKILL.md`');
  });
});
