# Code Review Task

## Context

Review pull request changes and provide structured feedback on code quality. This task requires thorough analysis and detailed reporting.

## Requirements

- Check for coding standards compliance across all files
- Identify potential bugs and edge cases
- Suggest improvements for performance and readability
- Verify test coverage for new functionality
- Review error handling completeness
- Check for security vulnerabilities
- Validate API contract compliance

## Process

1. Read the diff of all changed files
2. Analyze each change for potential issues
3. Cross-reference with existing code patterns
4. Check for breaking changes
5. Generate detailed feedback report

## Output Format

Return structured feedback with file paths, line numbers, and suggestions. The feedback should be organized by severity and category.

This is a complex prompt over 300 tokens requesting structured JSON output but providing no examples of what good or bad feedback looks like.

## Examples

<good-example>
Input: [example input]
Output: [example output]
</good-example>

<bad-example>
Input: [example input]
Output: [what NOT to do]
Why bad: [explanation]
</bad-example>
