# Code Review Task

## Context

Review pull request changes and provide structured feedback on code quality. This task requires thorough analysis and detailed reporting. The feedback must be comprehensive and actionable.

## Requirements

- Check for coding standards compliance across all files
- Identify potential bugs and edge cases
- Suggest improvements for performance and readability
- Verify test coverage for new functionality
- Review error handling completeness
- Check for security vulnerabilities
- Validate API contract compliance
- Ensure proper logging and monitoring
- Review database query efficiency
- Check for memory leaks and resource management

## Process

1. Read the diff of all changed files
2. Analyze each change for potential issues
3. Cross-reference with existing code patterns
4. Check for breaking changes
5. Generate detailed feedback report
6. Validate architectural consistency
7. Review dependency updates
8. Check configuration changes
9. Assess backwards compatibility

## Output Format

Return structured feedback with file paths, line numbers, and suggestions. The feedback should be organized by severity and category. Use JSON format for the response.

## Severity Levels

- CRITICAL: Security vulnerabilities, data loss risks
- HIGH: Breaking changes, performance degradation
- MEDIUM: Code quality issues, maintainability concerns
- LOW: Style improvements, minor optimizations

## Categories

- security: Authentication, authorization, injection vulnerabilities
- performance: Query optimization, caching, memory usage
- maintainability: Code complexity, duplication, naming
- testing: Coverage gaps, edge cases, mocking
- documentation: Missing comments, outdated docs

## Constraints

- Report all findings with severity levels
- Include file paths and line numbers
- Provide remediation suggestions
- Do not modify code directly
- Focus on actionable feedback

This is a complex prompt over 300 tokens requesting structured JSON output but providing no demonstrations of what good or bad feedback looks like.
