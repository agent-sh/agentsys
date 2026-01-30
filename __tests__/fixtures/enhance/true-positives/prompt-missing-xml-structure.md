# Very Long Complex Prompt Without XML Structure

## Introduction

This is a complex prompt with many sections, code blocks, and instructions that would benefit from XML tags but doesn't have any.

## Context

The system handles multiple types of requests including authentication, authorization, data processing, and reporting. Each request type has different requirements and constraints.

## Authentication Flow

When a user authenticates:
1. Validate credentials
2. Generate token
3. Store session
4. Return response

## Authorization Rules

Users can have multiple roles:
- admin: full access
- editor: read/write
- viewer: read only

## Data Processing

Process incoming data according to these rules:
1. Validate input format
2. Transform to internal format
3. Apply business rules
4. Store in database

```javascript
function processData(input) {
  const validated = validate(input);
  const transformed = transform(validated);
  const result = applyRules(transformed);
  return store(result);
}
```

## Reporting Requirements

Generate reports with:
- Summary statistics
- Detailed breakdowns
- Trend analysis
- Recommendations

## Error Handling

Handle errors gracefully:
1. Log error details
2. Return appropriate status
3. Notify administrators if critical

## Performance Constraints

- Response time under 200ms
- Memory usage under 100MB
- Concurrent users: 1000+

## Security Requirements

- All inputs sanitized
- SQL injection prevention
- XSS protection
- CSRF tokens

This prompt is over 800 tokens with 6+ sections and code blocks but uses no XML tags for structure.
