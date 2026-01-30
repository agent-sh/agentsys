---
name: enhance-plugins
description: "Use when analyzing plugin structures, MCP tools, and plugin security patterns."
version: 1.0.0
argument-hint: "[path] [--fix]"
---

# enhance-plugins

Analyze plugin structures, MCP tools, and security patterns against best practices.

## Workflow

1. **Discover** - Find all plugins in `plugins/` directory
2. **Load** - Read `.claude-plugin/plugin.json` and agent files
3. **Analyze** - Run all pattern checks by certainty level
4. **Report** - Generate markdown output grouped by category
5. **Fix** - Apply auto-fixes if `--fix` flag present (HIGH certainty only)

## Detection Patterns

### HIGH Certainty (auto-fixable)

| Pattern | Description | Auto-Fix |
|---------|-------------|----------|
| missing_additional_properties | Schema allows extra fields | Add `"additionalProperties": false` |
| missing_required_fields | Parameters not marked required | Add to `required` array |
| version_mismatch | plugin.json vs package.json | Sync versions |
| missing_tool_description | Tool has no description | Manual fix required |
| unrestricted_bash | Agent has `Bash` without scope | Manual - flag for review |

### MEDIUM Certainty (verify context)

| Pattern | Description |
|---------|-------------|
| broad_permissions | Agent has wide tool access |
| deep_schema_nesting | Parameter schema >2 levels deep |
| long_description | Tool description >500 chars |
| missing_param_descriptions | Parameters lack descriptions |

### LOW Certainty (advisory)

| Pattern | Description |
|---------|-------------|
| tool_overexposure | >10 tools in single plugin |
| optimization_hints | Suggested simplifications |

## Auto-Fix Implementations

### 1. Missing additionalProperties

```javascript
// Add to schema object
schema.additionalProperties = false;
```

### 2. Missing required array

```javascript
// Add all properties to required
schema.required = Object.keys(schema.properties);
```

### 3. Version mismatch

```javascript
// Sync plugin.json version with package.json
pluginJson.version = packageJson.version;
```

## Output Format

```markdown
## Plugin Analysis: {plugin-name}

**Analyzed**: {timestamp}
**Files scanned**: {count}

### Summary
- HIGH: {count} issues
- MEDIUM: {count} issues
- LOW: {count} issues

### Tool Definitions ({n} issues)

| Tool | Issue | Fix | Certainty |
|------|-------|-----|-----------|
| {name} | {issue} | {fix} | {level} |

### Structure ({n} issues)

| File | Issue | Certainty |
|------|-------|-----------|
| {path} | {issue} | {level} |

### Security ({n} issues)

| File | Line | Issue | Certainty |
|------|------|-------|-----------|
| {path} | {line} | {issue} | {level} |
```

## Plugin Structure Validation

Check each plugin's `.claude-plugin/plugin.json`:

**Required fields**: name, version, description

**Version format**: Must match `/^\d+\.\d+\.\d+$/`

**Cross-reference**: Compare with package.json if exists

## Security Pattern Detection

Scan agent files for:

**HIGH Certainty**:
- Unrestricted `Bash` tool (no restrictions like `Bash(git:*)`)
- Command injection: `${...}` in shell commands without validation
- Path traversal: `../` in file operations

**MEDIUM Certainty**:
- Broad file access patterns
- Missing input validation

<examples>
### Example: Missing additionalProperties

<bad_example>
```json
{
  "type": "object",
  "properties": {
    "path": { "type": "string" }
  }
}
```
**Why it's bad**: Without `additionalProperties: false`, extra fields are silently accepted.
</bad_example>

<good_example>
```json
{
  "type": "object",
  "properties": {
    "path": { "type": "string" }
  },
  "additionalProperties": false,
  "required": ["path"]
}
```
**Why it's good**: Strict schema catches errors early.
</good_example>

### Example: Security Pattern

<bad_example>
```yaml
tools: Read, Bash  # Unrestricted
```
**Why it's bad**: Allows any shell command.
</bad_example>

<good_example>
```yaml
tools: Read, Bash(git:*)  # Scoped
```
**Why it's good**: Follows least privilege principle.
</good_example>
</examples>

## Constraints

- Only apply auto-fixes for HIGH certainty issues
- Security warnings are advisory - do not auto-fix
- Preserve existing plugin.json fields when syncing versions
- Never modify MCP tool behavior, only schema definitions
