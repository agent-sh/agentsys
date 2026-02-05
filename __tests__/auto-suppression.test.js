/**
 * Tests for auto-suppression.js
 * Auto-Learning Suppression System for /enhance
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  isLikelyFalsePositive,
  getProjectId,
  loadAutoSuppressions,
  saveAutoSuppressions,
  clearAutoSuppressions,
  mergeSuppressions,
  analyzeForAutoSuppression,
  exportAutoSuppressions,
  importAutoSuppressions,
  CONFIDENCE_THRESHOLD,
  PATTERN_HEURISTICS,
  isPatternDocumentation
} = require('../lib/enhance/auto-suppression');

describe('auto-suppression', () => {
  let tempDir;
  let suppressionPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-supp-test-'));
    suppressionPath = path.join(tempDir, 'suppressions.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('isLikelyFalsePositive', () => {
    test('detects pattern documentation self-reference for vague_instructions', () => {
      const finding = {
        patternId: 'vague_instructions',
        file: 'enhance.md',
        line: 10
      };
      const content = `
## Detection Categories

| Pattern | Description |
|---------|-------------|
| Vague instructions | Fuzzy language like "usually", "sometimes" |
`;
      const result = isLikelyFalsePositive(finding, content, {});
      expect(result).not.toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(result.reason).toMatch(/pattern.*documentation|table/i);
    });

    test('detects workflow enforcement context for aggressive_emphasis', () => {
      const finding = {
        patternId: 'aggressive_emphasis',
        file: 'orchestrator.md',
        line: 5 // Line 5 is within 20 lines of the WORKFLOW GATES content
      };
      const content = `Line 1
Line 2
## WORKFLOW GATES
Line 4
You MUST NOT proceed without approval.
NEVER skip the review step.
Line 7
[CRITICAL] NO AGENT may bypass this gate.
Line 9
Line 10`;
      const result = isLikelyFalsePositive(finding, content, {});
      expect(result).not.toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(result.reason).toMatch(/workflow.*enforcement|gate|critical/i);
    });

    test('detects orchestrator files for missing_examples', () => {
      const finding = {
        patternId: 'missing_examples',
        file: 'enhancement-orchestrator.md',
        line: 100
      };
      const content = `
## Workflow

Launch enhancers via Task():
Task({
  subagent_type: "enhance:plugin-enhancer",
  prompt: "Analyze plugins"
});
`;
      const result = isLikelyFalsePositive(finding, content, {});
      expect(result).not.toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(result.reason).toMatch(/orchestrator|subagent/i);
    });

    test('detects subagent delegation for missing_output_format', () => {
      const finding = {
        patternId: 'missing_output_format',
        file: 'coordinator.md',
        line: 30
      };
      const content = `
await Task({
  subagent_type: "enhance:docs-enhancer",
  prompt: "Analyze documentation"
});
`;
      const result = isLikelyFalsePositive(finding, content, {});
      expect(result).not.toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(result.reason).toMatch(/subagent|delegate/i);
    });

    test('detects constraint sections for missing_constraints', () => {
      const finding = {
        patternId: 'missing_constraints',
        file: 'agent.md',
        line: 200
      };
      const content = `
## Your Role

Do good work.

## What Agent MUST NOT Do

- Never delete files without confirmation
- Do not run destructive commands
`;
      const result = isLikelyFalsePositive(finding, content, {});
      expect(result).not.toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(result.reason).toMatch(/constraint.*section/i);
    });

    test('returns null for legitimate findings', () => {
      const finding = {
        patternId: 'vague_instructions',
        file: 'random-doc.md',
        line: 5
      };
      const content = `
# Some Documentation

This usually works well.
Sometimes you might need to restart.
`;
      const result = isLikelyFalsePositive(finding, content, {});
      // Should not suppress - this is actual vague language, not documentation about it
      expect(result).toBeNull();
    });

    test('returns null for empty content', () => {
      const finding = { patternId: 'vague_instructions' };
      expect(isLikelyFalsePositive(finding, '', {})).toBeNull();
      expect(isLikelyFalsePositive(finding, null, {})).toBeNull();
    });

    test('handles unknown pattern IDs gracefully', () => {
      const finding = {
        patternId: 'unknown_pattern_xyz',
        file: 'test.md'
      };
      const content = 'Some content';
      const result = isLikelyFalsePositive(finding, content, {});
      expect(result).toBeNull();
    });
  });

  describe('isPatternDocumentation', () => {
    test('identifies pattern documentation files', () => {
      const content = '| vague_instructions | Fuzzy language |';
      expect(isPatternDocumentation('enhance.md', content, 'vague_instructions')).toBe(true);
      expect(isPatternDocumentation('agent-patterns.js', content, 'vague_instructions')).toBe(true);
    });

    test('rejects non-pattern files', () => {
      const content = '| vague_instructions | Fuzzy language |';
      expect(isPatternDocumentation('readme.md', content, 'vague_instructions')).toBe(false);
    });
  });

  describe('getProjectId', () => {
    test('returns local fallback when not in git repo', () => {
      const projectId = getProjectId(tempDir);
      expect(projectId).toMatch(/^local:/);
      expect(projectId).toContain(path.basename(tempDir));
    });
  });

  describe('suppression storage', () => {
    test('loadAutoSuppressions returns empty for non-existent file', () => {
      const result = loadAutoSuppressions(suppressionPath, 'test-project');
      expect(result.patterns).toEqual({});
      expect(result.stats.totalSuppressed).toBe(0);
    });

    test('saveAutoSuppressions creates file and saves findings', () => {
      const findings = [
        {
          patternId: 'vague_instructions',
          file: 'test.md',
          suppressionReason: 'Pattern documentation',
          confidence: 0.95
        },
        {
          patternId: 'vague_instructions',
          file: 'test2.md',
          suppressionReason: 'Pattern documentation',
          confidence: 0.92
        }
      ];

      saveAutoSuppressions(suppressionPath, 'test-project', findings);

      expect(fs.existsSync(suppressionPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(suppressionPath, 'utf8'));
      expect(data.version).toBe('2.0');
      expect(data.projects['test-project']).toBeDefined();
      expect(data.projects['test-project'].auto_learned.patterns.vague_instructions).toBeDefined();
      expect(data.projects['test-project'].auto_learned.patterns.vague_instructions.files).toContain('test.md');
      expect(data.projects['test-project'].auto_learned.patterns.vague_instructions.files).toContain('test2.md');
      expect(data.projects['test-project'].auto_learned.patterns.vague_instructions.confidence).toBe(0.95);
    });

    test('saveAutoSuppressions merges with existing data', () => {
      // Save first batch
      saveAutoSuppressions(suppressionPath, 'test-project', [
        { patternId: 'pattern_a', file: 'a.md', confidence: 0.91 }
      ]);

      // Save second batch
      saveAutoSuppressions(suppressionPath, 'test-project', [
        { patternId: 'pattern_b', file: 'b.md', confidence: 0.92 }
      ]);

      const data = JSON.parse(fs.readFileSync(suppressionPath, 'utf8'));
      expect(data.projects['test-project'].auto_learned.patterns.pattern_a).toBeDefined();
      expect(data.projects['test-project'].auto_learned.patterns.pattern_b).toBeDefined();
    });

    test('loadAutoSuppressions retrieves saved data', () => {
      saveAutoSuppressions(suppressionPath, 'test-project', [
        { patternId: 'test_pattern', file: 'test.md', confidence: 0.93 }
      ]);

      const loaded = loadAutoSuppressions(suppressionPath, 'test-project');
      expect(loaded.patterns.test_pattern).toBeDefined();
      expect(loaded.patterns.test_pattern.files).toContain('test.md');
    });

    test('clearAutoSuppressions removes project suppressions', () => {
      saveAutoSuppressions(suppressionPath, 'test-project', [
        { patternId: 'test_pattern', file: 'test.md', confidence: 0.93 }
      ]);

      clearAutoSuppressions(suppressionPath, 'test-project');

      const loaded = loadAutoSuppressions(suppressionPath, 'test-project');
      expect(loaded.patterns).toEqual({});
      expect(loaded.stats.totalSuppressed).toBe(0);
    });

    test('saveAutoSuppressions does nothing with empty findings', () => {
      saveAutoSuppressions(suppressionPath, 'test-project', []);
      expect(fs.existsSync(suppressionPath)).toBe(false);

      saveAutoSuppressions(suppressionPath, 'test-project', null);
      expect(fs.existsSync(suppressionPath)).toBe(false);
    });

    test('maintains project isolation', () => {
      saveAutoSuppressions(suppressionPath, 'project-a', [
        { patternId: 'pattern_a', file: 'a.md', confidence: 0.91 }
      ]);
      saveAutoSuppressions(suppressionPath, 'project-b', [
        { patternId: 'pattern_b', file: 'b.md', confidence: 0.92 }
      ]);

      const loadedA = loadAutoSuppressions(suppressionPath, 'project-a');
      const loadedB = loadAutoSuppressions(suppressionPath, 'project-b');

      expect(loadedA.patterns.pattern_a).toBeDefined();
      expect(loadedA.patterns.pattern_b).toBeUndefined();
      expect(loadedB.patterns.pattern_b).toBeDefined();
      expect(loadedB.patterns.pattern_a).toBeUndefined();
    });
  });

  describe('mergeSuppressions', () => {
    test('merges auto-learned with manual suppressions', () => {
      const autoLearned = {
        patterns: {
          pattern_a: { files: ['a.md'], confidence: 0.95 }
        },
        stats: { totalSuppressed: 1 }
      };

      const manual = {
        ignore: {
          patterns: ['manual_pattern'],
          files: ['ignored/**'],
          rules: { some_rule: 'off' }
        },
        severity: { pattern_x: 'LOW' }
      };

      const merged = mergeSuppressions(autoLearned, manual);

      expect(merged.ignore.patterns).toContain('manual_pattern');
      expect(merged.ignore.files).toContain('ignored/**');
      expect(merged.ignore.rules.some_rule).toBe('off');
      expect(merged.severity.pattern_x).toBe('LOW');
      expect(merged.auto_learned.patterns.pattern_a).toBeDefined();
    });

    test('handles missing fields gracefully', () => {
      const merged = mergeSuppressions({ patterns: {} }, {});
      expect(merged.ignore.patterns).toEqual([]);
      expect(merged.ignore.files).toEqual([]);
      expect(merged.ignore.rules).toEqual({});
      expect(merged.severity).toEqual({});
    });
  });

  describe('export/import', () => {
    test('exportAutoSuppressions produces shareable format', () => {
      saveAutoSuppressions(suppressionPath, 'test-project', [
        { patternId: 'pattern_a', file: 'a.md', confidence: 0.95, suppressionReason: 'Test reason' }
      ]);

      const exported = exportAutoSuppressions(suppressionPath, 'test-project');

      expect(exported.projectId).toBe('test-project');
      expect(exported.exportedAt).toBeDefined();
      expect(exported.suppressions.pattern_a).toBeDefined();
    });

    test('importAutoSuppressions loads shared suppressions', () => {
      const importData = {
        projectId: 'shared-project',
        exportedAt: new Date().toISOString(),
        suppressions: {
          shared_pattern: {
            files: ['shared.md'],
            reason: 'Shared suppression',
            confidence: 0.94
          }
        }
      };

      importAutoSuppressions(suppressionPath, 'test-project', importData);

      const loaded = loadAutoSuppressions(suppressionPath, 'test-project');
      expect(loaded.patterns.shared_pattern).toBeDefined();
      expect(loaded.patterns.shared_pattern.files).toContain('shared.md');
    });
  });

  describe('analyzeForAutoSuppression', () => {
    test('identifies suppressible findings from file contents', () => {
      const findings = [
        {
          patternId: 'vague_instructions',
          file: 'enhance.md',
          line: 10
        }
      ];

      const fileContents = new Map();
      fileContents.set('enhance.md', `
| Pattern | Description |
|---------|-------------|
| Vague instructions | Fuzzy language like "usually" |
`);

      const result = analyzeForAutoSuppression(findings, fileContents, {});

      expect(result.length).toBe(1);
      expect(result[0].suppressed).toBe(true);
      expect(result[0].confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    test('respects noLearn option', () => {
      const findings = [{ patternId: 'vague_instructions', file: 'test.md' }];
      const fileContents = new Map();
      fileContents.set('test.md', '| Pattern | usually |');

      const result = analyzeForAutoSuppression(findings, fileContents, { noLearn: true });
      expect(result).toEqual([]);
    });

    test('skips findings without file content', () => {
      const findings = [
        { patternId: 'vague_instructions', file: 'missing.md' }
      ];
      const fileContents = new Map(); // No content for missing.md

      const result = analyzeForAutoSuppression(findings, fileContents, {});
      expect(result.length).toBe(0);
    });
  });

  describe('PATTERN_HEURISTICS', () => {
    test('has heuristics for expected patterns', () => {
      expect(PATTERN_HEURISTICS.vague_instructions).toBeDefined();
      expect(PATTERN_HEURISTICS.aggressive_emphasis).toBeDefined();
      expect(PATTERN_HEURISTICS.missing_examples).toBeDefined();
      expect(PATTERN_HEURISTICS.missing_output_format).toBeDefined();
      expect(PATTERN_HEURISTICS.missing_constraints).toBeDefined();
    });

    test('redundant_cot detects multi-phase workflows', () => {
      const finding = { patternId: 'redundant_cot', line: 50 };
      const content = `
### Phase 1: Discovery
Do something.

### Phase 2: Analysis
Do more.

### Phase 3: Report
Generate output.
`;
      const result = PATTERN_HEURISTICS.redundant_cot(finding, content, {});
      expect(result).not.toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });
  });

  describe('CONFIDENCE_THRESHOLD', () => {
    test('is set to 0.90', () => {
      expect(CONFIDENCE_THRESHOLD).toBe(0.90);
    });
  });
});
