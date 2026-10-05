---
name: enhance-skills
description: "Use when reviewing SKILL.md files for trigger quality, invocation control, tool scope, size, and prompt quality."
version: 5.2.0
argument-hint: "[path] [--fix]"
---

# enhance-skills

A skill's description decides when it loads, and its body is paid for on every load. Review both. Input (`$ARGUMENTS`): a path (default `.`), `--fix`, `--verbose`.

## Run the analyzer

```bash
node -e 'const a=require(process.argv[1]); console.log(JSON.stringify(a.analyzeAllSkills(process.argv[2]), null, 2))' \
  "$HOME/.agentsys/plugins/enhance/lib/enhance/skill-analyzer.js" "<path>"
```

Verify each finding against the file.

## What to check

**Frontmatter (HIGH).** `---` delimiters, a `description`, and a `name` that is lowercase and at most 64 characters when present (it defaults to the directory name). Other fields the harness understands (check its current skills reference, they change): `argument-hint`, `allowed-tools`, `disable-model-invocation`, `user-invocable`, `model`, `context: fork` with `agent`, skill-scoped `hooks`.

**Trigger (HIGH).** The description is routing text. It should name the kinds of requests the skill handles, in the words users use, and when not to use it if a neighbor skill overlaps. A stock "Use when..." prefix is common but not the test; the test is whether it would route correctly. Flag descriptions that only say what the skill is ("Reviews code"), and descriptions that grow into long lists of near-synonym phrases instead of naming the intent.

**Invocation control (HIGH).** A skill with side effects (deploy, publish, release, send) should set `disable-model-invocation: true` so it only runs when a person asks. Note the trade-off: with that flag the model cannot call the skill through the Skill tool, so an agent that depends on it has to read the file directly.

**Tool scope (HIGH).** Scope Bash (`Bash(git:*)`). Read-only skills should not allow Write or Edit.

**Size and structure (MEDIUM).** Keep SKILL.md readable in one sitting (roughly under 500 lines). Move long reference material to files the skill links to. Some installers copy only `SKILL.md`, so a skill that must work everywhere should treat linked files as optional or keep essentials inline.

**Body.** Apply the `enhance-prompts` guidance: goal, constraints with reasons, done criteria, output contract, no dated scaffolding.

**Context config (MEDIUM).** `context: fork` without `agent`, or an `agent` whose tools do not match `allowed-tools`.

## Fix

With `--fix`, apply HIGH certainty auto-fixes only: missing frontmatter, a trigger clause for a description that has none (propose wording from the body), bare Bash scoped to what the body uses. Never remove content.

## Output

```markdown
## Skill Analysis: <name>
File: <path>

| Issue | Fix | Certainty |
|---|---|---|
```

When called by an enhancer agent, return the findings JSON that agent specifies instead.
