---
name: enhance-cross-file
description: "Use when checking consistency across agents, skills, and commands: tools used but not declared, references to agents that do not exist, duplicated or contradictory rules."
version: 5.2.0
argument-hint: "[path]"
---

# enhance-cross-file

Find problems no single-file review sees. Input (`$ARGUMENTS`): a path (default `.`).

## Run the analyzer

```bash
node -e 'const a=require(process.argv[1]); console.log(JSON.stringify(a.analyze(process.argv[2]), null, 2))' \
  "$HOME/.agentsys/plugins/enhance/lib/enhance/cross-file-analyzer.js" "<path>"
```

It returns `summary` and `findings`. Every finding is MEDIUM certainty: each needs context to confirm. Verify before reporting, and skip content inside bad-example blocks (`<bad_example>` and similar tags, or code blocks whose info string says bad).

## What it finds

| Pattern | Meaning |
|---|---|
| `tool_not_in_allowed_list` | The body calls a tool its frontmatter does not grant |
| `skill_tool_mismatch` | A skill's `allowed-tools` does not match what the body uses |
| `missing_workflow_agent` | A `subagent_type` or `plugin:agent` reference points at an agent that does not exist in this repo |
| `orphaned_prompt` | An agent nothing references. Entry points (orchestrators, validators, discoverers, agents invoked by users) are not orphans |
| `incomplete_phase_transition` | A workflow mentions a phase with no section for it |
| `duplicate_instructions` | The same rule in three or more files |
| `contradictory_rules` | One file requires what another forbids |

A reference to an agent from another plugin is not missing if the calling file says it is optional and gives a fallback. Report it as missing only when the caller depends on it.

For duplicates, suggest one home for the rule (project memory or a shared skill) and a pointer elsewhere. For contradictions, show both lines; do not pick a side.

## Constraints

No auto-fix. A cross-file change means choosing which file is right, and that is the author's decision.

## Output

```markdown
## Cross-File Analysis
Files analyzed: <agents> agents, <skills> skills, <commands> commands

| Pattern | Files | Issue | Suggested fix |
|---|---|---|---|
```

When called by an enhancer agent, return the findings JSON that agent specifies instead.
