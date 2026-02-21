const fs = require('fs');
const path = require('path');
const { runValidation: runCrossPlatformValidation, validateCommandPrefixes, validateStateDirReferences, validateFeatureParity, validateInstallationInstructions } = require('../scripts/validate-cross-platform-docs');

const pluginsDir = path.join(__dirname, '..', 'plugins');
const hasPlugins = fs.existsSync(pluginsDir);

// validate-counts reads plugins/ dir directly. When plugins are extracted
// to standalone repos, these functions throw ENOENT. Conditionally test.
const countsModule = require('../scripts/validate-counts');
const { runValidation: runCountsValidation, getActualCounts, extractCountsFromDocs, checkVersionAlignment, checkProjectMemoryAlignment } = countsModule;

describe('validate-counts', () => {
  describe('getActualCounts', () => {
    test('returns correct structure', () => {
      if (!hasPlugins) {
        // getActualCounts uses discovery which returns 0 for missing plugins/
        const counts = getActualCounts();
        expect(counts).toHaveProperty('plugins');
        expect(counts.plugins).toBe(0);
        return;
      }
      const counts = getActualCounts();
      expect(counts).toHaveProperty('plugins');
      expect(counts).toHaveProperty('fileBasedAgents');
      expect(counts).toHaveProperty('roleBasedAgents');
      expect(counts).toHaveProperty('totalAgents');
      expect(counts).toHaveProperty('skills');
      expect(typeof counts.plugins).toBe('number');
    });

    test('all counts are non-negative numbers', () => {
      const counts = getActualCounts();
      expect(counts.plugins).toBeGreaterThanOrEqual(0);
      expect(counts.fileBasedAgents).toBeGreaterThanOrEqual(0);
      expect(counts.roleBasedAgents).toBeGreaterThanOrEqual(0);
      expect(counts.totalAgents).toBeGreaterThanOrEqual(0);
      expect(counts.skills).toBeGreaterThanOrEqual(0);
    });

    test('totalAgents equals sum of file-based and role-based', () => {
      const counts = getActualCounts();
      expect(counts.totalAgents).toBe(counts.fileBasedAgents + counts.roleBasedAgents);
    });
  });

  describe('runValidation', () => {
    (hasPlugins ? test : test.skip)('returns structured result', () => {
      const result = runCountsValidation();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('actualCounts');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('fixes');
      expect(result).toHaveProperty('summary');
      expect(['ok', 'issues-found']).toContain(result.status);
    });

    (hasPlugins ? test : test.skip)('summary has correct structure', () => {
      const result = runCountsValidation();
      expect(result.summary).toHaveProperty('issueCount');
      expect(result.summary).toHaveProperty('fixableCount');
      expect(result.summary).toHaveProperty('bySeverity');
    });

    (hasPlugins ? test : test.skip)('issues is an array', () => {
      const result = runCountsValidation();
      expect(Array.isArray(result.issues)).toBe(true);
    });

    (hasPlugins ? test : test.skip)('fixes is an array', () => {
      const result = runCountsValidation();
      expect(Array.isArray(result.fixes)).toBe(true);
    });

    (hasPlugins ? test : test.skip)('severity counts sum to total issueCount', () => {
      const result = runCountsValidation();
      const { high, medium, low } = result.summary.bySeverity;
      expect(high + medium + low).toBe(result.summary.issueCount);
    });
  });

  describe('extractCountsFromDocs', () => {
    test('returns object with all doc files', () => {
      const counts = extractCountsFromDocs();
      expect(counts['README.md']).toBeDefined();
      expect(counts['CLAUDE.md']).toBeDefined();
      expect(counts['package.json']).toBeDefined();
    });

    test('extracts counts from docs (may be zero without plugins)', () => {
      const counts = extractCountsFromDocs();
      Object.values(counts).forEach(doc => {
        if (doc.plugins !== undefined) {
          expect(typeof doc.plugins).toBe('number');
        }
      });
    });

    test('handles missing files gracefully', () => {
      const counts = extractCountsFromDocs();
      expect(counts).toBeDefined();
    });
  });

  describe('checkVersionAlignment', () => {
    (hasPlugins ? test : test.skip)('returns mainVersion', () => {
      const result = checkVersionAlignment();
      expect(result).toHaveProperty('mainVersion');
      expect(result.mainVersion).toMatch(/^\d+\.\d+\.\d+/);
    });

    (hasPlugins ? test : test.skip)('returns issues array', () => {
      const result = checkVersionAlignment();
      expect(result).toHaveProperty('issues');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    (hasPlugins ? test : test.skip)('issue has expected properties', () => {
      const result = checkVersionAlignment();
      result.issues.forEach(issue => {
        expect(issue).toHaveProperty('file');
        expect(issue).toHaveProperty('expected');
        expect(issue).toHaveProperty('actual');
      });
    });
  });

  describe('checkProjectMemoryAlignment', () => {
    test('returns alignment info', () => {
      const result = checkProjectMemoryAlignment();
      expect(result).toBeDefined();
    });

    test('similarity is percentage string when aligned defined', () => {
      const result = checkProjectMemoryAlignment();
      if (result.similarity !== undefined) {
        expect(result.similarity).toMatch(/%$/);
      }
    });
  });
});

describe('validate-cross-platform-docs', () => {
  describe('runValidation', () => {
    test('returns structured result', () => {
      const result = runCrossPlatformValidation();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('featuresByPlatform');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('fixes');
      expect(result).toHaveProperty('summary');
    });

    test('featuresByPlatform has all platforms', () => {
      const result = runCrossPlatformValidation();
      expect(result.featuresByPlatform).toHaveProperty('general');
      expect(result.featuresByPlatform).toHaveProperty('claudeCode');
      expect(result.featuresByPlatform).toHaveProperty('openCode');
      expect(result.featuresByPlatform).toHaveProperty('codex');
    });

    test('summary has byType breakdown', () => {
      const result = runCrossPlatformValidation();
      expect(result.summary).toHaveProperty('byType');
      expect(result.summary.byType).toHaveProperty('commandPrefix');
      expect(result.summary.byType).toHaveProperty('stateDirectory');
    });

    test('issues is an array', () => {
      const result = runCrossPlatformValidation();
      expect(Array.isArray(result.issues)).toBe(true);
    });

    test('fixes is an array', () => {
      const result = runCrossPlatformValidation();
      expect(Array.isArray(result.fixes)).toBe(true);
    });

    test('status is valid', () => {
      const result = runCrossPlatformValidation();
      expect(['ok', 'issues-found']).toContain(result.status);
    });

    test('summary has correct structure', () => {
      const result = runCrossPlatformValidation();
      expect(result.summary).toHaveProperty('issueCount');
      expect(result.summary).toHaveProperty('fixableCount');
      expect(typeof result.summary.issueCount).toBe('number');
      expect(typeof result.summary.fixableCount).toBe('number');
    });
  });

  describe('validateCommandPrefixes', () => {
    test('returns array', () => {
      const issues = validateCommandPrefixes();
      expect(Array.isArray(issues)).toBe(true);
    });

    test('each issue has required properties', () => {
      const issues = validateCommandPrefixes();
      issues.forEach(issue => {
        expect(issue).toHaveProperty('type');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('file');
        expect(issue).toHaveProperty('message');
      });
    });

    test('issue severity is valid', () => {
      const issues = validateCommandPrefixes();
      const validSeverities = ['high', 'medium', 'low'];
      issues.forEach(issue => {
        expect(validSeverities).toContain(issue.severity);
      });
    });
  });

  describe('validateStateDirReferences', () => {
    test('returns array', () => {
      const issues = validateStateDirReferences();
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('validateFeatureParity', () => {
    test('returns featuresByPlatform and issues', () => {
      const result = validateFeatureParity();
      expect(result).toHaveProperty('featuresByPlatform');
      expect(result).toHaveProperty('issues');
    });
  });

  describe('validateInstallationInstructions', () => {
    test('returns array', () => {
      const issues = validateInstallationInstructions();
      expect(Array.isArray(issues)).toBe(true);
    });
  });

});
