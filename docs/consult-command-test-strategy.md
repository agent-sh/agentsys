# Test Strategy for /consult Command

> **Note**: The consult plugin is entirely markdown-based with no JavaScript implementation.
> The function names below (e.g., `parseArguments()`, `getClaudeModel()`) are hypothetical
> examples showing what would be tested if the plugin had a JS implementation. The actual
> tests in `__tests__/consult-command.test.js` validate markdown content instead.

## Overview

The `/consult` command has unique testing requirements:
- **External process execution** (spawns CLI tools like gemini, codex, claude)
- **JSON output parsing** (structured responses between markers)
- **Timeout handling** (120-second limits)
- **Session state management** (save/load JSON files)
- **Cross-platform compatibility** (Windows/Unix tool detection)
- **Interactive parameter selection** (user dialogs)
- **Context packaging** (git diff, file attachment)

## Test Categories

### 1. Unit Tests (Fast, Isolated)

#### 1.1 Argument Parsing
Validate correct and incorrect argument formats.

```javascript
// tests/plugins/consult/consult-arguments.test.js

describe('Argument Parsing', () => {
  describe('--tool validation', () => {
    it('should accept valid tools', () => {
      const validTools = ['gemini', 'codex', 'claude', 'opencode', 'copilot'];
      validTools.forEach(tool => {
        const args = ['question', '--tool=' + tool];
        const parsed = parseArguments(args);
        expect(parsed.tool).toBe(tool);
      });
    });

    it('should reject invalid tools', () => {
      const invalidTools = ['openai', 'anthropic', 'llama', 'invalid'];
      invalidTools.forEach(tool => {
        const args = ['question', '--tool=' + tool];
        expect(() => parseArguments(args)).toThrow('Invalid tool');
      });
    });

    it('should accept quoted model names', () => {
      const args = ['question', '--tool=claude', '--model="gpt 4.5"'];
      const parsed = parseArguments(args);
      expect(parsed.model).toBe('gpt 4.5');
    });
  });

  describe('--effort validation', () => {
    it('should accept all effort levels', () => {
      const validEfforts = ['low', 'medium', 'high', 'max'];
      validEfforts.forEach(effort => {
        const args = ['question', '--effort=' + effort];
        const parsed = parseArguments(args);
        expect(parsed.effort).toBe(effort);
      });
    });

    it('should reject invalid effort levels', () => {
      const args = ['question', '--effort=unknown'];
      expect(() => parseArguments(args)).toThrow('Invalid effort');
    });
  });

  describe('--context validation', () => {
    it('should accept diff context', () => {
      const args = ['question', '--context=diff'];
      const parsed = parseArguments(args);
      expect(parsed.context).toBe('diff');
    });

    it('should accept file context', () => {
      const args = ['question', '--context=file=src/index.js'];
      const parsed = parseArguments(args);
      expect(parsed.context).toBe('file=src/index.js');
    });

    it('should reject paths outside project directory', () => {
      const args = ['question', '--context=file=/etc/passwd'];
      expect(() => parseArguments(args)).toThrow('Path outside project');
    });

    it('should reject paths with parent directory traversal', () => {
      const args = ['question', '--context=file=../../secret.js'];
      expect(() => parseArguments(args)).toThrow('Path outside project');
    });
  });

  describe('question extraction', () => {
    it('should extract question from arguments', () => {
      const args = ['what is the meaning of life?', '--tool=claude'];
      const parsed = parseArguments(args);
      expect(parsed.question).toBe('what is the meaning of life?');
    });

    it('should extract question from quoted string', () => {
      const args = ['"What is the best approach?"', '--tool=gemini'];
      const parsed = parseArguments(args);
      expect(parsed.question).toBe('What is the best approach?');
    });

    it('should return empty question without --continue', () => {
      const args = ['--tool=claude'];
      const parsed = parseArguments(args);
      expect(parsed.question).toBe('');
      expect(parsed.continue).toBeUndefined();
    });

    it('should handle --continue flag', () => {
      const args = ['--continue'];
      const parsed = parseArguments(args);
      expect(parsed.continue).toBe(true);
    });

    it('should handle specific session ID', () => {
      const args = ['--continue=abc-123'];
      const parsed = parseArguments(args);
      expect(parsed.continue).toBe('abc-123');
    });
  });

  describe('missing parameters', () => {
    it('should report usage when no question and no --continue', () => {
      const args = ['--tool=claude'];
      expect(() => parseArguments(args)).toThrow('Usage: /consult');
    });

    it('should allow --continue without question', () => {
      const args = ['--continue=abc-123'];
      const parsed = parseArguments(args);
      expect(parsed.continue).toBe('abc-123');
    });
  });
});
```

#### 1.2 Model Selection Logic
Test effort-to-model mapping and overrides.

