---
name: enhance-prompts
description: "Use when improving general prompts for structure, examples, and constraints."
version: 1.0.0
argument-hint: "[path] [--fix]"
---

# enhance-prompts

Analyze prompts for clarity, structure, examples, and output reliability.

## Differentiation from enhance-agent-prompts

| Skill | Focus | Use When |
|-------|-------|----------|
| `enhance-prompts` | Prompt quality (clarity, structure, examples) | General prompts, system prompts, templates |
| `enhance-agent-prompts` | Agent config (frontmatter, tools, model) | Agent files with YAML frontmatter |

## Workflow

1. **Discover** - Find prompt files (.md, .txt)
2. **Classify** - Detect prompt type from path/content
3. **Check** - Run pattern checks
4. **Filter** - Apply certainty filtering
5. **Report** - Generate markdown output
6. **Fix** - Apply auto-fixes if --fix flag present

## Detection Patterns

### 1. Clarity (HIGH Certainty)

#### Vague Instructions
- "usually", "sometimes", "often"
- "try to", "if possible", "when appropriate"

#### Negative-Only Constraints
- "don't", "never", "avoid" without stating what TO do

#### Aggressive Emphasis
- Excessive CAPS (CRITICAL, IMPORTANT)
- Multiple exclamation marks (!!)

### 2. Structure (HIGH/MEDIUM Certainty)

#### Missing XML Structure
- Complex prompts without XML tags
- Prompts >800 tokens or 6+ sections need structure

#### Inconsistent Sections
- Mixed heading styles
- Skipped heading levels (H1 to H3)

#### Critical Info Buried
- Important instructions in middle 40% of prompt
- Lost-in-the-middle effect

### 3. Examples (HIGH/MEDIUM Certainty)

#### Missing Examples
- Complex prompts without few-shot examples
- Format requests without example output

#### Suboptimal Example Count
- Only 1 example (optimal: 2-5)
- More than 7 examples (token bloat)

#### Missing Contrast
- Multiple examples without good/bad labeling

### 4. Context (MEDIUM Certainty)

#### Missing Context/WHY
- Many rules without explanation

#### Missing Priority
- Multiple constraint sections
- No conflict resolution order

### 5. Output Format (MEDIUM/HIGH Certainty)

#### Missing Output Format
- Substantial prompts without format specification

#### JSON Without Schema
- Requests JSON output but no schema or example

### 6. Anti-Patterns (HIGH/MEDIUM/LOW Certainty)

#### Redundant CoT
- "Think step by step" with modern models

#### Overly Prescriptive
- 10+ numbered steps
- Micro-managing reasoning process

#### Prompt Bloat (LOW)
- Over 2500 tokens

## Auto-Fix Implementations

### 1. Aggressive Emphasis
```javascript
// CRITICAL -> critical, !! -> !
fixAggressiveEmphasis(content)
```

## Output Format

```markdown
## Prompt Analysis: {prompt-name}

**File**: {path}
**Type**: {agent|command|skill|prompt}
**Token Count**: ~{tokens}

### Summary
- HIGH: {count} issues
- MEDIUM: {count} issues

### Clarity Issues ({n})
| Issue | Fix | Certainty |

### Structure Issues ({n})
| Issue | Fix | Certainty |

### Example Issues ({n})
| Issue | Fix | Certainty |

### Context Issues ({n})
| Issue | Fix | Certainty |

### Output Format Issues ({n})
| Issue | Fix | Certainty |

### Anti-Pattern Issues ({n})
| Issue | Fix | Certainty |
```

## Pattern Statistics

| Category | Patterns | Auto-Fixable |
|----------|----------|--------------|
| Clarity | 3 | 1 |
| Structure | 3 | 0 |
| Examples | 3 | 0 |
| Context | 2 | 0 |
| Output | 2 | 0 |
| Anti-Pattern | 3 | 0 |
| **Total** | **16** | **1** |

<examples>
### Example: Vague Instructions

<bad_example>
```markdown
You should usually follow best practices when possible.
```
**Why it's bad**: Vague qualifiers reduce determinism.
</bad_example>

<good_example>
```markdown
Follow these specific practices:
1. Validate input before processing
2. Handle null/undefined explicitly
```
**Why it's good**: Specific, actionable instructions.
</good_example>

### Example: Negative-Only Constraints

<bad_example>
```markdown
- Don't use vague language
- Never skip validation
```
**Why it's bad**: Only states what NOT to do.
</bad_example>

<good_example>
```markdown
- Use specific, deterministic language
- Always validate input; return structured errors
```
**Why it's good**: Each constraint includes what TO do.
</good_example>

### Example: Missing Examples

<bad_example>
```markdown
## Output Format
Respond with a JSON object containing the analysis results.
```
**Why it's bad**: No example of expected format.
</bad_example>

<good_example>
```markdown
## Output Format
```json
{
  "status": "success|error",
  "findings": [{"type": "issue", "severity": "HIGH"}]
}
```
```
**Why it's good**: Concrete example shows exact structure.
</good_example>
</examples>

## Constraints

- Only apply auto-fixes for HIGH certainty issues
- Preserve original structure and formatting
- Differentiate from agent-enhancer (prompt quality vs agent config)
