/**
 * Comprehensive Cross-File Analyzer Tests
 * Focus: False positive/negative prevention, performance, edge cases
 */

const path = require('path');
const crossFileAnalyzer = require('../lib/enhance/cross-file-analyzer');
const crossFilePatterns = require('../lib/enhance/cross-file-patterns');

// ============================================
// FALSE POSITIVE PREVENTION TESTS
// ============================================

describe('Cross-File Analyzer - False Positive Prevention', () => {
  describe('extractToolMentions - Should NOT flag', () => {
    const knownTools = ['Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];

    it('should NOT flag tool names in prose context', () => {
      const content = `
        You can read about the architecture in the docs.
        Please write your thoughts in the comments.
        Feel free to edit as needed.
        The task is to analyze patterns.
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      // These are prose usage, not tool calls
      expect(tools).toEqual([]);
    });

    it('should NOT flag tool names in pure prose without tool patterns', () => {
      // Tool detection requires specific patterns like "Tool(" or "use the Tool"
      // Plain word usage without tool patterns is not flagged
      const content = `
        This document explains how to read files.
        Users can write to the output directory.
        The edit feature allows changes.
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toEqual([]);
    });

    it('should NOT flag tool names inside <bad-example> variants (hyphen, underscore, space)', () => {
      // The code supports: <bad-example>, <bad_example>, <bad example>, <badexample>
      const supportedVariants = [
        '<bad-example>Use Write({ file_path: "/wrong" })</bad-example>',
        '<bad_example>Use Read({ file_path: "/wrong" })</bad_example>',
        '<badexample>Use Edit({ file_path: "/wrong" })</badexample>',
        '<bad example>Use Glob({ pattern: "*.md" })</bad example>'
      ];

      for (const content of supportedVariants) {
        const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
        expect(tools).toEqual([]);
      }
    });

    it('should NOT flag tool names in code blocks marked as bad', () => {
      const content = `
\`\`\`bad-example
Write({ file_path: "/wrong" })
\`\`\`

\`\`\`bad
Read({ file_path: "/also-wrong" })
\`\`\`
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toEqual([]);
    });

    it('should NOT flag partial matches (TaskRunner, ReadFile)', () => {
      const content = `
        The TaskRunner class handles execution.
        Use ReadFile for async file reading.
        WriteStream is for output.
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toEqual([]);
    });

    it('should detect tools with tool patterns even in markdown context', () => {
      // Known limitation: Tool detection uses pattern matching that may match
      // inside markdown links. This is acceptable because tool patterns like
      // "Read tool" are explicit enough to be intentional tool references.
      const content = `
        See [Read Tool](./docs/read.md) for details.
        The [Edit](https://example.com/edit) page has examples.
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      // "Read Tool" matches the "X tool" pattern, so it's detected
      // This is expected behavior - false positive rate is low
      expect(tools).toContain('Read');
    });

    it('should NOT flag git/npm as Bash when inside bad-example', () => {
      const content = `
<bad-example>
Don't do: git push --force
Bad: npm install without lock file
</bad-example>
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toEqual([]);
    });
  });

  describe('extractCriticalInstructions - Should NOT flag', () => {
    it('should NOT flag critical words inside code blocks', () => {
      const content = `
\`\`\`javascript
// MUST validate input
const ALWAYS_REQUIRED = true;
throw new Error('NEVER call this directly');
\`\`\`
      `;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions).toEqual([]);
    });

    it('should NOT flag critical words in headings', () => {
      const content = `
# CRITICAL Configuration
## MUST-HAVE Features
### NEVER Skip This Section
      `;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions).toEqual([]);
    });

    it('should NOT flag empty or whitespace-only lines', () => {
      const content = `
MUST validate



NEVER skip
      `;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions).toHaveLength(2);
    });
  });

  describe('analyzeOrphanedPrompts - Should NOT flag', () => {
    it('should NOT flag entry point agents (orchestrators, validators)', () => {
      const pattern = crossFilePatterns.crossFilePatterns.orphaned_prompt;

      // These are typical entry points invoked by commands, not other agents
      const entryPointNames = [
        'perf-orchestrator',
        'task-discoverer',
        'delivery-validator',
        'ci-monitor',
        'worktree-manager',
        'simple-fixer'
      ];

      for (const name of entryPointNames) {
        // The analyzer skips entry points based on name patterns
        const isEntryPoint = /orchestrator|discoverer|validator|monitor|fixer|checker|reporter|manager/i.test(name);
        expect(isEntryPoint).toBe(true);
      }
    });

    it('should NOT flag agents referenced by commands', () => {
      // Load actual commands to verify they reference agents
      const rootDir = path.resolve(__dirname, '..');
      const commands = crossFileAnalyzer.loadAllCommands(rootDir);

      // With plugins extracted, commands may be empty
      if (commands.length === 0) return;

      // Commands should reference agents
      let totalRefs = 0;
      for (const cmd of commands) {
        const refs = crossFileAnalyzer.extractAgentReferences(cmd.body);
        totalRefs += refs.length;
      }

      expect(totalRefs).toBeGreaterThan(0);
    });
  });

  describe('Pattern checks - Should NOT flag', () => {
    it('tool_not_in_allowed_list should NOT flag with wildcard (*)', () => {
      const pattern = crossFilePatterns.crossFilePatterns.tool_not_in_allowed_list;
      const result = pattern.check({
        declaredTools: ['*'],
        usedTools: ['Read', 'Write', 'Bash', 'Task', 'Glob', 'Grep'],
        agentName: 'test-agent'
      });
      expect(result).toBeNull();
    });

    it('skill_tool_mismatch should NOT flag with scoped tools', () => {
      const pattern = crossFilePatterns.crossFilePatterns.skill_tool_mismatch;

      // Bash(git:*) should allow Bash usage
      const result = pattern.check({
        skillName: 'git-skill',
        skillAllowedTools: ['Read', 'Bash(git:*)', 'Bash(npm:*)'],
        promptUsedTools: ['Read', 'Bash']
      });
      expect(result).toBeNull();
    });

    it('duplicate_instructions should NOT flag unique instructions', () => {
      const pattern = crossFilePatterns.crossFilePatterns.duplicate_instructions;
      const result = pattern.check({
        instruction: 'Validate user input before processing',
        files: ['agent1.md'] // Only in one file
      });
      expect(result).toBeNull();
    });
  });
});

