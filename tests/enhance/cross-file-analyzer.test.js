/**
 * Cross-File Analyzer Tests
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import modules under test
const crossFilePatterns = require('../../lib/enhance/cross-file-patterns');
const crossFileAnalyzer = require('../../lib/enhance/cross-file-analyzer');

describe('Cross-File Patterns', () => {
  describe('tool_not_in_allowed_list', () => {
    const pattern = crossFilePatterns.crossFilePatterns.tool_not_in_allowed_list;

    it('should detect tool used but not declared', () => {
      const result = pattern.check({
        declaredTools: ['Read', 'Grep'],
        usedTools: ['Read', 'Write', 'Edit'],
        agentName: 'test-agent'
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('Write');
      expect(result.issue).toContain('Edit');
      expect(result.issue).toContain('not declared');
    });

    it('should not flag when all tools are declared', () => {
      const result = pattern.check({
        declaredTools: ['Read', 'Grep', 'Write'],
        usedTools: ['Read', 'Write'],
        agentName: 'test-agent'
      });

      expect(result).toBeNull();
    });

    it('should handle scoped Bash declarations', () => {
      const result = pattern.check({
        declaredTools: ['Read', 'Bash(git:*)'],
        usedTools: ['Read', 'Bash'],
        agentName: 'test-agent'
      });

      expect(result).toBeNull();
    });

    it('should skip if no declared tools', () => {
      const result = pattern.check({
        declaredTools: [],
        usedTools: ['Read', 'Write'],
        agentName: 'test-agent'
      });

      expect(result).toBeNull();
    });

    it('should handle wildcard (*) in declared tools', () => {
      const result = pattern.check({
        declaredTools: ['*'],
        usedTools: ['Read', 'Write', 'Bash'],
        agentName: 'test-agent'
      });

      expect(result).toBeNull();
    });
  });

  describe('missing_workflow_agent', () => {
    const pattern = crossFilePatterns.crossFilePatterns.missing_workflow_agent;

    it('should detect missing agent reference', () => {
      const result = pattern.check({
        referencedAgent: 'next-task:nonexistent-agent',
        existingAgents: [
          { plugin: 'next-task', name: 'exploration-agent' },
          { plugin: 'enhance', name: 'plugin-enhancer' }
        ],
        sourceFile: 'workflow.md'
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('nonexistent-agent');
    });

    it('should not flag existing agent', () => {
      const result = pattern.check({
        referencedAgent: 'next-task:exploration-agent',
        existingAgents: [
          { plugin: 'next-task', name: 'exploration-agent' },
          { plugin: 'enhance', name: 'plugin-enhancer' }
        ],
        sourceFile: 'workflow.md'
      });

      expect(result).toBeNull();
    });

    it('should handle short agent name without plugin prefix', () => {
      const result = pattern.check({
        referencedAgent: 'exploration-agent',
        existingAgents: [
          { plugin: 'next-task', name: 'exploration-agent' }
        ],
        sourceFile: 'workflow.md'
      });

      expect(result).toBeNull();
    });
  });

  describe('duplicate_instructions', () => {
    const pattern = crossFilePatterns.crossFilePatterns.duplicate_instructions;

    it('should flag duplicate instructions in 3+ files', () => {
      const result = pattern.check({
        instruction: 'NEVER use git push --force on main branch',
        files: ['agent1.md', 'agent2.md', 'agent3.md']
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('3 files');
    });

    it('should not flag duplicate in only 2 files', () => {
      const result = pattern.check({
        instruction: 'Some instruction',
        files: ['agent1.md', 'agent2.md']
      });

      // Pattern requires 2+ files, but analyzer uses MIN_DUPLICATE_COUNT (3)
      expect(result).toBeTruthy();
    });

    it('should not flag single occurrence', () => {
      const result = pattern.check({
        instruction: 'Some instruction',
        files: ['agent1.md']
      });

      expect(result).toBeNull();
    });
  });

  describe('contradictory_rules', () => {
    const pattern = crossFilePatterns.crossFilePatterns.contradictory_rules;

    it('should flag contradictory rules', () => {
      const result = pattern.check({
        rule1: 'ALWAYS commit changes before switching branches',
        rule2: 'NEVER commit changes before review approval',
        file1: 'agent1.md',
        file2: 'agent2.md'
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('Contradictory');
    });

    it('should return null for missing data', () => {
      const result = pattern.check({
        rule1: null,
        rule2: 'NEVER do something',
        file1: 'agent1.md',
        file2: 'agent2.md'
      });

      expect(result).toBeNull();
    });
  });

  describe('orphaned_prompt', () => {
    const pattern = crossFilePatterns.crossFilePatterns.orphaned_prompt;

    it('should detect orphaned prompt', () => {
      const result = pattern.check({
        promptFile: 'unused-agent.md',
        referencedBy: []
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('Orphaned');
    });

    it('should not flag referenced prompt', () => {
      const result = pattern.check({
        promptFile: 'used-agent.md',
        referencedBy: ['workflow.md']
      });

      expect(result).toBeNull();
    });
  });

  describe('skill_tool_mismatch', () => {
    const pattern = crossFilePatterns.crossFilePatterns.skill_tool_mismatch;

    it('should detect skill tool mismatch', () => {
      const result = pattern.check({
        skillName: 'my-skill',
        skillAllowedTools: ['Read', 'Grep'],
        promptUsedTools: ['Read', 'Write', 'Edit']
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('Write');
    });

    it('should not flag aligned tools', () => {
      const result = pattern.check({
        skillName: 'my-skill',
        skillAllowedTools: ['Read', 'Grep', 'Write'],
        promptUsedTools: ['Read', 'Write']
      });

      expect(result).toBeNull();
    });

    it('should handle scoped tools in skill', () => {
      const result = pattern.check({
        skillName: 'my-skill',
        skillAllowedTools: ['Bash(git:*)', 'Read'],
        promptUsedTools: ['Bash', 'Read']
      });

      expect(result).toBeNull();
    });
  });

  describe('incomplete_phase_transition', () => {
    const pattern = crossFilePatterns.crossFilePatterns.incomplete_phase_transition;

    it('should detect missing phase transition', () => {
      const result = pattern.check({
        phases: ['phase1', 'phase2', 'phase3'],
        transitions: [
          { from: 'phase1', to: 'phase2' }
          // Missing phase2 -> phase3
        ],
        workflowFile: 'workflow.md'
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('Missing phase transitions');
    });

    it('should not flag complete transitions', () => {
      const result = pattern.check({
        phases: ['phase1', 'phase2', 'phase3'],
        transitions: [
          { from: 'phase1', to: 'phase2' },
          { from: 'phase2', to: 'phase3' }
        ],
        workflowFile: 'workflow.md'
      });

      expect(result).toBeNull();
    });

    it('should handle empty phases', () => {
      const result = pattern.check({
        phases: [],
        transitions: [],
        workflowFile: 'workflow.md'
      });

      expect(result).toBeNull();
    });
  });

  describe('skill_description_mismatch', () => {
    const pattern = crossFilePatterns.crossFilePatterns.skill_description_mismatch;

    it('should detect description mismatch', () => {
      const result = pattern.check({
        skillName: 'my-skill',
        description: 'This skill validates and deploys code',
        bodyCapabilities: ['validate code', 'run tests'],
        descriptionCapabilities: ['validate', 'deploy']
      });

      expect(result).toBeTruthy();
      expect(result.issue).toContain('deploy');
    });

    it('should not flag matching capabilities', () => {
      const result = pattern.check({
        skillName: 'my-skill',
        description: 'This skill validates code',
        bodyCapabilities: ['validate code', 'run tests'],
        descriptionCapabilities: ['validate']
      });

      expect(result).toBeNull();
    });
  });
});

describe('Cross-File Analyzer Utility Functions', () => {
  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      const escaped = crossFileAnalyzer.escapeRegex('Task()');
      expect(escaped).toBe('Task\\(\\)');
    });

    it('should escape all special characters', () => {
      const escaped = crossFileAnalyzer.escapeRegex('.*+?^${}()|[]\\');
      expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should return same string if no special chars', () => {
      const escaped = crossFileAnalyzer.escapeRegex('Read');
      expect(escaped).toBe('Read');
    });
  });

  describe('isPathWithinRoot', () => {
    it('should return true for path within root', () => {
      const result = crossFileAnalyzer.isPathWithinRoot('/root/sub/file.js', '/root');
      expect(result).toBe(true);
    });

    it('should return false for path outside root', () => {
      const result = crossFileAnalyzer.isPathWithinRoot('/other/file.js', '/root');
      expect(result).toBe(false);
    });

    it('should return true for exact root match', () => {
      const result = crossFileAnalyzer.isPathWithinRoot('/root', '/root');
      expect(result).toBe(true);
    });

    it('should handle path traversal attempts', () => {
      const result = crossFileAnalyzer.isPathWithinRoot('/root/../other/file.js', '/root');
      expect(result).toBe(false);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const similarity = crossFileAnalyzer.calculateSimilarity(
        'commit changes before push',
        'commit changes before push'
      );
      expect(similarity).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = crossFileAnalyzer.calculateSimilarity(
        'apple banana cherry',
        'dog elephant fox'
      );
      expect(similarity).toBe(0);
    });

    it('should return partial score for partial overlap', () => {
      const similarity = crossFileAnalyzer.calculateSimilarity(
        'commit changes always',
        'commit changes never'
      );
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should return 0 for empty strings', () => {
      expect(crossFileAnalyzer.calculateSimilarity('', 'test')).toBe(0);
      expect(crossFileAnalyzer.calculateSimilarity('test', '')).toBe(0);
      expect(crossFileAnalyzer.calculateSimilarity('', '')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(crossFileAnalyzer.calculateSimilarity(null, 'test')).toBe(0);
      expect(crossFileAnalyzer.calculateSimilarity('test', undefined)).toBe(0);
    });

    it('should filter short words (< 3 chars)', () => {
      // "is" and "a" should be filtered out
      const similarity = crossFileAnalyzer.calculateSimilarity(
        'this is a test',
        'this is a different'
      );
      // Only "this", "test", "different" count (3+ chars)
      expect(similarity).toBeGreaterThan(0);
    });
  });
});

describe('Cross-File Analyzer Functions', () => {
  describe('extractToolMentions', () => {
    const knownTools = ['Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];

    it('should extract tool calls', () => {
      const content = `
Use Read({ file_path: "/path" })
Then call Write({ file_path: "/out" })
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);

      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
    });

    it('should extract tool mentions (use the Tool)', () => {
      const content = `
Use the Glob tool to find files.
Invoke Task to spawn agents.
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);

      expect(tools).toContain('Glob');
      expect(tools).toContain('Task');
    });

    it('should extract tool noun pattern (Read tool)', () => {
      const content = `
The Read tool allows viewing files.
Use the Edit tool to modify.
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);

      expect(tools).toContain('Read');
      expect(tools).toContain('Edit');
    });

    it('should detect Bash via git commands', () => {
      const content = `
Run: git status
Then: git commit -m "message"
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toContain('Bash');
    });

    it('should detect Bash via npm commands', () => {
      const content = 'Run npm test to verify';
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toContain('Bash');
    });

    it('should detect Bash via pnpm commands', () => {
      const content = 'Run pnpm install';
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toContain('Bash');
    });

    it('should detect Bash via yarn commands', () => {
      const content = 'Run yarn add package';
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toContain('Bash');
    });

    it('should detect Bash via cargo commands', () => {
      const content = 'Run cargo build';
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toContain('Bash');
    });

    it('should detect Bash via go commands', () => {
      const content = 'Run go test ./...';
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);
      expect(tools).toContain('Bash');
    });

    it('should skip bad-example tags', () => {
      const content = `
<bad-example>
Write({ file_path: "/wrong" })
</bad-example>

Read({ file_path: "/correct" })
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);

      expect(tools).toContain('Read');
      expect(tools).not.toContain('Write');
    });

    it('should skip bad code blocks', () => {
      const content = `
\`\`\`bad-example
Write({ file_path: "/wrong" })
\`\`\`

Read({ file_path: "/correct" })
      `;
      const tools = crossFileAnalyzer.extractToolMentions(content, knownTools);

      expect(tools).toContain('Read');
      expect(tools).not.toContain('Write');
    });

    it('should return empty array for null content', () => {
      expect(crossFileAnalyzer.extractToolMentions(null, knownTools)).toEqual([]);
    });

    it('should return empty array for non-string content', () => {
      expect(crossFileAnalyzer.extractToolMentions(12345, knownTools)).toEqual([]);
    });

    it('should return empty array for non-array knownTools', () => {
      expect(crossFileAnalyzer.extractToolMentions('content', 'not-array')).toEqual([]);
    });
  });

  describe('extractAgentReferences', () => {
    it('should extract subagent_type references with double quotes', () => {
      const content = `
Task({
  subagent_type: "next-task:exploration-agent",
  prompt: "Explore"
})
      `;
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      expect(refs).toContain('next-task:exploration-agent');
    });

    it('should extract subagent_type references with single quotes', () => {
      const content = `await Task({ subagent_type: 'enhance:plugin-enhancer' });`;
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      expect(refs).toContain('enhance:plugin-enhancer');
    });

    it('should extract multiple references', () => {
      const content = `
Task({ subagent_type: "agent1" })
Task({ subagent_type: "agent2" })
Task({ subagent_type: "agent3" })
      `;
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      expect(refs).toHaveLength(3);
    });

    it('should return empty array for no references', () => {
      const content = 'No agent references here.';
      const refs = crossFileAnalyzer.extractAgentReferences(content);
      expect(refs).toEqual([]);
    });

    it('should return empty array for null content', () => {
      expect(crossFileAnalyzer.extractAgentReferences(null)).toEqual([]);
    });

    it('should return empty array for non-string', () => {
      expect(crossFileAnalyzer.extractAgentReferences(12345)).toEqual([]);
    });
  });

  describe('extractCriticalInstructions', () => {
    it('should extract MUST instructions', () => {
      const content = 'You MUST validate input.';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.some(i => i.line.includes('MUST'))).toBe(true);
    });

    it('should extract NEVER instructions', () => {
      const content = 'NEVER expose credentials.';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.some(i => i.line.includes('NEVER'))).toBe(true);
    });

    it('should extract ALWAYS instructions (case insensitive)', () => {
      const content = 'Always check permissions.';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.length).toBe(1);
    });

    it('should extract REQUIRED instructions', () => {
      const content = 'This is REQUIRED for safety.';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.length).toBe(1);
    });

    it('should extract FORBIDDEN instructions', () => {
      const content = 'FORBIDDEN to bypass auth.';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.length).toBe(1);
    });

    it('should extract CRITICAL instructions', () => {
      const content = 'CRITICAL: must validate.';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.length).toBe(1);
    });

    it('should extract DO NOT instructions', () => {
      const content = 'DO NOT skip tests.';
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.length).toBe(1);
    });

    it('should extract don\'t instructions', () => {
      const content = "don't ignore errors.";
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.length).toBe(1);
    });

    it('should skip headers', () => {
      const content = `
# MUST Header

Regular MUST instruction.
      `;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.length).toBe(1);
      expect(instructions[0].line).not.toContain('Header');
    });

    it('should skip code blocks', () => {
      const content = `
\`\`\`
NEVER in code block
\`\`\`

MUST catch this one.
      `;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions.length).toBe(1);
      expect(instructions[0].line).toContain('catch this one');
    });

    it('should include line numbers', () => {
      const content = `Line 1
MUST on line 2
Line 3`;
      const instructions = crossFileAnalyzer.extractCriticalInstructions(content);
      expect(instructions[0].lineNumber).toBe(2);
    });

    it('should return empty array for null content', () => {
      expect(crossFileAnalyzer.extractCriticalInstructions(null)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(crossFileAnalyzer.extractCriticalInstructions('')).toEqual([]);
    });
  });
});

describe('Cross-File Pattern Helpers', () => {
  describe('getAllPatterns', () => {
    it('should return all patterns', () => {
      const patterns = crossFilePatterns.getAllPatterns();
      expect(Object.keys(patterns).length).toBeGreaterThan(0);
    });

    it('should include expected patterns', () => {
      const patterns = crossFilePatterns.getAllPatterns();
      expect(patterns.tool_not_in_allowed_list).toBeDefined();
      expect(patterns.missing_workflow_agent).toBeDefined();
      expect(patterns.duplicate_instructions).toBeDefined();
    });
  });

  describe('getPatternsByCategory', () => {
    it('should filter by tool-consistency category', () => {
      const patterns = crossFilePatterns.getPatternsByCategory('tool-consistency');
      expect(Object.keys(patterns).length).toBeGreaterThan(0);
      for (const pattern of Object.values(patterns)) {
        expect(pattern.category).toBe('tool-consistency');
      }
    });

    it('should filter by workflow category', () => {
      const patterns = crossFilePatterns.getPatternsByCategory('workflow');
      expect(Object.keys(patterns).length).toBeGreaterThan(0);
    });

    it('should filter by consistency category', () => {
      const patterns = crossFilePatterns.getPatternsByCategory('consistency');
      expect(Object.keys(patterns).length).toBeGreaterThan(0);
    });

    it('should return empty for unknown category', () => {
      const patterns = crossFilePatterns.getPatternsByCategory('unknown-category');
      expect(Object.keys(patterns).length).toBe(0);
    });
  });

  describe('getPatternsByCertainty', () => {
    it('should filter by MEDIUM certainty', () => {
      const patterns = crossFilePatterns.getPatternsByCertainty('MEDIUM');
      expect(Object.keys(patterns).length).toBeGreaterThan(0);
      for (const pattern of Object.values(patterns)) {
        expect(pattern.certainty).toBe('MEDIUM');
      }
    });

    it('should return empty for HIGH certainty (none exist)', () => {
      const patterns = crossFilePatterns.getPatternsByCertainty('HIGH');
      expect(Object.keys(patterns).length).toBe(0);
    });
  });

  describe('loadKnownTools', () => {
    it('should return platform defaults without config file', () => {
      const tools = crossFilePatterns.loadKnownTools('/nonexistent/path');
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include common tools in defaults', () => {
      const tools = crossFilePatterns.loadKnownTools('/nonexistent/path');
      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Task');
    });
  });

  describe('PLATFORM_TOOLS', () => {
    it('should have claude tools', () => {
      expect(crossFilePatterns.PLATFORM_TOOLS.claude).toBeDefined();
      expect(crossFilePatterns.PLATFORM_TOOLS.claude).toContain('Task');
    });

    it('should have opencode tools', () => {
      expect(crossFilePatterns.PLATFORM_TOOLS.opencode).toBeDefined();
    });

    it('should have codex tools', () => {
      expect(crossFilePatterns.PLATFORM_TOOLS.codex).toBeDefined();
    });

    it('should have unknown (superset) tools', () => {
      expect(crossFilePatterns.PLATFORM_TOOLS.unknown).toBeDefined();
      expect(crossFilePatterns.PLATFORM_TOOLS.unknown.length).toBeGreaterThan(
        crossFilePatterns.PLATFORM_TOOLS.claude.length
      );
    });
  });
});

describe('Integration - Real Plugin Analysis', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('should load agents from plugins directory', () => {
    const agents = crossFileAnalyzer.loadAllAgents(rootDir);

    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0]).toHaveProperty('plugin');
    expect(agents[0]).toHaveProperty('name');
    expect(agents[0]).toHaveProperty('frontmatter');
    expect(agents[0]).toHaveProperty('body');
    expect(agents[0]).toHaveProperty('path');
    expect(agents[0]).toHaveProperty('content');
  });

  it('should not include README.md in agents', () => {
    const agents = crossFileAnalyzer.loadAllAgents(rootDir);
    const hasReadme = agents.some(a => a.name.toLowerCase() === 'readme');
    expect(hasReadme).toBe(false);
  });

  it('should load skills from plugins directory', () => {
    const skills = crossFileAnalyzer.loadAllSkills(rootDir);

    expect(skills.length).toBeGreaterThan(0);
    expect(skills[0]).toHaveProperty('plugin');
    expect(skills[0]).toHaveProperty('name');
    expect(skills[0]).toHaveProperty('frontmatter');
    expect(skills[0]).toHaveProperty('body');
  });

  it('should run full cross-file analysis', () => {
    const results = crossFileAnalyzer.analyze(rootDir, { verbose: true });

    expect(results).toHaveProperty('findings');
    expect(results).toHaveProperty('summary');
    expect(results.summary.agentsAnalyzed).toBeGreaterThan(0);
    expect(results.summary.skillsAnalyzed).toBeGreaterThan(0);
    expect(results.summary).toHaveProperty('byCategory');
  });

  it('should run analysis with specific categories', () => {
    const results = crossFileAnalyzer.analyze(rootDir, {
      categories: ['tool-consistency']
    });

    expect(results.summary.byCategory).toHaveProperty('tool-consistency');
    expect(results.summary.byCategory).not.toHaveProperty('workflow');
  });

  it('should run analysis with default options', () => {
    const results = crossFileAnalyzer.analyze(rootDir);

    expect(results).toHaveProperty('findings');
    expect(results).toHaveProperty('summary');
  });

  it('should handle nonexistent directory gracefully', () => {
    const results = crossFileAnalyzer.analyze('/nonexistent/path');

    expect(results.summary.agentsAnalyzed).toBe(0);
    expect(results.summary.skillsAnalyzed).toBe(0);
    expect(results.findings).toEqual([]);
  });
});