```javascript
// tests/plugins/consult/model-mapping.test.js

describe('Model Selection', () => {
  describe('Claude models', () => {
    it('should map low effort to haiku', () => {
      expect(getClaudeModel('low')).toBe('haiku');
    });

    it('should map medium effort to sonnet', () => {
      expect(getClaudeModel('medium')).toBe('sonnet');
    });

    it('should map high effort to opus', () => {
      expect(getClaudeModel('high')).toBe('opus');
    });

    it('should map max effort to opus', () => {
      expect(getClaudeModel('max')).toBe('opus');
    });

    it('should allow model override', () => {
      expect(getClaudeModel('medium', 'custom-model')).toBe('custom-model');
    });
  });

  describe('Gemini models', () => {
    it('should map effort levels correctly', () => {
      expect(getGeminiModel('low')).toBe('gemini-2.5-flash');
      expect(getGeminiModel('medium')).toBe('gemini-3-flash');
      expect(getGeminiModel('high')).toBe('gemini-3-pro');
      expect(getGeminiModel('max')).toBe('gemini-3-pro');
    });
  });

  describe('Codex models', () => {
    it('should map effort levels correctly', () => {
      expect(getCodexModel('low')).toBe('gpt-5.1-codex-mini');
      expect(getCodexModel('medium')).toBe('gpt-5.2-codex');
      expect(getCodexModel('high')).toBe('gpt-5.3-codex');
      expect(getCodexModel('max')).toBe('gpt-5.3-codex');
    });
  });

  describe('OpenCode models', () => {
    it('should map effort levels correctly', () => {
      expect(getOpenCodeModel('low')).toBe('glm-4.7');
      expect(getOpenCodeModel('medium')).toBe('github-copilot/claude-opus-4-6');
      expect(getOpenCodeModel('high')).toBe('github-copilot/claude-opus-4-6');
      expect(getOpenCodeModel('max')).toBe('github-copilot/gpt-5.3-codex');
    });

    it('should add --thinking flag for max effort', () => {
      const { command, flags } = getOpenCodeCommand('max', 'question');
      expect(flags.includes('--thinking')).toBe(true);
    });
  });

  describe('Copilot', () => {
    it('should return simple command without effort control', () => {
      const result = getCopilotCommand('any question', 'medium');
      expect(result.command).toBe('copilot -p "any question"');
      expect(result.model).toBeNull();
    });
  });
});
```

#### 1.3 Session Management
Test session file read/write operations.

```javascript
// tests/plugins/consult/session-management.test.js

describe('Session Management', () => {
  describe('Save Session', () => {
    it('should write session JSON to correct path', () => {
      const session = {
        tool: 'claude',
        model: 'opus',
        effort: 'high',
        session_id: 'abc-123',
        timestamp: new Date().toISOString(),
        question: 'original question',
        continuable: true
      };

      const result = saveSession(session);
      expect(fs.existsSync(result.path)).toBe(true);

      const loaded = JSON.parse(fs.readFileSync(result.path, 'utf8'));
      expect(loaded.tool).toBe(session.tool);
      expect(loaded.model).toBe(session.model);
      expect(loaded.effort).toBe(session.effort);
      expect(loaded.session_id).toBe(session.session_id);
      expect(loaded.continuable).toBe(true);
    });

    it('should include question in saved session', () => {
      const session = {
        tool: 'gemini',
        model: 'gemini-3-pro',
        effort: 'medium',
        session_id: 'xyz-789',
        timestamp: new Date().toISOString(),
        question: 'my consultation question',
        continuable: true
      };

      saveSession(session);
      const loaded = JSON.parse(
        fs.readFileSync(AI_STATE_DIR + '/consult/last-session.json', 'utf8')
      );
      expect(loaded.question).toBe('my consultation question');
    });
  });

  describe('Load Session', () => {
    it('should load existing session file', () => {
      const session = {
        tool: 'claude',
        model: 'sonnet',
        effort: 'medium',
        session_id: 'session-123',
        timestamp: new Date().toISOString(),
        question: 'previous question',
        continuable: true
      };

      const path = AI_STATE_DIR + '/consult/last-session.json';
      fs.writeFileSync(path, JSON.stringify(session));

      const loaded = loadSession();
      expect(loaded.tool).toBe(session.tool);
      expect(loaded.model).toBe(session.model);
      expect(loaded.session_id).toBe(session.session_id);
    });

    it('should return null when no session file exists', () => {
      const path = AI_STATE_DIR + '/consult/last-session.json';
      fs.unlinkSync(path);
      expect(loadSession()).toBeNull();
    });

    it('should handle malformed JSON gracefully', () => {
      const path = AI_STATE_DIR + '/consult/last-session.json';
      fs.writeFileSync(path, 'not valid json');

      const result = loadSession();
      expect(result).toBeNull();
    });
  });

  describe('Session Validity', () => {
    it('should validate session has required fields', () => {
      const validSession = {
        tool: 'claude',
        model: 'opus',
        effort: 'high',
        session_id: 'valid-session',
        timestamp: new Date().toISOString(),
        question: 'question',
        continuable: true
      };

      expect(validateSession(validSession)).toBe(true);
    });

    it('should reject sessions missing required fields', () => {
      const invalidSessions = [
        { tool: 'claude', model: 'opus' },
        { session_id: 'abc', question: 'q' },
        {}
      ];

      invalidSessions.forEach(session => {
        expect(validateSession(session)).toBe(false);
      });
    });
  });
});
```

