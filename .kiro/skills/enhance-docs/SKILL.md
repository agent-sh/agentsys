---
name: enhance-docs
description: "Use when improving documentation: broken links, structure, stale content, and readiness for retrieval by AI tools."
version: 5.2.0
argument-hint: "[path] [--fix] [--ai]"
---

# enhance-docs

Make docs correct first, then easy to navigate for people and easy to retrieve for AI tools. Input (`$ARGUMENTS`): a path (default `docs/`), `--fix`, `--verbose`, and a mode:

- default (both audiences): readability wins; suggest AI-friendly changes only when they also help people.
- `--ai`: docs read mainly by agents (agent-docs, knowledge bases): denser, self-contained sections sized for retrieval.

## Run the analyzer

```bash
node -e 'const a=require(process.argv[1]); console.log(JSON.stringify(a.analyzeAllDocs(process.argv[2], { mode: process.argv[3] }), null, 2))' \
  "$HOME/.agentsys/plugins/enhance/lib/enhance/docs-analyzer.js" "<path>" "<ai|both>"
```

Verify each finding. If the prompt includes doc-drift or stale-doc context from repo-intel, prioritize those docs: a doc that names a symbol that no longer exists is the most valuable finding you can report.

## What to check

**Correctness (HIGH).** Broken relative links and anchors, links to files that do not exist, commands and APIs that no longer match the code, stale version numbers.

**Structure (HIGH).** One H1, no skipped heading levels, language tags on code blocks, a heading at least every few hundred words.

**Navigation (MEDIUM).** The purpose and quick start near the top. Reference material after it. Long pages split by topic.

**Retrieval, `--ai` mode (MEDIUM).** Sections that stand alone: one topic each, a descriptive title, and no opening "It" or "This" that depends on the previous section. Very long sections split, fragments merged. Tables for parameter lists and option matrices.

**Wordiness (LOW).** Filler ("In this document we will...", "It is important to note that"), and phrases with shorter equivalents ("in order to" to "to"). Report, do not rewrite prose wholesale.

## Fix

With `--fix`, apply HIGH certainty auto-fixes only: heading level jumps, missing code-block languages when the content makes the language obvious, and (in `--ai` mode) the verbose-phrase replacements. Preserve tone. Never delete content.

## Output

```markdown
## Documentation Analysis: <name>
File: <path> | Mode: <ai|both> | ~<tokens> tokens

| Line | Issue | Fix | Certainty |
|---|---|---|---|
```

When called by an enhancer agent, return the findings JSON that agent specifies instead.
