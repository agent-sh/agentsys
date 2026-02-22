/**
 * Tests for lib/cross-platform/index.js
 *
 * Covers:
 * - Platform detection (Claude Code, OpenCode, Codex)
 * - State directory resolution
 * - MCP configuration helpers
 * - Cross-platform path handling
 * - Tool schema creation
 * - Response helpers
 * - Prompt formatting
 * - Token efficiency utilities
 */

const path = require('path');
const os = require('os');

// Mock fs module before importing the module under test
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn()
}));

const fs = require('fs');

// Import after mocking
const {
  // Platform detection
  PLATFORMS,
  STATE_DIRS,
  getStateDir,
  detectPlatform,
  getPluginRoot,
  getSuppressionPath,

  // Tool schema
  TOOL_SCHEMA_GUIDELINES,
  createToolDefinition,

  // Response helpers
  successResponse,
  errorResponse,
  unknownToolResponse,

  // Prompt formatting
  formatBlock,
  formatList,
  formatSection,

  // Token efficiency
  truncate,
  compactSummary,

  // Agent prompts
  AGENT_TEMPLATE,
  createAgentPrompt,

  // Platform configs
  getOpenCodeConfig,
  getCodexConfig,
  getInstructionFiles,
  INSTRUCTION_FILES,

  // Path normalization
  normalizePathForRequire
} = require('../lib/cross-platform/index');

