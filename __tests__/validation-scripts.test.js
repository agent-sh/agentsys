const { runValidation: runCountsValidation, getActualCounts } = require('../scripts/validate-counts');
const { runValidation: runCrossPlatformValidation, validateCommandPrefixes } = require('../scripts/validate-cross-platform-docs');

describe('validate-counts', () => {
  describe('getActualCounts', () => {
    test('returns correct structure', () => {
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
    test('returns structured result', () => {
      const result = runCountsValidation();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('actualCounts');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('fixes');
      expect(result).toHaveProperty('summary');
      expect(['ok', 'issues-found']).toContain(result.status);
    });

    test('summary has correct structure', () => {
      const result = runCountsValidation();
      expect(result.summary).toHaveProperty('issueCount');
      expect(result.summary).toHaveProperty('fixableCount');
      expect(result.summary).toHaveProperty('bySeverity');
      expect(result.summary.bySeverity).toHaveProperty('high');
      expect(result.summary.bySeverity).toHaveProperty('medium');
      expect(result.summary.bySeverity).toHaveProperty('low');
    });

    test('issues is an array', () => {
      const result = runCountsValidation();
      expect(Array.isArray(result.issues)).toBe(true);
    });

    test('fixes is an array', () => {
      const result = runCountsValidation();
      expect(Array.isArray(result.fixes)).toBe(true);
    });

    test('severity counts sum to total issueCount', () => {
      const result = runCountsValidation();
      const { high, medium, low } = result.summary.bySeverity;
      expect(high + medium + low).toBe(result.summary.issueCount);
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
});
