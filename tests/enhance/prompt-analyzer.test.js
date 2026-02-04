/**
 * Prompt Analyzer Tests
 */

const path = require('path');

// Import modules under test
const promptPatterns = require('../../lib/enhance/prompt-patterns');
const promptAnalyzer = require('../../lib/enhance/prompt-analyzer');
const reporter = require('../../lib/enhance/reporter');

describe('Prompt Patterns', () => {
  describe('vague_instructions', () => {
    const pattern = promptPatterns.promptPatterns.vague_instructions;

    it('should detect vague language', () => {
      const content = `
        You should usually follow the guidelines.
        Sometimes you might need to handle edge cases.
        Try to be helpful if possible.
        When appropriate, provide examples.
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('vague');
    });

    it('should not flag content with few vague terms', () => {
      const content = `
        Follow these specific rules:
        1. Always validate input
        2. Return structured errors
        3. Use consistent formatting
      `;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should return null for empty content', () => {
      expect(pattern.check('')).toBeNull();
      expect(pattern.check(null)).toBeNull();
    });
  });

  describe('negative_only_constraints', () => {
    const pattern = promptPatterns.promptPatterns.negative_only_constraints;

    it('should detect negative-only constraints', () => {
      // Pattern requires >= 5 negative constraints without alternatives
      const content = `
        Don't use vague language.
        Never skip validation.
        Avoid using hardcoded values.
        Do not output raw errors.
        Refrain from using globals.
        Never expose internal details.
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('negative');
    });

    it('should not flag when alternatives are provided', () => {
      const content = `
        Don't use vague language. Instead, use specific terms.
        Use structured errors rather than raw exceptions.
        Prefer constants over hardcoded values.
      `;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('missing_output_format', () => {
    const pattern = promptPatterns.promptPatterns.missing_output_format;

    it('should detect missing output format in substantial prompts', () => {
      // Create a prompt with >200 tokens but no output format
      // Pattern requires >200 tokens (~800 chars)
      const content = `
        You are an analyzer that processes code and identifies patterns and issues.

        ## Your Role

        Analyze the codebase for patterns and issues. Check for security vulnerabilities.
        Validate the structure and organization of the code. Generate findings based on your analysis.
        Examine each file carefully and note any inconsistencies. Consider edge cases and error handling.
        Look for potential performance bottlenecks and memory leaks. Review the overall architecture.

        ## Constraints

        - Focus on actionable items that developers can fix
        - Be thorough but concise in your analysis
        - Consider edge cases and boundary conditions
        - Document your reasoning for each finding
        - Prioritize findings by severity and impact
        - Include code references where applicable

        ## Additional Context

        This is a production codebase with multiple modules and complex dependencies.
        There are various file types including JavaScript, TypeScript, and Python files.
        The codebase follows a modular architecture with shared libraries and utilities.
        Testing is important and coverage should be maintained at high levels always.
        Documentation should be updated when code changes are made to maintain accuracy.
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('output format');
    });

    it('should not flag when output format section exists', () => {
      const content = `
        You are an analyzer.

        ## Output Format

        Respond with JSON containing findings.
      `.repeat(3); // Make it substantial

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should not flag short prompts', () => {
      const content = 'Analyze the code.';

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('aggressive_emphasis', () => {
    const pattern = promptPatterns.promptPatterns.aggressive_emphasis;

    it('should detect aggressive CAPS', () => {
      const content = `
        ABSOLUTELY critical: You MUST follow these rules.
        ALWAYS validate input.
        This is IMPORTANT and ESSENTIAL and EXTREMELY IMPORTANT.
        NEVER skip this step.
        This is TOTALLY REQUIRED and DEFINITELY NECESSARY.
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('aggressive');
    });

    it('should not flag acceptable acronyms', () => {
      const content = `
        Use the API to fetch JSON data.
        Send HTTP requests to the URL.
        Configure the CLI with the SDK.
      `;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should detect multiple exclamation marks', () => {
      const content = `
        This is important!!
        Don't forget!!
        Critical rule!!
        Warning!!
        Must follow!!
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
    });
  });

  describe('missing_xml_structure', () => {
    const pattern = promptPatterns.promptPatterns.missing_xml_structure;

    it('should detect missing XML in complex prompts', () => {
      // Create a complex prompt without XML (needs >800 tokens OR 6+ sections with code blocks)
      // Pattern checks: tokens > 800 || (sectionCount >= 6 && hasCodeBlocks)
      const content = `
        # Agent Name

        You are a code analysis agent that examines files and reports issues.

        ## Your Role

        You analyze code for issues and patterns. Your job is to examine each file carefully.

        ## Workflow

        1. Read all files in the target directory
        2. Analyze patterns and identify issues
        3. Generate a comprehensive report
        4. Summarize findings for the team

        ## Constraints

        - Be thorough in your analysis
        - Be concise in your reporting
        - Follow coding standards
        - Document all findings

        ## Examples

        Example 1:
        \`\`\`javascript
        const foo = 'bar';
        const baz = 'qux';
        function analyze(code) {
          return code.split('\\n');
        }
        \`\`\`

        ## Output Format

        Generate a markdown report with all findings organized by severity and category.

        ## Additional Notes

        Consider edge cases and boundary conditions.
        Review error handling thoroughly.
        Check for security vulnerabilities.
      `.repeat(3); // Make it >800 tokens

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('XML');
    });

    it('should not flag prompts with XML tags', () => {
      const content = `
        <role>
        You are an analyzer.
        </role>

        <constraints>
        Follow these rules.
        </constraints>
      `.repeat(3);

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('missing_examples', () => {
    const pattern = promptPatterns.promptPatterns.missing_examples;

    it('should detect missing examples in complex prompts', () => {
      // Pattern requires >300 tokens AND format keywords
      const content = `
        You are an analyzer that produces JSON output with structured findings.

        ## Your Role

        Analyze the codebase and return findings in a structured format.
        Review all files carefully and identify issues. Document patterns.
        Check for security vulnerabilities and performance problems.
        Validate coding standards and best practices compliance.

        ## Output Format

        Return JSON with the following structured response format.
        Include all findings organized by category and severity level.
        Each finding should have a clear description and location.

        ## Constraints

        - Be thorough in your analysis work
        - Be concise in your reporting style
        - Follow the format exactly as specified
        - Include actionable recommendations
        - Prioritize high-impact findings first
        - Reference specific code locations always
      `.repeat(2);

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('example');
    });

    it('should not flag prompts with examples', () => {
      const content = `
        You are an analyzer.

        ## Example

        Input: foo
        Output: bar

        For example, when given code...
      `.repeat(3);

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('redundant_cot', () => {
    const pattern = promptPatterns.promptPatterns.redundant_cot;

    it('should detect redundant step-by-step instructions', () => {
      const content = `
        Think step by step about this problem.
        Use a step-by-step approach to analyze.
        Let's think through this carefully.
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('step-by-step');
    });

    it('should not flag single mention', () => {
      const content = `
        Analyze the code systematically.
        Think through each component.
      `;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('suboptimal_example_count', () => {
    const pattern = promptPatterns.promptPatterns.suboptimal_example_count;

    it('should detect single example', () => {
      const content = `
        ## Example

        This is one example.
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('1 example');
    });

    it('should detect too many examples', () => {
      const content = `
        <example>1</example>
        <example>2</example>
        <example>3</example>
        <example>4</example>
        <example>5</example>
        <example>6</example>
        <example>7</example>
        <example>8</example>
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('8 examples');
    });

    it('should not flag optimal range (2-5)', () => {
      const content = `
        <example>1</example>
        <example>2</example>
        <example>3</example>
      `;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('json_without_schema', () => {
    const pattern = promptPatterns.promptPatterns.json_without_schema;

    it('should detect JSON request without schema', () => {
      const content = `
        Respond with JSON containing the analysis results.
        The JSON object should have relevant fields.
      `;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('JSON');
    });

    it('should not flag when JSON example is provided', () => {
      const content = `
        Respond with JSON containing the analysis results.

        \`\`\`json
        {
          "status": "success",
          "findings": []
        }
        \`\`\`
      `;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('prompt_bloat', () => {
    const pattern = promptPatterns.promptPatterns.prompt_bloat;

    it('should detect prompt bloat', () => {
      // Create a very long prompt (>2500 tokens = ~10000 chars)
      const content = 'x'.repeat(11000);

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('tokens');
    });

    it('should not flag reasonable prompts', () => {
      const content = 'This is a reasonable prompt.'.repeat(50);

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });
});

describe('Prompt Analyzer', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test string';
      const tokens = promptAnalyzer.estimateTokens(text);

      // ~21 chars / 4 = ~6 tokens
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should return 0 for empty content', () => {
      expect(promptAnalyzer.estimateTokens('')).toBe(0);
      expect(promptAnalyzer.estimateTokens(null)).toBe(0);
    });
  });

  describe('detectPromptType', () => {
    it('should detect agent type from path', () => {
      const type = promptAnalyzer.detectPromptType('/plugins/enhance/agents/my-agent.md', '');
      expect(type).toBe('agent');
    });

    it('should detect command type from path', () => {
      const type = promptAnalyzer.detectPromptType('/plugins/enhance/commands/enhance.md', '');
      expect(type).toBe('command');
    });

    it('should detect skill type from path', () => {
      const type = promptAnalyzer.detectPromptType('/skills/my-skill/SKILL.md', '');
      expect(type).toBe('skill');
    });

    it('should detect agent from content frontmatter', () => {
      const content = '---\nname: my-agent\ntools: Read\n---\n# Agent';
      const type = promptAnalyzer.detectPromptType('/some/path.md', content);
      expect(type).toBe('agent');
    });

    it('should return markdown for unknown', () => {
      const type = promptAnalyzer.detectPromptType('/docs/readme.md', '');
      expect(type).toBe('markdown');
    });
  });

  describe('fixAggressiveEmphasis', () => {
    it('should fix aggressive CAPS', () => {
      const content = 'This is CRITICAL and IMPORTANT.';
      const fixed = promptAnalyzer.fixAggressiveEmphasis(content);

      expect(fixed).toBe('This is critical and important.');
    });

    it('should fix multiple exclamation marks', () => {
      const content = 'Warning!! Important!!';
      const fixed = promptAnalyzer.fixAggressiveEmphasis(content);

      // The fix reduces !! to ! but only lowercases specific CAPS words (Warning/Important aren't in the replacement list)
      expect(fixed).toBe('Warning! Important!');
    });

    it('should handle null content', () => {
      expect(promptAnalyzer.fixAggressiveEmphasis(null)).toBeNull();
    });
  });
});

describe('Reporter - Prompt Reports', () => {
  describe('generatePromptReport', () => {
    it('should generate markdown report for single prompt', () => {
      const results = {
        promptName: 'test-prompt',
        promptPath: '/path/to/test-prompt.md',
        promptType: 'agent',
        tokenCount: 500,
        clarityIssues: [
          { issue: 'Vague language detected', fix: 'Use specific terms', certainty: 'HIGH' }
        ],
        structureIssues: [],
        exampleIssues: [],
        contextIssues: [],
        outputIssues: [],
        antiPatternIssues: []
      };

      const report = reporter.generatePromptReport(results);

      expect(report).toContain('test-prompt');
      expect(report).toContain('agent');
      expect(report).toContain('500');
      expect(report).toContain('Vague language');
      expect(report).toContain('HIGH');
    });

    it('should show no issues message when clean', () => {
      const results = {
        promptName: 'clean-prompt',
        promptPath: '/path/to/clean.md',
        promptType: 'prompt',
        tokenCount: 100,
        clarityIssues: [],
        structureIssues: [],
        exampleIssues: [],
        contextIssues: [],
        outputIssues: [],
        antiPatternIssues: []
      };

      const report = reporter.generatePromptReport(results);

      expect(report).toContain('No issues found');
    });
  });

  describe('generatePromptSummaryReport', () => {
    it('should generate summary for multiple prompts', () => {
      const allResults = [
        {
          promptName: 'prompt-1',
          promptPath: '/path/1.md',
          promptType: 'agent',
          tokenCount: 300,
          clarityIssues: [{ certainty: 'HIGH' }],
          structureIssues: [],
          exampleIssues: [],
          contextIssues: [],
          outputIssues: [],
          antiPatternIssues: []
        },
        {
          promptName: 'prompt-2',
          promptPath: '/path/2.md',
          promptType: 'command',
          tokenCount: 200,
          clarityIssues: [],
          structureIssues: [{ certainty: 'MEDIUM' }],
          exampleIssues: [],
          contextIssues: [],
          outputIssues: [],
          antiPatternIssues: []
        }
      ];

      const report = reporter.generatePromptSummaryReport(allResults);

      expect(report).toContain('Prompt Analysis Summary');
      expect(report).toContain('2 prompts');
      expect(report).toContain('500'); // Total tokens
      expect(report).toContain('prompt-1');
      expect(report).toContain('prompt-2');
    });
  });
});

describe('Analyzer Integration Tests', () => {
  const fs = require('fs');
  const os = require('os');

  let tempDir;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-analyzer-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('analyzePrompt', () => {
    it('should analyze a single prompt file', () => {
      const promptPath = path.join(tempDir, 'test-prompt.md');
      fs.writeFileSync(promptPath, `
# Test Prompt

You are a helpful assistant.

## Your Role

Help users with their questions.
      `);

      const result = promptAnalyzer.analyzePrompt(promptPath);

      expect(result.promptName).toBe('test-prompt');
      expect(result.promptPath).toBe(promptPath);
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.clarityIssues).toBeDefined();
      expect(result.structureIssues).toBeDefined();
    });

    it('should handle non-existent file', () => {
      const result = promptAnalyzer.analyzePrompt('/nonexistent/path.md');

      expect(result.structureIssues).toHaveLength(1);
      expect(result.structureIssues[0].issue).toContain('File not found');
    });

    it('should detect vague instructions in prompt file', () => {
      const promptPath = path.join(tempDir, 'vague-prompt.md');
      fs.writeFileSync(promptPath, `
You should usually follow the guidelines.
Sometimes you might need to handle edge cases.
Try to be helpful if possible.
When appropriate, provide examples.
As needed, add more context.
      `);

      const result = promptAnalyzer.analyzePrompt(promptPath);

      const vagueIssue = result.clarityIssues.find(i => i.patternId === 'vague_instructions');
      expect(vagueIssue).toBeDefined();
      expect(vagueIssue.certainty).toBe('HIGH');
    });
  });

  describe('analyzeAllPrompts', () => {
    it('should analyze all prompts in a directory', () => {
      // Create test files
      fs.writeFileSync(path.join(tempDir, 'prompt1.md'), '# Prompt 1\nHelp users.');
      fs.writeFileSync(path.join(tempDir, 'prompt2.md'), '# Prompt 2\nAssist with tasks.');

      const results = promptAnalyzer.analyzeAllPrompts(tempDir);

      expect(results).toHaveLength(2);
      expect(results[0].promptName).toBeDefined();
      expect(results[1].promptName).toBeDefined();
    });

    it('should return empty array for non-existent directory', () => {
      const results = promptAnalyzer.analyzeAllPrompts('/nonexistent/directory');

      expect(results).toEqual([]);
    });

    it('should return empty array for invalid path input', () => {
      expect(promptAnalyzer.analyzeAllPrompts(null)).toEqual([]);
      expect(promptAnalyzer.analyzeAllPrompts('')).toEqual([]);
      expect(promptAnalyzer.analyzeAllPrompts(123)).toEqual([]);
    });

    it('should skip README files', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# README');
      fs.writeFileSync(path.join(tempDir, 'prompt.md'), '# Prompt');

      const results = promptAnalyzer.analyzeAllPrompts(tempDir);

      expect(results).toHaveLength(1);
      expect(results[0].promptName).toBe('prompt');
    });

    it('should analyze recursively by default', () => {
      const subDir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(tempDir, 'top.md'), '# Top');
      fs.writeFileSync(path.join(subDir, 'nested.md'), '# Nested');

      const results = promptAnalyzer.analyzeAllPrompts(tempDir);

      expect(results).toHaveLength(2);
    });

    it('should skip excluded directories', () => {
      const nodeModules = path.join(tempDir, 'node_modules');
      fs.mkdirSync(nodeModules);
      fs.writeFileSync(path.join(nodeModules, 'dep.md'), '# Dependency');
      fs.writeFileSync(path.join(tempDir, 'main.md'), '# Main');

      const results = promptAnalyzer.analyzeAllPrompts(tempDir);

      expect(results).toHaveLength(1);
      expect(results[0].promptName).toBe('main');
    });
  });

  describe('analyze', () => {
    it('should analyze single file when prompt option provided', () => {
      const promptPath = path.join(tempDir, 'single.md');
      fs.writeFileSync(promptPath, '# Single Prompt');

      const result = promptAnalyzer.analyze({ prompt: promptPath });

      expect(result.promptName).toBe('single');
    });

    it('should analyze directory when prompt option is a directory', () => {
      fs.writeFileSync(path.join(tempDir, 'a.md'), '# A');
      fs.writeFileSync(path.join(tempDir, 'b.md'), '# B');

      const results = promptAnalyzer.analyze({ prompt: tempDir });

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should analyze promptsDir when specified', () => {
      fs.writeFileSync(path.join(tempDir, 'c.md'), '# C');

      const results = promptAnalyzer.analyze({ promptsDir: tempDir });

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);
    });
  });

  describe('applyFixes', () => {
    it('should apply auto-fixes for aggressive emphasis', () => {
      const promptPath = path.join(tempDir, 'aggressive.md');
      fs.writeFileSync(promptPath, 'This is CRITICAL and IMPORTANT! Do NOT skip this!!');

      const results = promptAnalyzer.analyzePrompt(promptPath, { verbose: true });

      // Check if aggressive emphasis was detected
      const hasAggressiveIssue = results.clarityIssues.some(
        i => i.patternId === 'aggressive_emphasis'
      );

      if (hasAggressiveIssue) {
        const fixResults = promptAnalyzer.applyFixes(results, { dryRun: false, backup: false });

        expect(fixResults.applied.length).toBeGreaterThan(0);
        expect(fixResults.errors).toEqual([]);
      }
    });

    it('should handle dry run mode', () => {
      const promptPath = path.join(tempDir, 'dryrun.md');
      const originalContent = 'This is CRITICAL!';
      fs.writeFileSync(promptPath, originalContent);

      const results = promptAnalyzer.analyzePrompt(promptPath);
      promptAnalyzer.applyFixes(results, { dryRun: true });

      // File should be unchanged
      const content = fs.readFileSync(promptPath, 'utf8');
      expect(content).toBe(originalContent);
    });

    it('should handle array of results', () => {
      fs.writeFileSync(path.join(tempDir, 'multi1.md'), '# Test 1');
      fs.writeFileSync(path.join(tempDir, 'multi2.md'), '# Test 2');

      const results = promptAnalyzer.analyzeAllPrompts(tempDir);
      const fixResults = promptAnalyzer.applyFixes(results);

      expect(fixResults.applied).toBeDefined();
      expect(fixResults.skipped).toBeDefined();
      expect(fixResults.errors).toBeDefined();
    });
  });

  describe('generateReport', () => {
    it('should generate report for single result', () => {
      const promptPath = path.join(tempDir, 'report-test.md');
      fs.writeFileSync(promptPath, '# Test Prompt');

      const results = promptAnalyzer.analyzePrompt(promptPath);
      const report = promptAnalyzer.generateReport(results);

      expect(report).toContain('Prompt Analysis');
      expect(report).toContain('report-test');
    });

    it('should generate summary report for array of results', () => {
      fs.writeFileSync(path.join(tempDir, 'r1.md'), '# R1');
      fs.writeFileSync(path.join(tempDir, 'r2.md'), '# R2');

      const results = promptAnalyzer.analyzeAllPrompts(tempDir);
      const report = promptAnalyzer.generateReport(results);

      expect(report).toContain('Prompt Analysis Summary');
      expect(report).toContain('2 prompts');
    });
  });
});

describe('extractCodeBlocks', () => {
  it('should extract code blocks with language tags', () => {
    const content = `
# Example

\`\`\`javascript
const x = 1;
\`\`\`

\`\`\`json
{"key": "value"}
\`\`\`
`;

    const blocks = promptAnalyzer.extractCodeBlocks(content);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe('javascript');
    expect(blocks[0].code).toBe('const x = 1;');
    expect(blocks[0].startLine).toBeGreaterThan(0);
    expect(blocks[0].endLine).toBeGreaterThan(blocks[0].startLine);

    expect(blocks[1].language).toBe('json');
    expect(blocks[1].code).toBe('{"key": "value"}');
    expect(blocks[1].endLine).toBeGreaterThan(blocks[1].startLine);
  });

  it('should handle code blocks without language tag', () => {
    const content = `
\`\`\`
some code here
\`\`\`
`;

    const blocks = promptAnalyzer.extractCodeBlocks(content);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('');
    expect(blocks[0].code).toBe('some code here');
  });

  it('should handle empty code blocks', () => {
    const content = `
\`\`\`javascript
\`\`\`
`;

    const blocks = promptAnalyzer.extractCodeBlocks(content);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('javascript');
    expect(blocks[0].code).toBe('');
  });

  it('should handle unclosed code blocks', () => {
    const content = `
\`\`\`javascript
const x = 1;
`;

    const blocks = promptAnalyzer.extractCodeBlocks(content);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('javascript');
    expect(blocks[0].code).toContain('const x = 1;');
  });

  it('should return empty array for null/undefined content', () => {
    expect(promptAnalyzer.extractCodeBlocks(null)).toEqual([]);
    expect(promptAnalyzer.extractCodeBlocks(undefined)).toEqual([]);
    expect(promptAnalyzer.extractCodeBlocks('')).toEqual([]);
  });

  it('should handle multi-line code blocks', () => {
    const content = `
\`\`\`python
def hello():
    print("world")
    return True
\`\`\`
`;

    const blocks = promptAnalyzer.extractCodeBlocks(content);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('python');
    expect(blocks[0].code).toContain('def hello():');
    expect(blocks[0].code).toContain('print("world")');
  });
});

describe('Code Validation Patterns', () => {
  describe('invalid_json_in_code_block', () => {
    const pattern = promptPatterns.promptPatterns.invalid_json_in_code_block;

    it('should detect invalid JSON syntax', () => {
      const content = `
\`\`\`json
{"key": "value",}
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('Invalid JSON');
    });

    it('should pass valid JSON', () => {
      const content = `
\`\`\`json
{"key": "value", "nested": {"a": 1}}
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should skip JSON in bad-example tags', () => {
      const content = `
<bad-example>
\`\`\`json
{"key": "value",}
\`\`\`
</bad-example>
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should skip JSON in bad_example tags (underscore variant)', () => {
      const content = `
<bad_example>
\`\`\`json
{invalid json here}
\`\`\`
</bad_example>
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should skip empty JSON blocks', () => {
      const content = `
\`\`\`json
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('invalid_js_syntax', () => {
    const pattern = promptPatterns.promptPatterns.invalid_js_syntax;

    it('should detect JavaScript syntax errors', () => {
      const content = `
\`\`\`javascript
const x = {
  key: "value"
  // missing comma
  other: 123
}
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('syntax error');
    });

    it('should pass valid JavaScript', () => {
      const content = `
\`\`\`javascript
const x = {
  key: "value",
  other: 123
};
function foo() {
  return x.key;
}
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should skip JS in bad-example tags', () => {
      const content = `
<bad-example>
\`\`\`javascript
const x = {bad syntax
\`\`\`
</bad-example>
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should skip code with import/export statements', () => {
      // Function constructor doesn't support ES modules syntax
      const content = `
\`\`\`javascript
import { foo } from 'bar';
export const x = 1;
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should handle js language tag (short form)', () => {
      const content = `
\`\`\`js
const x = 1;
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });

  describe('code_language_mismatch', () => {
    const pattern = promptPatterns.promptPatterns.code_language_mismatch;

    it('should detect JSON tagged as JavaScript', () => {
      const content = `
\`\`\`javascript
{
  "name": "test",
  "version": "1.0.0"
}
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('JavaScript but appears to be JSON');
    });

    it('should detect JavaScript tagged as JSON', () => {
      const content = `
\`\`\`json
const config = {
  name: "test"
};
function setup() {}
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('JSON but appears to be JavaScript');
    });

    it('should not flag correctly tagged code', () => {
      const content = `
\`\`\`json
{"key": "value"}
\`\`\`

\`\`\`javascript
const x = 1;
function foo() {}
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should skip blocks without language tag', () => {
      const content = `
\`\`\`
{"key": "value"}
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should skip blocks in bad-example tags', () => {
      const content = `
<bad-example>
\`\`\`json
const x = wrongTag;
\`\`\`
</bad-example>
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should detect Python tagged as JavaScript', () => {
      const content = `
\`\`\`javascript
def hello():
    print("world")
\`\`\`
`;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('JavaScript but appears to be Python');
    });
  });

  describe('heading_hierarchy_gaps', () => {
    const pattern = promptPatterns.promptPatterns.heading_hierarchy_gaps;

    it('should detect skipped heading levels', () => {
      const content = `
# Main Title

### Skipped H2

Some content here.
`;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('H1 to H3');
      expect(result.issue).toContain('skipped H2');
    });

    it('should pass valid heading hierarchy', () => {
      const content = `
# Main Title

## Section 1

### Subsection 1.1

## Section 2

### Subsection 2.1
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should allow going from deeper to shallower levels', () => {
      const content = `
# Title

## Section

### Subsection

# New Top Level
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should not flag single heading', () => {
      const content = `
# Only One Heading

Some content.
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });

    it('should detect H2 to H4 gap', () => {
      const content = `
# Title

## Section

#### Deep Section
`;

      const result = pattern.check(content);

      expect(result).toBeTruthy();
      expect(result.issue).toContain('H2 to H4');
    });

    it('should ignore headings inside code blocks', () => {
      const content = `
# Title

## Section

\`\`\`markdown
# Fake H1 in code block

### Fake H3 that would cause gap if not excluded
\`\`\`

### Real H3 (valid since we have H2)
`;

      const result = pattern.check(content);

      expect(result).toBeNull();
    });
  });
});

describe('Code Validation Integration', () => {
  const fs = require('fs');
  const os = require('os');

  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-validation-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect invalid JSON in prompt file', () => {
    const promptPath = path.join(tempDir, 'test-prompt.md');
    fs.writeFileSync(promptPath, `
# Test Prompt

Example JSON:

\`\`\`json
{"key": "value",}
\`\`\`
`);

    const result = promptAnalyzer.analyzePrompt(promptPath);

    expect(result.codeValidationIssues).toBeDefined();
    const jsonIssue = result.codeValidationIssues.find(
      i => i.patternId === 'invalid_json_in_code_block'
    );
    expect(jsonIssue).toBeDefined();
    expect(jsonIssue.certainty).toBe('HIGH');
  });

  it('should include codeValidationIssues in report', () => {
    const promptPath = path.join(tempDir, 'validation-test.md');
    fs.writeFileSync(promptPath, `
# Test

\`\`\`json
{invalid}
\`\`\`
`);

    const result = promptAnalyzer.analyzePrompt(promptPath);
    const report = promptAnalyzer.generateReport(result);

    expect(report).toContain('Code Validation Issues');
  });

  it('should detect multiple code validation issues in one file', () => {
    const promptPath = path.join(tempDir, 'multi-issues.md');
    fs.writeFileSync(promptPath, `
# Test

Invalid JSON:
\`\`\`json
{"key": "value",}
\`\`\`

Invalid JS:
\`\`\`javascript
const x = {bad syntax
\`\`\`

Mismatched tag:
\`\`\`json
const y = require('module');
\`\`\`
`);

    const result = promptAnalyzer.analyzePrompt(promptPath);

    expect(result.codeValidationIssues).toBeDefined();
    expect(result.codeValidationIssues.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Pattern Helper Functions', () => {
  describe('getAllPatterns', () => {
    it('should return all patterns', () => {
      const patterns = promptPatterns.getAllPatterns();

      expect(Object.keys(patterns).length).toBeGreaterThan(10);
      expect(patterns.vague_instructions).toBeDefined();
      expect(patterns.missing_examples).toBeDefined();
    });
  });

  describe('getPatternsByCertainty', () => {
    it('should filter by HIGH certainty', () => {
      const high = promptPatterns.getPatternsByCertainty('HIGH');

      expect(Object.keys(high).length).toBeGreaterThan(0);
      for (const pattern of Object.values(high)) {
        expect(pattern.certainty).toBe('HIGH');
      }
    });

    it('should filter by MEDIUM certainty', () => {
      const medium = promptPatterns.getPatternsByCertainty('MEDIUM');

      expect(Object.keys(medium).length).toBeGreaterThan(0);
      for (const pattern of Object.values(medium)) {
        expect(pattern.certainty).toBe('MEDIUM');
      }
    });
  });

  describe('getPatternsByCategory', () => {
    it('should filter by clarity category', () => {
      const clarity = promptPatterns.getPatternsByCategory('clarity');

      expect(Object.keys(clarity).length).toBeGreaterThan(0);
      for (const pattern of Object.values(clarity)) {
        expect(pattern.category).toBe('clarity');
      }
    });

    it('should filter by examples category', () => {
      const examples = promptPatterns.getPatternsByCategory('examples');

      expect(Object.keys(examples).length).toBeGreaterThan(0);
      for (const pattern of Object.values(examples)) {
        expect(pattern.category).toBe('examples');
      }
    });
  });

  describe('getAutoFixablePatterns', () => {
    it('should return only auto-fixable patterns', () => {
      const fixable = promptPatterns.getAutoFixablePatterns();

      expect(Object.keys(fixable).length).toBeGreaterThan(0);
      for (const pattern of Object.values(fixable)) {
        expect(pattern.autoFix).toBe(true);
      }
    });
  });
});
