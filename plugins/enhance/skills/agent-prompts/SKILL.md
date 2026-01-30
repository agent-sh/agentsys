---
name: enhance-agent-prompts
description: "Use when improving agent prompts, frontmatter, and tool restrictions."
version: 1.0.0
argument-hint: "[path] [--fix] [--verbose]"
---

# enhance-agent-prompts

Analyze agent prompt files for prompt engineering best practices and optimization.

## Workflow

1. **Discover** - Find all agent .md files in directory
2. **Parse** - Extract frontmatter and analyze content
3. **Check** - Run all pattern checks (14 patterns)
4. **Filter** - Apply certainty filtering (skip LOW unless --verbose)
5. **Report** - Generate markdown output
6. **Fix** - Apply auto-fixes if --fix flag present

## Detection Patterns

### 1. Structure Validation (HIGH Certainty)

#### Required Elements
- YAML frontmatter with `---` delimiters
- `name` field in frontmatter
- `description` field in frontmatter
- Role section ("You are..." or "## Role")
- Output format specification
- Constraints section

#### Pattern Checks
```javascript
const hasFrontmatter = content.trim().startsWith('---');
const hasRole = /you are/i.test(content) || /##\s+(?:your\s+)?role/i.test(content);
const hasFormat = /##\s+output\s+format/i.test(content);
const hasConstraints = /##\s+constraints/i.test(content);
```

### 2. Tool Configuration (HIGH Certainty)

#### HIGH Certainty Issues
- No `tools` field: agent has unrestricted access to ALL tools
- `Bash` without scope: should be `Bash(git:*)` or specific restriction
- Overly broad tool access when narrow scope would work

### 3. XML Structure (MEDIUM Certainty)

When to suggest XML:
- 5+ sections in the prompt
- Both lists AND code blocks present
- Multiple distinct phases or steps

### 4. Chain-of-Thought Appropriateness (MEDIUM Certainty)

#### Unnecessary CoT
- Simple tasks (< 500 words, < 4 sections)
- Single-step operations

#### Missing CoT
- Complex analysis tasks (> 1000 words, 5+ sections)
- Multi-step reasoning required
- Keywords: "analyze", "evaluate", "assess", "review"

### 5. Example Quality (LOW Certainty)

Optimal example count: 2-5
- < 2 examples: insufficient for pattern recognition
- > 5 examples: token bloat, diminishing returns

### 6. Anti-Patterns (MEDIUM/LOW Certainty)

#### Vague Instructions (MEDIUM)
- Fuzzy qualifiers: `usually`, `sometimes`, `often`, `try to`, `if possible`
- Replace with definitive: `always`, `never`, `must`, `will`

#### Prompt Bloat (LOW)
- Estimated token count > 2000 (rough: length / 4)

## Auto-Fix Implementations

### 1. Missing frontmatter
```yaml
---
name: agent-name
description: Agent description
tools: Read, Glob, Grep
model: sonnet
---
```

### 2. Unrestricted Bash
```yaml
tools: Read, Bash(git:*)
```

### 3. Missing role
```markdown
## Your Role

You are an agent that [describe purpose].
```

## Output Format

```markdown
## Agent Analysis: {agent-name}

**File**: {path}
**Analyzed**: {timestamp}

### Summary
- HIGH: {count} issues
- MEDIUM: {count} issues
- LOW: {count} issues (verbose only)

### Structure Issues ({n})
| Issue | Fix | Certainty |
|-------|-----|-----------|

### Tool Issues ({n})
| Issue | Fix | Certainty |
|-------|-----|-----------|

### XML Structure Issues ({n})
| Issue | Fix | Certainty |
|-------|-----|-----------|

### Chain-of-Thought Issues ({n})
| Issue | Fix | Certainty |
|-------|-----|-----------|
```

## Pattern Statistics

| Category | Patterns | Auto-Fixable |
|----------|----------|--------------|
| Structure | 6 | 2 |
| Tool | 2 | 1 |
| XML | 1 | 0 |
| CoT | 2 | 0 |
| Example | 1 | 0 |
| Anti-Pattern | 2 | 0 |
| **Total** | **14** | **3** |

<examples>
### Example: Unrestricted Bash Access

<bad_example>
```yaml
tools: Read, Bash
```
**Why it's bad**: Unrestricted Bash allows any shell command.
</bad_example>

<good_example>
```yaml
tools: Read, Bash(git:*)
```
**Why it's good**: Bash restricted to git commands only.
</good_example>

### Example: Missing Role Section

<bad_example>
```markdown
# My Agent

## What It Does
This agent processes files...
```
**Why it's bad**: No clear role definition.
</bad_example>

<good_example>
```markdown
# My Agent

## Your Role
You are a file processing agent that analyzes and transforms data files.
```
**Why it's good**: Clear role establishes agent identity.
</good_example>
</examples>

## Constraints

- Only apply auto-fixes for HIGH certainty issues
- Preserve existing frontmatter fields when adding missing ones
- Never remove content, only suggest improvements
