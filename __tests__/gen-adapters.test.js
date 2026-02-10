const path = require('path');
const fs = require('fs');
const discovery = require('../lib/discovery');
const transforms = require('../lib/adapter-transforms');
const genAdapters = require('../scripts/gen-adapters');

const REPO_ROOT = path.join(__dirname, '..');

beforeEach(() => {
  discovery.invalidateCache();
});

// ---------------------------------------------------------------------------
// Unit tests for transform functions
// ---------------------------------------------------------------------------

describe('adapter-transforms', () => {
  describe('transformBodyForOpenCode', () => {
    test('replaces CLAUDE_PLUGIN_ROOT with PLUGIN_ROOT', () => {
      const input = 'path: ${CLAUDE_PLUGIN_ROOT}/lib and $CLAUDE_PLUGIN_ROOT/scripts';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('${PLUGIN_ROOT}/lib');
      expect(result).toContain('$PLUGIN_ROOT/scripts');
      expect(result).not.toContain('CLAUDE_PLUGIN_ROOT');
    });

    test('replaces .claude/ references with .opencode/', () => {
      const input = 'state in .claude/ and ".claude" and \'.claude\' and `.claude`';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('.opencode/');
      expect(result).toContain('.opencode"');
      expect(result).toContain(".opencode'");
      expect(result).toContain('.opencode`');
    });

    test('strips plugin prefixes from agent references', () => {
      const input = '`next-task:exploration-agent` and next-task:planning-agent';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('`exploration-agent`');
      expect(result).toContain('planning-agent');
      expect(result).not.toContain('next-task:');
    });

    test('keeps bash code blocks intact', () => {
      const input = '```bash\ngit status\ngh pr list\n```';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('```bash\ngit status\ngh pr list\n```');
    });

    test('transforms JS code blocks with Task calls', () => {
      const input = '```javascript\nawait Task({ subagent_type: "next-task:exploration-agent" })\n```';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('@exploration-agent');
      expect(result).not.toContain('```javascript');
    });

    test('marks JS-only code blocks as reference', () => {
      const input = '```javascript\nconst x = require("./foo");\nfunction bar() {}\n```';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('not executable in OpenCode');
    });

    test('transforms multiple Task() calls in one code block', () => {
      const input = '```javascript\nawait Task({ subagent_type: "next-task:exploration-agent" });\nawait Task({ subagent_type: "next-task:planning-agent" });\n```';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('@exploration-agent');
      expect(result).toContain('@planning-agent');
    });

    test('extracts startPhase calls from code blocks', () => {
      const input = '```javascript\nworkflowState.startPhase(\'exploration\');\n```';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('exploration');
    });

    test('removes standalone require statements', () => {
      const input = 'const foo = require("bar");\nlet { baz } = require("qux");';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).not.toContain('require(');
    });

    test('replaces bash code blocks containing node -e with require', () => {
      const input = '```bash\nnode -e "const x = require(\'foo\'); x.run()"\n```';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('adapt for OpenCode');
    });

    test('injects OpenCode agent note for agent-heavy content', () => {
      const input = '---\ndescription: test\n---\nUse the agent to do work';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('OpenCode Note');
      expect(result).toContain('@agent-name');
    });

    test('does not inject OpenCode note when no agent references', () => {
      const input = '---\ndescription: test\n---\nJust plain content here';
      const result = transforms.transformBodyForOpenCode(input, REPO_ROOT);
      expect(result).not.toContain('OpenCode Note');
    });
  });

  describe('transformCommandFrontmatterForOpenCode', () => {
    test('keeps description and adds agent: general', () => {
      const input = '---\ndescription: Test command\nargument-hint: "[path]"\nallowed-tools: Task, Read\ncodex-description: "test"\n---\nbody';
      const result = transforms.transformCommandFrontmatterForOpenCode(input);
      expect(result).toContain('description: Test command');
      expect(result).toContain('agent: general');
      expect(result).not.toContain('argument-hint');
      expect(result).not.toContain('allowed-tools');
      expect(result).not.toContain('codex-description');
    });

    test('produces valid frontmatter with delimiters', () => {
      const input = '---\ndescription: Foo\n---\nbody';
      const result = transforms.transformCommandFrontmatterForOpenCode(input);
      expect(result).toMatch(/^---\n/);
      expect(result).toMatch(/---\nbody$/);
    });
  });

  describe('transformAgentFrontmatterForOpenCode', () => {
    test('maps name, description, and mode: subagent', () => {
      const input = '---\nname: test-agent\ndescription: A test agent\nmodel: sonnet\ntools: Bash(git:*), Read, Glob, Grep\n---\nbody';
      const result = transforms.transformAgentFrontmatterForOpenCode(input);
      expect(result).toContain('name: test-agent');
      expect(result).toContain('description: A test agent');
      expect(result).toContain('mode: subagent');
    });

    test('strips model by default', () => {
      const input = '---\nname: test\nmodel: opus\n---\nbody';
      const result = transforms.transformAgentFrontmatterForOpenCode(input);
      expect(result).not.toContain('model:');
    });

    test('includes model when stripModels is false', () => {
      const input = '---\nname: test\nmodel: opus\n---\nbody';
      const result = transforms.transformAgentFrontmatterForOpenCode(input, { stripModels: false });
      expect(result).toContain('model: anthropic/claude-opus-4');
    });

    test('maps sonnet model correctly', () => {
      const input = '---\nname: test\nmodel: sonnet\n---\nbody';
      const result = transforms.transformAgentFrontmatterForOpenCode(input, { stripModels: false });
      expect(result).toContain('model: anthropic/claude-sonnet-4');
    });

    test('maps haiku model correctly', () => {
      const input = '---\nname: test\nmodel: haiku\n---\nbody';
      const result = transforms.transformAgentFrontmatterForOpenCode(input, { stripModels: false });
      expect(result).toContain('model: anthropic/claude-haiku-3-5');
    });

    test('converts tools to permission block', () => {
      const input = '---\nname: test\ntools: Bash(git:*), Read, Write, Glob, Grep\n---\nbody';
      const result = transforms.transformAgentFrontmatterForOpenCode(input);
      expect(result).toContain('permission:');
      expect(result).toContain('read: allow');
      expect(result).toContain('edit: allow');
      expect(result).toContain('bash: allow');
      expect(result).toContain('glob: allow');
      expect(result).toContain('grep: allow');
    });

    test('sets deny for missing tools', () => {
      const input = '---\nname: test\ntools: Read\n---\nbody';
      const result = transforms.transformAgentFrontmatterForOpenCode(input);
      expect(result).toContain('read: allow');
      expect(result).toContain('edit: deny');
      expect(result).toContain('bash: ask');
      expect(result).toContain('glob: deny');
      expect(result).toContain('grep: deny');
    });

    test('handles agent with no tools field', () => {
      const input = '---\nname: simple-agent\ndescription: A simple agent\nmodel: sonnet\n---\nBody content';
      const result = transforms.transformAgentFrontmatterForOpenCode(input, { stripModels: true });
      expect(result).toContain('name: simple-agent');
      expect(result).toContain('mode: subagent');
      expect(result).not.toContain('permission');
    });

    test('unknown model name falls through unmapped', () => {
      const input = '---\nname: test-agent\ndescription: Test\nmodel: gpt-4\ntools:\n  - Read\n---\nBody';
      const result = transforms.transformAgentFrontmatterForOpenCode(input, { stripModels: false });
      expect(result).toContain('model: gpt-4');
    });
  });

  describe('transformSkillBodyForOpenCode', () => {
    test('delegates to body transform', () => {
      const input = 'Use ${CLAUDE_PLUGIN_ROOT}/skills and .claude/ dir';
      const result = transforms.transformSkillBodyForOpenCode(input, REPO_ROOT);
      expect(result).toContain('${PLUGIN_ROOT}/skills');
      expect(result).toContain('.opencode/');
    });
  });

  describe('transformForCodex', () => {
    test('replaces frontmatter with name and description', () => {
      const input = '---\ndescription: original\nargument-hint: "[path]"\n---\nbody content';
      const result = transforms.transformForCodex(input, {
        skillName: 'test-skill',
        description: 'A test skill',
        pluginInstallPath: '/usr/local/plugins/test'
      });
      expect(result).toContain('name: test-skill');
      expect(result).toContain('description: "A test skill"');
      expect(result).not.toContain('argument-hint');
    });

    test('escapes quotes in description', () => {
      const input = '---\ndescription: x\n---\nbody';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'Use when user says "hello"',
        pluginInstallPath: '/tmp'
      });
      expect(result).toContain('description: "Use when user says \\"hello\\""');
    });

    test('replaces PLUGIN_ROOT with install path', () => {
      const input = '---\ndescription: x\n---\nPath: ${CLAUDE_PLUGIN_ROOT}/lib and $PLUGIN_ROOT/scripts';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'test',
        pluginInstallPath: '/home/user/.awesome-slash/plugins/test'
      });
      expect(result).toContain('/home/user/.awesome-slash/plugins/test/lib');
      expect(result).toContain('/home/user/.awesome-slash/plugins/test/scripts');
    });

    test('adds frontmatter to files without it', () => {
      const input = '# No frontmatter\nBody content';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'test desc',
        pluginInstallPath: '/tmp'
      });
      expect(result).toMatch(/^---\nname: test\n/);
      expect(result).toContain('# No frontmatter');
    });
  });
});