### 2. Integration Tests (Process Execution)

#### 2.1 Tool Detection
Test cross-platform tool detection logic.

```javascript
// tests/plugins/consult/tool-detection.test.js

describe('Tool Detection', () => {
  describe('Cross-platform detection', () => {
    beforeEach(() => {
      // Mock environment
      process.platform = 'win32';
      process.env.Path = '/usr/bin';
    });

    it('should detect installed tools on Windows', () => {
      // Mock where.exe to return tool found
      jest.spyOn(Bash, 'run').mockResolvedValue({ stdout: 'C:\\tools\\claude.exe' });

      const detected = detectTools();
      expect(detected).toContain('claude');
      expect(detected).toContain('gemini');
    });

    it('should detect installed tools on Unix', () => {
      process.platform = 'darwin';
      jest.spyOn(Bash, 'run').mockResolvedValue({ stdout: '/usr/local/bin/codex' });

      const detected = detectTools();
      expect(detected).toContain('codex');
    });

    it('should return empty array when no tools installed', () => {
      jest.spyOn(Bash, 'run').mockResolvedValue({ stdout: '' });

      const detected = detectTools();
      expect(detected).toEqual([]);
    });
  });

  describe('Tool validation', () => {
    it('should reject tools not in allow-list', () => {
      const args = ['question', '--tool=openai'];
      expect(() => parseArguments(args)).toThrow('Invalid tool');
    });
  });
});
```

#### 2.2 Context Packaging
Test git diff and file context attachment.

```javascript
// tests/plugins/consult/context-packaging.test.js

describe('Context Packaging', () => {
  describe('Git Diff Context', () => {
    it('should include git diff output', () => {
      const mockDiff = {
        stdout: 'diff --git a/file.js b/file.js\n+new line'
      };

      jest.spyOn(Bash, 'run').mockResolvedValue(mockDiff);

      const question = 'what changed?';
      const result = packageContext(question, 'diff');

      expect(result).toContain('what changed?');
      expect(result).toContain(mockDiff.stdout);
    });

    it('should handle missing git repo gracefully', () => {
      jest.spyOn(Bash, 'run').mockResolvedValue({ stdout: '' });

      const result = packageContext('what changed?', 'diff');
      expect(result).toBe('what changed?');
    });

    it('should prepend context before question', () => {
      jest.spyOn(Bash, 'run').mockResolvedValue({
        stdout: '--- Original ---\n+++ New ---'
      });

      const result = packageContext('explanation?', 'diff');
      expect(result.startsWith('--- Original ---')).toBe(true);
      expect(result.endsWith('explanation?')).toBe(true);
    });
  });

  describe('File Context', () => {
    it('should read and attach file content', () => {
      const mockFileContent = 'function example() {\n  return true;\n}';

      jest.spyOn(Read, 'readFile').mockResolvedValue(mockFileContent);

      const result = packageContext('explain this', 'file=src/index.js');
      expect(result).toContain(mockFileContent);
      expect(result).toContain('explain this');
    });

    it('should reject absolute paths outside project', () => {
      jest.spyOn(Read, 'readFile').mockRejectedValue(new Error('Access denied'));

      expect(() => packageContext('explain', 'file=/etc/passwd')).toThrow();
    });

    it('should reject paths with directory traversal', () => {
      expect(() => packageContext('explain', 'file=../../secret')).toThrow();
    });
  });

  describe('No Context', () => {
    it('should return question unchanged', () => {
      const result = packageContext('simple question', 'none');
      expect(result).toBe('simple question');
    });
  });
});
```

#### 2.3 Session Continuation
Test --continue flag functionality.

