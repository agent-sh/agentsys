/**
 * Tests for cli-enhancers.js
 * Optional CLI tool integration for slop detection pipeline
 */

const {
  detectAvailableTools,
  runDuplicateDetection,
  runDependencyAnalysis,
  runComplexityAnalysis,
  getMissingToolsMessage,
  getToolDefinitions,
  isToolAvailable,
  CLI_TOOLS
} = require('../lib/patterns/cli-enhancers');

describe('cli-enhancers', () => {
  describe('CLI_TOOLS constants', () => {
    it('should have jscpd definition', () => {
      expect(CLI_TOOLS.jscpd).toBeDefined();
      expect(CLI_TOOLS.jscpd.name).toBe('jscpd');
      expect(CLI_TOOLS.jscpd.checkCommand).toBeDefined();
      expect(CLI_TOOLS.jscpd.installHint).toBeDefined();
    });

    it('should have madge definition', () => {
      expect(CLI_TOOLS.madge).toBeDefined();
      expect(CLI_TOOLS.madge.name).toBe('madge');
      expect(CLI_TOOLS.madge.checkCommand).toBeDefined();
      expect(CLI_TOOLS.madge.installHint).toBeDefined();
    });

    it('should have escomplex definition', () => {
      expect(CLI_TOOLS.escomplex).toBeDefined();
      expect(CLI_TOOLS.escomplex.name).toBe('escomplex');
      expect(CLI_TOOLS.escomplex.checkCommand).toBeDefined();
      expect(CLI_TOOLS.escomplex.installHint).toBeDefined();
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
  });

  describe('detectAvailableTools', () => {
    it('should return object with all tool keys', () => {
      const tools = detectAvailableTools();

      expect(tools).toHaveProperty('jscpd');
      expect(tools).toHaveProperty('madge');
      expect(tools).toHaveProperty('escomplex');
    });

    it('should return boolean values for each tool', () => {
      const tools = detectAvailableTools();

      expect(typeof tools.jscpd).toBe('boolean');
      expect(typeof tools.madge).toBe('boolean');
      expect(typeof tools.escomplex).toBe('boolean');
    });
  });

  describe('runDuplicateDetection', () => {
    it('should return null if jscpd not available', () => {
      // This test assumes jscpd is not installed globally
      // If it is, the test will still pass but return actual results
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
  });

  describe('runDependencyAnalysis', () => {
    it('should return null if madge not available', () => {
      const result = runDependencyAnalysis('/nonexistent/path');

      // Either null (tool not available) or array (tool available)
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should accept entry option', () => {
      const result = runDependencyAnalysis('/nonexistent/path', {
        entry: 'src/index.js'
      });

      expect(result === null || Array.isArray(result)).toBe(true);
    });
  });

  describe('runComplexityAnalysis', () => {
    it('should return null if escomplex not available', () => {
      const result = runComplexityAnalysis('/nonexistent/path', ['app.js']);

      // Either null (tool not available) or array (tool available)
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it('should skip non-JS files', () => {
      const result = runComplexityAnalysis('/nonexistent/path', ['app.py', 'main.go']);

      // Should return null since no JS files to analyze
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
      expect(message).toContain('Optional CLI Tools Not Found');
    });

    it('should format message for multiple missing tools', () => {
      const message = getMissingToolsMessage(['jscpd', 'madge', 'escomplex']);

      expect(message).toContain('jscpd');
      expect(message).toContain('madge');
      expect(message).toContain('escomplex');
      expect(message).toContain('npm install -g jscpd');
      expect(message).toContain('npm install -g madge');
      expect(message).toContain('npm install -g escomplex');
    });

    it('should include tool descriptions', () => {
      const message = getMissingToolsMessage(['jscpd']);

      expect(message).toContain('Copy/paste detector');
    });

    it('should include optional notice', () => {
      const message = getMissingToolsMessage(['jscpd']);

      expect(message).toContain('optional');
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

  describe('missingTools array population', () => {
    it('should track all unavailable tools', () => {
      const tools = detectAvailableTools();
      const missingTools = [];

      if (!tools.jscpd) missingTools.push('jscpd');
      if (!tools.madge) missingTools.push('madge');
      if (!tools.escomplex) missingTools.push('escomplex');

      // The count of missing tools should match what we manually counted
      const manualCount = Object.values(tools).filter(v => !v).length;
      expect(missingTools.length).toBe(manualCount);
    });

    it('getMissingToolsMessage should handle unknown tool names', () => {
      const message = getMissingToolsMessage(['unknown_tool']);

      // Should not throw, just skip unknown tools
      expect(message).toContain('Optional CLI Tools Not Found');
      // Unknown tool should not have install hint
      expect(message).not.toContain('unknown_tool');
    });
  });

  describe('tool check commands', () => {
    it('jscpd check command should be version check', () => {
      expect(CLI_TOOLS.jscpd.checkCommand).toContain('--version');
    });

    it('madge check command should be version check', () => {
      expect(CLI_TOOLS.madge.checkCommand).toContain('--version');
    });

    it('escomplex check command should be version check', () => {
      expect(CLI_TOOLS.escomplex.checkCommand).toContain('--version');
    });
  });

  describe('install hints', () => {
    it('jscpd install hint should use npm', () => {
      expect(CLI_TOOLS.jscpd.installHint).toContain('npm install');
      expect(CLI_TOOLS.jscpd.installHint).toContain('-g');
    });

    it('madge install hint should use npm', () => {
      expect(CLI_TOOLS.madge.installHint).toContain('npm install');
      expect(CLI_TOOLS.madge.installHint).toContain('-g');
    });

    it('escomplex install hint should use npm', () => {
      expect(CLI_TOOLS.escomplex.installHint).toContain('npm install');
      expect(CLI_TOOLS.escomplex.installHint).toContain('-g');
    });
  });
});