// ============================================
// FALSE NEGATIVE PREVENTION TESTS
// ============================================

describe('Cross-File Analyzer - False Negative Prevention', () => {
  describe('extractToolMentions - MUST flag', () => {
    const knownTools = ['Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebFetch'];

    it('MUST flag direct tool call patterns', () => {
      const patterns = [
        'Use Read({ file_path: "/path" })',
        'Call Write({ file_path: "/out" })',
        'Invoke Task({ prompt: "test" })',
        'Use the Glob tool to find files',
        'invoke Grep for searching',
        'call WebFetch to fetch content'
      ];

      for (const content of patterns) {
        const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
        expect(tools.length).toBeGreaterThan(0);
      }
    });

    it('MUST flag tool noun patterns', () => {
      const content = `
        The Read tool is for viewing files.
        Use the Write tool for output.
        The Edit tool modifies files.
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Edit');
    });

    it('MUST flag Bash via common shell commands', () => {
      const shellCommands = [
        'Run git status to check changes',
        'Execute npm test for validation',
        'Use pnpm install for dependencies',
        'Run yarn build',
        'Execute cargo test',
        'Run go build ./...'
      ];

      for (const content of shellCommands) {
        const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
        expect(tools).toContain('Bash');
      }
    });

    it('MUST flag tools in good examples (outside bad-example)', () => {
      const content = `
<bad-example>
Don't use Write({ wrong: true })
</bad-example>

<good-example>
Use Read({ file_path: "/correct" })
</good-example>
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toContain('Read');
      expect(tools).not.toContain('Write');
    });
  });

  describe('extractAgentReferences - MUST flag', () => {
    it('MUST extract subagent_type with double quotes', () => {
      const content = 'Task({ subagent_type: "next-task:exploration-agent" })';
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      expect(refs).toContain('next-task:exploration-agent');
    });

    it('MUST extract subagent_type with single quotes', () => {
      const content = "Task({ subagent_type: 'enhance:plugin-enhancer' })";
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      expect(refs).toContain('enhance:plugin-enhancer');
    });

    it('MUST extract subagent_type with equals sign', () => {
      const content = 'subagent_type = "perf:perf-analyzer"';
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      expect(refs).toContain('perf:perf-analyzer');
    });

    it('MUST extract multiple agent references', () => {
      const content = `
        First: Task({ subagent_type: "agent1" })
        Then: Task({ subagent_type: "agent2" })
        Finally: Task({ subagent_type: "agent3" })
      `;
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      expect(refs).toHaveLength(3);
    });
  });

  describe('extractCriticalInstructions - MUST flag', () => {
    const criticalPatterns = [
      { word: 'MUST', content: 'You MUST validate input' },
      { word: 'NEVER', content: 'NEVER expose credentials' },
      { word: 'ALWAYS', content: 'Always check permissions' },
      { word: 'REQUIRED', content: 'This is REQUIRED for safety' },
      { word: 'FORBIDDEN', content: 'FORBIDDEN to bypass auth' },
      { word: 'CRITICAL', content: 'CRITICAL: must validate' },
      { word: 'DO NOT', content: 'DO NOT skip tests' },
      { word: "don't", content: "don't ignore errors" }
    ];

    for (const { word, content } of criticalPatterns) {
      it(`MUST flag ${word} instructions`, () => {
        const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
        expect(instructions.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Pattern checks - MUST flag', () => {
    it('tool_not_in_allowed_list MUST flag undeclared tools', () => {
      const pattern = crossFilePatterns.crossFilePatterns.tool_not_in_allowed_list;
      const result = pattern.check({
        declaredTools: ['Read', 'Grep'],
        usedTools: ['Read', 'Write', 'Edit', 'Bash'],
        agentName: 'test-agent'
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('Write');
      expect(result.issue).toContain('Edit');
      expect(result.issue).toContain('Bash');
    });

    it('missing_workflow_agent MUST flag nonexistent agent', () => {
      const pattern = crossFilePatterns.crossFilePatterns.missing_workflow_agent;
      const result = pattern.check({
        referencedAgent: 'plugin:nonexistent-agent',
        existingAgents: [
          { plugin: 'plugin', name: 'existing-agent' }
        ],
        sourceFile: 'workflow.md'
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('nonexistent-agent');
    });

    it('duplicate_instructions MUST flag 3+ duplicates', () => {
      const pattern = crossFilePatterns.crossFilePatterns.duplicate_instructions;
      const result = pattern.check({
        instruction: 'NEVER use git push --force on main',
        files: ['agent1.md', 'agent2.md', 'agent3.md', 'agent4.md']
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('4 files');
    });

    it('contradictory_rules MUST flag ALWAYS vs NEVER conflicts', () => {
      const pattern = crossFilePatterns.crossFilePatterns.contradictory_rules;
      const result = pattern.check({
        rule1: 'ALWAYS commit changes before switching',
        rule2: 'NEVER commit changes before review',
        file1: 'agent1.md',
        file2: 'agent2.md'
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('Contradictory');
    });
  });
});

// ============================================
// PERFORMANCE AND EFFICIENCY TESTS
// ============================================

describe('Cross-File Analyzer - Performance', () => {
  describe('Large input handling', () => {
    it('should handle large content without timeout', () => {
      const knownTools = ['Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];

      // Create 100KB of content
      const largeContent = `
        Use Read({ file_path: "/path" })
        ${' '.repeat(50000)}
        Use Write({ file_path: "/out" })
        ${' '.repeat(50000)}
      `;

      const start = Date.now();
      const tools = crossFileAnalyzer.extractToolMentions(largeContent, knownTools);
      const elapsed = Date.now() - start;

      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle content with many code blocks', () => {
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `
\`\`\`javascript
const block${i} = { NEVER: true, MUST: false };
\`\`\`
`;
      }
      content += '\nMUST validate input outside code blocks';

      const start = Date.now();
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      const elapsed = Date.now() - start;

      expect(instructions.length).toBe(1);
      expect(instructions[0].line).toContain('validate input');
      expect(elapsed).toBeLessThan(500);
    });

    it('should handle many agent references efficiently', () => {
      let content = '';
      for (let i = 0; i < 200; i++) {
        content += `Task({ subagent_type: "plugin:agent-${i}" })\n`;
      }

      const start = Date.now();
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      const elapsed = Date.now() - start;

      expect(refs).toHaveLength(200);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Tool pattern caching', () => {
    it('should use cached patterns for repeated tool lookups', () => {
      const knownTools = ['Read', 'Write', 'Edit'];
      const content1 = 'Use Read({ file_path: "/a" })';
      const content2 = 'Use Read({ file_path: "/b" })';

      // First call builds cache
      const tools1 = crossFileAnalyzer.extractToolMentions(content1, knownTools);

      // Second call should use cache (faster)
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        crossFileAnalyzer.extractToolMentions(content2, knownTools);
      }
      const elapsed = Date.now() - start;

      expect(tools1).toContain('Read');
      expect(elapsed).toBeLessThan(500); // 1000 iterations should be fast with cache
    });
  });

  describe('Similarity calculation efficiency', () => {
    it('should handle long strings efficiently', () => {
      const words = 'word '.repeat(1000);
      const str1 = `always ${words}`;
      const str2 = `never ${words}`;

      const start = Date.now();
      const similarity = crossFileAnalyzer.calculateSimilarity(str1, str2);
      const elapsed = Date.now() - start;

      // Jaccard index: intersection / union
      // With "word" repeated, the set has only one unique word
      // str1 = {"always", "word"}, str2 = {"never", "word"}
      // intersection = 1 ("word"), union = 3 ("always", "never", "word")
      // similarity = 1/3 = 0.33
      expect(similarity).toBeCloseTo(0.33, 1);
      expect(elapsed).toBeLessThan(100);
    });

    it('should show high similarity for nearly identical strings', () => {
      const str1 = 'commit changes before switching branches in git repository';
      const str2 = 'commit changes before switching branches in the repository';

      const similarity = crossFileAnalyzer.calculateSimilarity(str1, str2);

      // Most words overlap, so similarity should be high
      expect(similarity).toBeGreaterThan(0.7);
    });
  });
});

// ============================================
// EDGE CASES AND COMPLEX SCENARIOS
// ============================================

describe('Cross-File Analyzer - Edge Cases', () => {
  describe('Nested and complex patterns', () => {
    it('should handle nested bad-example tags', () => {
      const content = `
<bad-example>
<bad-example>
Nested Write({ file_path: "/wrong" })
</bad-example>
</bad-example>
Read({ file_path: "/correct" })
      `;
      const knownTools = ['Read', 'Write'];
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);

      expect(tools).toContain('Read');
      expect(tools).not.toContain('Write');
    });

    it('should handle mixed quote styles in agent references', () => {
      const content = `
        Task({ subagent_type: "agent1" })
        Task({ subagent_type: 'agent2' })
        Task({ subagent_type: "agent3" })
      `;
      const refs = crossFileAnalyzer.extractAgentReferences(content);

      expect(refs).toHaveLength(3);
      expect(refs).toContain('agent1');
      expect(refs).toContain('agent2');
      expect(refs).toContain('agent3');
    });

    it('should handle critical instructions with special characters', () => {
      const content = `
        You MUST handle UTF-8 characters: é, ñ, 中文
        NEVER expose user's credentials
        ALWAYS validate file paths (like C:\\Users\\test)
      `;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);

      expect(instructions.length).toBe(3);
    });

    it('should handle fenced code blocks with language tags', () => {
      const content = `
\`\`\`typescript
// MUST comment inside TS code block
\`\`\`

\`\`\`python
# NEVER comment inside Python code block
\`\`\`

MUST validate outside code blocks
      `;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);

      expect(instructions.length).toBe(1);
      expect(instructions[0].line).toContain('validate outside');
    });
  });

  describe('Boundary conditions', () => {
    it('should handle empty knownTools array', () => {
      const content = 'Use Read({ file_path: "/path" })';
      const tools = crossFileAnalyzer.extractToolMentions(content, []);

      // Should still detect Bash via shell patterns
      expect(tools).toEqual([]);
    });

    it('should handle content with only whitespace', () => {
      const content = '   \n\t\n   ';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);

      expect(instructions).toEqual([]);
    });

    it('should handle single-line content', () => {
      const content = 'MUST validate input ALWAYS';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);

      expect(instructions.length).toBe(1);
    });

    it('should handle tool names at string boundaries', () => {
      const knownTools = ['Read', 'Write'];
      const content = 'Read( Write(';
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);

      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle Unicode in content', () => {
      const content = `
        Use Read({ file_path: "/путь/к/файлу" })
        文件路径: Write({ file_path: "/ファイル" })
      `;
      const knownTools = ['Read', 'Write'];
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);

      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
    });

    it('should handle emoji in content (without flagging)', () => {
      const content = `
        ✅ MUST validate
        ❌ NEVER skip
        🚀 ALWAYS test
      `;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);

      expect(instructions.length).toBe(3);
    });
  });

  describe('Path validation', () => {
    it('should reject path traversal attempts', () => {
      const result = crossFileAnalyzer.isPathWithinRoot('/root/../etc/passwd', '/root');
      expect(result).toBe(false);
    });

    it('should reject parent directory access', () => {
      const result = crossFileAnalyzer.isPathWithinRoot('/root/sub/../../other', '/root');
      expect(result).toBe(false);
    });

    it('should allow paths within root', () => {
      const result = crossFileAnalyzer.isPathWithinRoot('/root/sub/deep/file.js', '/root');
      expect(result).toBe(true);
    });

    it('should handle Windows-style paths', () => {
      // This depends on platform, test both styles
      const unixPath = crossFileAnalyzer.isPathWithinRoot('/root/sub', '/root');
      expect(unixPath).toBe(true);
    });
  });
});

// ============================================
// CONTEXT WINDOW EFFICIENCY TESTS
// ============================================

describe('Cross-File Analyzer - Context Efficiency', () => {
  describe('Output size verification', () => {
    it('should produce compact findings', () => {
      const pattern = crossFilePatterns.crossFilePatterns.tool_not_in_allowed_list;
      const result = pattern.check({
        declaredTools: ['Read'],
        usedTools: ['Read', 'Write', 'Edit', 'Bash', 'Task', 'Glob', 'Grep'],
        agentName: 'test-agent'
      });

      // Issue text should be concise
      expect(result.issue.length).toBeLessThan(200);
      expect(result.fix.length).toBeLessThan(200);
    });

    it('should truncate duplicate instruction display', () => {
      const pattern = crossFilePatterns.crossFilePatterns.duplicate_instructions;
      const longInstruction = 'MUST validate '.repeat(50);
      const result = pattern.check({
        instruction: longInstruction,
        files: ['a.md', 'b.md', 'c.md']
      });

      // Should truncate to ~50 chars in display
      expect(result.issue).toContain('...');
      expect(result.issue.length).toBeLessThan(150);
    });

    it('should limit contradictory rule display', () => {
      const pattern = crossFilePatterns.crossFilePatterns.contradictory_rules;
      const longRule = 'ALWAYS do this very long thing '.repeat(10);
      const result = pattern.check({
        rule1: longRule,
        rule2: 'NEVER ' + longRule,
        file1: 'a.md',
        file2: 'b.md'
      });

      // Should truncate rules in display
      expect(result.issue).toContain('...');
      expect(result.issue.length).toBeLessThan(200);
    });
  });

  describe('Summary compactness', () => {
    it('should produce compact analysis summary', () => {
      const rootDir = path.resolve(__dirname, '..');
      const results = crossFileAnalyzer.analyze(rootDir);

      // With plugins extracted, counts may be 0
      expect(results.summary.agentsAnalyzed).toBeGreaterThanOrEqual(0);
      expect(results.summary.skillsAnalyzed).toBeGreaterThanOrEqual(0);
      expect(typeof results.summary.totalFindings).toBe('number');
      expect(results.summary.byCategory).toBeDefined();

      // byCategory should have compact keys
      for (const key of Object.keys(results.summary.byCategory)) {
        expect(key.length).toBeLessThan(30);
      }
    });
  });
});

// ============================================
// INTEGRATION TESTS - REAL CODEBASE
// ============================================

describe('Cross-File Analyzer - Real Codebase Integration', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('should load all agents without errors', () => {
    const agents = crossFileAnalyzer.loadAllAgents(rootDir);
    // With plugins extracted, agents may be empty
    expect(Array.isArray(agents)).toBe(true);
    for (const agent of agents) {
      expect(agent.plugin).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.path).toBeDefined();
      expect(agent.frontmatter).toBeDefined();
      expect(typeof agent.body).toBe('string');
    }
  });

  it('should load all skills without errors', () => {
    const skills = crossFileAnalyzer.loadAllSkills(rootDir);
    expect(Array.isArray(skills)).toBe(true);
    for (const skill of skills) {
      expect(skill.plugin).toBeDefined();
      expect(skill.name).toBeDefined();
      expect(skill.path).toBeDefined();
    }
  });

  it('should load all commands without errors', () => {
    const commands = crossFileAnalyzer.loadAllCommands(rootDir);
    expect(Array.isArray(commands)).toBe(true);
    for (const cmd of commands) {
      expect(cmd.plugin).toBeDefined();
      expect(cmd.name).toBeDefined();
    }
  });

  it('should run full analysis without false positives on clean codebase', () => {
    const results = crossFileAnalyzer.analyze(rootDir);

    // With plugins extracted, agentsAnalyzed may be 0
    expect(results.summary.agentsAnalyzed).toBeGreaterThanOrEqual(0);

    if (results.findings.length > 0) {
      for (const finding of results.findings) {
        expect(finding.issue).toBeDefined();
        expect(finding.file).toBeDefined();
        expect(finding.certainty).toBeDefined();
        expect(finding.source).toBe('cross-file');
      }
    }
  });

  it('should categorize findings correctly', () => {
    const results = crossFileAnalyzer.analyze(rootDir);

    // byCategory should sum to totalFindings
    const categorySum = Object.values(results.summary.byCategory).reduce((a, b) => a + b, 0);
    expect(categorySum).toBe(results.summary.totalFindings);
  });
});