```javascript
// tests/plugins/consult/session-continuation.test.js

describe('Session Continuation', () => {
  describe('Load Session', () => {
    it('should restore tool from saved session', () => {
      const session = {
        tool: 'gemini',
        model: 'gemini-3-pro',
        effort: 'medium',
        session_id: 'session-456',
        timestamp: new Date().toISOString(),
        question: 'continue with this',
        continuable: true
      };

      const path = AI_STATE_DIR + '/consult/last-session.json';
      fs.writeFileSync(path, JSON.stringify(session));

      const args = ['--continue=session-456'];
      const parsed = parseArguments(args);
      const loaded = loadSession();

      expect(parsed.tool).toBe('gemini');
      expect(parsed.continue).toBe('session-456');
    });

    it('should warn when session file missing', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const path = AI_STATE_DIR + '/consult/last-session.json';
      fs.unlinkSync(path);

      const args = ['--continue'];
      const parsed = parseArguments(args);

      expect(consoleWarn).toHaveBeenCalledWith('[WARN] No previous session found');
      expect(parsed.continue).toBe(true);
    });
  });

  describe('Tool Continuability', () => {
    it('should allow continuation for Claude', () => {
      const session = { tool: 'claude', ...basicSession };
      expect(isToolContinuable(session)).toBe(true);
    });

    it('should allow continuation for Gemini', () => {
      const session = { tool: 'gemini', ...basicSession };
      expect(isToolContinuable(session)).toBe(true);
    });

    it('should reject continuation for Codex', () => {
      const session = { tool: 'codex', ...basicSession };
      expect(isToolContinuable(session)).toBe(false);
    });

    it('should reject continuation for OpenCode', () => {
      const session = { tool: 'opencode', ...basicSession };
      expect(isToolContinuable(session)).toBe(false);
    });

    it('should reject continuation for Copilot', () => {
      const session = { tool: 'copilot', ...basicSession };
      expect(isToolContinuable(session)).toBe(false);
    });
  });
});
```

### 3. Mock Tests (Process Simulation)

#### 3.1 Output Parsing
Test parsing of provider-specific output formats.

```javascript
// tests/plugins/consult/output-parsing.test.js

describe('Output Parsing', () => {
  describe('Claude Output', () => {
    it('should parse JSON output', () => {
      const output = {
        stdout: JSON.stringify({ result: 'AI response', session_id: 'session-123' }),
        stderr: ''
      };

      const result = parseClaudeOutput(output);
      expect(result.response).toBe('AI response');
      expect(result.session_id).toBe('session-123');
    });

    it('should handle raw text output', () => {
      const output = {
        stdout: 'AI response text',
        stderr: ''
      };

      const result = parseClaudeOutput(output);
      expect(result.response).toBe('AI response text');
      expect(result.session_id).toBeUndefined();
    });
  });

  describe('Gemini Output', () => {
    it('should parse JSON output', () => {
      const output = {
        stdout: JSON.stringify({ response: 'Gemini response' }),
        stderr: ''
      };

      const result = parseGeminiOutput(output);
      expect(result.response).toBe('Gemini response');
    });
  });

  describe('Codex Output', () => {
    it('should parse JSON message', () => {
      const output = {
        stdout: JSON.stringify({ message: 'Codex response' }),
        stderr: ''
      };

      const result = parseCodexOutput(output);
      expect(result.response).toBe('Codex response');
    });

    it('should handle raw text fallback', () => {
      const output = {
        stdout: 'Raw text response',
        stderr: ''
      };

      const result = parseCodexOutput(output);
      expect(result.response).toBe('Raw text response');
    });
  });

  describe('OpenCode Output', () => {
    it('should parse JSON events', () => {
      const events = [
        { type: 'start', data: {} },
        { type: 'text', content: 'Response text' },
        { type: 'end', data: {} }
      ];

      const result = parseOpenCodeOutput(JSON.stringify(events));
      expect(result.response).toBe('Response text');
    });
  });

  describe('Copilot Output', () => {
    it('should return raw text', () => {
      const output = {
        stdout: 'Copilot response',
        stderr: ''
      };

      const result = parseCopilotOutput(output);
      expect(result.response).toBe('Copilot response');
    });
  });

  describe('Result markers', () => {
    it('should extract result between markers', () => {
      const fullOutput = '=== CONSULT_RESULT ===\n{"response":"test"}\n=== END_RESULT ===';

      const result = extractResultFromMarkers(fullOutput);
      expect(result.response).toBe('test');
    });

    it('should handle missing end marker', () => {
      const fullOutput = '=== CONSULT_RESULT ===\n{"response":"test"}';

      const result = extractResultFromMarkers(fullOutput);
      expect(result.response).toBe('test');
    });
  });
});
```

#### 3.2 Command Building
Test building provider-specific CLI commands.

