# Slop Pattern Categories

Detailed reference for all slop patterns detected by the pipeline.

## Pattern Categories

### Console Debugging

| Language | Patterns | Severity |
|----------|----------|----------|
| JavaScript | `console.log()`, `console.debug()`, `console.info()` | medium |
| Python | `print()`, `import pdb`, `breakpoint()` | medium |
| Rust | `println!()`, `dbg!()`, `eprintln!()` | medium |
| Rust | `log::debug!()`, `log::trace!()` | medium |
| C | `printf("DEBUG ...")`, `fprintf(stderr, "TRACE ...")` | medium |
| C++ | `std::cout << "DEBUG"`, `std::cerr << "TRACE"` | medium |
| Java | `System.out.println()`, `System.err.println()` | medium |
| Kotlin | `println()` | medium |

**Excludes**: Test files, CLI entry points, config files

### Unsafe Error Handling (Rust)

| Pattern | Severity | Better Alternatives |
|---------|----------|---------------------|
| `.unwrap()` | medium | `.expect("msg")`, `.unwrap_or(default)`, `?` operator |
| `.expect("msg")` | medium | `?` operator, explicit match/if-let |
| `Err(_) => {}` empty match arm | high | Log error, return Err, or propagate |

Bare `.unwrap()` and `.expect()` calls can cause panics in production. Prefer:
- `?` operator - propagate errors to caller
- `.unwrap_or(default)` / `.unwrap_or_default()` - provide fallback
- `.unwrap_or_else(\|\| ...)` - lazy fallback computation
- `.ok()` / `.map()` / `.and_then()` - transform Result/Option

Empty error match arms silently swallow errors. Always log or propagate.

**Excludes**: Test files, examples, benchmarks

### Placeholder Code

| Pattern | Language | Severity |
|---------|----------|----------|
| `throw new Error("TODO: ...")` | JavaScript | high |
| `todo!()`, `unimplemented!()` | Rust | high |
| `raise NotImplementedError` | Python | high |
| `panic("TODO: ...")` | Go | high |
| `assert(false && "not implemented")` | C | high |
| `throw runtime_error("not implemented")` | C++ | high |
| `throw new UnsupportedOperationException()` | Java | high |
| `throw new RuntimeException("TODO")` | Java | high |
| `TODO()` | Kotlin | high |
| Empty function bodies `{}` | All | high |
| `pass` only functions | Python | high |

### Error Handling Issues

| Pattern | Description | Fix Strategy |
|---------|-------------|--------------|
| Empty catch blocks | `catch (e) {}`, `catch (...) {}` (C++) | add_logging |
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
| Unnecessary `.clone()` (Rust) | Review if borrow would suffice | low |
| `unsafe {}` without `// SAFETY:` (Rust) | Missing justification comment | high |

### Portability Issues

| Pattern | Description | Severity |
|---------|-------------|----------|
| Hardcoded absolute paths (Rust) | `"/home/..."`, `"/tmp/..."`, `"/etc/..."` | medium |
| Hardcoded user paths (Python) | `"/home/user/"`, `"/Users/user/"` | medium |

Hardcoded paths like `/home/user/config` or `/tmp/cache` break cross-platform portability.
Use `std::env::temp_dir()`, `dirs::home_dir()`, `os.path.expanduser("~")`, or `pathlib.Path.home()`.

### Python

| Pattern | Description | Severity |
|---------|-------------|----------|
| python_debugging | print(), pdb, breakpoint() debug statements | medium |
| placeholder_not_implemented_py | raise NotImplementedError placeholder | high |
| placeholder_pass_only_py | Function with only pass statement | high |
| placeholder_ellipsis_py | Function with only ellipsis (...) | high |
| empty_except_py | Empty except blocks with pass | high |
| mutable_globals_py | Mutable global collections (list/dict/set) | high |
| python_bare_except | Bare except: without exception type | high |
| python_eval_exec | eval()/exec() usage | high |
| python_os_system | os.system() calls | medium |
| python_chmod_777 | os.chmod with 0o777 | high |
| python_hardcoded_path | Hardcoded /home/ or /Users/ paths | medium |
| python_logging_debug | logging.basicConfig with DEBUG level | medium |
| python_os_environ_debug | Debug prints of os.environ/sys.argv | medium |
| python_shell_injection | subprocess with shell=True | high |

### C/C++

