---
name: enhance-hooks
description: "Use when reviewing hooks for safety, timeouts, and correct frontmatter."
version: 1.0.0
argument-hint: "[path] [--fix]"
---

# enhance-hooks

Analyze hook definitions and scripts for safety, correctness, and best practices.

## Workflow

1. **Discover** - Find hook files (.md, .sh, .json)
2. **Classify** - Identify hook type and event
3. **Parse** - Extract frontmatter and script content
4. **Check** - Run all pattern checks (18 patterns)
5. **Filter** - Apply certainty filtering
6. **Report** - Generate markdown output
7. **Fix** - Apply auto-fixes if --fix flag present

## Detection Patterns

### 1. Frontmatter Validation (HIGH Certainty)

#### Required Elements
- YAML frontmatter with `---` delimiters
- `name` field in frontmatter
- `description` field in frontmatter

#### Recommended Elements
- `timeout` for command hooks (default: 30s)
- Hook type specification

### 2. Script Safety (HIGH Certainty)

#### Required Safety Patterns
- `set -euo pipefail` at script start
- Error handling for jq/JSON parsing
- Proper quoting of variables

#### Dangerous Patterns to Flag
```bash
# HIGH certainty
rm -rf            # Destructive without confirmation
git reset --hard  # Data loss risk
curl | sh         # Remote code execution
eval "$input"     # Arbitrary code execution

# MEDIUM certainty
rm -r             # Recursive delete (may be intentional)
git push --force  # Force push (may be intentional)
```

### 3. Exit Code Handling (HIGH Certainty)

| Exit Code | Purpose |
|-----------|---------|
| 0 | Success - output shown to user |
| 2 | Blocking error - action blocked |
| Other | Non-blocking error |

### 4. Lifecycle Event Appropriateness (MEDIUM Certainty)

| Event | Common Use Cases |
|-------|------------------|
| PreToolUse | Security validation, command blocking |
| PostToolUse | Formatting, logging, notifications |
| Stop | Completion checks, cleanup |
| SubagentStop | Workflow orchestration |
| SessionStart | Environment setup |

#### Flag Mismatches
- PostToolUse hooks trying to block actions
- PreToolUse hooks doing heavy processing

### 5. Timeout Configuration (MEDIUM Certainty)

- Default: 30 seconds for command hooks
- Flag: No timeout for network operations
- Flag: Timeout missing for external service calls

### 6. Output Format (MEDIUM Certainty)

#### PreToolUse Output
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask"
  }
}
```

### 7. Anti-Patterns (LOW Certainty)

- Complex logic in hooks (should be simple and fast)
- Missing documentation

## Auto-Fix Implementations

### 1. Missing safety header
```bash
#!/usr/bin/env bash
set -euo pipefail
```

### 2. Missing exit code
```bash
exit 0
```

### 3. Missing frontmatter fields
```yaml
---
name: hook-name
description: Hook description
---
```

## Output Format

```markdown
## Hook Analysis: {hook-name}

**File**: {path}
**Type**: {command|prompt|config}

### Summary
- HIGH: {count} issues
- MEDIUM: {count} issues

### Frontmatter Issues ({n})
| Issue | Fix | Certainty |

### Safety Issues ({n})
| Issue | Fix | Certainty |

### Exit Code Issues ({n})
| Issue | Fix | Certainty |

### Lifecycle Issues ({n})
| Issue | Fix | Certainty |
```

## Pattern Statistics

| Category | Patterns | Auto-Fixable |
|----------|----------|--------------|
| Frontmatter | 3 | 2 |
| Safety | 4 | 2 |
| Exit Code | 2 | 1 |
| Lifecycle | 3 | 0 |
| Timeout | 2 | 0 |
| Output | 2 | 0 |
| Anti-Pattern | 2 | 0 |
| **Total** | **18** | **5** |

<examples>
### Example: Missing Safety Header

<bad_example>
```bash
#!/usr/bin/env bash
cmd=$(jq -r '.tool_input.command // ""')
```
**Why it's bad**: Missing `set -euo pipefail` means errors may silently pass.
</bad_example>

<good_example>
```bash
#!/usr/bin/env bash
set -euo pipefail
cmd=$(jq -r '.tool_input.command // ""')
```
**Why it's good**: Fails fast on errors.
</good_example>

### Example: Dangerous Command Pattern

<bad_example>
```bash
if echo "$cmd" | grep -q 'rm'; then
  exit 2
fi
```
**Why it's bad**: Too broad - blocks legitimate `rm file.tmp`.
</bad_example>

<good_example>
```bash
if echo "$cmd" | grep -qE 'rm\s+(-rf|-fr)\s+/'; then
  exit 2
fi
```
**Why it's good**: Specific pattern targets actual dangerous commands.
</good_example>
</examples>

## Constraints

- Only apply auto-fixes for HIGH certainty issues
- Be cautious about security patterns - false negatives worse than false positives
- Never remove content, only suggest improvements