```javascript
// tests/plugins/consult/command-building.test.js

describe('Command Building', () => {
  describe('Claude Command', () => {
    it('should build basic command', () => {
      const { command, flags } = buildClaudeCommand('question', 'opus', 3);
      expect(command).toBe('claude');
      expect(flags).toContain('-p');
      expect(flags).toContain('"question"');
      expect(flags).toContain('--output-format');
      expect(flags).toContain('json');
      expect(flags).toContain('--model');
      expect(flags).toContain('opus');
      expect(flags).toContain('--max-turns');
      expect(flags).toContain('3');
    });

    it('should include safe-mode flags', () => {
      const { flags } = buildClaudeCommand('question', 'opus', 3);
      expect(flags).toContain('--allowedTools');
      expect(flags).toContain('"Read,Glob,Grep"');
    });

    it('should append session resume for continuation', () => {
      const { flags } = buildClaudeCommand('question', 'opus', 3, 'session-123', true);
      expect(flags).toContain('--resume');
      expect(flags).toContain('session-123');
    });

    it('should escape quotes in command', () => {
      const { flags } = buildClaudeCommand('what"quote', 'opus', 3);
      const quoteIndex = flags.indexOf('"what"quote');
      expect(quoteIndex).toBeGreaterThan(-1);
    });
  });

  describe('Gemini Command', () => {
    it('should build basic command', () => {
      const { command, flags } = buildGeminiCommand('question', 'gemini-3-pro');
      expect(command).toBe('gemini');
      expect(flags).toContain('-p');
      expect(flags).toContain('"question"');
      expect(flags).toContain('--output-format');
      expect(flags).toContain('json');
      expect(flags).toContain('-m');
      expect(flags).toContain('gemini-3-pro');
    });

    it('should append session resume for continuation', () => {
      const { flags } = buildGeminiCommand('question', 'gemini-3-pro', 'session-456', true);
      expect(flags).toContain('--resume');
      expect(flags).toContain('session-456');
    });
  });

  describe('Codex Command', () => {
    it('should build basic command', () => {
      const { command, flags } = buildCodexCommand('question', 'gpt-5.3-codex', 'high');
      expect(command).toBe('codex');
      expect(flags).toContain('-q');
      expect(flags).toContain('"question"');
      expect(flags).toContain('--json');
      expect(flags).toContain('-m');
      expect(flags).toContain('gpt-5.3-codex');
      expect(flags).toContain('-a');
      expect(flags).toContain('suggest');
      expect(flags).toContain('-c');
      expect(flags).toContain('model_reasoning_effort=high');
    });

    it('should use suggest mode', () => {
      const { flags } = buildCodexCommand('question', 'gpt-5.3-codex', 'high');
      expect(flags).toContain('-a');
      expect(flags).toContain('suggest');
    });
  });

  describe('OpenCode Command', () => {
    it('should build basic command', () => {
      const { command, flags } = buildOpenCodeCommand('question', 'glm-4.7', 'low', 'low');
      expect(command).toBe('opencode');
      expect(flags).toContain('run');
      expect(flags).toContain('"question"');
      expect(flags).toContain('--format');
      expect(flags).toContain('json');
      expect(flags).toContain('--model');
      expect(flags).toContain('glm-4.7');
      expect(flags).toContain('--variant');
      expect(flags).toContain('low');
    });

    it('should add --thinking for max effort', () => {
      const { flags } = buildOpenCodeCommand('question', 'github-copilot/gpt-5.3-codex', 'max', 'high');
      expect(flags).toContain('--thinking');
    });

    it('should not add --thinking for lower efforts', () => {
      const { flags } = buildOpenCodeCommand('question', 'glm-4.7', 'low', 'low');
      expect(flags).not.toContain('--thinking');
    });
  });

  describe('Copilot Command', () => {
    it('should build simple command', () => {
      const { command, flags } = buildCopilotCommand('question', 'medium');
      expect(command).toBe('copilot');
      expect(flags).toContain('-p');
      expect(flags).toContain('"question"');
      expect(flags).not.toContain('--model');
      expect(flags).not.toContain('--effort');
    });
  });

  describe('Shell Escaping', () => {
    it('should escape special characters in question', () => {
      const { flags } = buildClaudeCommand('test$var', 'opus', 3);
      const quotedIndex = flags.indexOf('"test$var"');
      expect(quotedIndex).toBeGreaterThan(-1);
    });

    it('should escape backticks', () => {
      const { flags } = buildClaudeCommand('test`backtick', 'opus', 3);
      const quotedIndex = flags.indexOf('"test`backtick"');
      expect(quotedIndex).toBeGreaterThan(-1);
    });
  });
});
```

#### 3.3 Timeout Handling
Test 120-second timeout enforcement.

```javascript
// tests/plugins/consult/timeout-handling.test.js