// ---------------------------------------------------------------------------
// Integration tests for generation script
// ---------------------------------------------------------------------------

describe('gen-adapters', () => {
  describe('computeAdapters', () => {
    test('returns a files map with expected adapter paths', () => {
      const { files } = genAdapters.computeAdapters();
      expect(files).toBeInstanceOf(Map);
      expect(files.size).toBeGreaterThan(0);

      // Should have OpenCode commands
      const commandPaths = [...files.keys()].filter(p => p.startsWith('adapters/opencode/commands/'));
      expect(commandPaths.length).toBeGreaterThan(0);

      // Should have OpenCode agents
      const agentPaths = [...files.keys()].filter(p => p.startsWith('adapters/opencode/agents/'));
      expect(agentPaths.length).toBeGreaterThan(0);

      // Should have Codex skills
      const codexPaths = [...files.keys()].filter(p => p.startsWith('adapters/codex/skills/'));
      expect(codexPaths.length).toBeGreaterThan(0);
    });

    test('generates files with auto-generated header', () => {
      const { files } = genAdapters.computeAdapters();
      for (const [, content] of files) {
        expect(content).toContain('AUTO-GENERATED');
        expect(content).toContain('DO NOT EDIT');
      }
    });

    test('OpenCode command files with frontmatter have correct format', () => {
      const { files } = genAdapters.computeAdapters();
      const cmdPaths = [...files.keys()].filter(p => p.startsWith('adapters/opencode/commands/'));
      // Only check files that have frontmatter (some supplementary .md files lack it)
      let checkedCount = 0;
      for (const cmdPath of cmdPaths) {
        const content = files.get(cmdPath);
        if (content.includes('---\n')) {
          // Files with frontmatter should have the OpenCode format
          const afterHeader = content.replace(/^<!-- AUTO-GENERATED[^\n]*\n/, '');
          if (afterHeader.startsWith('---\n')) {
            expect(content).toContain('agent: general');
            expect(content).not.toContain('argument-hint');
            expect(content).not.toContain('codex-description');
            checkedCount++;
          }
        }
      }
      // Ensure we actually checked some files
      expect(checkedCount).toBeGreaterThan(0);
    });

    test('OpenCode agent files have mode: subagent', () => {
      const { files } = genAdapters.computeAdapters();
      const agentPaths = [...files.keys()].filter(p => p.startsWith('adapters/opencode/agents/'));
      for (const agentPath of agentPaths) {
        const content = files.get(agentPath);
        expect(content).toContain('mode: subagent');
        // Models should be stripped by default
        expect(content).not.toMatch(/^model:/m);
      }
    });

    test('Codex skill files use placeholder path', () => {
      const { files } = genAdapters.computeAdapters();
      const codexPaths = [...files.keys()].filter(p => p.startsWith('adapters/codex/skills/'));
      for (const codexPath of codexPaths) {
        const content = files.get(codexPath);
        // Should NOT contain literal CLAUDE_PLUGIN_ROOT or PLUGIN_ROOT variables
        expect(content).not.toContain('${CLAUDE_PLUGIN_ROOT}');
        expect(content).not.toContain('$CLAUDE_PLUGIN_ROOT');
      }
    });

    test('does not generate adapters/opencode-plugin files', () => {
      const { files } = genAdapters.computeAdapters();
      const pluginPaths = [...files.keys()].filter(p => p.startsWith('adapters/opencode-plugin/'));
      expect(pluginPaths).toHaveLength(0);
    });

    test('OpenCode skills have SKILL.md files', () => {
      const { files } = genAdapters.computeAdapters();
      const skillPaths = [...files.keys()].filter(p => p.startsWith('adapters/opencode/skills/'));
      expect(skillPaths.length).toBeGreaterThan(0);
      for (const p of skillPaths) {
        expect(p).toMatch(/SKILL\.md$/);
      }
    });

    test('generates correct number of commands matching discovery', () => {
      const { files } = genAdapters.computeAdapters();
      const commands = discovery.discoverCommands(REPO_ROOT);
      const cmdPaths = [...files.keys()].filter(p => p.startsWith('adapters/opencode/commands/'));
      expect(cmdPaths.length).toBe(commands.length);
    });

    test('generates correct number of agents matching discovery', () => {
      const { files } = genAdapters.computeAdapters();
      const agents = discovery.discoverAgents(REPO_ROOT);
      const agentPaths = [...files.keys()].filter(p => p.startsWith('adapters/opencode/agents/'));
      expect(agentPaths.length).toBe(agents.length);
    });

    test('detects orphaned files not in generated set', () => {
      const { files, orphanedFiles } = genAdapters.computeAdapters();
      expect(orphanedFiles).toBeDefined();
      expect(Array.isArray(orphanedFiles)).toBe(true);
      // All orphaned files should be .md files in adapters/opencode or adapters/codex
      for (const orphan of orphanedFiles) {
        expect(orphan).toMatch(/^adapters\/(opencode|codex)\/.+\.md$/);
        expect(files.has(orphan)).toBe(false);
      }
    });

    test('findOrphanedAdapters returns empty array when all files are generated', () => {
      // First generate to ensure consistency
      genAdapters.main([]);
      const { files } = genAdapters.computeAdapters();
      const orphans = genAdapters.findOrphanedAdapters(files);
      expect(orphans).toEqual([]);
    });

    test('findOrphanedAdapters detects files not in generated map', () => {
      const fakeMap = new Map();
      fakeMap.set('adapters/opencode/commands/test.md', 'content');
      const orphans = genAdapters.findOrphanedAdapters(fakeMap);
      // Should find many orphans since we only included one file
      expect(orphans.length).toBeGreaterThan(0);
      // None of the orphans should be in the fake map
      for (const orphan of orphans) {
        expect(fakeMap.has(orphan)).toBe(false);
      }
    });
  });

  describe('checkFreshness', () => {
    test('returns a result object with status and staleFiles', () => {
      const result = genAdapters.checkFreshness();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('staleFiles');
      expect(result).toHaveProperty('orphanedFiles');
      expect(Array.isArray(result.staleFiles)).toBe(true);
      expect(Array.isArray(result.orphanedFiles)).toBe(true);
    });
  });

  describe('main', () => {
    test('--check mode returns a number (exit code)', () => {
      const result = genAdapters.main(['--check']);
      expect(typeof result).toBe('number');
    });

    test('--check returns 0 when adapters are fresh', () => {
      // First generate to ensure fresh state
      genAdapters.main([]);
      const result = genAdapters.main(['--check']);
      expect(result).toBe(0);
    });

    test('--dry-run mode returns result object without writing', () => {
      const result = genAdapters.main(['--dry-run']);
      expect(result).toHaveProperty('changed');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('deleted');
      expect(typeof result.changed).toBe('boolean');
      expect(Array.isArray(result.deleted)).toBe(true);
    });
  });
});
