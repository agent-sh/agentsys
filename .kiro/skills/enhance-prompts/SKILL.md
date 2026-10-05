---
name: enhance-prompts
description: "Use when reviewing or improving prompt text (system prompts, commands, agent bodies, templates) for clarity, dated patterns, and output contracts. Holds the shared prompt guidance the other enhance skills cite."
version: 5.2.0
argument-hint: "[path] [--fix]"
---

# enhance-prompts

Find what in a prompt makes a current model do worse: missing context, dated scaffolding, unclear output contracts. Input (`$ARGUMENTS`): a path (default `.`), `--fix`, `--verbose`. This skill is also the shared reference for the agent, project-memory and skills enhancers.

## Run the analyzer

```bash
node -e 'const a=require(process.argv[1]); console.log(JSON.stringify(a.analyzeAllPrompts(process.argv[2]), null, 2))' \
  "$HOME/.agentsys/plugins/enhance/lib/enhance/prompt-analyzer.js" "<path>"
```

For one file use `analyzePrompt(<file>)`. The result has `summary` and `findings` (`issue`, `fix`, `certainty`, `patternId`, `line`). Verify each finding against the text, then add what the analyzer cannot see (below).

## What current models need

Current models (recent Claude, GPT and strong open models) follow instructions closely and literally. Text written for older models now hurts: emphasis makes them over-apply a rule, step scripts make them rigid, and repeated rules make them reconcile wordings instead of working. Judge a prompt by whether each line carries something only the author knows.

Keep and strengthen:

- **Context**: audience, product, environment facts, the quality bar, and the reason behind each constraint. A rule with its reason generalizes; a bare rule gets applied where it does not fit.
- **Goal and done criteria**: what success looks like and how to check it.
- **Real constraints**: safety, destructive operations, data handling, external posting. State each once, plainly, with the reason.
- **Exact commands for fragile operations**: where only one sequence is safe, a script is right.
- **Output contracts**: when something parses the output, show the exact shape.

Flag as dated:

| Pattern | Why it hurts now | Fix |
|---|---|---|
| All-caps MUST / NEVER / CRITICAL, stacked emphasis, threats | Over-triggering and rigid behavior; when everything is critical nothing is | Normal voice, one statement, with the reason |
| "Think step by step", scratchpad or `<thinking>` instructions | Models reason natively; this adds cost or gets refused as reasoning extraction | Remove |
| Step-by-step choreography for judgment work | The model's own plan is usually better | State the goal, constraints, and done criteria; keep numbered steps only where order matters |
| Prohibition lists with no reasons | Can anchor the model toward the failure | Keep the ones that encode real constraints, with reasons; restate the rest positively |
| The same rule repeated across sections | Wasted effort reconciling wordings | Say it once, where it applies |
| Hedges on real requirements ("try to", "if possible") | Read literally as optional | State the requirement |
| Long worked examples, a single gold output | The model copies length and structure | Delete, or keep several short varied ones labeled illustrative; keep format-pinning examples |
| Verification nudges after every step, forced tool order | Over-verification, slower runs | One check at the end, or none |
| History narratives, incident IDs, pinned model versions | Authority comes from the rule, not the story; pinned models go stale | State the current rule |
| Arithmetic scoring or lookup tables the model must compute | Models are worse at arithmetic than code | Move to code or data |

Do not flag: a one-line role statement, a single end-of-prompt recap, emphasis on one instruction that is demonstrably underweighted, routing text in a skill or tool description (trigger text may be emphatic), or length alone. Cruft is specific dated instructions, not word count.

## Analyzer findings to down-rank

These analyzer patterns encode older advice. Report them as LOW at most, and only when the prompt shows the problem they describe:

- `missing_xml_structure`: XML tags help separate data from instructions; they are not required for structure.
- `suboptimal_example_count`, `examples_without_contrast`, `missing_examples`: examples are right for format-sensitive output, not a quota.
- `critical_info_buried`: matters for very long prompts only.

Never suggest adding emphasis or chain-of-thought instructions.

## Fix

With `--fix`, apply only HIGH certainty findings that have an auto-fix (`applyFixes` in the analyzer; for emphasis, `fixAggressiveEmphasis`). Preserve the author's structure and wording otherwise.

## Output

Per file:

```markdown
## Prompt Analysis: <name>
File: <path> | Type: <system|agent|skill|command|template> | ~<tokens> tokens

| Line | Issue | Fix | Certainty |
|---|---|---|---|
```

When called by an enhancer agent, return the findings JSON that agent specifies instead.