describe('Timeout Handling', () => {
  describe('120-second timeout enforcement', () => {
    it('should use 120s timeout on all executions', () => {
      const mockProcess = {
        exec: jest.fn()
      };

      executeWithTimeout(mockProcess, 'command', 120000);

      expect(mockProcess.exec).toHaveBeenCalledWith(
        'command',
        expect.objectContaining({
          timeout: 120000
        })
      );
    });

    it('should handle shorter timeouts', () => {
      const mockProcess = {
        exec: jest.fn()
      };

      executeWithTimeout(mockProcess, 'command', 60000);

      expect(mockProcess.exec).toHaveBeenCalledWith(
        'command',
        expect.objectContaining({
          timeout: 60000
        })
      );
    });

    it('should propagate timeout error', async () => {
      const mockProcess = {
        exec: jest.fn().mockImplementation((cmd, opts, callback) => {
          callback(new Error('Command timed out after 120s'));
        })
      };

      const { error } = await executeWithTimeout(mockProcess, 'command', 120000);
      expect(error).toBeDefined();
      expect(error.message).toContain('timeout');
    });
  });

  describe('Timeout Error Response', () => {
    it('should return error response on timeout', () => {
      const mockProcess = {
        exec: jest.fn().mockImplementation((cmd, opts, callback) => {
          callback(new Error('Command timed out after 120s'));
        })
      };

      const result = executeConsult('claude', 'question');
      expect(result.error).toBe('Command timed out after 120s');
      expect(result.duration_ms).toBeGreaterThanOrEqual(120000);
    });

    it('should return suggested effort reduction', () => {
      const result = getTimeoutMessage('claude', 125000);
      expect(result).toContain('--effort=low');
    });
  });
});
```

### 4. Integration/E2E Tests (Full Workflow)

#### 4.1 Full Consultation Flow
Test end-to-end consultation with mock tool outputs.

```javascript
// tests/plugins/consult/consult-flow.test.js

describe('Full Consultation Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Flow', () => {
    it('should complete full consultation successfully', async () => {
      // Mock tool detection
      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: 'C:\\tools\\claude.exe'
      });

      // Mock file read for context
      jest.spyOn(Read, 'readFile').mockResolvedValue('file content');

      // Mock session save
      jest.spyOn(fs, 'writeFileSync');

      // Mock skill invocation and output parsing
      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: '=== CONSULT_RESULT ===\n{"response":"Test response","session_id":"session-123"}\n=== END_RESULT ==='
      });

      const result = await runConsultation(
        'explain this code',
        'claude',
        'high'
      );

      expect(result.tool).toBe('claude');
      expect(result.response).toContain('Test response');
      expect(result.duration_ms).toBeGreaterThan(0);
      expect(result.session_id).toBe('session-123');
      expect(result.continuable).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('Context Packaging Flow', () => {
    it('should package git diff context before question', async () => {
      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: 'C:\\tools\\claude.exe'
      });

      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: '--- git diff output ---\n+new code'
      });

      jest.spyOn(Read, 'readFile').mockResolvedValue('file content');

      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: '=== CONSULT_RESULT ===\n{"response":"test"}\n=== END_RESULT ==='
      });

      const result = await runConsultation(
        'explain this',
        'claude',
        'high',
        'diff'
      );

      // Verify git diff was run
      expect(Bash.run).toHaveBeenCalledWith(
        'git diff 2>/dev/null',
        expect.any(Object)
      );
    });

    it('should package file context', async () => {
      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: 'C:\\tools\\claude.exe'
      });

      jest.spyOn(Read, 'readFile').mockResolvedValueOnce('file content');

      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: '=== CONSULT_RESULT ===\n{"response":"test"}\n=== END_RESULT ==='
      });

      await runConsultation(
        'explain this',
        'claude',
        'high',
        'file=src/index.js'
      );

      // Verify file was read
      expect(Read.readFile).toHaveBeenCalledWith('src/index.js');
    });
  });

  describe('Session Continuation Flow', () => {
    it('should load session and use session ID', async () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify({
        tool: 'gemini',
        session_id: 'session-456',
        model: 'gemini-3-pro',
        effort: 'medium',
        timestamp: new Date().toISOString(),
        question: 'continue',
        continuable: true
      }));

      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: 'where.exe gemini.exe'
      });

      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: '=== CONSULT_RESULT ===\n{"response":"continued"}\n=== END_RESULT ==='
      });

      const result = await runConsultation(
        '--continue=session-456',
        null,
        null
      );

      expect(result.tool).toBe('gemini');
      expect(result.session_id).toBe('session-456');
    });

    it('should start fresh when session missing', async () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValueOnce('');

      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: 'where.exe gemini.exe'
      });

      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: '=== CONSULT_RESULT ===\n{"response":"fresh"}\n=== END_RESULT ==='
      });

      const result = await runConsultation(
        '--continue',
        null,
        null
      );

      expect(result.tool).toBeDefined();
      expect(result.session_id).toBeDefined();
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle tool not installed', async () => {
      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: ''
      });

      const result = await runConsultation(
        'question',
        'codex',
        'high'
      );

      expect(result.error).toContain('codex is not installed');
      expect(result.error).toContain('npm install -g @openai/codex');
    });

    it('should handle tool execution failure', async () => {
      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: 'where.exe codex.exe'
      });

      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: '',
        stderr: 'Error: API key not found'
      });

      const result = await runConsultation('question', 'codex', 'high');

      expect(result.error).toContain('codex failed');
      expect(result.error).toContain('API key not found');
    });

    it('should handle timeout', async () => {
      jest.spyOn(Bash, 'run').mockResolvedValueOnce({
        stdout: 'where.exe gemini.exe'
      });

      jest.spyOn(Bash, 'run').mockImplementationOnce((cmd, opts, callback) => {
        callback(new Error('Command timed out'));
      });

      const result = await runConsultation('question', 'gemini', 'high');

      expect(result.error).toContain('timeout');
      expect(result.error).toContain('--effort=low');
    });
  });
});
```

### 5. Cross-Platform Tests

#### 5.1 Platform-Specific Behavior
Test Windows vs Unix behavior differences.

```javascript
// tests/plugins/consult/cross-platform.test.js

