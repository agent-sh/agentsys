# Complex Prompt Requiring Structured Output But No Examples

## Task

Analyze the provided code and return a structured report following the format specification below.

## Context

You are a code quality analyzer. Your job is to find issues in code and report them in a specific format. This is a complex analysis task that requires thorough examination of the codebase.

## Requirements

- Parse the code structure completely
- Identify code smells and anti-patterns
- Calculate complexity metrics including cyclomatic complexity
- Find duplicate code blocks across all files
- Check naming conventions for consistency
- Verify error handling coverage
- Assess test coverage gaps
- Review documentation completeness

## Detailed Instructions

When analyzing code, you should:

1. Start by reading all files in the target directory
2. Build an abstract syntax tree for each file
3. Traverse the AST to identify issues
4. Cross-reference findings across files
5. Prioritize issues by severity
6. Generate actionable recommendations

## Output Format

Return a structured report with your findings. Include severity levels and recommendations. The report should have sections for issues, metrics, and summary with detailed breakdowns.

## Constraints

- Process files in alphabetical order
- Skip binary files and node_modules
- Limit analysis to 1000 files maximum
- Report at most 100 issues per category

This prompt is over 300 tokens and requests structured output but provides no examples of the expected format, which typically leads to inconsistent responses. It needs few-shot examples to demonstrate the pattern.
