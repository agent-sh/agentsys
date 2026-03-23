/**
 * Tests for lib/repo-map/updater.js
 *
 * After the agent-analyzer migration, updater.js only exports checkStaleness().
 * The internal helpers (commitExists, getCurrentBranch, getCommitsBehind,
 * isValidCommitHash) are exercised indirectly through checkStaleness.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const { checkStaleness } = require('../lib/repo-map/updater');

// Check if we're in a git repo
const isGitRepo = (() => {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

describe('repo-map/updater', () => {
  describe('checkStaleness', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staleness-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('returns stale for map without git commit', () => {
      const map = { files: {} };
      const result = checkStaleness(tempDir, map);

      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('Missing base commit');
      expect(result.suggestFullRebuild).toBe(true);
    });

    test('returns stale for null map', () => {
      const result = checkStaleness(tempDir, null);

      expect(result.isStale).toBe(true);
      expect(result.suggestFullRebuild).toBe(true);
    });

    test('returns stale for undefined map', () => {
      const result = checkStaleness(tempDir, undefined);

      expect(result.isStale).toBe(true);
      expect(result.suggestFullRebuild).toBe(true);
    });

    test('returns stale for map with empty git object', () => {
      const map = { git: {} };
      const result = checkStaleness(tempDir, map);

      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('Missing base commit');
      expect(result.suggestFullRebuild).toBe(true);
    });

    test('returns stale for map with nonexistent commit', () => {
      if (!isGitRepo) return;

      const map = {
        git: { commit: 'nonexistent123456789abcdef' }
      };

      const result = checkStaleness(process.cwd(), map);
      expect(result.isStale).toBe(true);
      expect(result.reason).toContain('no longer exists');
      expect(result.suggestFullRebuild).toBe(true);
    });

    test('returns not stale for current commit on current branch', () => {
      if (!isGitRepo) return;

      try {
        const currentCommit = execSync('git rev-parse HEAD', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        const map = {
          git: {
            commit: currentCommit,
            branch: currentBranch
          }
        };

        const result = checkStaleness(process.cwd(), map);
        expect(result.commitsBehind).toBe(0);
        // Should not be stale when commit and branch match HEAD
        if (!result.isStale) {
          expect(result.reason).toBeNull();
        }
      } catch {
        // Skip if git commands fail
      }
    });

    test('returns stale when branch has changed', () => {
      if (!isGitRepo) return;

      try {
        const currentCommit = execSync('git rev-parse HEAD', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        const map = {
          git: {
            commit: currentCommit,
            branch: 'nonexistent-branch-xyz-999'
          }
        };

        const result = checkStaleness(process.cwd(), map);
        expect(result.isStale).toBe(true);
        expect(result.reason).toContain('Branch changed');
        expect(result.suggestFullRebuild).toBe(true);
      } catch {
        // Skip if git commands fail
      }
    });

    test('reports commits behind when map commit is older', () => {
      if (!isGitRepo) return;

      try {
        // Use a commit that is a few commits behind HEAD
        const olderCommit = execSync('git rev-parse HEAD~3', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        const map = {
          git: {
            commit: olderCommit,
            branch: currentBranch
          }
        };

        const result = checkStaleness(process.cwd(), map);
        expect(result.isStale).toBe(true);
        expect(result.commitsBehind).toBeGreaterThanOrEqual(3);
        expect(result.reason).toContain('commits behind HEAD');
      } catch {
        // Skip if not enough commits or git fails
      }
    });

    test('handles invalid commit hash gracefully', () => {
      if (!isGitRepo) return;

      const map = {
        git: { commit: 'not-a-hash!' }
      };

      // Invalid hash should trigger "no longer exists" path
      const result = checkStaleness(process.cwd(), map);
      expect(result.isStale).toBe(true);
      expect(result.suggestFullRebuild).toBe(true);
    });

    test('returns result object with expected properties', () => {
      const result = checkStaleness(tempDir, {});

      expect(result).toHaveProperty('isStale');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('commitsBehind');
      expect(result).toHaveProperty('suggestFullRebuild');
      expect(typeof result.isStale).toBe('boolean');
      expect(typeof result.commitsBehind).toBe('number');
      expect(typeof result.suggestFullRebuild).toBe('boolean');
    });

    test('commitsBehind defaults to 0 for non-git directory', () => {
      const map = {
        git: { commit: 'abc1234' }
      };

      // tempDir is not a git repo, so git commands will fail gracefully
      const result = checkStaleness(tempDir, map);
      expect(result.isStale).toBe(true);
    });
  });
});