describe('Cross-Platform Compatibility', () => {
  describe('Tool Detection', () => {
    it('should use where.exe on Windows', () => {
      process.platform = 'win32';

      jest.spyOn(Bash, 'run').mockResolvedValue({
        stdout: 'C:\\tools\\gemini.exe'
      });

      detectTools();

      expect(Bash.run).toHaveBeenCalledWith(
        'where.exe gemini.exe 2>nul && echo FOUND || echo NOTFOUND',
        expect.any(Object)
      );
    });

    it('should use which on Unix', () => {
      process.platform = 'darwin';

      jest.spyOn(Bash, 'run').mockResolvedValue({
        stdout: '/usr/local/bin/gemini'
      });

      detectTools();

      expect(Bash.run).toHaveBeenCalledWith(
        'which gemini 2>/dev/null && echo FOUND || echo NOTFOUND',
        expect.any(Object)
      );
    });
  });

  describe('Path Validation', () => {
    it('should validate paths on Windows', () => {
      const isPathValid = validateProjectPath('C:\\project\\file.js');
      expect(isPathValid).toBe(true);
    });

    it('should validate paths on Unix', () => {
      const isPathValid = validateProjectPath('/home/user/project/file.js');
      expect(isPathValid).toBe(true);
    });

    it('should reject absolute paths outside project', () => {
      const isPathValid = validateProjectPath('/etc/passwd');
      expect(isPathValid).toBe(false);
    });

    it('should reject paths with parent traversal', () => {
      const isPathValid = validateProjectPath('../secret/file.js');
      expect(isPathValid).toBe(false);
    });
  });

  describe('Environment Variables', () => {
    it('should use platform state directory on Windows', () => {
      process.env.HOME = 'C:\\Users\\user';
      const stateDir = getStateDirectory();
      expect(stateDir).toBe('C:\\Users\\user\\.claude');
    });

    it('should use platform state directory on Unix', () => {
      process.env.HOME = '/home/user';
      const stateDir = getStateDirectory();
      expect(stateDir).toBe('/home/user/.claude');
    });
  });
});
```

### 6. Mocked External Tool Tests

#### 6.1 Mocking Real Tool Outputs
Test with realistic mock outputs for each provider.

```javascript
// tests/plugins/consult/mocked-tools.test.js

describe('Mocked Tool Outputs', () => {
  const mockClaudeOutput = `=== CONSULT_RESULT ===
{
  "tool": "claude",
  "model": "opus",
  "effort": "high",
  "duration_ms": 52300,
  "response": "Looking at this code, I notice the function could be optimized by extracting the helper logic into a separate function. This would improve readability and maintainability.",
  "session_id": "session-abc-123",
  "continuable": true
}
=== END_RESULT ===`;

  const mockGeminiOutput = `=== CONSULT_RESULT ===
{
  "tool": "gemini",
  "model": "gemini-3-pro",
  "effort": "medium",
  "duration_ms": 23400,
  "response": "Based on my analysis, the approach seems sound but could benefit from error handling for edge cases.",
  "session_id": "session-xyz-789",
  "continuable": true
}
=== END_RESULT ===`;

  const mockCodexOutput = `=== CONSULT_RESULT ===
{
  "tool": "codex",
  "model": "gpt-5.3-codex",
  "effort": "high",
  "duration_ms": 45600,
  "response": "I've analyzed the code. The refactoring would improve the code structure significantly.",
  "session_id": null,
  "continuable": false
}
=== END_RESULT ===`;

  describe('Claude Mock', () => {
    it('should parse structured output correctly', () => {
      const result = parseMockOutput(mockClaudeOutput, 'claude');
      expect(result.tool).toBe('claude');
      expect(result.model).toBe('opus');
      expect(result.response).toContain('optimize');
      expect(result.session_id).toBe('session-abc-123');
      expect(result.duration_ms).toBe(52300);
    });
  });

  describe('Gemini Mock', () => {
    it('should parse structured output correctly', () => {
      const result = parseMockOutput(mockGeminiOutput, 'gemini');
      expect(result.tool).toBe('gemini');
      expect(result.model).toBe('gemini-3-pro');
      expect(result.duration_ms).toBe(23400);
      expect(result.session_id).toBe('session-xyz-789');
    });
  });

  describe('Codex Mock', () => {
    it('should parse structured output correctly', () => {
      const result = parseMockOutput(mockCodexOutput, 'codex');
      expect(result.tool).toBe('codex');
      expect(result.model).toBe('gpt-5.3-codex');
      expect(result.response).toContain('refactoring');
    });
  });
});
```

## Test Execution Strategy

### Test Categories by Priority

#### Priority 1: Critical (Must Pass)
- Argument validation (all valid/invalid inputs)
- Tool allow-list validation
- Effort level validation
- Path validation (security)
- Model mapping (all efforts)
- Timeout enforcement
- Error messages

#### Priority 2: Important (Should Pass)
- Context packaging (git diff, file)
- Session save/load
- Session continuation
- Output parsing (all providers)
- Command building (all providers)
- Tool detection (cross-platform)

#### Priority 3: Nice to Have (Good to Have)
- Full consultation flow (with mocks)
- Interactive parameter selection
- Cross-platform tests
- Edge cases (empty inputs, malformed JSON)

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- consult-arguments.test.js

# Run with coverage
npm run test:coverage

# Run with watch mode
npm run test:watch
```

