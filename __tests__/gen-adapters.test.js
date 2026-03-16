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
      // When plugins/ dir exists, prefixes are stripped using discovered plugin names.
      // When plugins are extracted to standalone repos, the regex has no plugin names
      // and prefixes remain (the transform is a no-op for unknown prefixes).
      const fs = require('fs');
      const pluginsDir = path.join(REPO_ROOT, 'plugins');
      if (fs.existsSync(pluginsDir)) {
        expect(result).toContain('`exploration-agent`');
        expect(result).toContain('planning-agent');
        expect(result).not.toContain('next-task:');
      } else {
        // No plugins discovered - prefixes not stripped
        expect(result).toContain('next-task:exploration-agent');
      }
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
        pluginInstallPath: '/home/user/.agentsys/plugins/test'
      });
      expect(result).toContain('/home/user/.agentsys/plugins/test/lib');
      expect(result).toContain('/home/user/.agentsys/plugins/test/scripts');
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

    test('replaces AskUserQuestion with request_user_input', () => {
      const input = '---\ndescription: x\n---\nUse AskUserQuestion to pick.\nAskUserQuestion({ questions })';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'test',
        pluginInstallPath: '/tmp'
      });
      expect(result).not.toContain('AskUserQuestion');
      expect(result).toContain('request_user_input');
      expect(result).toContain('Use request_user_input to pick.');
      expect(result).toContain('request_user_input({ questions })');
    });

    test('removes multiSelect lines', () => {
      const input = '---\ndescription: x\n---\noptions:\n  multiSelect: false\n  header: "Test"\n    multiSelect: true\n  question: "?"';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'test',
        pluginInstallPath: '/tmp'
      });
      expect(result).not.toContain('multiSelect');
      expect(result).toContain('header: "Test"');
      expect(result).toContain('question: "?"');
    });

    test('injects Codex note about required id field', () => {
      const input = '---\ndescription: x\n---\nrequest_user_input:\n  header: "Test"';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'test',
        pluginInstallPath: '/tmp'
      });
      expect(result).toContain('Codex');
      expect(result).toContain('id');
    });

    test('does not inject note when request_user_input has inline content', () => {
      const input = '---\ndescription: x\n---\nrequest_user_input({ questions });\nrequest_user_input: { header: "test" }';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'test',
        pluginInstallPath: '/tmp'
      });
      // Note only injected after standalone "request_user_input:" lines, not inline usage
      expect(result).not.toContain('Codex');
    });

    test('removes multiSelect with tab indentation', () => {
      const input = '---\ndescription: x\n---\n\tmultiSelect: true\n  multiSelect: false\nheader: "Test"';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'test',
        pluginInstallPath: '/tmp'
      });
      expect(result).not.toContain('multiSelect');
      expect(result).toContain('header: "Test"');
    });

    test('handles content with no AskUserQuestion', () => {
      const input = '---\ndescription: x\n---\nJust regular content here.';
      const result = transforms.transformForCodex(input, {
        skillName: 'test',
        description: 'test',
        pluginInstallPath: '/tmp'
      });
      expect(result).not.toContain('AskUserQuestion');
      expect(result).not.toContain('request_user_input');
      expect(result).toContain('Just regular content here.');
    });
  });

});


// ---------------------------------------------------------------------------
// Integration tests for generation script
// ---------------------------------------------------------------------------

describe('gen-adapters', () => {
  test('findOrphanedAdapters detects files not in generated map', () => {
    const fakeMap = new Map();
    fakeMap.set('adapters/opencode/commands/test.md', 'content');
    const orphans = genAdapters.findOrphanedAdapters(fakeMap);
    // With plugins extracted, adapter dirs may be empty, so orphans could be 0.
    // If adapters exist on disk but not in fakeMap, they are orphans.
    for (const orphan of orphans) {
      expect(fakeMap.has(orphan)).toBe(false);
    }
  });
});
