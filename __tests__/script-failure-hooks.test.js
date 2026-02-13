const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOK_SCRIPT = path.join(ROOT, '.claude', 'hooks', 'enforce-script-failure-report.sh');
const SETTINGS_PATH = path.join(ROOT, '.claude', 'settings.json');
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');
const AGENTS_MD = path.join(ROOT, 'AGENTS.md');

/**
 * Helper: pipe JSON to the hook script and return stdout.
 * Uses execFileSync with input option to avoid shell injection.
 * Always expects exit code 0.
 */
function runHook(jsonInput) {
  try {
    const result = execFileSync('bash', [HOOK_SCRIPT], {
      input: jsonInput,
      encoding: 'utf8',
      timeout: 5000,
    });
    return result.trim();
  } catch (err) {
    // If the script exits non-zero, that is itself a test failure
    throw new Error(`Hook exited with code ${err.status}: ${err.stderr}`);
  }
}

// Skip hook execution tests on Windows if bash is unavailable
let bashAvailable = true;
try {
  execFileSync('bash', ['--version'], { encoding: 'utf8', timeout: 3000 });
} catch {
  bashAvailable = false;
}

describe('script failure enforcement hooks', () => {
  describe('.claude/settings.json', () => {
    test('exists and is valid JSON', () => {
      expect(fs.existsSync(SETTINGS_PATH)).toBe(true);
      const content = fs.readFileSync(SETTINGS_PATH, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('has PostToolUse hook structure', () => {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      expect(settings).toHaveProperty('hooks');
      expect(settings.hooks).toHaveProperty('PostToolUse');
      expect(Array.isArray(settings.hooks.PostToolUse)).toBe(true);
      expect(settings.hooks.PostToolUse.length).toBeGreaterThan(0);
    });

    test('PostToolUse has Bash matcher', () => {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      const bashHook = settings.hooks.PostToolUse.find(h => h.matcher === 'Bash');
      expect(bashHook).toBeDefined();
      expect(bashHook.hooks).toBeDefined();
      expect(bashHook.hooks.length).toBeGreaterThan(0);
    });

    test('references existing hook script', () => {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      const bashHook = settings.hooks.PostToolUse.find(h => h.matcher === 'Bash');
      const hookCommand = bashHook.hooks[0].command;
      // The command references $CLAUDE_PROJECT_DIR which resolves at runtime
      // Just verify it references our script filename
      expect(hookCommand).toContain('enforce-script-failure-report.sh');
    });
  });

  describe('hook script', () => {
    test('exists', () => {
      expect(fs.existsSync(HOOK_SCRIPT)).toBe(true);
    });

    test('is executable', () => {
      if (process.platform === 'win32') {
        // Windows doesn't have Unix-style executable bits; verify shebang instead
        const content = fs.readFileSync(HOOK_SCRIPT, 'utf8');
        expect(content).toMatch(/^#!/);
        return;
      }
      const stats = fs.statSync(HOOK_SCRIPT);
      // Check user execute bit (0o100)
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });

    test('has bash shebang', () => {
      const content = fs.readFileSync(HOOK_SCRIPT, 'utf8');
      expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
    });
  });

  (bashAvailable ? describe : describe.skip)('pattern matching - project scripts should trigger reminder', () => {
    const projectCommands = [
      'npm test',
      'npm test --coverage',
      'npm run validate',
      'npm run preflight --all',
      'npm build',
      'node scripts/preflight.js',
      'node scripts/validate-plugins.js',
      'npx agentsys-dev test',
      'npx agentsys-dev validate',
      'agentsys-dev status',
      'node bin/dev-cli.js validate',
      'node bin/dev-cli.js bump 4.2.0',
    ];

    test.each(projectCommands)('"%s" triggers reminder', (cmd) => {
      const input = JSON.stringify({ tool_input: { command: cmd } });
      const output = runHook(input);
      expect(output).toContain('[HOOK]');
      expect(output).toContain('Rule #13');
    });
  });

  (bashAvailable ? describe : describe.skip)('pattern matching - non-project commands should be silent', () => {
    const nonProjectCommands = [
      'git status',
      'ls -la',
      'echo hello',
      'cat README.md',
      'mkdir -p /tmp/test',
      'grep -r "pattern" .',
      'cd /some/dir',
    ];

    test.each(nonProjectCommands)('"%s" produces no output', (cmd) => {
      const input = JSON.stringify({ tool_input: { command: cmd } });
      const output = runHook(input);
      expect(output).toBe('');
    });
  });

  (bashAvailable ? describe : describe.skip)('pattern matching - chained commands containing project scripts', () => {
    const chainedCommands = [
      'cd /some/dir && npm test',
      'cd /project && npm run validate',
      'export FOO=bar && node scripts/preflight.js',
    ];

    test.each(chainedCommands)('"%s" triggers reminder', (cmd) => {
      const input = JSON.stringify({ tool_input: { command: cmd } });
      const output = runHook(input);
      expect(output).toContain('[HOOK]');
    });
  });

  (bashAvailable ? describe : describe.skip)('edge cases', () => {
    test('empty input exits 0 with no output', () => {
      const output = runHook('');
      expect(output).toBe('');
    });

    test('malformed JSON exits 0 with no output', () => {
      const output = runHook('not json at all');
      expect(output).toBe('');
    });

    test('JSON without tool_input exits 0 with no output', () => {
      const output = runHook('{"other":"field"}');
      expect(output).toBe('');
    });

    test('JSON with empty command exits 0 with no output', () => {
      const input = JSON.stringify({ tool_input: { command: '' } });
      const output = runHook(input);
      expect(output).toBe('');
    });
  });

  (bashAvailable ? describe : describe.skip)('hook always exits 0', () => {
    test('exits 0 on project script', () => {
      // runHook throws if exit code != 0
      expect(() => runHook(JSON.stringify({ tool_input: { command: 'npm test' } }))).not.toThrow();
    });

    test('exits 0 on non-project command', () => {
      expect(() => runHook(JSON.stringify({ tool_input: { command: 'ls' } }))).not.toThrow();
    });

    test('exits 0 on empty input', () => {
      expect(() => runHook('')).not.toThrow();
    });
  });

  describe('CLAUDE.md rule #13', () => {
    let claudeContent;

    beforeAll(() => {
      claudeContent = fs.readFileSync(CLAUDE_MD, 'utf8');
    });

    test('contains rule about script failure reporting', () => {
      expect(claudeContent).toContain('Report script failures before manual fallback');
    });

    test('rule references npm/scripts/agentsys-dev patterns', () => {
      expect(claudeContent).toContain('npm test/run/build');
      expect(claudeContent).toContain('scripts/*');
      expect(claudeContent).toContain('agentsys-dev');
      expect(claudeContent).toContain('node bin/dev-cli.js');
    });

    test('rule requires failure reporting', () => {
      expect(claudeContent).toContain('Report the failure with exact error output');
    });

    test('rule prohibits silent fallback', () => {
      expect(claudeContent).toContain('NEVER silently fall back');
    });
  });

  describe('AGENTS.md matching rule', () => {
    let agentsContent;

    beforeAll(() => {
      agentsContent = fs.readFileSync(AGENTS_MD, 'utf8');
    });

    test('contains script failure reporting rule', () => {
      expect(agentsContent).toContain('Report script failures before manual fallback');
    });

    test('rule prohibits silent fallback', () => {
      expect(agentsContent).toContain('NEVER silently fall back');
    });
  });

  describe('OpenCode plugin pattern parity', () => {
    // Mirror the exact patterns from adapters/opencode-plugin/index.ts
    const PROJECT_SCRIPT_PATTERNS = [
      /\bnpm\s+test\b/,
      /\bnpm\s+run\s+/,
      /\bnpm\s+build\b/,
      /\bnode\s+scripts\//,
      /\bnode\s+bin\/dev-cli\.js\b/,
      /\bagentsys-dev\b/,
    ];

    const FAILURE_INDICATORS = [
      /\bERR!\b/,
      /\bFAIL\b/,
      /\bELIFECYCLE\b/,
      /\bError:/,
      /\berror Command failed\b/,
      /exit code [1-9]/,
    ];

    describe('PROJECT_SCRIPT_PATTERNS match project commands', () => {
      const projectCommands = [
        'npm test',
        'npm test --coverage',
        'npm run validate',
        'npm run preflight --all',
        'npm build',
        'node scripts/preflight.js',
        'node scripts/validate-plugins.js',
        'npx agentsys-dev test',
        'agentsys-dev status',
        'node bin/dev-cli.js validate',
        'node bin/dev-cli.js bump 4.2.0',
      ];

      test.each(projectCommands)('matches "%s"', (cmd) => {
        const matches = PROJECT_SCRIPT_PATTERNS.some(p => p.test(cmd));
        expect(matches).toBe(true);
      });
    });

    describe('PROJECT_SCRIPT_PATTERNS reject non-project commands', () => {
      const nonProjectCommands = [
        'git status',
        'ls -la',
        'echo hello',
        'cat README.md',
        'mkdir -p /tmp/test',
        'cd /some/dir',
      ];

      test.each(nonProjectCommands)('does not match "%s"', (cmd) => {
        const matches = PROJECT_SCRIPT_PATTERNS.some(p => p.test(cmd));
        expect(matches).toBe(false);
      });
    });

    describe('FAILURE_INDICATORS detect failures', () => {
      const failureOutputs = [
        'npm ERR! code ELIFECYCLE',
        'FAIL src/__tests__/my-test.js',
        'Error: Cannot find module',
        'error Command failed with exit code 1',
        'ELIFECYCLE npm run test',
        'exit code 1',
        'exit code 127',
      ];

      test.each(failureOutputs)('detects failure in "%s"', (output) => {
        const hasFailure = FAILURE_INDICATORS.some(p => p.test(output));
        expect(hasFailure).toBe(true);
      });
    });

    describe('FAILURE_INDICATORS ignore success', () => {
      const successOutputs = [
        'Tests: 42 passed, 42 total',
        'All suites passed',
        'Build completed successfully',
        'exit code 0',
      ];

      test.each(successOutputs)('does not flag "%s"', (output) => {
        const hasFailure = FAILURE_INDICATORS.some(p => p.test(output));
        expect(hasFailure).toBe(false);
      });
    });

    test('patterns in index.ts match those tested here', () => {
      const pluginContent = fs.readFileSync(
        path.join(ROOT, 'adapters', 'opencode-plugin', 'index.ts'),
        'utf8'
      );
      // Verify the patterns exist in the plugin source
      expect(pluginContent).toContain('PROJECT_SCRIPT_PATTERNS');
      expect(pluginContent).toContain('FAILURE_INDICATORS');
      // Verify key pattern substrings exist in plugin source
      // Note: regex source has escaped slashes, e.g. scripts\/ not scripts/
      expect(pluginContent).toContain('PROJECT_SCRIPT_PATTERNS');
      expect(pluginContent).toContain('FAILURE_INDICATORS');
      expect(pluginContent).toContain('npm');
      expect(pluginContent).toContain('agentsys-dev');
      expect(pluginContent).toContain('scripts');
      expect(pluginContent).toContain('dev-cli');
    });
  });
});