| Pattern | Description | Severity |
|---------|-------------|----------|
| c_printf_debugging | Debug printf/fprintf with DEBUG/TRACE markers | medium |
| c_ifdef_debug_block | #ifdef DEBUG or #if 0 blocks left in code | low |
| c_placeholder_todo | assert(false && "TODO") placeholder crashes | high |
| c_pragma_warning_disable | #pragma warning(disable:...) silencing | medium |
| c_goto_usage | goto statements (maintainability risk) | low |
| c_hardcoded_credential_path | Hardcoded /etc/passwd, ~/.ssh/id_rsa paths | critical |
| c_magic_number_cast | Casts with magic numbers: (void*)0x1234 | medium |
| cpp_cout_debugging | std::cout/cerr debug output in library code | medium |
| cpp_throw_not_implemented | throw runtime_error("not implemented") | high |
| cpp_empty_catch | Empty catch blocks: catch(...) {} | high |

C patterns (prefix `c_`) apply to both C and C++ files. C++ patterns (prefix `cpp_`) apply only to C++ files.

### Java

| Pattern | Description | Severity |
|---------|-------------|----------|
| placeholder_unsupported_java | throw new UnsupportedOperationException() | high |
| java_sysout_debugging | System.out/err.println() debug output | medium |
| java_stacktrace_debugging | printStackTrace() - use logging framework | medium |
| java_throw_todo | RuntimeException("TODO") / IllegalStateException("not implemented") | high |
| java_return_null_todo | return null; // TODO placeholder | high |
| java_empty_catch | Empty catch blocks: catch (Exception e) {} | high |
| java_catch_ignore | catch block with // ignore comment | medium |
| java_suppress_warnings | @SuppressWarnings("unchecked") | low |
| java_raw_type | Raw generics without type parameters | low |
| java_wildcard_catch | Overly broad catch (Exception/Throwable) | low |

### Kotlin

| Pattern | Description | Severity |
|---------|-------------|----------|
| kotlin_println_debugging | println() debug output in production code | medium |
| kotlin_todo_call | TODO() stdlib call - throws at runtime | high |
| kotlin_fixme_comment | // FIXME comment with placeholder code | medium |
| kotlin_empty_catch | Empty catch blocks: catch (e: Exception) {} | high |
| kotlin_swallowed_error | runCatching{}.getOrNull() silently swallows errors | medium |
| kotlin_suppress_annotation | @Suppress("UNCHECKED_CAST") | low |

### Go

| Pattern | Description | Severity |
|---------|-------------|----------|
| placeholder_panic_go | panic("TODO: ...") placeholder | high |
| go_fmt_debugging | fmt.Print/Println/Printf debug statements | medium |
| go_log_debugging | log.Print/Println/Printf debug logging | low |
| go_spew_debugging | spew.Dump/Sdump debug output | medium |
| go_empty_error_check | Empty if err != nil {} blocks | high |
| go_discarded_error | _ = someFunc() discarding errors | medium |
| go_bare_os_exit | os.Exit without defer cleanup | medium |
| go_empty_interface_param | interface{} parameters - prefer specific types | low |
| go_todo_empty_func | Empty function bodies with TODO comments | high |
| go_unchecked_type_assertion | Type assertion without comma-ok - panics at runtime | high |
| go_panic_recoverable | panic() for recoverable errors - return error instead | high |
| go_error_string_capitalized | Capitalized error strings (Go convention: lowercase) | low |
| go_defer_close_no_error | defer Close() without error handling | low |
| go_weak_random | math/rand instead of crypto/rand for security | medium |
| go_unused_append | append() result not assigned - always a bug | critical |

### Shell/Bash

| Pattern | Description | Severity |
|---------|-------------|----------|
| shell_debugging | set -x/set -v debug tracing left enabled | medium |
| shell_echo_debug | Debug echo statements (DEBUG, TRACE, HERE) | medium |
| shell_placeholder_todo | Placeholder functions (not implemented, TODO) | high |
| shell_error_silencing | Error silencing with \|\| true | medium |
| shell_empty_trap | Empty trap handlers | high |
| shell_hardcoded_path | Hardcoded user paths (/home/, /Users/) | medium |
| shell_chmod_777 | Overly permissive chmod 777 | critical |
| shell_curl_pipe_bash | Piping remote content to shell | critical |
| shell_unquoted_variable | Unquoted variables in dangerous commands | high |
| shell_eval_usage | Eval command usage | high |

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
