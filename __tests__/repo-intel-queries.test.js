/**
 * Tests for lib/repo-intel/queries - typed wrappers over agent-analyzer
 * `repo-intel query <type>` subcommands.
 *
 * Verifies argv construction (the contract with the binary), error wrapping
 * (parse failures, missing artifact), and input validation. The binary
 * itself is mocked so these run hermetically in CI.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the binary module so runAnalyzer doesn't actually shell out.
jest.mock('../lib/binary', () => ({
  runAnalyzer: jest.fn(),
}));

const binary = require('../lib/binary');
const queries = require('../lib/repo-intel/queries');

describe('lib/repo-intel/queries', () => {
  let tempDir;
  let mapFilePath;

  beforeEach(() => {
    binary.runAnalyzer.mockReset();
    // Build a fake repo with the state dir + map file the queries look for.
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-intel-queries-test-'));
    fs.mkdirSync(path.join(tempDir, '.claude'), { recursive: true });
    mapFilePath = path.join(tempDir, '.claude', 'repo-intel.json');
    fs.writeFileSync(mapFilePath, '{}');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ─── Argv construction ────────────────────────────────────────────────────
  // For each query, we mock the binary to return a known JSON value, call
  // the wrapper, then assert the exact argv passed through. This is the
  // load-bearing contract with the agent-analyzer CLI.

  describe('argv construction', () => {
    test('hotspots without limit', () => {
      binary.runAnalyzer.mockReturnValue('[]');
      queries.hotspots(tempDir);
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args.slice(0, 3)).toEqual(['repo-intel', 'query', 'hotspots']);
      expect(args).toContain('--map-file');
      expect(args).toContain(mapFilePath);
      expect(args).toContain(tempDir);
      expect(args).not.toContain('--top');
    });

    test('hotspots with limit adds --top', () => {
      binary.runAnalyzer.mockReturnValue('[]');
      queries.hotspots(tempDir, { limit: 25 });
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args).toContain('--top');
      expect(args[args.indexOf('--top') + 1]).toBe('25');
    });

    test('coupling forwards file argument', () => {
      binary.runAnalyzer.mockReturnValue('[]');
      queries.coupling(tempDir, 'src/auth.js');
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args.slice(0, 4)).toEqual(['repo-intel', 'query', 'coupling', 'src/auth.js']);
    });

    test('busFactor with adjustForAi adds --adjust-for-ai', () => {
      binary.runAnalyzer.mockReturnValue('{}');
      queries.busFactor(tempDir, { adjustForAi: true });
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args).toContain('--adjust-for-ai');
    });

    test('testGaps with limit + minChanges adds both flags', () => {
      binary.runAnalyzer.mockReturnValue('[]');
      queries.testGaps(tempDir, { limit: 5, minChanges: 3 });
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args[args.indexOf('--top') + 1]).toBe('5');
      expect(args[args.indexOf('--min-changes') + 1]).toBe('3');
    });

    test('aiRatio with pathFilter adds --path-filter', () => {
      binary.runAnalyzer.mockReturnValue('{}');
      queries.aiRatio(tempDir, { pathFilter: 'src/' });
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args[args.indexOf('--path-filter') + 1]).toBe('src/');
    });

    test('diffRisk joins files with comma', () => {
      binary.runAnalyzer.mockReturnValue('[]');
      queries.diffRisk(tempDir, ['a.js', 'b.js', 'c.js']);
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args[args.indexOf('--files') + 1]).toBe('a.js,b.js,c.js');
    });

    test('dependents with file scope adds --file', () => {
      binary.runAnalyzer.mockReturnValue('{}');
      queries.dependents(tempDir, 'createUser', 'src/users.js');
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args).toContain('createUser');
      expect(args[args.indexOf('--file') + 1]).toBe('src/users.js');
    });
  });

  // ─── Phase 5 graph queries ────────────────────────────────────────────────

  describe('graph queries (Phase 5.1)', () => {
    test('communities sends "communities" subcommand', () => {
      binary.runAnalyzer.mockReturnValue('[]');
      queries.communities(tempDir);
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args.slice(0, 3)).toEqual(['repo-intel', 'query', 'communities']);
    });

    test('boundaries with limit adds --top', () => {
      binary.runAnalyzer.mockReturnValue('[]');
      queries.boundaries(tempDir, { limit: 8 });
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args.slice(0, 3)).toEqual(['repo-intel', 'query', 'boundaries']);
      expect(args[args.indexOf('--top') + 1]).toBe('8');
    });

    test('areaOf forwards file argument', () => {
      binary.runAnalyzer.mockReturnValue('{}');
      queries.areaOf(tempDir, 'src/foo.js');
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args.slice(0, 4)).toEqual(['repo-intel', 'query', 'area-of', 'src/foo.js']);
    });

    test('communityHealth forwards id as string', () => {
      binary.runAnalyzer.mockReturnValue('{}');
      queries.communityHealth(tempDir, 7);
      const args = binary.runAnalyzer.mock.calls[0][0];
      expect(args.slice(0, 4)).toEqual(['repo-intel', 'query', 'community-health', '7']);
    });
  });

  // ─── Input validation ─────────────────────────────────────────────────────

  describe('input validation', () => {
    test('communityHealth rejects non-integer id', () => {
      expect(() => queries.communityHealth(tempDir, 'foo')).toThrow(TypeError);
      expect(() => queries.communityHealth(tempDir, null)).toThrow(TypeError);
      expect(() => queries.communityHealth(tempDir, 1.5)).toThrow(TypeError);
      expect(() => queries.communityHealth(tempDir, -1)).toThrow(TypeError);
      expect(binary.runAnalyzer).not.toHaveBeenCalled();
    });

    test('diffRisk rejects non-array files', () => {
      expect(() => queries.diffRisk(tempDir, 'a.js')).toThrow(TypeError);
      expect(() => queries.diffRisk(tempDir, [1, 2, 3])).toThrow(TypeError);
      expect(binary.runAnalyzer).not.toHaveBeenCalled();
    });

    test('diffRisk rejects oversized file argument', () => {
      // 1000 paths × 50 chars each = 50000 chars, exceeds 30000 cap.
      const huge = Array.from({ length: 1000 }, (_, i) => `path/that/is/about/fifty-chars-long/file${i}.js`);
      expect(() => queries.diffRisk(tempDir, huge)).toThrow(RangeError);
      expect(binary.runAnalyzer).not.toHaveBeenCalled();
    });

    test('diffRisk accepts a normal-sized file argument', () => {
      binary.runAnalyzer.mockReturnValue('[]');
      queries.diffRisk(tempDir, ['a.js', 'b.js']);
      expect(binary.runAnalyzer).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Error wrapping ───────────────────────────────────────────────────────

  describe('error wrapping', () => {
    test('throws RepoIntelMissingError when artifact is absent', () => {
      // Use a fresh dir with no .claude/repo-intel.json.
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-intel-empty-'));
      try {
        let caught;
        try {
          queries.hotspots(emptyDir);
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(queries.RepoIntelMissingError);
        expect(caught.code).toBe('REPO_INTEL_MISSING');
        expect(caught.mapFile).toContain('repo-intel.json');
        expect(binary.runAnalyzer).not.toHaveBeenCalled();
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    test('wraps binary failure with query context', () => {
      binary.runAnalyzer.mockImplementation(() => {
        throw new Error('binary blew up');
      });
      let caught;
      try {
        queries.bugspots(tempDir, { limit: 5 });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught.message).toContain('repo-intel query failed');
      expect(caught.message).toContain('bugspots');
      expect(caught.message).toContain('binary blew up');
      expect(caught.cause).toBeDefined();
    });

    test('wraps non-JSON output with preview', () => {
      binary.runAnalyzer.mockReturnValue('not actually json');
      let caught;
      try {
        queries.health(tempDir);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught.message).toContain('non-JSON output');
      expect(caught.message).toContain('health');
      expect(caught.message).toContain('not actually json');
    });

    test('non-JSON output preview is truncated', () => {
      // 500 chars - should be truncated to 200 in the message.
      const big = 'x'.repeat(500);
      binary.runAnalyzer.mockReturnValue(big);
      let caught;
      try {
        queries.health(tempDir);
      } catch (err) {
        caught = err;
      }
      // The message contains exactly 200 x's, not 500.
      const xCount = (caught.message.match(/x/g) || []).length;
      expect(xCount).toBe(200);
    });
  });
});
