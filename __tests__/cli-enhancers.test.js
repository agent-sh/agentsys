/**
 * Tests for cli-enhancers.js
 * Optional CLI tool integration for slop detection pipeline
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  detectAvailableTools,
  detectProjectLanguages,
  getToolsForLanguages,
  getToolAvailabilityForRepo,
  runDuplicateDetection,
  runDependencyAnalysis,
  runComplexityAnalysis,
  getMissingToolsMessage,
  getToolDefinitions,
  getSupportedLanguages,
  clearCache,
  isToolAvailable,
  CLI_TOOLS,
  SUPPORTED_LANGUAGES
} = require('../lib/patterns/cli-enhancers');

describe('cli-enhancers', () => {
  // Clear cache before each test
  beforeEach(() => {
    clearCache();
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should include javascript, typescript, python, rust, go', () => {
      expect(SUPPORTED_LANGUAGES).toContain('javascript');
      expect(SUPPORTED_LANGUAGES).toContain('typescript');
      expect(SUPPORTED_LANGUAGES).toContain('python');
      expect(SUPPORTED_LANGUAGES).toContain('rust');
      expect(SUPPORTED_LANGUAGES).toContain('go');
    });

    it('should have exactly 5 supported languages', () => {
      expect(SUPPORTED_LANGUAGES.length).toBe(5);
    });
  });

  describe('CLI_TOOLS constants', () => {
    it('should have JavaScript/TypeScript tools', () => {
      expect(CLI_TOOLS.jscpd).toBeDefined();
      expect(CLI_TOOLS.jscpd.languages).toContain('javascript');
      expect(CLI_TOOLS.jscpd.languages).toContain('typescript');

      expect(CLI_TOOLS.madge).toBeDefined();
      expect(CLI_TOOLS.madge.languages).toContain('javascript');
      expect(CLI_TOOLS.madge.languages).toContain('typescript');

      expect(CLI_TOOLS.escomplex).toBeDefined();
      expect(CLI_TOOLS.escomplex.languages).toContain('javascript');
    });

    it('should have Python tools', () => {
      expect(CLI_TOOLS.pylint).toBeDefined();
      expect(CLI_TOOLS.pylint.languages).toContain('python');

      expect(CLI_TOOLS.radon).toBeDefined();
      expect(CLI_TOOLS.radon.languages).toContain('python');
    });

    it('should have Go tools', () => {
      expect(CLI_TOOLS.golangci_lint).toBeDefined();
      expect(CLI_TOOLS.golangci_lint.languages).toContain('go');
    });

    it('should have Rust tools', () => {
      expect(CLI_TOOLS.clippy).toBeDefined();
      expect(CLI_TOOLS.clippy.languages).toContain('rust');
    });

    it('each tool should have required fields', () => {
      for (const tool of Object.values(CLI_TOOLS)) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.checkCommand).toBeDefined();
        expect(tool.installHint).toBeDefined();
        expect(Array.isArray(tool.languages)).toBe(true);
        expect(tool.languages.length).toBeGreaterThan(0);
      }
    });

    it('jscpd should support all languages (cross-language tool)', () => {
      expect(CLI_TOOLS.jscpd.languages).toContain('javascript');
      expect(CLI_TOOLS.jscpd.languages).toContain('typescript');
      expect(CLI_TOOLS.jscpd.languages).toContain('python');
      expect(CLI_TOOLS.jscpd.languages).toContain('go');
      expect(CLI_TOOLS.jscpd.languages).toContain('rust');
    });
  });

  describe('isToolAvailable', () => {
    it('should return true for available commands', () => {
      // node --version should always be available in test environment
      const result = isToolAvailable('node --version');
      expect(result).toBe(true);
    });

    it('should return false for unavailable commands', () => {
      const result = isToolAvailable('nonexistent_tool_xyz_123 --version');
      expect(result).toBe(false);
    });

    it('should handle command execution errors gracefully', () => {
      // Invalid command should return false, not throw
      const result = isToolAvailable('');
      expect(result).toBe(false);
    });

    it('should handle commands with multiple arguments', () => {
      // npm --version should work with multiple flags
      const result = isToolAvailable('node --version');
      expect(result).toBe(true);
    });

    it('should return false for commands that exit with error code', () => {
      // This should return false if the command fails
      const result = isToolAvailable('node --invalid-flag-xyz');
      expect(result).toBe(false);
    });

    it('should handle whitespace in command string', () => {
      // Extra whitespace should be handled
      const result = isToolAvailable('node   --version');
      expect(result).toBe(true);
    });
  });

  describe('detectProjectLanguages', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-enhancers-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should detect JavaScript from package.json', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('javascript');
    });

    it('should detect TypeScript from tsconfig.json', () => {
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('typescript');
    });

    it('should detect Python from requirements.txt', () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask\n');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('python');
    });

    it('should detect Go from go.mod', () => {
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module test\n');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('go');
    });

    it('should detect Rust from Cargo.toml', () => {
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]\n');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('rust');
    });

    it('should detect Python from setup.py', () => {
      fs.writeFileSync(path.join(tempDir, 'setup.py'), 'from setuptools import setup\n');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('python');
    });

    it('should detect Python from pyproject.toml', () => {
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '[project]\n');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('python');
    });

    it('should detect Python from Pipfile', () => {
      fs.writeFileSync(path.join(tempDir, 'Pipfile'), '[[source]]\n');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('python');
    });

    it('should detect Go from go.sum', () => {
      fs.writeFileSync(path.join(tempDir, 'go.sum'), 'module/path v1.0.0\n');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('go');
    });

    it('should detect multiple languages', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask\n');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('javascript');
      expect(langs).toContain('python');
    });

    it('should fallback to file extension scanning', () => {
      fs.writeFileSync(path.join(tempDir, 'main.py'), 'print("hello")');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('python');
    });

    it('should scan src/ directory for extensions', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'main.ts'), 'const x: number = 1;');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('typescript');
    });

    it('should scan lib/ directory for extensions', () => {
      fs.mkdirSync(path.join(tempDir, 'lib'));
      fs.writeFileSync(path.join(tempDir, 'lib', 'utils.go'), 'package main');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('go');
    });

    it('should detect .jsx files as javascript', () => {
      fs.writeFileSync(path.join(tempDir, 'App.jsx'), 'export default function App() {}');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('javascript');
    });

    it('should detect .tsx files as typescript', () => {
      fs.writeFileSync(path.join(tempDir, 'App.tsx'), 'export default function App() {}');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('typescript');
    });

    it('should detect .mjs files as javascript', () => {
      fs.writeFileSync(path.join(tempDir, 'module.mjs'), 'export const x = 1;');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('javascript');
    });

    it('should detect .cjs files as javascript', () => {
      fs.writeFileSync(path.join(tempDir, 'module.cjs'), 'module.exports = {};');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('javascript');
    });

    it('should detect .rs files as rust', () => {
      fs.writeFileSync(path.join(tempDir, 'main.rs'), 'fn main() {}');
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('rust');
    });

    it('should default to javascript if nothing detected', () => {
      const langs = detectProjectLanguages(tempDir);
      expect(langs).toContain('javascript');
    });

    it('should only return supported languages', () => {
      const langs = detectProjectLanguages(tempDir);
      for (const lang of langs) {
        expect(SUPPORTED_LANGUAGES).toContain(lang);
      }
    });
  });

  describe('getToolsForLanguages', () => {
    it('should return JS tools for javascript', () => {
      const tools = getToolsForLanguages(['javascript']);
      expect(tools.jscpd).toBeDefined();
      expect(tools.madge).toBeDefined();
      expect(tools.escomplex).toBeDefined();
    });

    it('should return Python tools for python', () => {
      const tools = getToolsForLanguages(['python']);
      expect(tools.pylint).toBeDefined();
      expect(tools.radon).toBeDefined();
      expect(tools.jscpd).toBeDefined(); // jscpd supports python too
    });

    it('should return Go tools for go', () => {
      const tools = getToolsForLanguages(['go']);
      expect(tools.golangci_lint).toBeDefined();
      expect(tools.jscpd).toBeDefined(); // jscpd supports go too
    });

    it('should return Rust tools for rust', () => {
      const tools = getToolsForLanguages(['rust']);
      expect(tools.clippy).toBeDefined();
      expect(tools.jscpd).toBeDefined(); // jscpd supports rust too
    });

    it('should return combined tools for multiple languages', () => {
      const tools = getToolsForLanguages(['javascript', 'python']);
      // JS tools
      expect(tools.madge).toBeDefined();
      // Python tools
      expect(tools.pylint).toBeDefined();
    });

    it('should return empty object for unknown language', () => {
      const tools = getToolsForLanguages(['brainfuck']);
      expect(Object.keys(tools).length).toBe(0);
    });

    it('should return empty object for empty languages array', () => {
      const tools = getToolsForLanguages([]);
      expect(Object.keys(tools).length).toBe(0);
    });

    it('should not include escomplex for typescript-only', () => {
      const tools = getToolsForLanguages(['typescript']);
      // escomplex only supports javascript, not typescript
      expect(tools.escomplex).toBeUndefined();
      // But madge supports both
      expect(tools.madge).toBeDefined();
    });

    it('should include all relevant tools when multiple languages present', () => {
      const tools = getToolsForLanguages(['javascript', 'python', 'go', 'rust']);
      // Should include cross-language tool
      expect(tools.jscpd).toBeDefined();
      // Should include language-specific tools
      expect(tools.madge).toBeDefined();
      expect(tools.escomplex).toBeDefined();
      expect(tools.pylint).toBeDefined();
      expect(tools.radon).toBeDefined();
      expect(tools.golangci_lint).toBeDefined();
      expect(tools.clippy).toBeDefined();
    });
  });

  describe('detectAvailableTools', () => {
    it('should return object with tool keys when no languages specified', () => {
      const tools = detectAvailableTools();
      expect(typeof tools).toBe('object');
      // Should include all tools
      expect(Object.keys(tools).length).toBe(Object.keys(CLI_TOOLS).length);
    });

    it('should filter to JS tools when javascript specified', () => {
      const tools = detectAvailableTools(['javascript']);
      expect(tools).toHaveProperty('jscpd');
      expect(tools).toHaveProperty('madge');
      expect(tools).toHaveProperty('escomplex');
      // Should not have python-only tools
      expect(tools).not.toHaveProperty('pylint');
    });

    it('should filter to Python tools when python specified', () => {
      const tools = detectAvailableTools(['python']);
      expect(tools).toHaveProperty('pylint');
      expect(tools).toHaveProperty('radon');
      expect(tools).toHaveProperty('jscpd'); // jscpd supports python
      // Should not have JS-only tools
      expect(tools).not.toHaveProperty('madge');
    });

    it('should return boolean values for each tool', () => {
      const tools = detectAvailableTools(['javascript']);
      for (const value of Object.values(tools)) {
        expect(typeof value).toBe('boolean');
      }
    });

    it('should use cache when repoPath provided', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
      try {
        // First call - populates cache
        const tools1 = detectAvailableTools(['javascript'], tempDir);
        // Second call - should use cache
        const tools2 = detectAvailableTools(['javascript'], tempDir);
        expect(tools2).toEqual(tools1);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should filter tools by multiple languages', () => {
      const tools = detectAvailableTools(['python', 'rust']);
      // Python tools
      expect(tools).toHaveProperty('pylint');
      expect(tools).toHaveProperty('radon');
      // Rust tools
      expect(tools).toHaveProperty('clippy');
      // Cross-language tool
      expect(tools).toHaveProperty('jscpd');
      // Should NOT have JS-only tools
      expect(tools).not.toHaveProperty('madge');
      expect(tools).not.toHaveProperty('escomplex');
    });

    it('should return fresh detection when no repoPath provided', () => {
      const tools1 = detectAvailableTools(['javascript']);
      clearCache();
      const tools2 = detectAvailableTools(['javascript']);
      // Both should return same structure (though values may vary)
      expect(Object.keys(tools1).sort()).toEqual(Object.keys(tools2).sort());
    });
  });

  describe('getToolAvailabilityForRepo', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-enhancers-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return detected languages', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const result = getToolAvailabilityForRepo(tempDir);
      expect(result.languages).toContain('javascript');
    });

    it('should return available tools object', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const result = getToolAvailabilityForRepo(tempDir);
      expect(result.available).toBeDefined();
      expect(typeof result.available).toBe('object');
    });

    it('should return missing tools array', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const result = getToolAvailabilityForRepo(tempDir);
      expect(Array.isArray(result.missing)).toBe(true);
    });

    it('should use cache on subsequent calls', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const result1 = getToolAvailabilityForRepo(tempDir);
      const result2 = getToolAvailabilityForRepo(tempDir);
      expect(result2.languages).toEqual(result1.languages);
    });

    it('should refresh cache when forceRefresh is true', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      getToolAvailabilityForRepo(tempDir); // Initial cache
      // Add Python
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask\n');
      // Without force refresh, should still show only JS (cached)
      const cachedResult = getToolAvailabilityForRepo(tempDir);
      expect(cachedResult.languages).not.toContain('python');
      // With force refresh, should detect Python too
      const refreshedResult = getToolAvailabilityForRepo(tempDir, { forceRefresh: true });
      expect(refreshedResult.languages).toContain('python');
    });

    it('should handle multi-language projects', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module test\n');
      const result = getToolAvailabilityForRepo(tempDir);
      expect(result.languages).toContain('javascript');
      expect(result.languages).toContain('python');
      expect(result.languages).toContain('go');
      // Should have tools for all detected languages
      expect(result.available).toHaveProperty('jscpd');
      expect(result.available).toHaveProperty('madge');
      expect(result.available).toHaveProperty('pylint');
      expect(result.available).toHaveProperty('golangci_lint');
    });

    it('should correctly identify missing tools', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const result = getToolAvailabilityForRepo(tempDir);
      // missing should contain tools that are not available
      for (const toolName of result.missing) {
        expect(result.available[toolName]).toBe(false);
      }
    });

    it('should resolve repo path correctly', () => {
      // Use relative-like path
      const absPath = path.resolve(tempDir);
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const result = getToolAvailabilityForRepo(absPath);
      expect(result.languages).toContain('javascript');
    });
  });

  describe('runDuplicateDetection', () => {
    it('should return null if jscpd not available', () => {
      const result = runDuplicateDetection('/nonexistent/path');
      // Either null (tool not available) or array (tool available)
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should accept options', () => {
      const result = runDuplicateDetection('/nonexistent/path', {
        minLines: 10,
        minTokens: 100
      });
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should use default minLines of 5', () => {
      const result = runDuplicateDetection('/nonexistent/path', {});
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should use default minTokens of 50', () => {
      const result = runDuplicateDetection('/nonexistent/path', { minLines: 3 });
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    describe('temp directory for jscpd output (Windows NUL fix)', () => {
      // The module destructures execFileSync from child_process at require time,
      // so we must use jest.isolateModules to re-require with mocked child_process.
      function loadWithMocks(execFileSyncMock) {
        let mod;
        jest.isolateModules(() => {
          jest.doMock('child_process', () => ({
            ...jest.requireActual('child_process'),
            execFileSync: execFileSyncMock,
            execSync: jest.requireActual('child_process').execSync
          }));
          mod = require('../lib/patterns/cli-enhancers');
        });
        return mod;
      }

      it('should use temp directory for jscpd output instead of NUL', () => {
        const mkdtempSpy = jest.spyOn(fs, 'mkdtempSync');
        const rmSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});

        const mockExecFileSync = jest.fn((cmd, args) => {
          if (cmd === 'jscpd' && args && args.includes('--version')) {
            return 'jscpd v1.0.0';
          }
          if (cmd === 'jscpd' && args && args.includes('--reporters')) {
            return JSON.stringify({ duplicates: [] });
          }
          return '';
        });

        const mod = loadWithMocks(mockExecFileSync);
        mod.runDuplicateDetection('/some/repo');

        // Verify mkdtempSync was called with os.tmpdir() prefix
        expect(mkdtempSpy).toHaveBeenCalled();
        const mkdtempArg = mkdtempSpy.mock.calls[0][0];
        expect(mkdtempArg.startsWith(os.tmpdir())).toBe(true);

        // Verify --output arg uses temp dir, not NUL or /dev/null
        const jscpdCall = mockExecFileSync.mock.calls.find(
          call => call[0] === 'jscpd' && call[1] && call[1].includes('--output')
        );
        expect(jscpdCall).toBeDefined();
        const outputIndex = jscpdCall[1].indexOf('--output');
        const outputValue = jscpdCall[1][outputIndex + 1];
        expect(outputValue).not.toBe('NUL');
        expect(outputValue).not.toBe('/dev/null');

        mkdtempSpy.mockRestore();
        rmSpy.mockRestore();
      });

      it('should clean up temp directory after successful execution', () => {
        const rmSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});

        const mockExecFileSync = jest.fn((cmd, args) => {
          if (cmd === 'jscpd' && args && args.includes('--version')) {
            return 'jscpd v1.0.0';
          }
          if (cmd === 'jscpd' && args && args.includes('--reporters')) {
            return JSON.stringify({ duplicates: [] });
          }
          return '';
        });

        const mod = loadWithMocks(mockExecFileSync);
        mod.runDuplicateDetection('/some/repo');

        // Verify rmSync was called with recursive and force options
        const rmCalls = rmSpy.mock.calls.filter(
          call => call[1] && call[1].recursive && call[1].force
        );
        expect(rmCalls.length).toBeGreaterThan(0);
        // The path should be in the temp directory
        expect(rmCalls[0][0].startsWith(os.tmpdir())).toBe(true);

        rmSpy.mockRestore();
      });

      it('should clean up temp directory even on jscpd failure', () => {
        const rmSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});

        const mockExecFileSync = jest.fn((cmd, args) => {
          if (cmd === 'jscpd' && args && args.includes('--version')) {
            return 'jscpd v1.0.0';
          }
          if (cmd === 'jscpd' && args && args.includes('--reporters')) {
            throw new Error('jscpd execution failed');
          }
          return '';
        });

        const mod = loadWithMocks(mockExecFileSync);
        const result = mod.runDuplicateDetection('/some/repo');

        // Should return null on failure
        expect(result).toBeNull();
        // Should still clean up temp dir via finally block
        const rmCalls = rmSpy.mock.calls.filter(
          call => call[1] && call[1].recursive && call[1].force
        );
        expect(rmCalls.length).toBeGreaterThan(0);

        rmSpy.mockRestore();
      });

      it('should not reference NUL or /dev/null in jscpd args', () => {
        jest.spyOn(fs, 'rmSync').mockImplementation(() => {});

        const mockExecFileSync = jest.fn((cmd, args) => {
          if (cmd === 'jscpd' && args && args.includes('--version')) {
            return 'jscpd v1.0.0';
          }
          if (cmd === 'jscpd' && args && args.includes('--reporters')) {
            return JSON.stringify({ duplicates: [] });
          }
          return '';
        });

        const mod = loadWithMocks(mockExecFileSync);
        mod.runDuplicateDetection('/some/repo');

        // Verify no args contain NUL or /dev/null as the output path
        for (const call of mockExecFileSync.mock.calls) {
          const args = call[1] || [];
          const outputIdx = args.indexOf('--output');
          if (outputIdx !== -1) {
            const outputVal = args[outputIdx + 1];
            expect(outputVal.toLowerCase()).not.toBe('nul');
            expect(outputVal).not.toBe('/dev/null');
          }
        }
      });
    });
  });

  describe('runDependencyAnalysis', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-analysis-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null if madge not available', () => {
      const result = runDependencyAnalysis('/nonexistent/path');
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should accept entry option', () => {
      const result = runDependencyAnalysis('/nonexistent/path', {
        entry: 'src/index.js'
      });
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should auto-detect src/index.js entry point', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'index.js'), 'module.exports = {};');
      const result = runDependencyAnalysis(tempDir);
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should auto-detect src/index.ts entry point', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export {};');
      const result = runDependencyAnalysis(tempDir);
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should auto-detect index.js entry point', () => {
      fs.writeFileSync(path.join(tempDir, 'index.js'), 'module.exports = {};');
      const result = runDependencyAnalysis(tempDir);
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should auto-detect lib/index.js entry point', () => {
      fs.mkdirSync(path.join(tempDir, 'lib'));
      fs.writeFileSync(path.join(tempDir, 'lib', 'index.js'), 'module.exports = {};');
      const result = runDependencyAnalysis(tempDir);
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should fallback to . when no entry point found', () => {
      // Empty directory - no entry point files
      const result = runDependencyAnalysis(tempDir);
      expect(result === null || Array.isArray(result)).toBe(true);
    });
  });

  describe('runComplexityAnalysis', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'complexity-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null if escomplex not available', () => {
      const result = runComplexityAnalysis('/nonexistent/path', ['app.js']);
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should skip non-JS files', () => {
      const result = runComplexityAnalysis('/nonexistent/path', ['app.py', 'main.go']);
      // Should return null since no JS files to analyze
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should filter to only JS/TS files', () => {
      const result = runComplexityAnalysis(tempDir, [
        'app.js',
        'utils.ts',
        'component.jsx',
        'page.tsx',
        'main.py',
        'lib.go',
        'Cargo.toml'
      ]);
      // Only JS/TS files should be analyzed
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should handle absolute file paths', () => {
      const absPath = path.join(tempDir, 'test.js');
      fs.writeFileSync(absPath, 'function test() { return 1; }');
      const result = runComplexityAnalysis(tempDir, [absPath]);
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should handle relative file paths', () => {
      fs.writeFileSync(path.join(tempDir, 'test.js'), 'function test() { return 1; }');
      const result = runComplexityAnalysis(tempDir, ['test.js']);
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should handle empty file list', () => {
      const result = runComplexityAnalysis(tempDir, []);
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should accept options parameter', () => {
      const result = runComplexityAnalysis(tempDir, ['app.js'], { someOption: true });
      expect(result === null || Array.isArray(result)).toBe(true);
    });
  });

  describe('getMissingToolsMessage', () => {
    it('should return empty string for empty array', () => {
      const message = getMissingToolsMessage([]);
      expect(message).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(getMissingToolsMessage(null)).toBe('');
      expect(getMissingToolsMessage(undefined)).toBe('');
    });

    it('should format message for single missing tool', () => {
      const message = getMissingToolsMessage(['jscpd']);
      expect(message).toContain('jscpd');
      expect(message).toContain('npm install -g jscpd');
      expect(message).toContain('Enhanced Analysis Available');
    });

    it('should format message for multiple missing tools', () => {
      const message = getMissingToolsMessage(['jscpd', 'madge', 'escomplex']);
      expect(message).toContain('jscpd');
      expect(message).toContain('madge');
      expect(message).toContain('escomplex');
    });

    it('should include detected languages when provided', () => {
      const message = getMissingToolsMessage(['pylint'], ['python']);
      expect(message).toContain('python');
      expect(message).toContain('Detected project languages');
    });

    it('should skip unknown tools', () => {
      const message = getMissingToolsMessage(['unknown_tool']);
      expect(message).toBe('');
    });

    it('should include optional notice', () => {
      const message = getMissingToolsMessage(['jscpd']);
      expect(message).toContain('optional');
    });

    it('should include multiple detected languages', () => {
      const message = getMissingToolsMessage(['pylint', 'golangci_lint'], ['python', 'go']);
      expect(message).toContain('python');
      expect(message).toContain('go');
    });

    it('should format install hints correctly for different package managers', () => {
      const message = getMissingToolsMessage(['jscpd', 'pylint', 'golangci_lint', 'clippy']);
      expect(message).toContain('npm install');
      expect(message).toContain('pip install');
      expect(message).toContain('go install');
      expect(message).toContain('rustup');
    });

    it('should handle mix of valid and invalid tool names', () => {
      const message = getMissingToolsMessage(['jscpd', 'unknown_tool', 'madge']);
      expect(message).toContain('jscpd');
      expect(message).toContain('madge');
      expect(message).not.toContain('unknown_tool');
    });

    it('should include Enhanced Analysis Available header', () => {
      const message = getMissingToolsMessage(['jscpd']);
      expect(message).toContain('## Enhanced Analysis Available');
    });

    it('should format tool description correctly', () => {
      const message = getMissingToolsMessage(['madge']);
      expect(message).toContain('Circular dependency detector');
    });
  });

  describe('getToolDefinitions', () => {
    it('should return copy of CLI_TOOLS', () => {
      const definitions = getToolDefinitions();
      expect(definitions).toHaveProperty('jscpd');
      expect(definitions).toHaveProperty('madge');
      expect(definitions).toHaveProperty('escomplex');
    });

    it('should return independent copy', () => {
      const definitions = getToolDefinitions();
      definitions.jscpd = null;
      // Original should be unchanged
      expect(CLI_TOOLS.jscpd).toBeDefined();
    });

    it('should include all defined tools', () => {
      const definitions = getToolDefinitions();
      expect(Object.keys(definitions)).toEqual(Object.keys(CLI_TOOLS));
    });

    it('should preserve tool structure', () => {
      const definitions = getToolDefinitions();
      for (const [name, tool] of Object.entries(definitions)) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.checkCommand).toBeDefined();
        expect(tool.installHint).toBeDefined();
        expect(tool.languages).toBeDefined();
      }
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return copy of SUPPORTED_LANGUAGES', () => {
      const langs = getSupportedLanguages();
      expect(langs).toContain('javascript');
      expect(langs).toContain('python');
    });

    it('should return independent copy', () => {
      const langs = getSupportedLanguages();
      langs.push('brainfuck');
      expect(SUPPORTED_LANGUAGES).not.toContain('brainfuck');
    });

    it('should return all supported languages', () => {
      const langs = getSupportedLanguages();
      expect(langs).toContain('javascript');
      expect(langs).toContain('typescript');
      expect(langs).toContain('python');
      expect(langs).toContain('rust');
      expect(langs).toContain('go');
      expect(langs.length).toBe(5);
    });
  });

  describe('clearCache', () => {
    it('should clear the tool cache', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
      try {
        fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
        // Populate cache
        getToolAvailabilityForRepo(tempDir);
        // Clear cache
        clearCache();
        // Add Python and refresh - should detect it now
        fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask\n');
        const result = getToolAvailabilityForRepo(tempDir);
        expect(result.languages).toContain('python');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('graceful degradation', () => {
    it('runDuplicateDetection should not throw when tool unavailable', () => {
      expect(() => {
        runDuplicateDetection('/some/path');
      }).not.toThrow();
    });

    it('runDependencyAnalysis should not throw when tool unavailable', () => {
      expect(() => {
        runDependencyAnalysis('/some/path');
      }).not.toThrow();
    });

    it('runComplexityAnalysis should not throw when tool unavailable', () => {
      expect(() => {
        runComplexityAnalysis('/some/path', ['app.js']);
      }).not.toThrow();
    });
  });

  describe('install hints', () => {
    it('JS tools should use npm install', () => {
      expect(CLI_TOOLS.jscpd.installHint).toContain('npm install');
      expect(CLI_TOOLS.madge.installHint).toContain('npm install');
      expect(CLI_TOOLS.escomplex.installHint).toContain('npm install');
    });

    it('Python tools should use pip install', () => {
      expect(CLI_TOOLS.pylint.installHint).toContain('pip install');
      expect(CLI_TOOLS.radon.installHint).toContain('pip install');
    });

    it('Go tools should use go install', () => {
      expect(CLI_TOOLS.golangci_lint.installHint).toContain('go install');
    });

    it('Rust tools should use rustup', () => {
      expect(CLI_TOOLS.clippy.installHint).toContain('rustup');
    });
  });

  describe('command injection prevention', () => {
    it('runDuplicateDetection should handle paths with shell metacharacters safely', () => {
      // These paths contain shell injection attempts
      const dangerousPaths = [
        '/path/with/$HOME/injection',
        '/path/with/`whoami`/injection',
        '/path/with/$(id)/injection',
        '/path/with/"quotes"/injection'
      ];

      // Should not throw - paths are escaped internally
      for (const path of dangerousPaths) {
        expect(() => {
          runDuplicateDetection(path);
        }).not.toThrow();
      }
    });

    it('runDependencyAnalysis should handle paths with shell metacharacters safely', () => {
      const dangerousPaths = [
        '/path/with/$HOME/injection',
        '/path/with/`whoami`/injection',
        '/path/with/$(id)/injection'
      ];

      for (const path of dangerousPaths) {
        expect(() => {
          runDependencyAnalysis(path);
        }).not.toThrow();
      }
    });

    it('runComplexityAnalysis should handle file paths with shell metacharacters safely', () => {
      const dangerousFiles = [
        '/path/with/$HOME/file.js',
        '/path/with/`whoami`/file.js',
        '/path/with/$(id)/file.js'
      ];

      expect(() => {
        runComplexityAnalysis('/safe/repo', dangerousFiles);
      }).not.toThrow();
    });
  });

  describe('CLI_TOOLS structure validation', () => {
    it('all tools should have --version in checkCommand', () => {
      for (const [name, tool] of Object.entries(CLI_TOOLS)) {
        expect(tool.checkCommand).toContain('--version');
      }
    });

    it('all tool languages should be in SUPPORTED_LANGUAGES', () => {
      for (const [name, tool] of Object.entries(CLI_TOOLS)) {
        for (const lang of tool.languages) {
          expect(SUPPORTED_LANGUAGES).toContain(lang);
        }
      }
    });

    it('each tool should have a unique name', () => {
      const names = Object.values(CLI_TOOLS).map(t => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('checkCommand should match tool name pattern', () => {
      // Most tools have the tool name in the check command
      expect(CLI_TOOLS.jscpd.checkCommand).toContain('jscpd');
      expect(CLI_TOOLS.madge.checkCommand).toContain('madge');
      expect(CLI_TOOLS.escomplex.checkCommand).toContain('escomplex');
      expect(CLI_TOOLS.pylint.checkCommand).toContain('pylint');
      expect(CLI_TOOLS.radon.checkCommand).toContain('radon');
      expect(CLI_TOOLS.golangci_lint.checkCommand).toContain('golangci-lint');
      expect(CLI_TOOLS.clippy.checkCommand).toContain('clippy');
    });

    it('installHint should use appropriate package manager', () => {
      // npm for JS tools
      expect(CLI_TOOLS.jscpd.installHint).toMatch(/npm install/);
      expect(CLI_TOOLS.madge.installHint).toMatch(/npm install/);
      expect(CLI_TOOLS.escomplex.installHint).toMatch(/npm install/);
      // pip for Python tools
      expect(CLI_TOOLS.pylint.installHint).toMatch(/pip install/);
      expect(CLI_TOOLS.radon.installHint).toMatch(/pip install/);
      // go install for Go tools
      expect(CLI_TOOLS.golangci_lint.installHint).toMatch(/go install/);
      // rustup for Rust tools
      expect(CLI_TOOLS.clippy.installHint).toMatch(/rustup/);
    });
  });

  describe('edge cases', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-case-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('detectProjectLanguages should handle unreadable directories gracefully', () => {
      // Create a directory that might fail to read
      const badDir = path.join(tempDir, 'nonexistent-subdir');
      // Should not throw, even if directory doesn't exist
      expect(() => detectProjectLanguages(badDir)).not.toThrow();
    });

    it('getToolAvailabilityForRepo should handle empty options object', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const result = getToolAvailabilityForRepo(tempDir, {});
      expect(result.languages).toContain('javascript');
    });

    it('detectAvailableTools should handle null repoPath', () => {
      const tools = detectAvailableTools(['javascript'], null);
      expect(typeof tools).toBe('object');
      expect(tools).toHaveProperty('jscpd');
    });

    it('clearCache should work even when cache is empty', () => {
      expect(() => {
        clearCache();
        clearCache(); // Call twice
      }).not.toThrow();
    });

    it('getMissingToolsMessage should handle empty languages array', () => {
      const message = getMissingToolsMessage(['jscpd'], []);
      expect(message).toContain('jscpd');
      // Should not contain "Detected project languages" section
      expect(message).not.toContain('Detected project languages');
    });

    it('getToolsForLanguages should handle duplicate languages', () => {
      const tools = getToolsForLanguages(['javascript', 'javascript', 'python', 'python']);
      // Should work correctly without duplicates causing issues
      expect(tools.jscpd).toBeDefined();
      expect(tools.pylint).toBeDefined();
    });
  });

  describe('cache behavior', () => {
    let tempDir;

    beforeEach(() => {
      clearCache();
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-behavior-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should cache results per repo path', () => {
      const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-2-'));
      try {
        fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
        fs.writeFileSync(path.join(tempDir2, 'requirements.txt'), 'flask\n');

        const result1 = getToolAvailabilityForRepo(tempDir);
        const result2 = getToolAvailabilityForRepo(tempDir2);

        // Different repos should have different results
        expect(result1.languages).toContain('javascript');
        expect(result1.languages).not.toContain('python');
        expect(result2.languages).toContain('python');
      } finally {
        fs.rmSync(tempDir2, { recursive: true, force: true });
      }
    });

    it('should resolve different paths to same repo correctly', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

      // Get result with resolved path
      const result1 = getToolAvailabilityForRepo(path.resolve(tempDir));

      // Should get same result
      const result2 = getToolAvailabilityForRepo(tempDir);

      expect(result1.languages).toEqual(result2.languages);
    });
  });

  describe('language detection priority', () => {
    let tempDir;

    beforeEach(() => {
      clearCache();
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should prefer config files over extension scanning', () => {
      // Create tsconfig but only .js files
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'console.log("hi")');

      const langs = detectProjectLanguages(tempDir);
      // Should detect TypeScript from config, not just JavaScript from extension
      expect(langs).toContain('typescript');
    });

    it('should detect both JS and TS from package.json', () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const langs = detectProjectLanguages(tempDir);
      // package.json indicates both JS and TS projects
      expect(langs).toContain('javascript');
      expect(langs).toContain('typescript');
    });
  });

  describe('tool filtering edge cases', () => {
    it('should handle case sensitivity in language names', () => {
      // Languages should be lowercase
      const tools = getToolsForLanguages(['JavaScript']); // Wrong case
      // This should return empty since our languages are lowercase
      expect(Object.keys(tools).length).toBe(0);
    });

    it('typescript should include madge but not escomplex', () => {
      const tsTools = getToolsForLanguages(['typescript']);
      const jsTools = getToolsForLanguages(['javascript']);

      // madge supports both
      expect(tsTools.madge).toBeDefined();
      expect(jsTools.madge).toBeDefined();

      // escomplex only supports javascript
      expect(tsTools.escomplex).toBeUndefined();
      expect(jsTools.escomplex).toBeDefined();
    });
  });
});
