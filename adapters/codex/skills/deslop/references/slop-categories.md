# Slop Pattern Categories

Detailed reference for all slop patterns detected by the pipeline.

## Pattern Categories

### Console Debugging

| Language | Patterns | Severity |
|----------|----------|----------|
| JavaScript | `console.log()`, `console.debug()`, `console.info()` | medium |
| Python | `print()`, `import pdb`, `breakpoint()` | medium |
| Rust | `println!()`, `dbg!()`, `eprintln!()` | medium |

**Excludes**: Test files, CLI entry points, config files

### Unsafe Error Handling (Rust)

| Pattern | Severity | Better Alternatives |
|---------|----------|---------------------|
| `.unwrap()` | medium | `.expect("msg")`, `.unwrap_or(default)`, `?` operator |

Bare `.unwrap()` calls can cause panics in production. Prefer:
- `.expect("descriptive message")` - panic with context
- `.unwrap_or(default)` / `.unwrap_or_default()` - provide fallback
- `.unwrap_or_else(\|\| ...)` - lazy fallback computation
- `?` operator - propagate errors to caller
- `.ok()` / `.map()` / `.and_then()` - transform Result/Option

**Excludes**: Test files, examples, benchmarks

### Placeholder Code

| Pattern | Language | Severity |
|---------|----------|----------|
| `throw new Error("TODO: ...")` | JavaScript | high |
| `todo!()`, `unimplemented!()` | Rust | high |
| `raise NotImplementedError` | Python | high |
| `panic("TODO: ...")` | Go | high |
| Empty function bodies `{}` | All | high |
| `pass` only functions | Python | high |

### Error Handling Issues

| Pattern | Description | Fix Strategy |
|---------|-------------|--------------|
| Empty catch blocks | `catch (e) {}` | add_logging |
| Silent except | `except: pass` | add_logging |

### Hardcoded Secrets

**Critical severity** - always flagged for manual review.

| Pattern | Examples |
|---------|----------|
| Generic credentials | `password=`, `api_key=`, `secret=` |
| JWT tokens | `eyJ...` base64 pattern |
| Provider-specific | `sk-` (OpenAI), `ghp_` (GitHub), `AKIA` (AWS) |

**Excludes**: Template placeholders (`${VAR}`, `{{VAR}}`), masked values (`xxxxxx`)

### Documentation Issues

| Pattern | Description | Severity |
|---------|-------------|----------|
| JSDoc > 3x function | Excessive documentation | medium |
| Issue/PR references | `// #123`, `// PR #456` | medium |
| Stale file references | `// see auth-flow.md` | low |

### Code Smells

| Pattern | Description | Severity |
|---------|-------------|----------|
| Boolean blindness | `fn(true, false, true)` | medium |
| Message chains | `a.b().c().d().e()` | low |
| Mutable globals | `let CONSTANT = ...` | high |
| Dead code | Unreachable after return | high |

### Verbosity Patterns

| Pattern | Examples | Severity |
|---------|----------|----------|
| AI preambles | "Certainly!", "I'd be happy to help" | low |
| Marketing buzzwords | "synergize", "paradigm shift" | low |
| Hedging language | "it's worth noting", "arguably" | low |

## Certainty Levels

### HIGH Certainty
- Direct regex match
- Definitive slop pattern
- Safe for auto-fix

### MEDIUM Certainty
- Multi-pass analysis required
- Review context before fixing
- May need human judgment

### LOW Certainty
- Heuristic detection
- High false positive rate
- Flag only, no auto-fix

## Auto-Fix Strategies

| Strategy | When Used |
|----------|-----------|
| `remove` | Debug statements, trailing whitespace |
| `replace` | Mixed indentation, multiple blank lines |
| `add_logging` | Empty error handlers |
| `flag` | Secrets, placeholders, code smells |

## Multi-Pass Analyzers

These patterns require structural analysis beyond regex:

- `doc_code_ratio_js` - JSDoc/function ratio
- `over_engineering_metrics` - File/export ratios
- `buzzword_inflation` - Claims vs evidence
- `infrastructure_without_implementation` - Setup without usage
- `dead_code` - Unreachable code detection
- `shotgun_surgery` - Git co-change analysis
