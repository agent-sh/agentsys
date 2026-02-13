/**
 * Collectors Module Tests
 *
 * Tests for lib/collectors modules:
 * - index.js (main exports)
 * - github.js (GitHub data collection)
 * - documentation.js (documentation analysis)
 * - codebase.js (codebase scanning)
 * - docs-patterns.js (documentation patterns)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import modules under test
const collectors = require('@agentsys/lib/collectors');
const github = require('@agentsys/lib/collectors/github');
const documentation = require('@agentsys/lib/collectors/documentation');
const codebase = require('@agentsys/lib/collectors/codebase');
const docsPatterns = require('@agentsys/lib/collectors/docs-patterns');

describe('Collectors Index', () => {
  describe('exports', () => {
    it('should export collect function', () => {
      expect(typeof collectors.collect).toBe('function');
    });

    it('should export collectAllData function', () => {
      expect(typeof collectors.collectAllData).toBe('function');
    });

    it('should export individual collectors', () => {
      expect(collectors.github).toBeDefined();
      expect(collectors.documentation).toBeDefined();
      expect(collectors.codebase).toBeDefined();
      expect(collectors.docsPatterns).toBeDefined();
    });

    it('should re-export commonly used functions', () => {
      expect(typeof collectors.scanGitHubState).toBe('function');
      expect(typeof collectors.isGhAvailable).toBe('function');
      expect(typeof collectors.analyzeDocumentation).toBe('function');
      expect(typeof collectors.scanCodebase).toBe('function');
      expect(typeof collectors.findRelatedDocs).toBe('function');
      expect(typeof collectors.analyzeDocIssues).toBe('function');
      expect(typeof collectors.checkChangelog).toBe('function');
    });

    it('should export DEFAULT_OPTIONS', () => {
      expect(collectors.DEFAULT_OPTIONS).toBeDefined();
      expect(collectors.DEFAULT_OPTIONS.collectors).toEqual(['github', 'docs', 'code']);
      expect(collectors.DEFAULT_OPTIONS.depth).toBe('thorough');
    });
  });

  describe('collect', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collectors-test-'));
    });

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should return data object with timestamp', () => {
      const result = collectors.collect({ cwd: tempDir, collectors: [] });

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('should include options in result', () => {
      const result = collectors.collect({ cwd: tempDir, collectors: [], depth: 'quick' });

      expect(result.options.cwd).toBe(tempDir);
      expect(result.options.depth).toBe('quick');
    });

    it('should collect docs when specified', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Project');

      const result = collectors.collect({ cwd: tempDir, collectors: ['docs'] });

      expect(result.docs).not.toBeNull();
      expect(result.docs.files['README.md']).toBeDefined();
    });

    it('should collect code when specified', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));

      const result = collectors.collect({ cwd: tempDir, collectors: ['code'] });

      expect(result.code).not.toBeNull();
      expect(result.code.summary).toBeDefined();
    });

    it('should collect docs-patterns when specified', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');

      const result = collectors.collect({
        cwd: tempDir,
        collectors: ['docs-patterns'],
        changedFiles: []
      });

      expect(result.docsPatterns).not.toBeNull();
      expect(result.docsPatterns.markdownFiles).toBeDefined();
    });

    it('should return null for collectors not specified', () => {
      const result = collectors.collect({ cwd: tempDir, collectors: [] });

      expect(result.github).toBeNull();
      expect(result.docs).toBeNull();
      expect(result.code).toBeNull();
      expect(result.docsPatterns).toBeNull();
    });

    it('should handle string collectors option gracefully', () => {
      // If collectors is not an array, should use default
      const result = collectors.collect({ cwd: tempDir, collectors: 'invalid' });

      expect(result.options).toBeDefined();
    });
  });

  describe('collectAllData', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collect-all-test-'));
    });

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should map legacy sources option to collectors', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');

      const result = collectors.collectAllData({
        cwd: tempDir,
        sources: ['docs']
      });

      expect(result.docs).not.toBeNull();
      expect(result.code).toBeNull();
    });

    it('should prefer sources over collectors when both provided', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));

      const result = collectors.collectAllData({
        cwd: tempDir,
        collectors: ['docs'],
        sources: ['code'] // Legacy option takes precedence for backward compatibility
      });

      expect(result.code).not.toBeNull();
      expect(result.docs).toBeNull();
    });

    it('should default to github, docs, code collectors', () => {
      const result = collectors.collectAllData({ cwd: tempDir });

      // GitHub may or may not be available, but docs and code should be collected
      expect(result.docs).not.toBeNull();
      expect(result.code).not.toBeNull();
    });
  });
});

describe('GitHub Collector', () => {
  describe('DEFAULT_OPTIONS', () => {
    it('should have expected defaults', () => {
      expect(github.DEFAULT_OPTIONS.issueLimit).toBe(100);
      expect(github.DEFAULT_OPTIONS.prLimit).toBe(50);
      expect(github.DEFAULT_OPTIONS.timeout).toBe(10000);
    });
  });

  describe('summarizeIssue', () => {
    it('should summarize issue with all fields', () => {
      const issue = {
        number: 42,
        title: 'Test Issue',
        labels: [{ name: 'bug' }, { name: 'high-priority' }],
        milestone: { title: 'v1.0' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        body: 'This is the issue body content.'
      };

      const result = github.summarizeIssue(issue);

      expect(result.number).toBe(42);
      expect(result.title).toBe('Test Issue');
      expect(result.labels).toEqual(['bug', 'high-priority']);
      expect(result.milestone).toBe('v1.0');
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(result.updatedAt).toBe('2024-01-02T00:00:00Z');
      expect(result.snippet).toBe('This is the issue body content.');
    });

    it('should handle missing labels', () => {
      const issue = { number: 1, title: 'Test' };

      const result = github.summarizeIssue(issue);

      expect(result.labels).toEqual([]);
    });

    it('should handle string labels', () => {
      const issue = {
        number: 1,
        title: 'Test',
        labels: ['bug', 'feature']
      };

      const result = github.summarizeIssue(issue);

      expect(result.labels).toEqual(['bug', 'feature']);
    });

    it('should handle string milestone', () => {
      const issue = {
        number: 1,
        title: 'Test',
        milestone: 'v2.0'
      };

      const result = github.summarizeIssue(issue);

      expect(result.milestone).toBe('v2.0');
    });

    it('should truncate long body', () => {
      const longBody = 'x'.repeat(300);
      const issue = {
        number: 1,
        title: 'Test',
        body: longBody
      };

      const result = github.summarizeIssue(issue);

      expect(result.snippet.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(result.snippet.endsWith('...')).toBe(true);
    });

    it('should handle null body', () => {
      const issue = { number: 1, title: 'Test', body: null };

      const result = github.summarizeIssue(issue);

      expect(result.snippet).toBe('');
    });

    it('should replace newlines in body snippet', () => {
      const issue = {
        number: 1,
        title: 'Test',
        body: 'Line 1\nLine 2\nLine 3'
      };

      const result = github.summarizeIssue(issue);

      expect(result.snippet).not.toContain('\n');
      expect(result.snippet).toBe('Line 1 Line 2 Line 3');
    });
  });

  describe('summarizePR', () => {
    it('should summarize PR with all fields', () => {
      const pr = {
        number: 123,
        title: 'Fix bug',
        labels: [{ name: 'bugfix' }],
        isDraft: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        files: ['src/index.js', 'tests/test.js'],
        body: 'This PR fixes a bug.'
      };

      const result = github.summarizePR(pr);

      expect(result.number).toBe(123);
      expect(result.title).toBe('Fix bug');
      expect(result.labels).toEqual(['bugfix']);
      expect(result.isDraft).toBe(false);
      expect(result.files).toEqual(['src/index.js', 'tests/test.js']);
      expect(result.snippet).toBe('This PR fixes a bug.');
    });

    it('should handle draft PR', () => {
      const pr = { number: 1, title: 'WIP', isDraft: true };

      const result = github.summarizePR(pr);

      expect(result.isDraft).toBe(true);
    });

    it('should truncate long PR body to 150 chars', () => {
      const longBody = 'x'.repeat(200);
      const pr = { number: 1, title: 'Test', body: longBody };

      const result = github.summarizePR(pr);

      expect(result.snippet.length).toBeLessThanOrEqual(153); // 150 + '...'
      expect(result.snippet.endsWith('...')).toBe(true);
    });

    it('should handle missing files', () => {
      const pr = { number: 1, title: 'Test' };

      const result = github.summarizePR(pr);

      expect(result.files).toEqual([]);
    });
  });

  describe('categorizeIssues', () => {
    it('should categorize bugs', () => {
      const result = {
        categorized: { bugs: [], features: [], security: [], enhancements: [], other: [] }
      };
      const issues = [
        { number: 1, title: 'Bug fix', labels: [{ name: 'bug' }] },
        { number: 2, title: 'Type bug', labels: [{ name: 'type: bug' }] }
      ];

      github.categorizeIssues(result, issues);

      expect(result.categorized.bugs).toHaveLength(2);
      expect(result.categorized.bugs[0].number).toBe(1);
      expect(result.categorized.bugs[1].number).toBe(2);
    });

    it('should categorize features', () => {
      const result = {
        categorized: { bugs: [], features: [], security: [], enhancements: [], other: [] }
      };
      const issues = [
        { number: 1, title: 'New feature', labels: [{ name: 'feature' }] },
        { number: 2, title: 'Type feature', labels: [{ name: 'type: feature' }] }
      ];

      github.categorizeIssues(result, issues);

      expect(result.categorized.features).toHaveLength(2);
    });

    it('should categorize security issues', () => {
      const result = {
        categorized: { bugs: [], features: [], security: [], enhancements: [], other: [] }
      };
      const issues = [
        { number: 1, title: 'Security fix', labels: [{ name: 'security' }] },
        { number: 2, title: 'Sec issue', labels: [{ name: 'type: security' }] }
      ];

      github.categorizeIssues(result, issues);

      expect(result.categorized.security).toHaveLength(2);
    });

    it('should categorize enhancements', () => {
      const result = {
        categorized: { bugs: [], features: [], security: [], enhancements: [], other: [] }
      };
      const issues = [
        { number: 1, title: 'Improve perf', labels: [{ name: 'enhancement' }] }
      ];

      github.categorizeIssues(result, issues);

      expect(result.categorized.enhancements).toHaveLength(1);
    });

    it('should put unmatched issues in other', () => {
      const result = {
        categorized: { bugs: [], features: [], security: [], enhancements: [], other: [] }
      };
      const issues = [
        { number: 1, title: 'Documentation', labels: [{ name: 'docs' }] },
        { number: 2, title: 'Question', labels: [] }
      ];

      github.categorizeIssues(result, issues);

      expect(result.categorized.other).toHaveLength(2);
    });

    it('should handle case-insensitive label matching', () => {
      const result = {
        categorized: { bugs: [], features: [], security: [], enhancements: [], other: [] }
      };
      const issues = [
        { number: 1, title: 'Bug', labels: [{ name: 'BUG' }] },
        { number: 2, title: 'Feature', labels: [{ name: 'FEATURE' }] }
      ];

      github.categorizeIssues(result, issues);

      expect(result.categorized.bugs).toHaveLength(1);
      expect(result.categorized.features).toHaveLength(1);
    });
  });

  describe('findStaleItems', () => {
    it('should find stale items older than specified days', () => {
      const result = { stale: [] };
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const items = [
        { number: 1, title: 'Old issue', updatedAt: oldDate.toISOString() }
      ];

      github.findStaleItems(result, items, 90);

      expect(result.stale).toHaveLength(1);
      expect(result.stale[0].number).toBe(1);
      expect(result.stale[0].daysStale).toBeGreaterThanOrEqual(100);
    });

    it('should not mark recent items as stale', () => {
      const result = { stale: [] };
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      const items = [
        { number: 1, title: 'Recent issue', updatedAt: recentDate.toISOString() }
      ];

      github.findStaleItems(result, items, 90);

      expect(result.stale).toHaveLength(0);
    });

    it('should include item details in stale result', () => {
      const result = { stale: [] };
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 120);

      const items = [
        { number: 42, title: 'Stale PR', updatedAt: oldDate.toISOString() }
      ];

      github.findStaleItems(result, items, 30);

      expect(result.stale[0]).toEqual({
        number: 42,
        title: 'Stale PR',
        lastUpdated: oldDate.toISOString(),
        daysStale: expect.any(Number)
      });
    });
  });

  describe('extractThemes', () => {
    it('should extract common words from issue titles', () => {
      const result = { themes: [] };
      const issues = [
        { title: 'Performance issue in dashboard' },
        { title: 'Performance problem with charts' },
        { title: 'Dashboard loading slow' }
      ];

      github.extractThemes(result, issues);

      const themeWords = result.themes.map(t => t.word);
      expect(themeWords).toContain('performance');
      expect(themeWords).toContain('dashboard');
    });

    it('should exclude stop words', () => {
      const result = { themes: [] };
      const issues = [
        { title: 'The issue is with the API' },
        { title: 'The problem is in the code' }
      ];

      github.extractThemes(result, issues);

      const themeWords = result.themes.map(t => t.word);
      expect(themeWords).not.toContain('the');
      expect(themeWords).not.toContain('is');
      expect(themeWords).not.toContain('with');
    });

    it('should exclude short words', () => {
      const result = { themes: [] };
      const issues = [
        { title: 'Bug in API' },
        { title: 'Fix the API' }
      ];

      github.extractThemes(result, issues);

      const themeWords = result.themes.map(t => t.word);
      expect(themeWords).not.toContain('bug');
      expect(themeWords).not.toContain('fix');
    });

    it('should limit to top 10 themes', () => {
      const result = { themes: [] };
      const issues = [];
      const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo',
        'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'];

      for (const word of words) {
        issues.push({ title: `${word} ${word} issue` });
        issues.push({ title: `${word} problem` });
      }

      github.extractThemes(result, issues);

      expect(result.themes.length).toBeLessThanOrEqual(10);
    });

    it('should sort by count descending', () => {
      const result = { themes: [] };
      const issues = [
        { title: 'Performance issue' },
        { title: 'Dashboard slow' },
        { title: 'Performance dashboard' },
        { title: 'Performance again' }
      ];

      github.extractThemes(result, issues);

      expect(result.themes[0].word).toBe('performance');
      expect(result.themes[0].count).toBe(3);
    });

    it('should handle empty title', () => {
      const result = { themes: [] };
      const issues = [
        { title: '' },
        { title: null }
      ];

      github.extractThemes(result, issues);

      expect(result.themes).toEqual([]);
    });
  });

  describe('findOverdueMilestones', () => {
    it('should find overdue milestones', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const result = {
        milestones: [
          { title: 'v1.0', state: 'open', due_on: pastDate.toISOString(), open_issues: 5 }
        ],
        overdueMilestones: []
      };

      github.findOverdueMilestones(result);

      expect(result.overdueMilestones).toHaveLength(1);
      expect(result.overdueMilestones[0].title).toBe('v1.0');
    });

    it('should not include closed milestones', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const result = {
        milestones: [
          { title: 'v1.0', state: 'closed', due_on: pastDate.toISOString() }
        ],
        overdueMilestones: []
      };

      github.findOverdueMilestones(result);

      expect(result.overdueMilestones).toHaveLength(0);
    });

    it('should not include milestones without due date', () => {
      const result = {
        milestones: [
          { title: 'v2.0', state: 'open', due_on: null }
        ],
        overdueMilestones: []
      };

      github.findOverdueMilestones(result);

      expect(result.overdueMilestones).toHaveLength(0);
    });

    it('should not include future milestones', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const result = {
        milestones: [
          { title: 'v3.0', state: 'open', due_on: futureDate.toISOString() }
        ],
        overdueMilestones: []
      };

      github.findOverdueMilestones(result);

      expect(result.overdueMilestones).toHaveLength(0);
    });
  });

  describe('scanGitHubState', () => {
    it('should return unavailable result when gh CLI not available', () => {
      // This test relies on gh not being authenticated in the test environment
      // or returns available: true if it is
      const result = github.scanGitHubState({ cwd: os.tmpdir() });

      expect(result.summary).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.prs).toBeDefined();
      expect(result.categorized).toBeDefined();
    });
  });
});

describe('Documentation Collector', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-collector-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('isPathSafe', () => {
    it('should return true for paths within base', () => {
      expect(documentation.isPathSafe('README.md', tempDir)).toBe(true);
      expect(documentation.isPathSafe('docs/guide.md', tempDir)).toBe(true);
    });

    it('should return false for path traversal attempts', () => {
      expect(documentation.isPathSafe('../../../etc/passwd', tempDir)).toBe(false);
      expect(documentation.isPathSafe('/etc/passwd', tempDir)).toBe(false);
    });
  });

  describe('safeReadFile', () => {
    it('should read file within base path', () => {
      const filePath = 'test.txt';
      fs.writeFileSync(path.join(tempDir, filePath), 'content');

      const result = documentation.safeReadFile(filePath, tempDir);

      expect(result).toBe('content');
    });

    it('should return null for non-existent file', () => {
      const result = documentation.safeReadFile('nonexistent.txt', tempDir);

      expect(result).toBeNull();
    });

    it('should return null for path traversal attempt', () => {
      const result = documentation.safeReadFile('../../../etc/passwd', tempDir);

      expect(result).toBeNull();
    });
  });

  describe('analyzeMarkdownFile', () => {
    it('should count sections', () => {
      const content = `# Title
## Section 1
Content
## Section 2
More content
## Section 3
Even more`;

      const result = documentation.analyzeMarkdownFile(content, 'test.md');

      expect(result.sectionCount).toBe(3);
      expect(result.sections).toContain('Section 1');
      expect(result.sections).toContain('Section 2');
      expect(result.sections).toContain('Section 3');
    });

    it('should detect installation section', () => {
      const content = `# Project
## Installation
Run npm install`;

      const result = documentation.analyzeMarkdownFile(content, 'test.md');

      expect(result.hasInstallation).toBe(true);
    });

    it('should detect usage section', () => {
      const content = `# Project
## Usage
Import and use`;

      const result = documentation.analyzeMarkdownFile(content, 'test.md');

      expect(result.hasUsage).toBe(true);
    });

    it('should detect API section', () => {
      const content = `# Project
## API Reference
Methods and functions`;

      const result = documentation.analyzeMarkdownFile(content, 'test.md');

      expect(result.hasApi).toBe(true);
    });

    it('should detect testing section', () => {
      const content = `# Project
## Testing
Run npm test`;

      const result = documentation.analyzeMarkdownFile(content, 'test.md');

      expect(result.hasTesting).toBe(true);
    });

    it('should count code blocks', () => {
      const content = `# Project
\`\`\`javascript
const x = 1;
\`\`\`
\`\`\`bash
npm install
\`\`\``;

      const result = documentation.analyzeMarkdownFile(content, 'test.md');

      expect(result.codeBlocks).toBe(2);
    });

    it('should count words', () => {
      const content = 'This is a test with several words in it.';

      const result = documentation.analyzeMarkdownFile(content, 'test.md');

      expect(result.wordCount).toBe(9);
    });

    it('should limit sections to 10', () => {
      const sections = Array.from({ length: 15 }, (_, i) => `## Section ${i + 1}`).join('\n');
      const content = `# Title\n${sections}`;

      const result = documentation.analyzeMarkdownFile(content, 'test.md');

      expect(result.sections.length).toBe(10);
      expect(result.sectionCount).toBe(15);
    });
  });

  describe('extractCheckboxes', () => {
    it('should count checked checkboxes', () => {
      const result = { checkboxes: { total: 0, checked: 0, unchecked: 0 } };
      const content = `- [x] Task 1
- [x] Task 2
* [x] Task 3`;

      documentation.extractCheckboxes(result, content);

      expect(result.checkboxes.checked).toBe(3);
    });

    it('should count unchecked checkboxes', () => {
      const result = { checkboxes: { total: 0, checked: 0, unchecked: 0 } };
      const content = `- [ ] Task 1
- [ ] Task 2`;

      documentation.extractCheckboxes(result, content);

      expect(result.checkboxes.unchecked).toBe(2);
    });

    it('should calculate total', () => {
      const result = { checkboxes: { total: 0, checked: 0, unchecked: 0 } };
      const content = `- [x] Done
- [ ] Todo
- [x] Also done`;

      documentation.extractCheckboxes(result, content);

      expect(result.checkboxes.total).toBe(3);
      expect(result.checkboxes.checked).toBe(2);
      expect(result.checkboxes.unchecked).toBe(1);
    });

    it('should handle case-insensitive X', () => {
      const result = { checkboxes: { total: 0, checked: 0, unchecked: 0 } };
      const content = `- [X] Uppercase
- [x] Lowercase`;

      documentation.extractCheckboxes(result, content);

      expect(result.checkboxes.checked).toBe(2);
    });
  });

  describe('extractFeatures', () => {
    it('should extract feature bullet points', () => {
      const result = { features: [] };
      const content = `- **Feature A** - Does something
- Feature B - Does another thing
* Feature C`;

      documentation.extractFeatures(result, content);

      expect(result.features.length).toBeGreaterThan(0);
    });

    it('should limit to 20 features', () => {
      const result = { features: [] };
      const features = Array.from({ length: 30 }, (_, i) => `- Feature ${i + 1} description`).join('\n');

      documentation.extractFeatures(result, features);

      expect(result.features.length).toBeLessThanOrEqual(20);
    });

    it('should filter out too short features', () => {
      const result = { features: [] };
      const content = `- Hi
- This is a reasonable feature`;

      documentation.extractFeatures(result, content);

      const hasShort = result.features.some(f => f.length <= 5);
      expect(hasShort).toBe(false);
    });

    it('should deduplicate features', () => {
      const result = { features: [] };
      const content = `- Feature Alpha
- Feature Alpha
- Feature Beta`;

      documentation.extractFeatures(result, content);

      const alphaCount = result.features.filter(f => f === 'Feature Alpha').length;
      expect(alphaCount).toBeLessThanOrEqual(1);
    });
  });

  describe('extractPlans', () => {
    it('should extract TODO items', () => {
      const result = { plans: [] };
      const content = `TODO: Add authentication
FIXME: Fix the bug
PLAN: Implement feature X`;

      documentation.extractPlans(result, content);

      expect(result.plans.length).toBe(3);
    });

    it('should extract roadmap sections', () => {
      const result = { plans: [] };
      const content = `## Roadmap
## Future Plans
## Coming Soon`;

      documentation.extractPlans(result, content);

      expect(result.plans.length).toBeGreaterThan(0);
    });

    it('should limit plans to 15', () => {
      const result = { plans: [] };
      const todos = Array.from({ length: 20 }, (_, i) => `TODO: Task ${i + 1}`).join('\n');

      documentation.extractPlans(result, todos);

      expect(result.plans.length).toBeLessThanOrEqual(15);
    });
  });

  describe('identifyDocGaps', () => {
    it('should report missing README', () => {
      const result = { files: {}, gaps: [] };

      documentation.identifyDocGaps(result);

      const readmeGap = result.gaps.find(g => g.file === 'README.md' && g.type === 'missing');
      expect(readmeGap).toBeDefined();
      expect(readmeGap.severity).toBe('high');
    });

    it('should report missing installation section', () => {
      const result = {
        files: { 'README.md': { hasInstallation: false, hasUsage: true } },
        gaps: []
      };

      documentation.identifyDocGaps(result);

      const gap = result.gaps.find(g => g.section === 'Installation');
      expect(gap).toBeDefined();
      expect(gap.severity).toBe('medium');
    });

    it('should report missing usage section', () => {
      const result = {
        files: { 'README.md': { hasInstallation: true, hasUsage: false } },
        gaps: []
      };

      documentation.identifyDocGaps(result);

      const gap = result.gaps.find(g => g.section === 'Usage');
      expect(gap).toBeDefined();
    });

    it('should report missing CHANGELOG', () => {
      const result = { files: { 'README.md': {} }, gaps: [] };

      documentation.identifyDocGaps(result);

      const gap = result.gaps.find(g => g.file === 'CHANGELOG.md');
      expect(gap).toBeDefined();
      expect(gap.severity).toBe('low');
    });
  });

  describe('analyzeDocumentation', () => {
    it('should analyze README.md', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), `# Project
## Installation
npm install
## Usage
Import and use`);

      const result = documentation.analyzeDocumentation({ cwd: tempDir });

      expect(result.files['README.md']).toBeDefined();
      expect(result.files['README.md'].hasInstallation).toBe(true);
      expect(result.files['README.md'].hasUsage).toBe(true);
    });

    it('should count total files', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Project');
      fs.writeFileSync(path.join(tempDir, 'CHANGELOG.md'), '# Changelog');

      const result = documentation.analyzeDocumentation({ cwd: tempDir });

      expect(result.summary.fileCount).toBe(2);
    });

    it('should calculate total word count', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), 'One two three four five');
      fs.writeFileSync(path.join(tempDir, 'CHANGELOG.md'), 'Six seven eight');

      const result = documentation.analyzeDocumentation({ cwd: tempDir });

      expect(result.summary.totalWords).toBe(8);
    });

    it('should scan docs directory in thorough mode', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir);
      fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide');

      const result = documentation.analyzeDocumentation({ cwd: tempDir, depth: 'thorough' });

      expect(result.files['docs/guide.md']).toBeDefined();
    });

    it('should skip additional docs in quick mode', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir);
      fs.writeFileSync(path.join(docsDir, 'extra.md'), '# Extra');

      const result = documentation.analyzeDocumentation({ cwd: tempDir, depth: 'quick' });

      expect(result.files['docs/extra.md']).toBeUndefined();
    });
  });
});

describe('Codebase Collector', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebase-collector-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constants', () => {
    it('should export EXCLUDE_DIRS', () => {
      expect(codebase.EXCLUDE_DIRS).toContain('node_modules');
      expect(codebase.EXCLUDE_DIRS).toContain('.git');
      expect(codebase.EXCLUDE_DIRS).toContain('dist');
    });

    it('should export SOURCE_EXTENSIONS', () => {
      expect(codebase.SOURCE_EXTENSIONS.js).toContain('.js');
      expect(codebase.SOURCE_EXTENSIONS.js).toContain('.ts');
      expect(codebase.SOURCE_EXTENSIONS.python).toContain('.py');
    });
  });

  describe('shouldExclude', () => {
    it('should exclude node_modules', () => {
      expect(codebase.shouldExclude('node_modules/package/index.js')).toBe(true);
    });

    it('should exclude .git', () => {
      expect(codebase.shouldExclude('.git/objects/abc')).toBe(true);
    });

    it('should not exclude regular paths', () => {
      expect(codebase.shouldExclude('src/index.js')).toBe(false);
      expect(codebase.shouldExclude('lib/utils.js')).toBe(false);
    });

    it('should handle Windows paths', () => {
      expect(codebase.shouldExclude('node_modules\\package\\index.js')).toBe(true);
    });
  });

  describe('detectFrameworks', () => {
    it('should detect React', () => {
      const result = { frameworks: [] };
      const pkg = { dependencies: { react: '^18.0.0' } };

      codebase.detectFrameworks(result, pkg);

      expect(result.frameworks).toContain('React');
    });

    it('should detect Next.js', () => {
      const result = { frameworks: [] };
      const pkg = { dependencies: { next: '^14.0.0' } };

      codebase.detectFrameworks(result, pkg);

      expect(result.frameworks).toContain('Next.js');
    });

    it('should detect Express', () => {
      const result = { frameworks: [] };
      const pkg = { dependencies: { express: '^4.0.0' } };

      codebase.detectFrameworks(result, pkg);

      expect(result.frameworks).toContain('Express');
    });

    it('should check devDependencies too', () => {
      const result = { frameworks: [] };
      const pkg = { devDependencies: { react: '^18.0.0' } };

      codebase.detectFrameworks(result, pkg);

      expect(result.frameworks).toContain('React');
    });

    it('should deduplicate frameworks', () => {
      const result = { frameworks: [] };
      const pkg = { dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' } };

      codebase.detectFrameworks(result, pkg);

      const reactCount = result.frameworks.filter(f => f === 'React').length;
      expect(reactCount).toBe(1);
    });
  });

  describe('detectTestFramework', () => {
    it('should detect Jest', () => {
      const result = { testFramework: null, health: { hasTests: false } };
      const pkg = { devDependencies: { jest: '^29.0.0' } };

      codebase.detectTestFramework(result, pkg);

      expect(result.testFramework).toBe('jest');
      expect(result.health.hasTests).toBe(true);
    });

    it('should detect Mocha', () => {
      const result = { testFramework: null, health: { hasTests: false } };
      const pkg = { devDependencies: { mocha: '^10.0.0' } };

      codebase.detectTestFramework(result, pkg);

      expect(result.testFramework).toBe('mocha');
    });

    it('should detect Vitest', () => {
      const result = { testFramework: null, health: { hasTests: false } };
      const pkg = { devDependencies: { vitest: '^1.0.0' } };

      codebase.detectTestFramework(result, pkg);

      expect(result.testFramework).toBe('vitest');
    });

    it('should prefer first matching framework', () => {
      const result = { testFramework: null, health: { hasTests: false } };
      const pkg = { devDependencies: { jest: '^29.0.0', mocha: '^10.0.0' } };

      codebase.detectTestFramework(result, pkg);

      expect(result.testFramework).toBe('jest');
    });
  });

  describe('extractSymbols', () => {
    it('should extract named functions', () => {
      const content = `
function foo() {}
async function bar() {}`;

      const result = codebase.extractSymbols(content);

      expect(result.functions).toContain('foo');
      expect(result.functions).toContain('bar');
    });

    it('should extract arrow functions', () => {
      const content = `
const foo = () => {};
const bar = async (x) => x;
let baz = (a, b) => a + b;`;

      const result = codebase.extractSymbols(content);

      expect(result.functions).toContain('foo');
      expect(result.functions).toContain('bar');
      expect(result.functions).toContain('baz');
    });

    it('should extract classes', () => {
      const content = `
class MyClass {}
class AnotherClass extends Base {}`;

      const result = codebase.extractSymbols(content);

      expect(result.classes).toContain('MyClass');
      expect(result.classes).toContain('AnotherClass');
    });

    it('should extract named exports', () => {
      const content = `
export function foo() {}
export class Bar {}
export const baz = 1;`;

      const result = codebase.extractSymbols(content);

      expect(result.exports).toContain('foo');
      expect(result.exports).toContain('Bar');
      expect(result.exports).toContain('baz');
    });

    it('should extract module.exports', () => {
      const content = `
module.exports = {
  foo,
  bar,
  baz: something
};`;

      const result = codebase.extractSymbols(content);

      expect(result.exports).toContain('foo');
      expect(result.exports).toContain('bar');
      expect(result.exports).toContain('baz');
    });

    it('should deduplicate symbols', () => {
      const content = `
function foo() {}
function foo() {} // duplicate
const foo = () => {};`;

      const result = codebase.extractSymbols(content);

      const fooCount = result.functions.filter(f => f === 'foo').length;
      expect(fooCount).toBe(1);
    });
  });

  describe('detectHealth', () => {
    it('should detect README', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Project');

      const result = { health: { hasTests: false, hasLinting: false, hasCi: false, hasReadme: false } };
      codebase.detectHealth(result, tempDir);

      expect(result.health.hasReadme).toBe(true);
    });

    it('should detect ESLint config', () => {
      fs.writeFileSync(path.join(tempDir, '.eslintrc.json'), '{}');

      const result = { health: { hasTests: false, hasLinting: false, hasCi: false, hasReadme: false } };
      codebase.detectHealth(result, tempDir);

      expect(result.health.hasLinting).toBe(true);
    });

    it('should detect GitHub Actions', () => {
      const workflowsDir = path.join(tempDir, '.github', 'workflows');
      fs.mkdirSync(workflowsDir, { recursive: true });

      const result = { health: { hasTests: false, hasLinting: false, hasCi: false, hasReadme: false } };
      codebase.detectHealth(result, tempDir);

      expect(result.health.hasCi).toBe(true);
    });

    it('should detect tests directory', () => {
      fs.mkdirSync(path.join(tempDir, 'tests'));

      const result = { health: { hasTests: false, hasLinting: false, hasCi: false, hasReadme: false } };
      codebase.detectHealth(result, tempDir);

      expect(result.health.hasTests).toBe(true);
    });

    it('should preserve existing hasTests value', () => {
      const result = { health: { hasTests: true, hasLinting: false, hasCi: false, hasReadme: false } };
      codebase.detectHealth(result, tempDir);

      expect(result.health.hasTests).toBe(true);
    });
  });

  describe('findImplementedFeatures', () => {
    it('should detect authentication feature', () => {
      const result = {
        implementedFeatures: [],
        structure: { 'src/auth': {} }
      };

      codebase.findImplementedFeatures(result, tempDir);

      expect(result.implementedFeatures).toContain('authentication');
    });

    it('should detect API feature', () => {
      const result = {
        implementedFeatures: [],
        structure: { 'src/routes': {} }
      };

      codebase.findImplementedFeatures(result, tempDir);

      expect(result.implementedFeatures).toContain('api');
    });

    it('should detect database feature', () => {
      const result = {
        implementedFeatures: [],
        structure: { 'db/models': {} }
      };

      codebase.findImplementedFeatures(result, tempDir);

      expect(result.implementedFeatures).toContain('database');
    });

    it('should detect UI feature', () => {
      const result = {
        implementedFeatures: [],
        structure: { 'src/components': {} }
      };

      codebase.findImplementedFeatures(result, tempDir);

      expect(result.implementedFeatures).toContain('ui');
    });

    it('should detect testing feature', () => {
      const result = {
        implementedFeatures: [],
        structure: { '__tests__': {} }
      };

      codebase.findImplementedFeatures(result, tempDir);

      expect(result.implementedFeatures).toContain('testing');
    });
  });

  describe('scanCodebase', () => {
    it('should return basic structure', () => {
      const result = codebase.scanCodebase({ cwd: tempDir });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalDirs).toBeDefined();
      expect(result.summary.totalFiles).toBeDefined();
    });

    it('should detect TypeScript', () => {
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

      const result = codebase.scanCodebase({ cwd: tempDir });

      expect(result.hasTypeScript).toBe(true);
    });

    it('should parse package.json', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        dependencies: { express: '^4.0.0' },
        devDependencies: { jest: '^29.0.0' }
      }));

      const result = codebase.scanCodebase({ cwd: tempDir });

      expect(result.frameworks).toContain('Express');
      expect(result.testFramework).toBe('jest');
    });

    it('should scan file statistics', () => {
      fs.writeFileSync(path.join(tempDir, 'index.js'), 'module.exports = {}');
      fs.writeFileSync(path.join(tempDir, 'utils.js'), 'module.exports = {}');

      const result = codebase.scanCodebase({ cwd: tempDir });

      expect(result.fileStats['.js']).toBe(2);
    });

    it('should identify top-level directories', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.mkdirSync(path.join(tempDir, 'lib'));

      const result = codebase.scanCodebase({ cwd: tempDir });

      expect(result.topLevelDirs).toContain('src');
      expect(result.topLevelDirs).toContain('lib');
    });

    it('should handle invalid package.json gracefully', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), 'not valid json');

      const result = codebase.scanCodebase({ cwd: tempDir });

      expect(result.frameworks).toEqual([]);
    });
  });
});

describe('Docs Patterns Collector', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-patterns-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('findMarkdownFiles', () => {
    it('should find markdown files', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Project');
      fs.writeFileSync(path.join(tempDir, 'CHANGELOG.md'), '# Changelog');

      const files = docsPatterns.findMarkdownFiles(tempDir);

      expect(files).toContain('README.md');
      expect(files).toContain('CHANGELOG.md');
    });

    it('should find nested markdown files', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir);
      fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide');

      const files = docsPatterns.findMarkdownFiles(tempDir);

      expect(files.some(f => f.includes('guide.md'))).toBe(true);
    });

    it('should exclude node_modules', () => {
      const nmDir = path.join(tempDir, 'node_modules', 'pkg');
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(nmDir, 'README.md'), '# Package');

      const files = docsPatterns.findMarkdownFiles(tempDir);

      expect(files.some(f => f.includes('node_modules'))).toBe(false);
    });

    it('should exclude hidden directories', () => {
      const hiddenDir = path.join(tempDir, '.hidden');
      fs.mkdirSync(hiddenDir);
      fs.writeFileSync(path.join(hiddenDir, 'secret.md'), '# Secret');

      const files = docsPatterns.findMarkdownFiles(tempDir);

      expect(files.some(f => f.includes('.hidden'))).toBe(false);
    });

    it('should limit depth to 5', () => {
      let dir = tempDir;
      for (let i = 0; i < 7; i++) {
        dir = path.join(dir, `level${i}`);
        fs.mkdirSync(dir);
      }
      fs.writeFileSync(path.join(dir, 'deep.md'), '# Deep');

      const files = docsPatterns.findMarkdownFiles(tempDir);

      // File at depth 7+ should not be found
      expect(files.some(f => f.includes('deep.md'))).toBe(false);
    });
  });

  describe('findRelatedDocs', () => {
    it('should find docs referencing filename', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), 'See utils.js for details');

      const result = docsPatterns.findRelatedDocs(['src/utils.js'], { cwd: tempDir });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].referenceTypes).toContain('filename');
    });

    it('should find docs referencing full path', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), 'Check src/utils.js');

      const result = docsPatterns.findRelatedDocs(['src/utils.js'], { cwd: tempDir });

      expect(result.some(r => r.referenceTypes.includes('full-path'))).toBe(true);
    });

    it('should find docs with import references', () => {
      fs.writeFileSync(path.join(tempDir, 'docs.md'), "import x from 'src/utils'");

      const result = docsPatterns.findRelatedDocs(['src/utils.js'], { cwd: tempDir });

      expect(result.some(r => r.referenceTypes.includes('import'))).toBe(true);
    });

    it('should find docs with require references', () => {
      fs.writeFileSync(path.join(tempDir, 'docs.md'), "require('src/utils')");

      const result = docsPatterns.findRelatedDocs(['src/utils.js'], { cwd: tempDir });

      expect(result.some(r => r.referenceTypes.includes('require'))).toBe(true);
    });

    it('should return empty array for no matches', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Project');

      const result = docsPatterns.findRelatedDocs(['src/other.js'], { cwd: tempDir });

      expect(result).toEqual([]);
    });
  });

  describe('findLineNumber', () => {
    it('should find line number of string', () => {
      const content = 'Line 1\nLine 2\nTarget\nLine 4';

      const result = docsPatterns.findLineNumber(content, 'Target');

      expect(result).toBe(3);
    });

    it('should return 0 if not found', () => {
      const content = 'Line 1\nLine 2';

      const result = docsPatterns.findLineNumber(content, 'Missing');

      expect(result).toBe(0);
    });

    it('should handle first line', () => {
      const content = 'Target\nLine 2';

      const result = docsPatterns.findLineNumber(content, 'Target');

      expect(result).toBe(1);
    });
  });

  describe('compareVersions', () => {
    it('should return -1 when v1 < v2', () => {
      expect(docsPatterns.compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(docsPatterns.compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(docsPatterns.compareVersions('1.0.0', '1.0.1')).toBe(-1);
    });

    it('should return 1 when v1 > v2', () => {
      expect(docsPatterns.compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(docsPatterns.compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(docsPatterns.compareVersions('1.0.1', '1.0.0')).toBe(1);
    });

    it('should return 0 when equal', () => {
      expect(docsPatterns.compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(docsPatterns.compareVersions('2.5.3', '2.5.3')).toBe(0);
    });

    it('should handle missing patch version', () => {
      expect(docsPatterns.compareVersions('1.0', '1.0.0')).toBe(0);
    });
  });

  describe('checkChangelog', () => {
    it('should return exists: false when no CHANGELOG', () => {
      const result = docsPatterns.checkChangelog([], { cwd: tempDir });

      expect(result.exists).toBe(false);
    });

    it('should detect Unreleased section', () => {
      fs.writeFileSync(path.join(tempDir, 'CHANGELOG.md'), `# Changelog
## [Unreleased]
- New feature`);

      const result = docsPatterns.checkChangelog([], { cwd: tempDir });

      expect(result.exists).toBe(true);
      expect(result.hasUnreleased).toBe(true);
    });

    it('should detect missing Unreleased section', () => {
      fs.writeFileSync(path.join(tempDir, 'CHANGELOG.md'), `# Changelog
## [1.0.0]
- Release`);

      const result = docsPatterns.checkChangelog([], { cwd: tempDir });

      expect(result.exists).toBe(true);
      expect(result.hasUnreleased).toBe(false);
    });
  });

  describe('analyzeDocIssues', () => {
    it('should detect code example imports', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), `# Project
\`\`\`javascript
import { foo } from './utils';
\`\`\`
`);

      const result = docsPatterns.analyzeDocIssues('README.md', 'utils.js', { cwd: tempDir });

      const codeIssue = result.find(i => i.type === 'code-example');
      expect(codeIssue).toBeDefined();
    });

    it('should return empty array for non-existent doc', () => {
      const result = docsPatterns.analyzeDocIssues('nonexistent.md', 'file.js', { cwd: tempDir });

      expect(result).toEqual([]);
    });
  });

  describe('collect', () => {
    it('should return structured data', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Project');

      const result = docsPatterns.collect({ cwd: tempDir, changedFiles: [] });

      expect(result.relatedDocs).toBeDefined();
      expect(result.changelog).toBeDefined();
      expect(result.markdownFiles).toBeDefined();
    });

    it('should find related docs for changed files', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), 'See utils.js');

      const result = docsPatterns.collect({
        cwd: tempDir,
        changedFiles: ['utils.js']
      });

      expect(result.relatedDocs.length).toBeGreaterThan(0);
    });

    it('should use default changedFiles when not provided', () => {
      const result = docsPatterns.collect({ cwd: tempDir });

      expect(result.relatedDocs).toEqual([]);
    });
  });
});
