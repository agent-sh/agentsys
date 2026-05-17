const fs = require('fs');
const os = require('os');
const path = require('path');

const { analyzeHook, analyzeAllHooks } = require('../lib/enhance/hook-analyzer');
const { analyzeSkill, analyzeAllSkills } = require('../lib/enhance/skill-analyzer');

describe('enhance hook/skill analyzers', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enhance-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('analyzeHook detects missing frontmatter', () => {
    const hookPath = path.join(tempDir, 'hooks');
    fs.mkdirSync(hookPath, { recursive: true });
    const filePath = path.join(hookPath, 'pre-commit.md');
    fs.writeFileSync(filePath, '# Hook\n\nNo frontmatter.');

    const result = analyzeHook(filePath);
    expect(result.structureIssues.length).toBeGreaterThanOrEqual(1);
    expect(result.structureIssues.some(issue => /Missing YAML frontmatter/i.test(issue.issue))).toBe(true);
  });

  test('analyzeAllHooks scans nested hooks directories', () => {
    const hookA = path.join(tempDir, 'plugins', 'alpha', 'hooks');
    const hookB = path.join(tempDir, 'tools', 'hooks');
    fs.mkdirSync(hookA, { recursive: true });
    fs.mkdirSync(hookB, { recursive: true });
    fs.writeFileSync(path.join(hookA, 'a.md'), '---\nname: a\ndescription: test\n---\n');
    fs.writeFileSync(path.join(hookB, 'b.md'), '---\nname: b\ndescription: test\n---\n');

    const results = analyzeAllHooks(tempDir);
    expect(results.length).toBe(2);
  });

  test('analyzeSkill detects missing trigger phrase', () => {
    const skillDir = path.join(tempDir, 'skills', 'example');
    fs.mkdirSync(skillDir, { recursive: true });
    const filePath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(filePath, '---\nname: example\ndescription: Helpful skill.\n---\n');

    const result = analyzeSkill(filePath);
    expect(result.triggerIssues.length).toBe(1);
    expect(result.triggerIssues[0].issue).toMatch(/trigger phrase/i);
  });

  test('analyzeSkill accepts string true for disable-model-invocation', () => {
    const skillDir = path.join(tempDir, 'skills', 'publisher');
    fs.mkdirSync(skillDir, { recursive: true });
    const filePath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(filePath, [
      '---',
      'name: publisher',
      'description: Use when user asks to publish release notes.',
      'disable-model-invocation: true',
      '---',
      '',
      'Publish the release notes when explicitly invoked.'
    ].join('\n'));

    const result = analyzeSkill(filePath);
    expect(result.structureIssues.some(issue => issue.patternId === 'side_effect_without_disable')).toBe(false);
  });

  test('analyzeAllSkills finds nested SKILL.md files', () => {
    const skillA = path.join(tempDir, 'skills', 'alpha');
    const skillB = path.join(tempDir, 'plugins', 'beta', 'skills', 'beta-skill');
    fs.mkdirSync(skillA, { recursive: true });
    fs.mkdirSync(skillB, { recursive: true });
    fs.writeFileSync(path.join(skillA, 'SKILL.md'), '---\nname: alpha\ndescription: Use when user asks about alpha.\n---\n');
    fs.writeFileSync(path.join(skillB, 'SKILL.md'), '---\nname: beta\ndescription: Use when user asks about beta.\n---\n');

    const results = analyzeAllSkills(tempDir);
    expect(results.length).toBe(2);
  });
});
