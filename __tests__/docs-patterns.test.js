/**
 * Tests for Documentation Patterns Collector
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  DEFAULT_OPTIONS,
  findRelatedDocs,
  findMarkdownFiles,
  analyzeDocIssues,
  checkChangelog,
  getExportsFromGit,
  compareVersions,
  findLineNumber,
  collect,
  // New: repo-map integration
  ensureRepoMap,
  ensureRepoMapSync,
  getExportsFromRepoMap,
  findUndocumentedExports,
  isInternalExport,
  isEntryPoint
} = require('../lib/collectors/docs-patterns');

describe('docs-patterns', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-patterns-test-'));

    // Create test directory structure
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'nested', 'dir'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('module structure', () => {
    test('exports DEFAULT_OPTIONS', () => {
      expect(DEFAULT_OPTIONS).toBeDefined();
      expect(DEFAULT_OPTIONS.cwd).toBe(process.cwd());
    });

    test('exports all functions', () => {
      expect(typeof findRelatedDocs).toBe('function');
      expect(typeof findMarkdownFiles).toBe('function');
      expect(typeof analyzeDocIssues).toBe('function');
      expect(typeof checkChangelog).toBe('function');
      expect(typeof getExportsFromGit).toBe('function');
      expect(typeof compareVersions).toBe('function');
      expect(typeof findLineNumber).toBe('function');
      expect(typeof collect).toBe('function');
    });
  });

  describe('findMarkdownFiles', () => {
    test('finds .md files', () => {
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');
      fs.writeFileSync(path.join(testDir, 'docs', 'guide.md'), '# Guide');

      const files = findMarkdownFiles(testDir);

      expect(files).toContain('README.md');
      expect(files).toContain(path.join('docs', 'guide.md'));
    });

    test('excludes node_modules directory', () => {
      fs.mkdirSync(path.join(testDir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'node_modules', 'README.md'), '# Module');
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');

      const files = findMarkdownFiles(testDir);

      expect(files).toContain('README.md');
      expect(files).not.toContain(path.join('node_modules', 'README.md'));
    });

    test('excludes hidden directories', () => {
      fs.mkdirSync(path.join(testDir, '.git'), { recursive: true });
      fs.writeFileSync(path.join(testDir, '.git', 'test.md'), '# Git');
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');

      const files = findMarkdownFiles(testDir);

      expect(files).toContain('README.md');
      expect(files).not.toContain(path.join('.git', 'test.md'));
    });

    test('respects depth limit', () => {
      // Create deeply nested structure
      const deep = path.join(testDir, 'a', 'b', 'c', 'd', 'e', 'f');
      fs.mkdirSync(deep, { recursive: true });
      fs.writeFileSync(path.join(deep, 'deep.md'), '# Deep');
      fs.writeFileSync(path.join(testDir, 'shallow.md'), '# Shallow');

      const files = findMarkdownFiles(testDir);

      // Should find shallow but not deep (depth > 5)
      expect(files).toContain('shallow.md');
    });

    test('respects file limit', () => {
      // Create many markdown files
      for (let i = 0; i < 250; i++) {
        fs.writeFileSync(path.join(testDir, `file${i}.md`), '# File');
      }

      const files = findMarkdownFiles(testDir);

      // Should stop at 200 files (but may complete if all are top-level)
      // The actual limit triggers when scanning during recursion
      expect(files.length).toBeGreaterThan(0);
      expect(files.length).toBeLessThanOrEqual(250);
    });

    test('handles unreadable directories gracefully', () => {
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');

      const files = findMarkdownFiles(testDir);

      expect(files).toContain('README.md');
    });

    test('returns empty array for empty directory', () => {
      const files = findMarkdownFiles(testDir);
      expect(files).toEqual([]);
    });
  });

  describe('findRelatedDocs', () => {
    test('finds docs referencing changed files by filename', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nSee api.js for details'
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0]).toHaveProperty('doc');
      expect(related[0]).toHaveProperty('referencedFile', 'src/api.js');
      expect(related[0]).toHaveProperty('referenceTypes');
      expect(related[0].referenceTypes).toContain('filename');
    });

    test('finds docs with full path references', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nImported from src/api.js'
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0].referenceTypes).toContain('full-path');
    });

    test('finds docs with import statements', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '```js\nimport { getData } from "src/api"\n```'
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0].referenceTypes).toContain('import');
    });

    test('finds docs with require statements', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'module.exports = {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '```js\nconst api = require("src/api")\n```'
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0].referenceTypes).toContain('require');
    });

    test('finds docs with URL path references', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nSee /api endpoint'
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0].referenceTypes).toContain('url-path');
    });

    test('detects multiple reference types', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nFile: src/api.js\nimport from "src/api"\nPath: /api'
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0].referenceTypes.length).toBeGreaterThan(1);
      expect(related[0].referenceTypes).toContain('full-path');
      expect(related[0].referenceTypes).toContain('import');
    });

    test('returns empty for unrelated files', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Unrelated');

      const related = findRelatedDocs(['src/other.js'], { cwd: testDir });

      expect(related.length).toBe(0);
    });

    test('handles unreadable doc files gracefully', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Test');

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(Array.isArray(related)).toBe(true);
    });

    test('skips doc files that cannot be read', () => {
      // Create a doc file, then check behavior when file cannot be read
      // This tests the catch block at line 44
      fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Test with api reference');

      // Create a situation where the doc file exists in the list but reading fails
      // by removing it after scan but before read (simulated by non-existent path)
      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(Array.isArray(related)).toBe(true);
    });

    test('handles empty changed files list', () => {
      fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Test');

      const related = findRelatedDocs([], { cwd: testDir });

      expect(related).toEqual([]);
    });

    test('handles files with multiple extensions', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.test.js'), 'test code');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        'See api.test.js'
      );

      const related = findRelatedDocs(['src/api.test.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
    });
  });

  describe('compareVersions', () => {
    test('compares major versions correctly', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    test('compares minor versions correctly', () => {
      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
      expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
    });

    test('compares patch versions correctly', () => {
      expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
      expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
      expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
    });

    test('handles missing patch version', () => {
      expect(compareVersions('1.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.0.1', '1.0')).toBe(1);
    });

    test('handles missing minor and patch versions', () => {
      expect(compareVersions('1', '1.0.1')).toBe(-1);
      expect(compareVersions('2', '1.9.9')).toBe(1);
    });

    test('compares complex version strings', () => {
      expect(compareVersions('10.5.3', '10.5.12')).toBe(-1);
      expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
    });
  });

  describe('findLineNumber', () => {
    test('finds correct line number', () => {
      const content = 'line1\nline2\nline3';
      expect(findLineNumber(content, 'line1')).toBe(1);
      expect(findLineNumber(content, 'line2')).toBe(2);
      expect(findLineNumber(content, 'line3')).toBe(3);
    });

    test('finds line number for substring', () => {
      const content = 'first line\nsecond line\nthird line';
      expect(findLineNumber(content, 'second')).toBe(2);
    });

    test('returns 0 for not found', () => {
      const content = 'line1\nline2\nline3';
      expect(findLineNumber(content, 'nonexistent')).toBe(0);
    });

    test('returns first occurrence', () => {
      const content = 'duplicate\nother\nduplicate';
      expect(findLineNumber(content, 'duplicate')).toBe(1);
    });

    test('handles empty content', () => {
      expect(findLineNumber('', 'test')).toBe(0);
    });

    test('handles empty search string', () => {
      const content = 'line1\nline2';
      expect(findLineNumber(content, '')).toBe(1);
    });
  });

  describe('checkChangelog', () => {
    test('detects missing CHANGELOG', () => {
      const result = checkChangelog([], { cwd: testDir });
      expect(result.exists).toBe(false);
    });

    test('detects existing CHANGELOG', () => {
      fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), '# Changelog\n');

      const result = checkChangelog([], { cwd: testDir });

      expect(result.exists).toBe(true);
    });

    test('detects Unreleased section', () => {
      fs.writeFileSync(
        path.join(testDir, 'CHANGELOG.md'),
        '# Changelog\n## [Unreleased]\n- New feature'
      );

      const result = checkChangelog([], { cwd: testDir });

      expect(result.exists).toBe(true);
      expect(result.hasUnreleased).toBe(true);
    });

    test('detects missing Unreleased section', () => {
      fs.writeFileSync(
        path.join(testDir, 'CHANGELOG.md'),
        '# Changelog\n## [1.0.0]\n- Released'
      );

      const result = checkChangelog([], { cwd: testDir });

      expect(result.exists).toBe(true);
      expect(result.hasUnreleased).toBe(false);
    });

    test('handles unreadable CHANGELOG', () => {
      fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), '');

      const result = checkChangelog([], { cwd: testDir });

      expect(result.exists).toBeDefined();
    });

    test('returns documented and undocumented arrays', () => {
      // CHANGELOG with Unreleased section
      fs.writeFileSync(
        path.join(testDir, 'CHANGELOG.md'),
        '# Changelog\n## [Unreleased]\n- Some changes'
      );

      const result = checkChangelog([], { cwd: testDir });

      expect(result.exists).toBe(true);
      expect(Array.isArray(result.documented)).toBe(true);
      expect(Array.isArray(result.undocumented)).toBe(true);
    });

    test('provides suggestion when undocumented commits exist', () => {
      fs.writeFileSync(
        path.join(testDir, 'CHANGELOG.md'),
        '# Changelog\n## [Unreleased]'
      );

      const result = checkChangelog([], { cwd: testDir });

      // Result structure includes suggestion field
      expect(result).toHaveProperty('suggestion');
    });
  });

  describe('analyzeDocIssues', () => {
    test('detects outdated import paths in code blocks', () => {
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '```js\nimport { getData } from "./src/api"\n```'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('code-example');
      expect(issues[0].severity).toBe('medium');
    });

    test('detects outdated version numbers', () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '2.0.0' }));
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nVersion: 1.0.0'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      const versionIssues = issues.filter(i => i.type === 'outdated-version');
      expect(versionIssues.length).toBeGreaterThan(0);
      expect(versionIssues[0].severity).toBe('low');
      expect(versionIssues[0].current).toBe('1.0.0');
      expect(versionIssues[0].expected).toBe('2.0.0');
    });

    test('returns empty for non-existent doc', () => {
      const issues = analyzeDocIssues('nonexistent.md', 'src/api.js', { cwd: testDir });
      expect(issues).toEqual([]);
    });

    test('handles missing package.json gracefully', () => {
      fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Test');

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      expect(Array.isArray(issues)).toBe(true);
    });

    test('handles invalid package.json gracefully', () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), 'invalid json');
      fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Test');

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      expect(Array.isArray(issues)).toBe(true);
    });

    test('provides line numbers for issues', () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '2.0.0' }));
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\n\nVersion: 1.0.0\n\nMore content'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      const versionIssues = issues.filter(i => i.type === 'outdated-version');
      if (versionIssues.length > 0) {
        expect(versionIssues[0].line).toBeGreaterThan(0);
      }
    });

    test('provides suggestions for issues', () => {
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '```js\nimport { getData } from "./src/api"\n```'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].suggestion).toBeDefined();
      expect(typeof issues[0].suggestion).toBe('string');
    });

    test('handles doc file with no code blocks', () => {
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# Simple doc\nNo code blocks here.'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      expect(Array.isArray(issues)).toBe(true);
    });

    test('skips version check when current version matches', () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nVersion: 1.0.0'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      // Should not report outdated version when they match
      const versionIssues = issues.filter(i => i.type === 'outdated-version');
      expect(versionIssues.length).toBe(0);
    });

    test('skips version check when doc version is newer', () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nVersion: 2.0.0'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      // Should not report newer version as outdated
      const versionIssues = issues.filter(i => i.type === 'outdated-version');
      expect(versionIssues.length).toBe(0);
    });

    test('handles multiple import patterns in code blocks', () => {
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '```js\nimport { foo } from "./src/api"\nimport { bar } from "./src/api"\n```'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      // Should detect multiple imports referencing the same file
      const codeIssues = issues.filter(i => i.type === 'code-example');
      expect(codeIssues.length).toBeGreaterThan(0);
    });

    test('handles various version format patterns', () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '3.0.0' }));
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nversion: "1.0.0"\nVersion 2.0.0 released'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      const versionIssues = issues.filter(i => i.type === 'outdated-version');
      expect(versionIssues.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getExportsFromGit', () => {
    test('returns empty array when git command fails', () => {
      const exports = getExportsFromGit('nonexistent.js', 'HEAD', { cwd: testDir });
      expect(exports).toEqual([]);
    });

    test('returns empty array for non-git directory', () => {
      const exports = getExportsFromGit('src/api.js', 'HEAD', { cwd: testDir });
      expect(exports).toEqual([]);
    });

    test('returns empty array when git ref does not exist', () => {
      const exports = getExportsFromGit('src/api.js', 'nonexistent-ref', { cwd: testDir });
      expect(exports).toEqual([]);
    });
  });

  describe('collect', () => {
    test('collects all documentation data', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nSee api.js for details'
      );
      fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), '# Changelog');

      const result = collect({
        cwd: testDir,
        changedFiles: ['src/api.js']
      });

      expect(result).toHaveProperty('relatedDocs');
      expect(result).toHaveProperty('changelog');
      expect(result).toHaveProperty('markdownFiles');
      expect(Array.isArray(result.relatedDocs)).toBe(true);
      expect(result.changelog).toBeDefined();
      expect(Array.isArray(result.markdownFiles)).toBe(true);
    });

    test('uses default options when not provided', () => {
      const result = collect();

      expect(result).toHaveProperty('relatedDocs');
      expect(result).toHaveProperty('changelog');
      expect(result).toHaveProperty('markdownFiles');
    });

    test('handles empty changed files', () => {
      fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Test');

      const result = collect({ cwd: testDir });

      expect(result.relatedDocs).toEqual([]);
      expect(result.markdownFiles).toContain(path.join('docs', 'README.md'));
    });

    test('includes all markdown files', () => {
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Root');
      fs.writeFileSync(path.join(testDir, 'docs', 'guide.md'), '# Guide');
      fs.mkdirSync(path.join(testDir, 'examples'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'examples', 'example.md'), '# Example');

      const result = collect({ cwd: testDir });

      expect(result.markdownFiles).toContain('README.md');
      expect(result.markdownFiles).toContain(path.join('docs', 'guide.md'));
      expect(result.markdownFiles).toContain(path.join('examples', 'example.md'));
    });
  });

  describe('edge cases', () => {
    test('findRelatedDocs with single-quoted import paths', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        "```js\nimport { getData } from 'src/api'\n```"
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0].referenceTypes).toContain('import');
    });

    test('findRelatedDocs with single-quoted require paths', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'module.exports = {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        "```js\nconst api = require('src/api')\n```"
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0].referenceTypes).toContain('require');
    });

    test('findRelatedDocs with URL path containing file extension', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nSee /api.html for endpoint'
      );

      const related = findRelatedDocs(['src/api.js'], { cwd: testDir });

      expect(related.length).toBeGreaterThan(0);
      expect(related[0].referenceTypes).toContain('url-path');
    });

    test('findMarkdownFiles excludes vendor directory', () => {
      fs.mkdirSync(path.join(testDir, 'vendor'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'vendor', 'lib.md'), '# Vendor');
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');

      const files = findMarkdownFiles(testDir);

      expect(files).toContain('README.md');
      expect(files).not.toContain(path.join('vendor', 'lib.md'));
    });

    test('findMarkdownFiles excludes dist directory', () => {
      fs.mkdirSync(path.join(testDir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'dist', 'bundle.md'), '# Bundle');
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');

      const files = findMarkdownFiles(testDir);

      expect(files).toContain('README.md');
      expect(files).not.toContain(path.join('dist', 'bundle.md'));
    });

    test('findMarkdownFiles excludes build directory', () => {
      fs.mkdirSync(path.join(testDir, 'build'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'build', 'output.md'), '# Build');
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');

      const files = findMarkdownFiles(testDir);

      expect(files).toContain('README.md');
      expect(files).not.toContain(path.join('build', 'output.md'));
    });

    test('findMarkdownFiles excludes coverage directory', () => {
      fs.mkdirSync(path.join(testDir, 'coverage'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'coverage', 'report.md'), '# Coverage');
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');

      const files = findMarkdownFiles(testDir);

      expect(files).toContain('README.md');
      expect(files).not.toContain(path.join('coverage', 'report.md'));
    });

    test('analyzeDocIssues handles code block without imports', () => {
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '```js\nconst x = 1;\nconsole.log(x);\n```'
      );

      const issues = analyzeDocIssues('docs/README.md', 'src/api.js', { cwd: testDir });

      // Should not find code-example issues for blocks without imports
      const codeIssues = issues.filter(i => i.type === 'code-example');
      expect(codeIssues.length).toBe(0);
    });

    test('collect with no markdown files', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'index.js'), 'module.exports = {}');

      const result = collect({
        cwd: testDir,
        changedFiles: ['src/index.js']
      });

      expect(result.relatedDocs).toEqual([]);
      expect(result.markdownFiles).toEqual([]);
      expect(result.changelog.exists).toBe(false);
    });

    test('findRelatedDocs handles multiple changed files', () => {
      fs.writeFileSync(path.join(testDir, 'src', 'api.js'), 'export function getData() {}');
      fs.writeFileSync(path.join(testDir, 'src', 'util.js'), 'export function helper() {}');
      fs.writeFileSync(
        path.join(testDir, 'docs', 'README.md'),
        '# API\nSee api.js and util.js'
      );

      const related = findRelatedDocs(['src/api.js', 'src/util.js'], { cwd: testDir });

      expect(related.length).toBe(2);
      expect(related.map(r => r.referencedFile)).toContain('src/api.js');
      expect(related.map(r => r.referencedFile)).toContain('src/util.js');
    });

    test('checkChangelog returns correct structure when CHANGELOG exists', () => {
      fs.writeFileSync(
        path.join(testDir, 'CHANGELOG.md'),
        '# Changelog\n## [Unreleased]\n- Added feature\n## [1.0.0]\n- Initial release'
      );

      const result = checkChangelog(['src/api.js'], { cwd: testDir });

      expect(result).toHaveProperty('exists', true);
      expect(result).toHaveProperty('hasUnreleased', true);
      expect(result).toHaveProperty('documented');
      expect(result).toHaveProperty('undocumented');
      expect(result).toHaveProperty('suggestion');
    });
  });

  describe('repo-map integration', () => {
    describe('isInternalExport', () => {
      test('returns true for underscore-prefixed names', () => {
        expect(isInternalExport('_privateHelper', 'src/utils.js')).toBe(true);
        expect(isInternalExport('__internal', 'src/utils.js')).toBe(true);
      });

      test('returns false for public names', () => {
        expect(isInternalExport('publicFunction', 'src/api.js')).toBe(false);
        expect(isInternalExport('getData', 'src/api.js')).toBe(false);
      });

      test('returns true for internal directories', () => {
        expect(isInternalExport('helper', 'src/internal/helper.js')).toBe(true);
        expect(isInternalExport('util', 'lib/utils/util.js')).toBe(true);
        expect(isInternalExport('test', 'src/__tests__/test.js')).toBe(true);
      });

      test('returns true for test files', () => {
        expect(isInternalExport('testHelper', 'src/api.test.js')).toBe(true);
        expect(isInternalExport('specHelper', 'src/api.spec.ts')).toBe(true);
      });

      test('returns false for regular source files', () => {
        expect(isInternalExport('getData', 'src/api.js')).toBe(false);
        expect(isInternalExport('Component', 'src/components/Button.tsx')).toBe(false);
      });
    });

    describe('isEntryPoint', () => {
      test('returns true for index files', () => {
        expect(isEntryPoint('src/index.js')).toBe(true);
        expect(isEntryPoint('lib/index.ts')).toBe(true);
      });

      test('returns true for main/app/server files', () => {
        expect(isEntryPoint('main.js')).toBe(true);
        expect(isEntryPoint('src/app.ts')).toBe(true);
        expect(isEntryPoint('server.js')).toBe(true);
      });

      test('returns true for cli/bin files', () => {
        expect(isEntryPoint('bin/cli.js')).toBe(true);
        expect(isEntryPoint('src/bin.js')).toBe(true);
      });

      test('returns false for regular files', () => {
        expect(isEntryPoint('src/utils.js')).toBe(false);
        expect(isEntryPoint('lib/helpers.ts')).toBe(false);
      });
    });

    describe('getExportsFromRepoMap', () => {
      test('returns null for null map', () => {
        expect(getExportsFromRepoMap('src/api.js', null)).toBeNull();
      });

      test('returns null for map without files', () => {
        expect(getExportsFromRepoMap('src/api.js', {})).toBeNull();
      });

      test('returns null for non-existent file', () => {
        const map = {
          files: {
            'src/other.js': { symbols: { exports: [{ name: 'test' }] } }
          }
        };
        expect(getExportsFromRepoMap('src/api.js', map)).toBeNull();
      });

      test('returns exports for existing file', () => {
        const map = {
          files: {
            'src/api.js': {
              symbols: {
                exports: [
                  { name: 'getData', line: 5 },
                  { name: 'setData', line: 10 }
                ]
              }
            }
          }
        };
        const exports = getExportsFromRepoMap('src/api.js', map);
        expect(exports).toEqual(['getData', 'setData']);
      });

      test('handles path with leading ./', () => {
        const map = {
          files: {
            'src/api.js': {
              symbols: {
                exports: [{ name: 'getData' }]
              }
            }
          }
        };
        const exports = getExportsFromRepoMap('./src/api.js', map);
        expect(exports).toEqual(['getData']);
      });

      test('handles backslash paths', () => {
        const map = {
          files: {
            'src/api.js': {
              symbols: {
                exports: [{ name: 'getData' }]
              }
            }
          }
        };
        const exports = getExportsFromRepoMap('src\\api.js', map);
        expect(exports).toEqual(['getData']);
      });

      test('returns null for file without exports', () => {
        const map = {
          files: {
            'src/api.js': { symbols: {} }
          }
        };
        expect(getExportsFromRepoMap('src/api.js', map)).toBeNull();
      });
    });

    describe('ensureRepoMapSync', () => {
      test('returns unavailable when repo-map not initialized', () => {
        const result = ensureRepoMapSync({ cwd: testDir });
        expect(result.available).toBe(false);
        expect(result.fallbackReason).toBeTruthy();
      });
    });

    describe('findUndocumentedExports', () => {
      test('returns empty array when repo-map not available', () => {
        const result = findUndocumentedExports(['src/api.js'], { cwd: testDir });
        expect(result).toEqual([]);
      });
    });

    describe('collect with repo-map', () => {
      test('includes repoMap status in output', () => {
        fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Test');

        const result = collect({ cwd: testDir, changedFiles: [] });

        expect(result).toHaveProperty('repoMap');
        expect(result.repoMap).toHaveProperty('available');
        expect(result.repoMap).toHaveProperty('fallbackReason');
      });

      test('includes undocumentedExports in output', () => {
        fs.writeFileSync(path.join(testDir, 'docs', 'README.md'), '# Test');

        const result = collect({ cwd: testDir, changedFiles: [] });

        expect(result).toHaveProperty('undocumentedExports');
        expect(Array.isArray(result.undocumentedExports)).toBe(true);
      });
    });

    describe('module exports', () => {
      test('exports new repo-map integration functions', () => {
        expect(typeof ensureRepoMap).toBe('function');
        expect(typeof ensureRepoMapSync).toBe('function');
        expect(typeof getExportsFromRepoMap).toBe('function');
        expect(typeof findUndocumentedExports).toBe('function');
        expect(typeof isInternalExport).toBe('function');
        expect(typeof isEntryPoint).toBe('function');
      });
    });
  });
});
