---
name: enhance-skills
description: "Use when reviewing SKILL.md files for structure and trigger quality."
version: 1.0.0
argument-hint: "[path] [--fix]"
---

# enhance-skills

Analyze skill definitions for trigger quality, structure, and discoverability.

## Workflow

1. **Discover** - Find all SKILL.md files
2. **Parse** - Extract frontmatter and content
3. **Check** - Run all pattern checks (21 patterns)
4. **Filter** - Apply certainty filtering
5. **Report** - Generate markdown output
6. **Fix** - Apply auto-fixes if --fix flag present

## Detection Patterns

### 1. Frontmatter Validation (HIGH Certainty)

#### Required Elements
- YAML frontmatter with `---` delimiters
- `name` field (lowercase, max 64 chars)
- `description` field (max 1024 chars)

#### Recommended Elements
- `version` field for tracking
- `argument-hint` for user guidance
- `allowed-tools` for security

### 2. Trigger Quality (HIGH Certainty)

Description should include trigger context:
- "Use when user asks..."
- "Use when..."
- "Invoke when..."

#### Good Triggers
```yaml
description: "Use when user asks to 'review code', 'check PR', or 'code review'"
```

#### Bad Triggers
```yaml
description: "Reviews code"  # No trigger context
description: "Useful tool"   # Too vague
```

### 3. Invocation Control (HIGH Certainty)

| Setting | Purpose |
|---------|---------|
| `disable-model-invocation: true` | Manual only (side effects) |
| `user-invocable: false` | Background knowledge (auto-only) |

#### Flag Issues
- Skills with side effects missing `disable-model-invocation: true`
- Deploy/ship skills auto-invocable

### 4. Tool Restrictions (HIGH Certainty)

- Skills with Bash should specify scope: `Bash(git:*)`
- Read-only skills should not have Write/Edit
- Research skills should not have Task

### 5. Content Scope (MEDIUM Certainty)

#### Size Guidelines
- SKILL.md should be under 500 lines
- Large content should move to `references/` subdirectory

#### Flag Issues
- SKILL.md over 500 lines
- More than 3 dynamic injections
- Embedded large examples

### 6. Structure Quality (MEDIUM Certainty)

#### Recommended Sections
- Purpose/overview
- Required checks or steps
- Output format
- Examples (if complex)

### 7. Context Configuration (MEDIUM Certainty)

| Setting | Purpose |
|---------|---------|
| `context: fork` | Isolated context for verbose work |
| `agent: Explore` | Read-only exploration |
| `agent: Plan` | Planning-focused reasoning |

### 8. Anti-Patterns (LOW Certainty)

- Vague descriptions
- Too many responsibilities (should split)
- Missing `argument-hint` for skills needing input

## Auto-Fix Implementations

### 1. Missing frontmatter
```yaml
---
name: skill-name
description: "Use when..."
version: 1.0.0
---
```

### 2. Missing trigger phrase
Add "Use when user asks..." prefix to description

### 3. Unrestricted Bash
Replace `Bash` with `Bash(git:*)` or appropriate scope

## Output Format

```markdown
## Skill Analysis: {skill-name}

**File**: {path}

### Summary
- HIGH: {count} issues
- MEDIUM: {count} issues

### Frontmatter Issues ({n})
| Issue | Fix | Certainty |

### Trigger Issues ({n})
| Issue | Fix | Certainty |

### Invocation Issues ({n})
| Issue | Fix | Certainty |

### Tool Issues ({n})
| Issue | Fix | Certainty |

### Scope Issues ({n})
| Issue | Fix | Certainty |
```

## Pattern Statistics

| Category | Patterns | Auto-Fixable |
|----------|----------|--------------|
| Frontmatter | 4 | 2 |
| Trigger | 2 | 1 |
| Invocation | 3 | 1 |
| Tool | 2 | 1 |
| Scope | 2 | 0 |
| Structure | 2 | 0 |
| Context | 3 | 0 |
| Anti-Pattern | 3 | 0 |
| **Total** | **21** | **5** |

<examples>
### Example: Missing Trigger Phrase

<bad_example>
```yaml
name: code-review
description: "Reviews code for issues"
```
**Why it's bad**: No trigger context for auto-discovery.
</bad_example>

<good_example>
```yaml
name: code-review
description: "Use when user asks to 'review code', 'check this PR'. Reviews code for issues."
```
**Why it's good**: Clear trigger phrases enable auto-discovery.
</good_example>

### Example: Dangerous Auto-Invocation

<bad_example>
```yaml
name: deploy
description: "Deploys code to production"
```
**Why it's bad**: Side-effect skill could be auto-invoked accidentally.
</bad_example>

<good_example>
```yaml
name: deploy
description: "Deploy to production environment"
disable-model-invocation: true
```
**Why it's good**: Manual-only prevents accidental deployments.
</good_example>

### Example: Oversized Skill

<bad_example>
```markdown
# Complex Analysis
[800 lines of detailed instructions]
```
**Why it's bad**: Large skills consume context budget.
</bad_example>

<good_example>
```markdown
# Complex Analysis
Core instructions here (under 500 lines).
For details, see `references/detailed-guide.md`.
```
**Why it's good**: Core skill is concise; details in separate files.
</good_example>
</examples>

## Constraints

- Only apply auto-fixes for HIGH certainty issues
- Consider skill context when evaluating trigger quality
- Never remove content, only suggest improvements
