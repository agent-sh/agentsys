---
name: enhance-docs
description: "Use when improving documentation structure, accuracy, and RAG readiness."
version: 1.0.0
argument-hint: "[path] [--fix] [--ai]"
---

# enhance-docs

Analyze documentation for readability, structure, and RAG optimization.

## Optimization Modes

### AI-Only Mode (`--ai`)
For agent-docs and RAG-optimized documentation:
- Aggressive token reduction
- Dense information packing
- Self-contained sections for retrieval
- Optimal chunking boundaries

### Both Mode (`--both`, default)
For user-facing documentation:
- Balance readability with AI-friendliness
- Clear structure for both humans and retrievers
- Explanatory text where helpful

## Workflow

1. **Discover** - Find all .md files in directory
2. **Parse** - Extract structure and content
3. **Check** - Run pattern checks based on mode
4. **Filter** - Apply certainty filtering
5. **Report** - Generate markdown output
6. **Fix** - Apply auto-fixes if --fix flag present

## Detection Patterns

### 1. Link Validation (HIGH Certainty)
- Broken anchor links (`[text](#missing-anchor)`)
- Links to non-existent files
- Malformed link syntax

### 2. Structure Validation (HIGH Certainty)
- Consistent heading hierarchy (no H1 -> H3 jumps)
- Code blocks with language specification
- Reasonable section lengths

### 3. Token Efficiency (HIGH - AI Mode Only)

#### Unnecessary Prose
- "In this document..."
- "As you can see..."
- "Let's explore..."

#### Verbose Phrases
- "in order to" -> "to"
- "due to the fact that" -> "because"
- "has the ability to" -> "can"

### 4. RAG Optimization (MEDIUM - AI Mode Only)

#### Suboptimal Chunking
- Sections too long (>1000 tokens)
- Sections too short (<20 tokens)

#### Poor Semantic Boundaries
- Multiple topics in single section
- Missing context anchors (sections starting with "It", "This")

### 5. Balance Suggestions (MEDIUM - Both Mode)
- Missing section headers in long content
- Important information buried late

## Auto-Fix Implementations

### 1. Inconsistent Headings
```javascript
// H1 -> H3 becomes H1 -> H2
fixInconsistentHeadings(content)
```

### 2. Verbose Explanations (AI mode)
```javascript
// "in order to" -> "to"
fixVerboseExplanations(content)
```

## Output Format

```markdown
## Documentation Analysis: {doc-name}

**File**: {path}
**Mode**: {AI-only | Both audiences}
**Token Count**: ~{tokens}

### Summary
- HIGH: {count} issues
- MEDIUM: {count} issues

### Link Issues ({n})
| Issue | Fix | Certainty |

### Structure Issues ({n})
| Issue | Fix | Certainty |

### Efficiency Issues ({n}) [AI mode]
| Issue | Fix | Certainty |

### RAG Optimization Issues ({n}) [AI mode]
| Issue | Fix | Certainty |
```

## Pattern Statistics

| Category | Patterns | Mode | Auto-Fixable |
|----------|----------|------|--------------|
| Link | 1 | shared | 0 |
| Structure | 3 | shared | 1 |
| Efficiency | 2 | ai | 1 |
| RAG | 3 | ai | 0 |
| Balance | 4 | both | 0 |
| **Total** | **14** | - | **2** |

<examples>
### Example: Verbose Phrase Detection

<bad_example>
```markdown
In order to configure the plugin, you need to...
```
**Why it's bad**: Verbose phrases waste tokens.
</bad_example>

<good_example>
```markdown
To configure the plugin...
```
**Why it's good**: Direct language reduces tokens.
</good_example>

### Example: RAG Chunking Issue

<bad_example>
```markdown
## Installation
[2000+ tokens of mixed content]
```
**Why it's bad**: Long mixed sections create poor retrieval boundaries.
</bad_example>

<good_example>
```markdown
## Installation
[500 tokens - just installation]

## Configuration
[400 tokens - configuration only]
```
**Why it's good**: Single-topic sections for clear chunk boundaries.
</good_example>
</examples>

## Constraints

- Only apply auto-fixes for HIGH certainty issues
- Preserve original tone and style
- Balance AI optimization with human readability (default mode)
