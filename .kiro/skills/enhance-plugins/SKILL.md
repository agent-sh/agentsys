---
name: enhance-plugins
description: "Use when reviewing agent plugins: manifest structure, MCP tool schemas and descriptions, and plugin security patterns."
version: 5.2.0
argument-hint: "[path] [--fix]"
---

# enhance-plugins

Review a plugin so it installs cleanly, its tools get called correctly, and it cannot be turned against the user. Input (`$ARGUMENTS`): a path (default `.`), `--fix`, `--verbose`.

Plugins are directories with `.claude-plugin/plugin.json` (Claude Code), OpenCode plugins under `.opencode/plugins/` with MCP servers in `opencode.json`, and Codex MCP servers in `~/.codex/config.toml`.

## Run the analyzer

```bash
node -e 'const a=require(process.argv[1]); a.analyzePlugin(process.argv[2]).then(r => console.log(JSON.stringify(r, null, 2)))' \
  "$HOME/.agentsys/plugins/enhance/lib/enhance/plugin-analyzer.js" "<plugin dir>"
```

For a directory of plugins, `analyzeAllPlugins(<dir>)`. Verify each finding.

## What to check

**Manifest (HIGH).** `plugin.json` has a kebab-case `name`, a semver `version`, and a `description`. If `package.json` also carries a version, the two agree. Components the manifest or `components.json` lists exist on disk.

**Tool descriptions (HIGH).** For tool calling, the description is the contract, and under-description is the common failure. Each tool says what it does, when to use it and when not to, what it returns, and its limits. Each parameter says its format, with an example value where the format is not obvious. Flag vague one-liners and missing parameter descriptions. Also flag the opposite problem: behavioral steering in a description ("ALWAYS call this first", "after results, always suggest...") or long worked examples, which belong in a skill or prompt, not the schema.

**Schema (HIGH or MEDIUM).** `required` lists the required parameters, `additionalProperties: false` on object inputs, enums for closed sets, bounds on numbers, flat shapes over deep nesting.

**Tool count (LOW).** Many overlapping tools make selection worse. Suggest merging near-duplicates, or deferred loading past a few dozen.

**Security (HIGH, advisory).** Bare `Bash` in agent or skill tools, shell commands built from unvalidated input, path traversal (`../`) in file handling, hardcoded secrets, MCP servers that send data out without the user knowing, tool output treated as instructions. Missing input validation and missing timeouts on network tools are MEDIUM.

**Errors (MEDIUM).** Tools return errors the model can act on: what failed and what to do next, with `is_error` set, instead of a bare stack trace.

## Fix

With `--fix`, apply HIGH certainty auto-fixes only (`applyFixes` in the analyzer): `additionalProperties: false`, a `required` array, a version synced between `plugin.json` and `package.json`. Never change tool behavior, and never auto-fix security findings: they need the author's judgment.

## Output

```markdown
## Plugin Analysis: <name>
Files scanned: <n>

| File | Tool | Issue | Fix | Certainty |
|---|---|---|---|---|
```

When called by an enhancer agent, return the findings JSON that agent specifies instead.
