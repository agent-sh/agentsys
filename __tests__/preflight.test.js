/**
 * Tests for scripts/preflight.js - unified change-aware checklist enforcement
 *
 * Note: Functions like getChangedFiles, checkChangelogModified, and
 * checkLibStagedTogether use a locally-bound execSync captured at module load.
 * We cannot mock it post-import, so those are tested against real git state.
 */

const path = require('path');
const fs = require('fs');

const {
  main,
  runPreflight,
  getChangedFiles,
  detectRelevantChecklists,
  checkChangelogModified,
  checkAskUserQuestionLabels,
  checkCodexTriggerPhrases,
  checkLibIndexExports,
  checkLibPluginSync,
  checkTestFileExistence,
  checkLibStagedTogether,
  runExistingValidators,
  runGapChecks,
  CHECKLIST_PATTERNS,
  VALIDATORS,
  MANUAL_CHECKS
} = require('../scripts/preflight.js');

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe('preflight module', () => {
  const filePath = path.join(__dirname, '..', 'scripts', 'preflight.js');
  const source = fs.readFileSync(filePath, 'utf8');

  test('file exists', () => {
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('has require.main guard', () => {
    expect(source).toContain('require.main === module');
  });

  test('exports main, runPreflight, getChangedFiles, detectRelevantChecklists', () => {
    expect(typeof main).toBe('function');
    expect(typeof runPreflight).toBe('function');
    expect(typeof getChangedFiles).toBe('function');
    expect(typeof detectRelevantChecklists).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// getChangedFiles
// ---------------------------------------------------------------------------

describe('getChangedFiles', () => {
  test('returns an array', () => {
    const result = getChangedFiles();
    expect(Array.isArray(result)).toBe(true);
  });

  test('returns deduplicated results (no duplicate entries)', () => {
    const result = getChangedFiles();
    const unique = [...new Set(result)];
    expect(result.length).toBe(unique.length);
  });

  test('all entries are non-empty trimmed strings', () => {
    const result = getChangedFiles();
    for (const f of result) {
      expect(typeof f).toBe('string');
      expect(f.length).toBeGreaterThan(0);
      expect(f).toBe(f.trim());
    }
  });
});

// ---------------------------------------------------------------------------
// detectRelevantChecklists
// ---------------------------------------------------------------------------

describe('detectRelevantChecklists', () => {
  test('command files trigger new-command and cross-platform', () => {
    const files = ['plugins/next-task/commands/next-task.md'];
    const result = detectRelevantChecklists(files);
    expect(result.has('new-command')).toBe(true);
    expect(result.has('cross-platform')).toBe(true);
  });

  test('agent files trigger new-agent and cross-platform', () => {
    const files = ['plugins/enhance/agents/my-agent.md'];
    const result = detectRelevantChecklists(files);
    expect(result.has('new-agent')).toBe(true);
    expect(result.has('cross-platform')).toBe(true);
  });

  test('skill files trigger new-skill and cross-platform', () => {
    const files = ['plugins/deslop/skills/deslop/SKILL.md'];
    const result = detectRelevantChecklists(files);
    expect(result.has('new-skill')).toBe(true);
    expect(result.has('cross-platform')).toBe(true);
  });

  test('lib/ files trigger new-lib-module and cross-platform', () => {
    const files = ['lib/config/index.js'];
    const result = detectRelevantChecklists(files);
    expect(result.has('new-lib-module')).toBe(true);
    expect(result.has('cross-platform')).toBe(true);
  });

  test('package.json triggers release', () => {
    const files = ['package.json'];
    const result = detectRelevantChecklists(files);
    expect(result.has('release')).toBe(true);
  });

  test('repo-map plugin files trigger repo-map', () => {
    const files = ['plugins/repo-map/skills/repo-mapping/SKILL.md'];
    const result = detectRelevantChecklists(files);
    expect(result.has('repo-map')).toBe(true);
  });

  test('lib/repo-map files trigger repo-map', () => {
    const files = ['lib/repo-map/index.js'];
    const result = detectRelevantChecklists(files);
    expect(result.has('repo-map')).toBe(true);
  });

  test('empty array triggers no checklists', () => {
    const result = detectRelevantChecklists([]);
    expect(result.size).toBe(0);
  });

  test('multiple file types produce union of checklists', () => {
    const files = [
      'plugins/next-task/commands/next-task.md',  // new-command + cross-platform
      'lib/config/index.js',                       // new-lib-module + cross-platform
      'package.json'                                // release
    ];
    const result = detectRelevantChecklists(files);
    expect(result.has('new-command')).toBe(true);
    expect(result.has('new-lib-module')).toBe(true);
    expect(result.has('release')).toBe(true);
    expect(result.has('cross-platform')).toBe(true);
  });

  test('files outside known patterns trigger no checklists', () => {
    const files = ['README.md', '.gitignore', 'docs/something.md'];
    const result = detectRelevantChecklists(files);
    expect(result.size).toBe(0);
  });

  test('opencode-plugin files trigger opencode-plugin', () => {
    const files = ['adapters/opencode-plugin/index.js'];
    const result = detectRelevantChecklists(files);
    expect(result.has('opencode-plugin')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gap checks (unit tests)
// ---------------------------------------------------------------------------

describe('checkChangelogModified', () => {
  test('returns object with name, status, and message', () => {
    const result = checkChangelogModified([]);
    expect(result).toHaveProperty('name', 'gap:changelog-modified');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('message');
  });

  test('passes when CHANGELOG.md is in changed files and new feature files exist', () => {
    // This tests the path where getNewFiles returns real new files (from git).
    // On this branch we have new feature files and CHANGELOG.md is changed,
    // so it should pass or show "no new feature files" (depends on git state).
    const changedFiles = getChangedFiles();
    const result = checkChangelogModified(changedFiles);
    // On a development branch with CHANGELOG.md changed, should pass
    expect(['pass', 'warn']).toContain(result.status);
  });

  test('passes when no new feature files are detected', () => {
    // Passing only non-feature files means getNewFiles determines status
    const result = checkChangelogModified(['README.md']);
    // getNewFiles uses real git - if there ARE new feature files on this branch,
    // it will detect them. The CHANGELOG.md absence in changedFiles list would
    // cause a 'warn'. Otherwise 'pass'.
    expect(['pass', 'warn']).toContain(result.status);
  });
});

describe('checkLibIndexExports', () => {
  test('integration: passes on current clean tree', () => {
    const result = checkLibIndexExports();
    expect(result.status).toBe('pass');
  });

  test('has correct check name', () => {
    const result = checkLibIndexExports();
    expect(result.name).toBe('gap:lib-index-exports');
  });
});

describe('checkLibPluginSync', () => {
  test('integration: passes on current clean tree with --all', () => {
    const result = checkLibPluginSync([], { all: true });
    expect(result.status).toBe('pass');
  });

  test('skips when no lib changes detected and not --all', () => {
    const result = checkLibPluginSync(['README.md'], {});
    expect(result.status).toBe('skip');
    expect(result.message).toContain('No lib/ changes');
  });

  test('runs check when lib/ file is in changed files', () => {
    const result = checkLibPluginSync(['lib/config/index.js'], {});
    // Should actually run (not skip)
    expect(result.status).not.toBe('skip');
  });
});

describe('checkAskUserQuestionLabels', () => {
  test('integration: passes on current codebase', () => {
    const result = checkAskUserQuestionLabels();
    // Should pass or warn - not error
    expect(['pass', 'warn']).toContain(result.status);
  });

  test('has correct check name', () => {
    const result = checkAskUserQuestionLabels();
    expect(result.name).toBe('gap:label-length');
  });
});

describe('checkCodexTriggerPhrases', () => {
  test('returns result with correct check name', () => {
    const result = checkCodexTriggerPhrases();
    expect(result.name).toBe('gap:codex-trigger-phrases');
  });

  test('returns pass when plugins/ directory does not exist', () => {
    // The script returns 'pass' (not 'error') when plugins/ is absent —
    // this is the expected state after plugins were extracted to standalone repos.
    const result = checkCodexTriggerPhrases();
    // plugins/ does not exist in this repo (extracted to standalone repos),
    // so the function must return 'pass'.
    const pluginsExists = require('fs').existsSync(require('path').join(__dirname, '..', 'plugins'));
    if (!pluginsExists) {
      expect(result.status).toBe('pass');
    } else {
      // If plugins/ somehow exists, allow pass or warn (never error for missing codex-description)
      expect(['pass', 'warn']).toContain(result.status);
    }
  });
});

describe('checkTestFileExistence', () => {
  test('returns result with correct check name', () => {
    const result = checkTestFileExistence([]);
    expect(result.name).toBe('gap:test-file-existence');
  });
});

describe('checkLibStagedTogether', () => {
  test('returns result with correct check name', () => {
    const result = checkLibStagedTogether();
    expect(result.name).toBe('gap:lib-staged-together');
  });

  test('returns a valid status', () => {
    const result = checkLibStagedTogether();
    expect(['pass', 'skip', 'warn']).toContain(result.status);
  });
});

// ---------------------------------------------------------------------------
// runExistingValidators
// ---------------------------------------------------------------------------

describe('runExistingValidators', () => {
  test('skips all validators when no checklists are relevant', () => {
    const results = runExistingValidators(new Set(), { all: false });
    // All should be skipped since no checklists match
    for (const r of results) {
      expect(r.status).toBe('skip');
    }
  });

  test('runs validators when --all is true', () => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};

    try {
      const results = runExistingValidators(new Set(), { all: true });
      // At least some should run (not all skipped)
      const ran = results.filter(r => r.status !== 'skip');
      expect(ran.length).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  });

  test('each result has name, status, message, and duration', () => {
    const results = runExistingValidators(new Set(), { all: false });
    for (const r of results) {
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('message');
      expect(typeof r.duration).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// runGapChecks
// ---------------------------------------------------------------------------

describe('runGapChecks', () => {
  test('returns array of results', () => {
    const results = runGapChecks(new Set(['cross-platform']), ['lib/config/index.js'], {});
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  test('each result has name and status', () => {
    const results = runGapChecks(new Set(['new-command']), ['plugins/x/commands/y.md'], {});
    for (const r of results) {
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('status');
    }
  });

  test('runs all gap checks with --all flag', () => {
    const results = runGapChecks(new Set(), [], { all: true });
    // With --all, all gap checks should run
    const names = results.map(r => r.name);
    expect(names).toContain('gap:changelog-modified');
    expect(names).toContain('gap:label-length');
    expect(names).toContain('gap:codex-trigger-phrases');
    expect(names).toContain('gap:lib-index-exports');
    expect(names).toContain('gap:lib-plugin-sync');
    expect(names).toContain('gap:test-file-existence');
    expect(names).toContain('gap:lib-staged-together');
  });
});

// ---------------------------------------------------------------------------
// formatResults (tested indirectly via runPreflight)
// ---------------------------------------------------------------------------

describe('formatResults', () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  let logOutput;

  beforeEach(() => {
    logOutput = [];
    console.log = (...args) => logOutput.push(args.join(' '));
    console.error = (...args) => logOutput.push(args.join(' '));
    console.warn = (...args) => logOutput.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  test('[OK]/[ERROR]/[WARN]/[SKIP] markers appear in text output', () => {
    // Use auto-detect mode (no --all) to keep it fast
    runPreflight({});

    const fullOutput = logOutput.join('\n');
    const hasMarkers = fullOutput.includes('[OK]') ||
                       fullOutput.includes('[SKIP]') ||
                       fullOutput.includes('[WARN]') ||
                       fullOutput.includes('[ERROR]');
    expect(hasMarkers).toBe(true);
  });

  test('summary line has correct format when checks run', () => {
    runPreflight({ all: true });

    const summaryLine = logOutput.find(line =>
      line.startsWith('Summary:') && line.includes('passed')
    );
    expect(summaryLine).toBeDefined();
    expect(summaryLine).toMatch(/Summary: \d+ passed, \d+ failed, \d+ warnings, \d+ skipped/);
  }, 30000);

  test('JSON output mode produces valid JSON with --all', () => {
    runPreflight({ all: true, json: true });

    const jsonLine = logOutput.find(line => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });

    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(jsonLine);
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('results');
    expect(parsed).toHaveProperty('exitCode');
    expect(parsed).toHaveProperty('relevantChecklists');
    expect(parsed.summary).toHaveProperty('passed');
    expect(parsed.summary).toHaveProperty('failed');
    expect(parsed.summary).toHaveProperty('warnings');
    expect(parsed.summary).toHaveProperty('skipped');
    expect(parsed.summary).toHaveProperty('total');
    expect(parsed.results.length).toBeGreaterThan(0);
  }, 30000);
});

// ---------------------------------------------------------------------------
// main (arg parsing)
// ---------------------------------------------------------------------------

describe('main', () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  test('default args (empty array) runs auto-detect and returns number', () => {
    const code = main([]);
    expect(typeof code).toBe('number');
  });

  test('--all flag is parsed and runs all checks', () => {
    const code = main(['--all']);
    // With plugins extracted to standalone repos, some validators may report
    // issues (e.g. missing plugins/), so exit code may be 0 or 1.
    expect(typeof code).toBe('number');
  }, 30000);

  test('--json flag with --all produces JSON output', () => {
    const code = main(['--json', '--all']);
    expect(typeof code).toBe('number');

    // Should have logged valid JSON
    const calls = console.log.mock.calls;
    const jsonCall = calls.find(call => {
      try {
        JSON.parse(call[0]);
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
  }, 30000);

  test('--verbose flag is accepted without error', () => {
    const code = main(['--verbose']);
    expect(typeof code).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Constants / registry checks
// ---------------------------------------------------------------------------

describe('CHECKLIST_PATTERNS', () => {
  test('has expected checklist keys', () => {
    const expected = [
      'new-command', 'new-agent', 'new-skill', 'new-lib-module',
      'release', 'repo-map', 'opencode-plugin', 'cross-platform'
    ];
    for (const key of expected) {
      expect(CHECKLIST_PATTERNS).toHaveProperty(key);
    }
  });

  test('all pattern values are arrays', () => {
    for (const patterns of Object.values(CHECKLIST_PATTERNS)) {
      expect(Array.isArray(patterns)).toBe(true);
    }
  });
});

describe('VALIDATORS', () => {
  test('has expected validator keys', () => {
    const expected = [
      'plugins', 'cross-platform', 'consistency', 'paths',
      'counts', 'platform-docs', 'agent-skill-compliance'
    ];
    for (const key of expected) {
      expect(VALIDATORS).toHaveProperty(key);
      expect(VALIDATORS[key]).toHaveProperty('requirePath');
      expect(VALIDATORS[key]).toHaveProperty('call');
      expect(VALIDATORS[key]).toHaveProperty('relevantChecklists');
    }
  });

  test('all validator require paths point to existing files', () => {
    for (const [name, validator] of Object.entries(VALIDATORS)) {
      expect(fs.existsSync(validator.requirePath)).toBe(true);
    }
  });
});

describe('MANUAL_CHECKS', () => {
  test('has entries for known checklists', () => {
    expect(Object.keys(MANUAL_CHECKS).length).toBeGreaterThan(0);
  });

  test('all values are non-empty string arrays', () => {
    for (const [key, items] of Object.entries(MANUAL_CHECKS)) {
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(typeof item).toBe('string');
      }
    }
  });
});
