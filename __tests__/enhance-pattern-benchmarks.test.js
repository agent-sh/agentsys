const path = require('path');
const fs = require('fs');
const {
  runPatternBenchmarks,
  runFixBenchmarks,
  generateReport,
  assertThresholds
} = require('../lib/enhance/benchmark');
const { analyzeAgent } = require('../lib/enhance/agent-analyzer');
const { analyzePrompt } = require('../lib/enhance/prompt-analyzer');
const fixer = require('../lib/enhance/fixer');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'enhance');
const MANIFEST_PATH = path.join(FIXTURES_DIR, 'manifest.json');

// Load manifest synchronously for test.each
const manifest = fs.existsSync(MANIFEST_PATH)
  ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  : { fixtures: {}, fixPairs: {} };

// Analyzer adapters that return findings array
const analyzers = {
  agent: (filePath) => {
    const result = analyzeAgent(filePath, { verbose: true });
    // Flatten all issue arrays into single findings array
    return [
      ...(result.structureIssues || []),
      ...(result.toolIssues || []),
      ...(result.xmlIssues || []),
      ...(result.cotIssues || []),
      ...(result.exampleIssues || []),
      ...(result.antiPatternIssues || []),
      ...(result.crossPlatformIssues || [])
    ];
  },
  prompt: (filePath) => {
    const result = analyzePrompt(filePath, { verbose: true });
    return [
      ...(result.clarityIssues || []),
      ...(result.structureIssues || []),
      ...(result.exampleIssues || []),
      ...(result.contextIssues || []),
      ...(result.outputIssues || []),
      ...(result.antiPatternIssues || [])
    ];
  }
};

// Get fixture entries for test.each
const truePositiveFixtures = Object.entries(manifest.fixtures)
  .filter(([p]) => p.includes('true-positives'));
const falsePositiveFixtures = Object.entries(manifest.fixtures)
  .filter(([p]) => p.includes('false-positives'));
const fixPairEntries = Object.entries(manifest.fixPairs);

describe('Pattern Validation Benchmarks', () => {
  describe('Pattern Precision - True Positives', () => {
    test.each(truePositiveFixtures.length > 0 ? truePositiveFixtures : [['skip', {}]])(
      'should detect expected patterns in %s',
      (fixturePath, expectations) => {
        if (fixturePath === 'skip') return;
      const fullPath = path.join(FIXTURES_DIR, fixturePath);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`Fixture not found: ${fullPath}`);
      }

      const analyzer = analyzers[expectations.analyzer];
      if (!analyzer) {
        throw new Error(`Unknown analyzer: ${expectations.analyzer}`);
      }

      const findings = analyzer(fullPath);
      const foundPatterns = findings.map(f => f.patternId).filter(Boolean);

      // Check each expected pattern is found
      for (const expectedPattern of expectations.expectedPatterns) {
        expect(foundPatterns).toContain(expectedPattern);
      }
    });
  });

  describe('Pattern Precision - False Positives', () => {
    test.each(falsePositiveFixtures.length > 0 ? falsePositiveFixtures : [['skip', {}]])(
      'should NOT trigger forbidden patterns in %s',
      (fixturePath, expectations) => {
        if (fixturePath === 'skip') return;
      const fullPath = path.join(FIXTURES_DIR, fixturePath);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`Fixture not found: ${fullPath}`);
      }

      const analyzer = analyzers[expectations.analyzer];
      const findings = analyzer(fullPath);
      const foundPatterns = findings.map(f => f.patternId).filter(Boolean);

      // Check must-not-trigger patterns are NOT found
      for (const forbidden of expectations.mustNotTrigger || []) {
        expect(foundPatterns).not.toContain(forbidden);
      }
    });
  });

  describe('Fix Effectiveness', () => {
    test.each(fixPairEntries.length > 0 ? fixPairEntries : [['skip', {}]])(
      'fix for %s should remove the finding',
      (pairName, pairConfig) => {
        if (pairName === 'skip') return;
      const beforePath = path.join(FIXTURES_DIR, pairConfig.before);
      const afterPath = path.join(FIXTURES_DIR, pairConfig.after);

      if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
        throw new Error(`Fix pair files not found for ${pairName}`);
      }

      const beforeContent = fs.readFileSync(beforePath, 'utf8');

      // Get the fix function
      const fixFnName = `fix${toPascalCase(pairConfig.pattern)}`;
      const fixFn = fixer[fixFnName];

      if (!fixFn) {
        return;
      }

      // Apply fix
      const fixedContent = fixFn(beforeContent);

      // Analyze before and after
      const analyzer = analyzers[pairConfig.analyzer || 'prompt'];

      // Write temp files for analysis
      const tempBefore = path.join(FIXTURES_DIR, '.temp-before.md');
      const tempAfter = path.join(FIXTURES_DIR, '.temp-after.md');

      try {
        fs.writeFileSync(tempBefore, beforeContent);
        fs.writeFileSync(tempAfter, fixedContent);

        const beforeFindings = analyzer(tempBefore);
        const afterFindings = analyzer(tempAfter);

        const beforePatterns = beforeFindings.map(f => f.patternId).filter(Boolean);
        const afterPatterns = afterFindings.map(f => f.patternId).filter(Boolean);

        // Before should have the pattern
        expect(beforePatterns).toContain(pairConfig.pattern);

        // After should NOT have the pattern
        expect(afterPatterns).not.toContain(pairConfig.pattern);
      } finally {
        // Cleanup
        try { fs.unlinkSync(tempBefore); } catch (e) {}
        try { fs.unlinkSync(tempAfter); } catch (e) {}
      }
    });
  });

  describe('Benchmark Runner Integration', () => {
    test('runPatternBenchmarks should calculate metrics', () => {
      const results = runPatternBenchmarks(MANIFEST_PATH, analyzers);

      // Should have summary metrics
      expect(results.summary).toBeDefined();
      expect(typeof results.summary.precision).toBe('number');
      expect(typeof results.summary.recall).toBe('number');
      expect(typeof results.summary.f1).toBe('number');

      // Should have per-pattern metrics
      expect(results.byPattern).toBeDefined();
      expect(Object.keys(results.byPattern).length).toBeGreaterThan(0);
    });

    test('generateReport should produce markdown', () => {
      const results = runPatternBenchmarks(MANIFEST_PATH, analyzers);
      const report = generateReport(results);

      expect(typeof report).toBe('string');
      expect(report).toContain('# Pattern Validation Benchmark Report');
      expect(report).toContain('Precision');
      expect(report).toContain('Recall');
    });

    test('assertThresholds should pass with lenient thresholds', () => {
      const results = runPatternBenchmarks(MANIFEST_PATH, analyzers);

      // Use lenient thresholds - these fixtures test specific patterns
      // and may trigger other patterns as well (expected false positives)
      expect(() => assertThresholds(results, {
        minPrecision: 0.3,  // Low threshold - we test specific patterns
        minRecall: 0.7,     // Higher recall expected
        minF1: 0.4,
        maxFalsePositives: 20
      })).not.toThrow();
    });
  });
});

function toPascalCase(str) {
  return str
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