## Mock Strategy

### Critical Decisions

1. **Never test with real tools** - Mock all external tool executions
2. **Use realistic mock outputs** - Match provider response formats
3. **Mock file system** - Use Jest mocks for fs operations
4. **Mock Bash execution** - Control timing and return values
5. **Mock Read tool** - Return predefined content

### Mock Hierarchy

1. **Unit Level**: Pure functions (no I/O)
   - Argument parsing
   - Model mapping
   - Path validation
   - Session validation

2. **Integration Level**: Component interactions
   - Context packaging (mock Bash git diff)
   - Session management (mock fs operations)

3. **End-to-End Level**: Full workflow
   - Full consultation flow (mock all tools)
   - Error scenarios (mock failures)

## Coverage Goals

| Category | Coverage Target |
|----------|-----------------|
| Argument parsing | 100% |
| Model selection | 100% |
| Session management | 95% |
| Context packaging | 90% |
| Output parsing | 95% |
| Command building | 95% |
| Timeout handling | 90% |
| Tool detection | 85% |
| Cross-platform | 90% |

## Continuous Integration

### CI Test Matrix

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        platform: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18.x, 20.x]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm install
      - run: npm test
```

### Performance Tests

Add integration tests for timeout scenarios:
- Verify 120s timeout works correctly
- Test slow responses still complete within limits
- Verify cleanup of timed-out processes

## Common Test Patterns

### Argument Parsing Pattern
```javascript
describe('Argument Parsing', () => {
  it('should parse valid arguments', () => {
    const args = parseArguments(['question', '--tool=claude']);
    expect(args.question).toBe('question');
    expect(args.tool).toBe('claude');
  });

  it('should reject invalid tool', () => {
    expect(() => parseArguments(['question', '--tool=openai']))
      .toThrow('Invalid tool');
  });
});
```

### Mock Output Pattern
```javascript
it('should handle provider output', () => {
  jest.spyOn(Bash, 'run').mockResolvedValue({
    stdout: '=== CONSULT_RESULT ===\n{"response":"test"}\n=== END_RESULT ==='
  });

  const result = executeConsult('claude', 'question');
  expect(result.response).toBe('test');
});
```

### Session State Pattern
```javascript
describe('Session Management', () => {
  it('should save and load session', () => {
    const session = {
      tool: 'claude',
      model: 'opus',
      session_id: 'abc-123'
    };

    saveSession(session);
    const loaded = loadSession();

    expect(loaded.tool).toBe('claude');
    expect(loaded.model).toBe('opus');
    expect(loaded.session_id).toBe('abc-123');
  });
});
```

## Test Maintenance

### When Adding New Features

1. Add unit tests for new functions
2. Add integration tests for new workflows
3. Update coverage goals if needed
4. Document new test patterns

### When Changing External Tools

1. Update mock outputs to match new format
2. Update parser functions for new JSON structure
3. Update command builders for new flags
4. Update effort-to-model mappings if needed

### When Fixing Bugs

1. Add regression tests for the bug
2. Test edge cases around the fix
3. Verify all existing tests still pass
4. Update documentation if behavior changes

## Summary

The consult command test strategy prioritizes:

1. **Unit tests** for logic validation (fast, isolated)
2. **Integration tests** for component interactions (process mocks)
3. **E2E tests** for full workflows (complete user scenarios)
4. **Mock tests** for realistic provider outputs
5. **Cross-platform tests** for platform differences

All tests should:
- Use Jest for test framework
- Mock all external I/O operations
- Test both success and error paths
- Verify timeout enforcement
- Validate session state management
- Check cross-platform compatibility
- Maintain 85%+ overall coverage

This ensures the consult command is robust, maintainable, and reliable across platforms and tool versions.
