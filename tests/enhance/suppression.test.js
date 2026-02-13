/**
 * Suppression System Tests
 * Tests for loadConfig, shouldSuppress, filterFindings with auto-learning integration
 */

const suppression = require('@agentsys/lib/enhance/suppression');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Suppression System', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'suppress-test-'));
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('shouldSuppress with auto_learned', () => {
    it('should suppress finding when file matches auto-learned pattern', () => {
      const config = {
        auto_learned: {
          patterns: {
            vague_instructions: {
              files: ['docs/enhance.md'],
              confidence: 0.95,
              reason: 'Pattern documentation'
            }
          }
        },
        ignore: { patterns: [], files: [], rules: {} }
      };

      const finding = { patternId: 'vague_instructions', file: 'docs/enhance.md' };
      const result = suppression.shouldSuppress(finding, config, new Set(), 'docs/enhance.md', testDir);

      expect(result).not.toBeNull();
      expect(result.reason).toBe('auto_learned');
      expect(result.confidence).toBe(0.95);
    });

    it('should not suppress when file does not match auto-learned pattern', () => {
      const config = {
        auto_learned: {
          patterns: {
            vague_instructions: {
              files: ['docs/enhance.md'],
              confidence: 0.95
            }
          }
        },
        ignore: { patterns: [], files: [], rules: {} }
      };

      const finding = { patternId: 'vague_instructions', file: 'other/file.md' };
      const result = suppression.shouldSuppress(finding, config, new Set(), 'other/file.md', testDir);

      expect(result).toBeNull();
    });

    it('should combine auto-learned with manual suppressions', () => {
      const config = {
        auto_learned: {
          patterns: {
            pattern_a: { files: ['a.md'], confidence: 0.95, reason: 'Auto' }
          }
        },
        ignore: {
          patterns: ['pattern_b'],
          files: [],
          rules: {}
        }
      };

      // Auto-learned suppression
      const finding1 = { patternId: 'pattern_a', file: 'a.md' };
      const result1 = suppression.shouldSuppress(finding1, config, new Set(), 'a.md', testDir);
      expect(result1).not.toBeNull();
      expect(result1.reason).toBe('auto_learned');

      // Manual suppression
      const finding2 = { patternId: 'pattern_b', file: 'b.md' };
      const result2 = suppression.shouldSuppress(finding2, config, new Set(), 'b.md', testDir);
      expect(result2).not.toBeNull();
      expect(result2.reason).toBe('config');
    });
  });

  describe('filterFindings with auto_learned', () => {
    it('should track auto-learned suppressions separately', () => {
      const findings = [
        { patternId: 'vague_instructions', file: 'docs.md', issue: 'Issue 1', certainty: 'HIGH' },
        { patternId: 'aggressive_emphasis', file: 'workflow.md', issue: 'Issue 2', certainty: 'HIGH' }
      ];

      const config = {
        auto_learned: {
          patterns: {
            vague_instructions: { files: ['docs.md'], confidence: 0.95, reason: 'Auto' }
          }
        },
        ignore: { patterns: [], files: [], rules: {} },
        severity: {}
      };

      const fileContents = new Map();
      const result = suppression.filterFindings(findings, config, testDir, fileContents);

      expect(result.active).toHaveLength(1);
      expect(result.active[0].patternId).toBe('aggressive_emphasis');
      expect(result.suppressed).toHaveLength(1);
      expect(result.suppressed[0].patternId).toBe('vague_instructions');
      expect(result.suppressed[0].reason).toBe('auto_learned');
    });
  });
});