describe('cross-platform', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete process.env.AI_STATE_DIR;
    delete process.env.PLUGIN_ROOT;
  });

  afterEach(() => {
    // Restore environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  });

  describe('PLATFORMS constant', () => {
    it('should define all supported platforms', () => {
      expect(PLATFORMS.CLAUDE_CODE).toBe('claude-code');
      expect(PLATFORMS.OPENCODE).toBe('opencode');
      expect(PLATFORMS.CODEX_CLI).toBe('codex-cli');
      expect(PLATFORMS.CURSOR).toBe('cursor');
    });

    it('should have exactly 4 platforms', () => {
      expect(Object.keys(PLATFORMS)).toHaveLength(4);
    });
  });

  describe('STATE_DIRS constant', () => {
    it('should map each platform to its state directory', () => {
      expect(STATE_DIRS[PLATFORMS.CLAUDE_CODE]).toBe('.claude');
      expect(STATE_DIRS[PLATFORMS.OPENCODE]).toBe('.opencode');
      expect(STATE_DIRS[PLATFORMS.CODEX_CLI]).toBe('.codex');
      expect(STATE_DIRS[PLATFORMS.CURSOR]).toBe('.cursor');
    });

    it('should have a state dir for each platform', () => {
      for (const platform of Object.values(PLATFORMS)) {
        expect(STATE_DIRS[platform]).toBeDefined();
        expect(typeof STATE_DIRS[platform]).toBe('string');
        expect(STATE_DIRS[platform].startsWith('.')).toBe(true);
      }
    });
  });

  describe('getStateDir', () => {
    it('should return .claude by default when AI_STATE_DIR is not set', () => {
      delete process.env.AI_STATE_DIR;
      expect(getStateDir()).toBe('.claude');
    });

    it('should return AI_STATE_DIR when set to .opencode', () => {
      process.env.AI_STATE_DIR = '.opencode';
      expect(getStateDir()).toBe('.opencode');
    });

    it('should return AI_STATE_DIR when set to .codex', () => {
      process.env.AI_STATE_DIR = '.codex';
      expect(getStateDir()).toBe('.codex');
    });

    it('should return custom AI_STATE_DIR value', () => {
      process.env.AI_STATE_DIR = '.custom-state';
      expect(getStateDir()).toBe('.custom-state');
    });
  });

  describe('detectPlatform', () => {
    it('should detect Claude Code when AI_STATE_DIR is not set', () => {
      delete process.env.AI_STATE_DIR;
      expect(detectPlatform()).toBe(PLATFORMS.CLAUDE_CODE);
    });

    it('should detect OpenCode when AI_STATE_DIR is .opencode', () => {
      process.env.AI_STATE_DIR = '.opencode';
      expect(detectPlatform()).toBe(PLATFORMS.OPENCODE);
    });

    it('should detect Codex CLI when AI_STATE_DIR is .codex', () => {
      process.env.AI_STATE_DIR = '.codex';
      expect(detectPlatform()).toBe(PLATFORMS.CODEX_CLI);
    });

    it('should detect Cursor when AI_STATE_DIR is .cursor', () => {
      process.env.AI_STATE_DIR = '.cursor';
      expect(detectPlatform()).toBe(PLATFORMS.CURSOR);
    });

    it('should default to Claude Code for unknown AI_STATE_DIR values', () => {
      process.env.AI_STATE_DIR = '.unknown';
      expect(detectPlatform()).toBe(PLATFORMS.CLAUDE_CODE);
    });

    it('should default to Claude Code for empty AI_STATE_DIR', () => {
      process.env.AI_STATE_DIR = '';
      expect(detectPlatform()).toBe(PLATFORMS.CLAUDE_CODE);
    });
  });

  describe('getPluginRoot', () => {
    it('should return PLUGIN_ROOT env var when set', () => {
      process.env.PLUGIN_ROOT = '/custom/plugin/root';
      expect(getPluginRoot()).toBe('/custom/plugin/root');
    });

    it('should return PLUGIN_ROOT regardless of pluginName when env var is set', () => {
      process.env.PLUGIN_ROOT = '/custom/root';
      expect(getPluginRoot('enhance')).toBe('/custom/root');
      expect(getPluginRoot('deslop')).toBe('/custom/root');
    });

    it('should search plugin cache directories when PLUGIN_ROOT not set', () => {
      delete process.env.PLUGIN_ROOT;
      const home = os.homedir();
      const searchPath = path.join(home, '.claude', 'plugins', 'cache', 'agentsys', 'enhance');

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['1.0.0', '2.0.0', '1.5.0']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = getPluginRoot('enhance');

      expect(fs.existsSync).toHaveBeenCalledWith(searchPath);
      expect(result).toBe(path.join(searchPath, '2.0.0'));
    });

    it('should return latest version when multiple versions exist', () => {
      delete process.env.PLUGIN_ROOT;
      const home = os.homedir();

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['0.9.0', '1.2.3', '1.10.0', '1.9.9']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = getPluginRoot('enhance');

      // Sorted by semver, '1.10.0' is latest (greater than 1.9.9)
      expect(result).toContain('1.10.0');
    });

    it('should return null when no plugin directories found', () => {
      delete process.env.PLUGIN_ROOT;

      fs.existsSync.mockReturnValue(false);

      const result = getPluginRoot('enhance');

      expect(result).toBeNull();
    });

    it('should return null when plugin directory exists but has no versions', () => {
      delete process.env.PLUGIN_ROOT;

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);

      const result = getPluginRoot('enhance');

      expect(result).toBeNull();
    });

    it('should skip non-directory entries in version list', () => {
      delete process.env.PLUGIN_ROOT;
      const home = os.homedir();

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['1.0.0', 'README.md', '2.0.0']);
      fs.statSync.mockImplementation((p) => ({
        isDirectory: () => !p.endsWith('README.md')
      }));

      const result = getPluginRoot('enhance');

      expect(result).toContain('2.0.0');
    });

    it('should use default plugin name "enhance" when not provided', () => {
      delete process.env.PLUGIN_ROOT;
      const home = os.homedir();

      fs.existsSync.mockReturnValue(false);

      getPluginRoot();

      const expectedPath = path.join(home, '.claude', 'plugins', 'cache', 'agentsys', 'enhance');
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    });

    it('should search secondary path when primary not found', () => {
      delete process.env.PLUGIN_ROOT;
      const home = os.homedir();
      const primaryPath = path.join(home, '.claude', 'plugins', 'cache', 'agentsys', 'enhance');
      const secondaryPath = path.join(home, '.claude', 'plugins', 'agentsys', 'enhance');

      fs.existsSync.mockImplementation((p) => p === secondaryPath);
      fs.readdirSync.mockReturnValue(['1.0.0']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = getPluginRoot('enhance');

      expect(fs.existsSync).toHaveBeenCalledWith(primaryPath);
      expect(fs.existsSync).toHaveBeenCalledWith(secondaryPath);
      expect(result).toBe(path.join(secondaryPath, '1.0.0'));
    });
  });

  describe('getSuppressionPath', () => {
    it('should return correct path for Claude Code', () => {
      delete process.env.AI_STATE_DIR;
      const home = os.homedir();
      const expected = path.join(home, '.claude', 'enhance', 'suppressions.json');

      expect(getSuppressionPath()).toBe(expected);
    });

    it('should return correct path for OpenCode', () => {
      process.env.AI_STATE_DIR = '.opencode';
      const home = os.homedir();
      const expected = path.join(home, '.opencode', 'enhance', 'suppressions.json');

      expect(getSuppressionPath()).toBe(expected);
    });

    it('should return correct path for Codex CLI', () => {
      process.env.AI_STATE_DIR = '.codex';
      const home = os.homedir();
      const expected = path.join(home, '.codex', 'enhance', 'suppressions.json');

      expect(getSuppressionPath()).toBe(expected);
    });
  });

  describe('TOOL_SCHEMA_GUIDELINES', () => {
    it('should define maxDescriptionLength', () => {
      expect(TOOL_SCHEMA_GUIDELINES.maxDescriptionLength).toBe(100);
    });

    it('should define naming pattern regex', () => {
      expect(TOOL_SCHEMA_GUIDELINES.namingPattern).toBeInstanceOf(RegExp);
      expect(TOOL_SCHEMA_GUIDELINES.namingPattern.test('workflow_status')).toBe(true);
      expect(TOOL_SCHEMA_GUIDELINES.namingPattern.test('WorkflowStatus')).toBe(false);
      expect(TOOL_SCHEMA_GUIDELINES.namingPattern.test('123_invalid')).toBe(false);
    });

    it('should have best practice flags', () => {
      expect(TOOL_SCHEMA_GUIDELINES.preferFlatStructures).toBe(true);
      expect(TOOL_SCHEMA_GUIDELINES.useEnumsForConstraints).toBe(true);
      expect(TOOL_SCHEMA_GUIDELINES.documentDefaults).toBe(true);
    });
  });

  describe('createToolDefinition', () => {
    it('should create a valid tool definition', () => {
      const result = createToolDefinition(
        'test_tool',
        'A test tool',
        { name: { type: 'string' } },
        ['name']
      );

      expect(result).toEqual({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name']
        }
      });
    });

    it('should create tool with empty properties by default', () => {
      const result = createToolDefinition('simple_tool', 'Simple');

      expect(result.inputSchema.properties).toEqual({});
      expect(result.inputSchema.required).toEqual([]);
    });

    it('should warn for invalid tool name', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      createToolDefinition('InvalidName', 'Description');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('InvalidName')
      );
      consoleSpy.mockRestore();
    });

    it('should warn for long description', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const longDesc = 'A'.repeat(150);

      createToolDefinition('valid_tool', longDesc);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeds 100 chars')
      );
      consoleSpy.mockRestore();
    });

    it('should not warn for valid name and short description', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      createToolDefinition('valid_tool', 'Short description');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('successResponse', () => {
    it('should format string data', () => {
      const result = successResponse('Hello world');

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Hello world' }]
      });
    });

    it('should JSON stringify object data', () => {
      const data = { status: 'ok', count: 42 };
      const result = successResponse(data);

      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      const result = successResponse(data);

      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
    });

    it('should convert numbers to strings', () => {
      const result = successResponse(42);

      expect(result.content[0].text).toBe('42');
    });

    it('should not set isError flag', () => {
      const result = successResponse('data');

      expect(result.isError).toBeUndefined();
    });
  });

  describe('errorResponse', () => {
    it('should format error message', () => {
      const result = errorResponse('Something went wrong');

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Something went wrong' }],
        isError: true
      });
    });

    it('should include details when provided', () => {
      const result = errorResponse('Failed', { code: 500, reason: 'timeout' });

      expect(result.content[0].text).toContain('Error: Failed');
      expect(result.content[0].text).toContain('Details:');
      // JSON.stringify without pretty print
      expect(result.content[0].text).toContain('"code":500');
    });

    it('should set isError flag', () => {
      const result = errorResponse('Error');

      expect(result.isError).toBe(true);
    });

    it('should handle null details', () => {
      const result = errorResponse('Error', null);

      expect(result.content[0].text).toBe('Error: Error');
      expect(result.content[0].text).not.toContain('Details:');
    });
  });

  describe('unknownToolResponse', () => {
    it('should format unknown tool message', () => {
      const result = unknownToolResponse('bad_tool');

      expect(result.content[0].text).toBe('Error: Unknown tool "bad_tool"');
      expect(result.isError).toBe(true);
    });

    it('should list available tools when provided', () => {
      const result = unknownToolResponse('bad_tool', ['tool_a', 'tool_b', 'tool_c']);

      expect(result.content[0].text).toContain('Available tools: tool_a, tool_b, tool_c');
    });

    it('should handle empty available tools array', () => {
      const result = unknownToolResponse('bad_tool', []);

      expect(result.content[0].text).toBe('Error: Unknown tool "bad_tool"');
      expect(result.content[0].text).not.toContain('Available tools:');
    });
  });

  describe('formatBlock', () => {
    it('should wrap content in XML-style tags', () => {
      const result = formatBlock('code', 'console.log("hello")');

      expect(result).toBe('<code>\nconsole.log("hello")\n</code>');
    });

    it('should handle multiline content', () => {
      const content = 'line1\nline2\nline3';
      const result = formatBlock('data', content);

      expect(result).toBe('<data>\nline1\nline2\nline3\n</data>');
    });

    it('should handle empty content', () => {
      const result = formatBlock('empty', '');

      expect(result).toBe('<empty>\n\n</empty>');
    });
  });

  describe('formatList', () => {
    it('should format items as bullet list by default', () => {
      const result = formatList(['item1', 'item2', 'item3']);

      expect(result).toBe('- item1\n- item2\n- item3');
    });

    it('should format items as numbered list when requested', () => {
      const result = formatList(['first', 'second', 'third'], true);

      expect(result).toBe('1. first\n2. second\n3. third');
    });

    it('should handle single item', () => {
      expect(formatList(['only'])).toBe('- only');
      expect(formatList(['only'], true)).toBe('1. only');
    });

    it('should handle empty array', () => {
      expect(formatList([])).toBe('');
    });
  });

  describe('formatSection', () => {
    it('should format as markdown section', () => {
      const result = formatSection('Title', 'Content here');

      expect(result).toBe('## Title\n\nContent here\n');
    });

    it('should handle multiline content', () => {
      const result = formatSection('Title', 'Line 1\nLine 2');

      expect(result).toBe('## Title\n\nLine 1\nLine 2\n');
    });
  });

  describe('truncate', () => {
    it('should return original text if within limit', () => {
      expect(truncate('short', 10)).toBe('short');
    });

    it('should return original text if exactly at limit', () => {
      expect(truncate('12345', 5)).toBe('12345');
    });

    it('should truncate and add ellipsis when over limit', () => {
      expect(truncate('Hello World!', 8)).toBe('Hello...');
    });

    it('should handle very short limit', () => {
      expect(truncate('Hello', 4)).toBe('H...');
    });

    it('should handle empty string', () => {
      expect(truncate('', 10)).toBe('');
    });
  });

  describe('compactSummary', () => {
    it('should create summary with grouping', () => {
      const items = [
        { type: 'error', msg: 'e1' },
        { type: 'error', msg: 'e2' },
        { type: 'warning', msg: 'w1' }
      ];
      const result = compactSummary(items, (item) => item.type);

      expect(result).toEqual({
        total: 3,
        showing: 3,
        truncated: false,
        byKey: { error: 2, warning: 1 }
      });
    });

    it('should truncate when items exceed maxItems', () => {
      const items = Array.from({ length: 15 }, (_, i) => ({ id: i, type: 'item' }));
      const result = compactSummary(items, (item) => item.type, 10);

      expect(result.total).toBe(15);
      expect(result.showing).toBe(10);
      expect(result.truncated).toBe(true);
    });

    it('should use default maxItems of 10', () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const result = compactSummary(items, () => 'all');

      expect(result.showing).toBe(10);
      expect(result.truncated).toBe(true);
    });

    it('should handle empty array', () => {
      const result = compactSummary([], () => 'key');

      expect(result).toEqual({
        total: 0,
        showing: 0,
        truncated: false,
        byKey: {}
      });
    });
  });

  describe('AGENT_TEMPLATE', () => {
    it('should contain all required placeholders', () => {
      expect(AGENT_TEMPLATE).toContain('{name}');
      expect(AGENT_TEMPLATE).toContain('{role}');
      expect(AGENT_TEMPLATE).toContain('{instructions}');
      expect(AGENT_TEMPLATE).toContain('{tools}');
      expect(AGENT_TEMPLATE).toContain('{outputFormat}');
      expect(AGENT_TEMPLATE).toContain('{constraints}');
    });

    it('should have markdown section headers', () => {
      expect(AGENT_TEMPLATE).toContain('## Role');
      expect(AGENT_TEMPLATE).toContain('## Instructions');
      expect(AGENT_TEMPLATE).toContain('## Tools Available');
      expect(AGENT_TEMPLATE).toContain('## Output Format');
      expect(AGENT_TEMPLATE).toContain('## Critical Constraints');
    });
  });

  describe('createAgentPrompt', () => {
    it('should create a complete agent prompt', () => {
      const config = {
        name: 'TestAgent',
        role: 'A test agent for unit testing',
        instructions: ['Do step 1', 'Do step 2'],
        tools: [
          { name: 'tool_a', description: 'Does A' },
          { name: 'tool_b', description: 'Does B' }
        ],
        outputFormat: 'JSON',
        constraints: ['Never fail', 'Always succeed']
      };

      const result = createAgentPrompt(config);

      expect(result).toContain('# Agent: TestAgent');
      expect(result).toContain('A test agent for unit testing');
      expect(result).toContain('1. Do step 1');
      expect(result).toContain('2. Do step 2');
      expect(result).toContain('- tool_a: Does A');
      expect(result).toContain('- tool_b: Does B');
      expect(result).toContain('JSON');
      expect(result).toContain('**Never fail**');
      expect(result).toContain('**Always succeed**');
    });

    it('should use default values when not provided', () => {
      const result = createAgentPrompt({
        name: 'MinimalAgent',
        role: 'Minimal role'
      });

      expect(result).toContain('# Agent: MinimalAgent');
      expect(result).toContain('Minimal role');
      expect(result).toContain('Respond with structured JSON');
    });

    it('should handle empty arrays', () => {
      const result = createAgentPrompt({
        name: 'EmptyAgent',
        role: 'Role',
        instructions: [],
        tools: [],
        constraints: []
      });

      expect(result).toContain('# Agent: EmptyAgent');
      expect(result).not.toContain('1.');
    });
  });

  describe('normalizePathForRequire', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(normalizePathForRequire('C:\\Users\\test\\file.js')).toBe('C:/Users/test/file.js');
    });

    it('should leave forward slashes unchanged', () => {
      expect(normalizePathForRequire('/home/user/file.js')).toBe('/home/user/file.js');
    });

    it('should handle mixed slashes', () => {
      expect(normalizePathForRequire('C:\\Users/test\\file.js')).toBe('C:/Users/test/file.js');
    });

    it('should handle paths without slashes', () => {
      expect(normalizePathForRequire('file.js')).toBe('file.js');
    });

    it('should handle empty string', () => {
      expect(normalizePathForRequire('')).toBe('');
    });
  });

  describe('getOpenCodeConfig', () => {
    it('should create OpenCode MCP configuration', () => {
      // serverPath is mcp-server/index.js, PLUGIN_ROOT is parent of parent (two levels up)
      const serverPath = '/path/to/mcp-server/index.js';
      const result = getOpenCodeConfig(serverPath);

      expect(result).toEqual({
        mcp: {
          'agentsys': {
            type: 'local',
            command: ['node', serverPath],
            environment: {
              // path.dirname(path.dirname(serverPath)) = /path/to
              PLUGIN_ROOT: '/path/to',
              AI_STATE_DIR: '.opencode'
            },
            timeout: 10000,
            enabled: true
          }
        }
      });
    });

    it('should merge custom environment variables', () => {
      const serverPath = '/path/to/server.js';
      const result = getOpenCodeConfig(serverPath, { CUSTOM_VAR: 'value' });

      expect(result.mcp['agentsys'].environment.CUSTOM_VAR).toBe('value');
      expect(result.mcp['agentsys'].environment.AI_STATE_DIR).toBe('.opencode');
    });

    it('should calculate PLUGIN_ROOT as grandparent of serverPath', () => {
      // PLUGIN_ROOT = path.dirname(path.dirname(serverPath))
      // For /project/mcp-server/index.js, parent is /project/mcp-server, grandparent is /project
      const serverPath = '/project/mcp-server/index.js';
      const result = getOpenCodeConfig(serverPath);

      expect(result.mcp['agentsys'].environment.PLUGIN_ROOT).toBe('/project');
    });
  });

  describe('getCodexConfig', () => {
    it('should create Codex CLI TOML configuration', () => {
      const serverPath = '/path/to/mcp-server/index.js';
      const result = getCodexConfig(serverPath);

      expect(result).toContain('[mcp_servers.agentsys]');
      expect(result).toContain('command = "node"');
      expect(result).toContain(`args = ["${serverPath}"]`);
      expect(result).toContain('AI_STATE_DIR = ".codex"');
      expect(result).toContain('enabled = true');
    });

    it('should include custom environment variables in TOML', () => {
      const serverPath = '/path/to/server.js';
      const result = getCodexConfig(serverPath, { MY_VAR: 'test' });

      expect(result).toContain('MY_VAR = "test"');
    });

    it('should calculate PLUGIN_ROOT as grandparent of serverPath', () => {
      // Same logic as getOpenCodeConfig: path.dirname(path.dirname(serverPath))
      const serverPath = '/project/mcp-server/index.js';
      const result = getCodexConfig(serverPath);

      expect(result).toContain('PLUGIN_ROOT = "/project"');
    });
  });

  describe('INSTRUCTION_FILES constant', () => {
    it('should define instruction files for Claude Code', () => {
      expect(INSTRUCTION_FILES[PLATFORMS.CLAUDE_CODE]).toEqual(['CLAUDE.md', '.claude/CLAUDE.md']);
    });

    it('should define instruction files for OpenCode', () => {
      expect(INSTRUCTION_FILES[PLATFORMS.OPENCODE]).toEqual(['AGENTS.md', 'CLAUDE.md']);
    });

    it('should define instruction files for Codex CLI', () => {
      expect(INSTRUCTION_FILES[PLATFORMS.CODEX_CLI]).toEqual(['AGENTS.md', 'AGENTS.override.md']);
    });

    it('should define instruction files for Cursor', () => {
      expect(INSTRUCTION_FILES[PLATFORMS.CURSOR]).toEqual(['.cursor/rules/*.mdc']);
    });
  });

  describe('getInstructionFiles', () => {
    it('should return Claude Code files when platform not specified and AI_STATE_DIR not set', () => {
      delete process.env.AI_STATE_DIR;
      const result = getInstructionFiles();

      expect(result).toEqual(['CLAUDE.md', '.claude/CLAUDE.md']);
    });

    it('should return OpenCode files when platform is opencode', () => {
      const result = getInstructionFiles(PLATFORMS.OPENCODE);

      expect(result).toEqual(['AGENTS.md', 'CLAUDE.md']);
    });

    it('should return Codex files when platform is codex-cli', () => {
      const result = getInstructionFiles(PLATFORMS.CODEX_CLI);

      expect(result).toEqual(['AGENTS.md', 'AGENTS.override.md']);
    });

    it('should detect platform from AI_STATE_DIR when platform not specified', () => {
      process.env.AI_STATE_DIR = '.opencode';
      const result = getInstructionFiles();

      expect(result).toEqual(['AGENTS.md', 'CLAUDE.md']);
    });

    it('should fall back to Claude Code files for unknown platform', () => {
      const result = getInstructionFiles('unknown-platform');

      expect(result).toEqual(['CLAUDE.md', '.claude/CLAUDE.md']);
    });
  });

  describe('integration scenarios', () => {
    describe('OpenCode environment', () => {
      beforeEach(() => {
        process.env.AI_STATE_DIR = '.opencode';
      });

      it('should correctly detect platform and state directory', () => {
        expect(detectPlatform()).toBe(PLATFORMS.OPENCODE);
        expect(getStateDir()).toBe('.opencode');
      });

      it('should return correct instruction files', () => {
        expect(getInstructionFiles()).toEqual(['AGENTS.md', 'CLAUDE.md']);
      });

      it('should return correct suppression path', () => {
        const home = os.homedir();
        expect(getSuppressionPath()).toBe(path.join(home, '.opencode', 'enhance', 'suppressions.json'));
      });
    });

    describe('Codex CLI environment', () => {
      beforeEach(() => {
        process.env.AI_STATE_DIR = '.codex';
      });

      it('should correctly detect platform and state directory', () => {
        expect(detectPlatform()).toBe(PLATFORMS.CODEX_CLI);
        expect(getStateDir()).toBe('.codex');
      });

      it('should return correct instruction files', () => {
        expect(getInstructionFiles()).toEqual(['AGENTS.md', 'AGENTS.override.md']);
      });

      it('should return correct suppression path', () => {
        const home = os.homedir();
        expect(getSuppressionPath()).toBe(path.join(home, '.codex', 'enhance', 'suppressions.json'));
      });
    });

    describe('MCP mode with PLUGIN_ROOT', () => {
      it('should use PLUGIN_ROOT directly when available', () => {
        process.env.PLUGIN_ROOT = '/mcp/plugin/root';

        expect(getPluginRoot()).toBe('/mcp/plugin/root');
        expect(getPluginRoot('any-plugin')).toBe('/mcp/plugin/root');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in tool descriptions', () => {
      const result = createToolDefinition(
        'special_tool',
        'Tool with "quotes" and <tags>',
        {},
        []
      );

      expect(result.description).toBe('Tool with "quotes" and <tags>');
    });

    it('should handle unicode in formatBlock', () => {
      const result = formatBlock('test', 'Hello World');

      expect(result).toContain('Hello World');
    });

    it('should handle nested objects in successResponse', () => {
      const data = {
        level1: {
          level2: {
            value: 'deep'
          }
        }
      };
      const result = successResponse(data);

      expect(JSON.parse(result.content[0].text)).toEqual(data);
    });

    it('should handle Windows-style paths in normalizePathForRequire', () => {
      const windowsPath = 'C:\\Users\\User Name\\Projects\\file.js';
      const result = normalizePathForRequire(windowsPath);

      expect(result).toBe('C:/Users/User Name/Projects/file.js');
    });

    it('should handle UNC paths in normalizePathForRequire', () => {
      const uncPath = '\\\\server\\share\\file.js';
      const result = normalizePathForRequire(uncPath);

      expect(result).toBe('//server/share/file.js');
    });
  });
});
