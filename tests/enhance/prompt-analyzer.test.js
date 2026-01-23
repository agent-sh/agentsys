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
        CRITICAL: You MUST follow these rules.
        ALWAYS validate input.
        This is IMPORTANT and ESSENTIAL.
        NEVER skip this step.
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
