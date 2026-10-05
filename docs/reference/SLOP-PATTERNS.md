# Slop Pattern Reference

Complete reference for patterns detected by `/deslop`.

**TL;DR:** 60+ patterns across 5 languages. HIGH certainty = safe to auto-fix. Uses regex (fast) not LLM calls.

---

## Quick Navigation

| Section | Jump to |
|---------|---------|
| [Pattern Categories](#pattern-categories) | Overview of all categories |
| [Language-Specific Patterns](#language-specific-patterns) | JS, Python, Rust, Go, Java |
| [Universal Patterns](#universal-patterns) | TODOs, placeholders, magic numbers |
| [Secret Detection](#secret-detection-patterns) | API keys, tokens, credentials |
| [Multi-Pass Analyzers](#multi-pass-analyzers) | Phase 2 context-aware detection |
| [CLI Tool Integration](#cli-tool-integration-phase-3) | Phase 3 optional tools |
| [Auto-Fix Strategies](#auto-fix-strategies) | What happens when you apply |

**Design principle:** Detection uses pre-indexed regex for O(1) lookup. LLM context is spent on judgment calls, not pattern matching that code can do better.

**Related docs:**
- [/deslop in README](../../README.md#deslop) - Command usage

---

## Pattern Categories

| Category | Certainty | Description |
|----------|-----------|-------------|
| Console Debugging | HIGH | Debug statements left in code |
| TODOs and FIXMEs | HIGH | Unfinished work markers |
| Empty Handlers | HIGH | Empty catch blocks, callbacks |
| Hardcoded Secrets | CRITICAL | API keys, tokens, credentials |
| Placeholder Code | HIGH | Stub implementations |
| Excessive Documentation | MEDIUM | Doc-to-code ratio issues |
| Verbosity | MEDIUM | AI preambles, hedging |
| Over-Engineering | MEDIUM | Unnecessary complexity |
| Code Smells | MEDIUM-LOW | Structural issues |

---

## Language-Specific Patterns

### JavaScript / TypeScript

| Pattern | Certainty | Example |
|---------|-----------|---------|
| console.log | HIGH | `console.log("debug")` |
| console.debug | HIGH | `console.debug(data)` |
| console.warn | MEDIUM | `console.warn("check this")` |
| debugger | HIGH | `debugger;` |
| Empty catch | HIGH | `catch (e) {}` |
| process.exit | MEDIUM | `process.exit(1)` |
| Disabled eslint | HIGH | `// eslint-disable-next-line` |

### Python

| Pattern | Certainty | Example |
|---------|-----------|---------|
| print() | HIGH | `print("debug")` |
| pprint | HIGH | `pprint(data)` |
| breakpoint() | HIGH | `breakpoint()` |
| pdb.set_trace | HIGH | `import pdb; pdb.set_trace()` |
| Empty except | HIGH | `except: pass` |
| Bare except | MEDIUM | `except Exception:` |

### Rust

| Pattern | Certainty | Example |
|---------|-----------|---------|
| println! | HIGH | `println!("debug: {:?}", x)` |
| dbg! | HIGH | `dbg!(value)` |
| todo!() | HIGH | `todo!()` |
| unimplemented!() | HIGH | `unimplemented!()` |
| panic! | MEDIUM | `panic!("not implemented")` |

### Go

| Pattern | Certainty | Example |
|---------|-----------|---------|
| fmt.Println | HIGH | `fmt.Println("debug")` |
| log.Println | MEDIUM | `log.Println("check")` |
| panic | MEDIUM | `panic("todo")` |

### Java

| Pattern | Certainty | Example |
|---------|-----------|---------|
| System.out.println | HIGH | `System.out.println("debug")` |
| e.printStackTrace | HIGH | `e.printStackTrace()` |
| UnsupportedOperationException | MEDIUM | `throw new UnsupportedOperationException()` |

---

## Universal Patterns

These apply to all languages.

### TODOs and Comments

| Pattern | Certainty | Example |
|---------|-----------|---------|
| TODO | HIGH | `// TODO: fix this` |
| FIXME | HIGH | `# FIXME: broken` |
| HACK | HIGH | `/* HACK: workaround */` |
| XXX | HIGH | `// XXX: dangerous` |
| Old TODO (>30 days) | HIGH | `// TODO: from 6 months ago` |
| Commented code blocks | MEDIUM | Large sections of commented code |

### Placeholder Text

| Pattern | Certainty | Example |
|---------|-----------|---------|
| Lorem ipsum | HIGH | `"Lorem ipsum dolor sit amet"` |
| foo/bar/baz | MEDIUM | `const foo = bar()` |
| test@example.com | LOW | `email = "test@example.com"` |
| 123-456-7890 | LOW | `phone = "123-456-7890"` |

### Magic Numbers

| Pattern | Certainty | Example |
|---------|-----------|---------|
| Hardcoded timeouts | MEDIUM | `setTimeout(fn, 3000)` |
| Hardcoded limits | MEDIUM | `if (count > 100)` |
| Hardcoded ports | LOW | `listen(8080)` |

---

## Secret Detection Patterns

**Certainty: CRITICAL**

All secret patterns trigger immediate flagging.

| Pattern | Example |
|---------|---------|
| JWT tokens | `eyJhbGciOiJIUzI1NiIs...` |
| API keys | `sk-proj-abc123...` |
| AWS credentials | `AKIA...` |
| GitHub tokens | `ghp_...`, `gho_...`, `ghu_...` |
| Slack tokens | `xoxb-...`, `xoxp-...` |
| Private keys | `-----BEGIN RSA PRIVATE KEY-----` |
| Generic secrets | `password = "..."`, `secret = "..."` |

---

## Multi-Pass Analyzers

These run in Phase 2 (MEDIUM certainty).

### Doc-to-Code Ratio

**What it checks:** Ratio of JSDoc/docstring lines to actual code lines.

**Flags when:**
- Documentation exceeds 50% of function body
- Comments explain obvious code
- Comments repeat what code says

**Example flagged:**

```javascript
/**
 * Adds two numbers together.
 * @param {number} a - The first number to add
 * @param {number} b - The second number to add
 * @returns {number} The sum of a and b
 */
function add(a, b) {
  return a + b;  // 10 lines of docs for 1 line of code
}
```

### Verbosity Ratio

**What it checks:** AI-style preambles and hedging language.

**Flags when:**
- Sentences start with "I'll", "Let me", "Here's"
- Hedging: "might", "could potentially", "may or may not"
- Buzzwords without substance

**Example flagged:**

```javascript
// Here's a robust, scalable, enterprise-grade solution
// that leverages modern best practices to efficiently
// handle the complexities of adding two numbers.
function add(a, b) {
  return a + b;
}
```

### Over-Engineering

**What it checks:** Unnecessary abstraction and complexity.

**Metrics:**
- File count vs function count
- Average exports per file
- Directory nesting depth
- Interface/implementation ratio

**Flags when:**
- Single-function files
- 5+ levels of directory nesting
- More interfaces than implementations
- Factory-of-factory patterns

### Buzzword Inflation

**What it checks:** Quality claims without evidence.

**Buzzwords tracked:**
- "enterprise-grade"
- "production-ready"
- "best practices"
- "scalable"
- "robust"
- "efficient"
- "optimized"
- "state-of-the-art"

**Flags when:**
- Claims appear in comments without tests to back them up
- Marketing language in technical code

### Dead Code

**What it checks:** Unreachable or unused code.

**Detection methods:**
- Functions never called (requires full analysis)
- Code after unconditional return
- Else branches after return
- Unreachable switch cases

### Stub Functions

**What it checks:** Placeholder implementations.

**Patterns:**
- `return null`
- `return undefined`
- `return {}`
- `return []`
- `throw new Error("TODO")`
- `throw new Error("Not implemented")`
- `pass` (Python)

---

## CLI Tool Integration (Phase 3)

Optional tools that run when available.

### JavaScript/TypeScript

| Tool | Checks |
|------|--------|
| jscpd | Copy-paste detection |
| madge | Circular dependencies |
| escomplex | Cyclomatic complexity |

### Python

| Tool | Checks |
|------|--------|
| pylint | Style and error detection |
| radon | Cyclomatic complexity |

### Go

| Tool | Checks |
|------|--------|
| golangci-lint | Multiple linters aggregated |

### Rust

| Tool | Checks |
|------|--------|
| clippy | Lints and suggestions |

---

## Auto-Fix Strategies

| Strategy | When Applied | What Happens |
|----------|--------------|--------------|
| `remove` | Console logs, debug statements | Line deleted |
| `replace` | Hardcoded values, magic numbers | Substituted with config |
| `add_logging` | Empty catch blocks | Adds `console.error(e)` or equivalent |
| `flag` | Needs human review | Marked in report, not auto-fixed |
| `none` | Informational only | Reported, no action |

---

## Severity Levels

| Level | Meaning | Auto-Fix? |
|-------|---------|-----------|
| CRITICAL | Security issue, immediate fix required | Yes, with warning |
| HIGH | Definite problem, safe to fix | Yes |
| MEDIUM | Probable problem, needs context | No (flagged) |
| LOW | Possible problem, needs judgment | No (reported) |

---

## Configuration

Thoroughness levels control which phases run:

| Level | Phase 1 | Phase 2 | Phase 3 |
|-------|---------|---------|---------|
| quick | Yes | No | No |
| normal | Yes | Yes | No |
| deep | Yes | Yes | If tools available |

**Usage:**

```bash
/deslop --thoroughness=deep
```

---

## Pattern Lookup Performance

Patterns are pre-indexed for O(1) lookup:

```javascript
// By language
getPatternsForLanguage('javascript')  // Returns JS-specific patterns

// By severity
getPatternsBySeverity('critical')  // Returns CRITICAL patterns

// By auto-fix strategy
getPatternsByAutoFix('remove')  // Returns removable patterns

// Combined criteria
getPatternsByCriteria({
  language: 'python',
  severity: 'high',
  autoFix: 'remove'
})
```

This avoids scanning all 60+ patterns on every check.

---

## Navigation

[← Back to Documentation Index](../README.md) | [Main README](../../README.md)

**Related:**
- [/deslop Command](../../README.md#deslop) - How to use the command
- [Agent Reference - deslop-agent](./AGENTS.md#deslop-plugin-agents) - The cleanup agent
