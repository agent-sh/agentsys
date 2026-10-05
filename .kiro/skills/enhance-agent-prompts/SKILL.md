---
name: enhance-agent-prompts
description: "Use when reviewing agent definition files: frontmatter, trigger description, tool scope, model choice, and the agent's prompt body."
version: 5.2.0
argument-hint: "[path] [--fix] [--verbose]"
---

# enhance-agent-prompts

Review agent files so each agent gets routed to correctly, has only the tools it needs, runs on a sensible model tier, and has a prompt a current model can execute well. Input (`$ARGUMENTS`): a path (default `.`), `--fix`, `--verbose`.

Agent files live in `.claude/agents/` and `~/.claude/agents/` (Claude Code), `.opencode/agents/` and `~/.config/opencode/agents/` (OpenCode), and plugin `agents/` directories.

## Run the analyzer

```bash
node -e 'const a=require(process.argv[1]); console.log(JSON.stringify(a.analyzeAllAgents(process.argv[2]), null, 2))' \
  "$HOME/.agentsys/plugins/enhance/lib/enhance/agent-analyzer.js" "<path>"
```

Verify each finding against the file. The analyzer's frontmatter parser does not read YAML list syntax (`tools:` followed by `- Read` lines), so it reports "no tools restriction" for agents that do restrict tools. Drop those.

## What to check

**Description.** It is routing text: it should say what the agent does and when to use it, specific enough that a caller picks it for the right tasks and not others. "Reviews code" fails; "Reviews diffs for security issues in auth, API and data-handling code; not for style" works.

**Tools.** Least privilege, because a subagent's tools are its blast radius. Read-only agents get `Read, Glob, Grep`. Scope Bash (`Bash(git:*)`, `Bash(npm:*)`) instead of granting it bare. In Claude Code, a subagent cannot spawn subagents, so `Task` in a subagent's tools does nothing; an agent that needs to delegate should say what to do without it.

**Model.** Mechanical or pattern-matching work pins a fast tier (`haiku` or `sonnet`). Judgment-heavy work can omit `model` and inherit the session model. Flag pinned opus on mechanical work, and any full model ID with a date (those retire).

**Prompt body.** Apply the guidance in the `enhance-prompts` skill: goal, constraints with reasons, done criteria, output contract. Agents in particular should:

- State their output shape when a caller parses it.
- Say how iteration ends (max rounds, stop conditions) if they loop.
- Treat fetched or user-supplied content as data, and validate inputs that reach a shell.
- Not ask the user questions when they run as subagents (they cannot), and not write shared state their caller owns.

Down-rank the analyzer's `missing_xml_structure`, `missing_cot`, and `example_count_suboptimal` to LOW at most: they encode older advice (see `enhance-prompts`). Never suggest stronger emphasis such as "should" to "MUST".

## Fix

With `--fix`, apply HIGH certainty auto-fixes only (`applyFixes` in the analyzer): missing frontmatter fields, bare `Bash` scoped to what the body uses. Keep existing frontmatter fields. Never delete prompt content in a fix.

## Output

```markdown
## Agent Analysis: <name>
File: <path> | Model: <model or inherit> | Tools: <tools>

| Issue | Fix | Certainty |
|---|---|---|
```

When called by an enhancer agent, return the findings JSON that agent specifies instead.
