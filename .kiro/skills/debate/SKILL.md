---
name: debate
description: "Use when the user wants two AI tools to argue a question: 'debate', 'argue about', 'stress test idea', 'devil advocate', 'codex vs gemini'. Runs proposer and challenger rounds between two CLIs and delivers a verdict."
version: 5.2.0
argument-hint: "[topic] [--proposer=tool] [--challenger=tool] [--rounds=N] [--effort=level]"
---

# debate

Run a structured debate between two AI CLIs on one topic: a proposer takes a position, a challenger attacks it, they alternate for N rounds, and you judge. The value is in genuine disagreement backed by evidence, so the prompts below push each side to cite specifics and push the challenger not to fold.

Arguments: `$ARGUMENTS`

- **topic** (required).
- **--proposer**, **--challenger**: claude, gemini, codex, opencode, copilot, kiro. They must differ.
- **--rounds**: 1 to 5, default 2.
- **--effort**: low, medium, high, max; applies to both tools.
- **--model-proposer**, **--model-challenger**: optional model ids.
- **--context**: diff, file=PATH, or none; the same context goes to both tools.

How to invoke a tool for one turn (transport, templates, models, parsing, redaction) is in [references/tools.md](references/tools.md).

## Running the debate

For each round, build the proposer prompt, run it, show the response, then do the same for the challenger. Before each call print `[INFO] Running round {round} proposer ({proposer}) - timeout 240s` (or `challenger ({challenger})`), because a round can take minutes and the user needs to see it moving. Show each response as soon as it has succeeded:

```
--- Round {round}: {tool} (Proposer|Challenger) ---

{response}
```

Each call has a hard 240-second timeout, enforced by something that can cancel/kill the underlying command: external tools can hang forever. Treat a timeout, non-zero exit, error envelope, empty output or unparseable output as a failure of that role in that round. Check the result envelope before parsing, and when parsing fails report only `PARSE_ERROR:<type>:<code>` (redact secrets, strip control characters, max 200 chars - never raw stdout/stderr snippets), since raw output can carry secrets.

| Failure | Then |
|---|---|
| Proposer, round 1 | Abort: `[ERROR] Debate aborted: proposer ({tool}) failed on opening round. {error}` |
| Challenger, round 1 | `[WARN] Challenger ({tool}) failed on round 1. Proceeding with uncontested proposer position.` and go to the verdict |
| Either, round 2+ | Stop the rounds, judge what completed, and note the early stop |
| Every call timed out | `[ERROR] Debate failed: all tool invocations timed out.` |
| No successful exchange (other causes) | `[ERROR] Debate failed: no successful exchanges were recorded.` |

## Prompt templates

Both sides support claims with specific evidence (a file path, a code pattern, a benchmark, documented behavior). Unsupported claims get called out by the other side and noted in the verdict.

### Round 1: Proposer Opening

```
You are the PROPOSER in a structured debate.

Topic: {topic}

Take a clear position and argue it. Support each claim with specific evidence: a file path, a code pattern, a benchmark, or documented behavior. The challenger will attack claims that rest on "generally" or "I think", so give them something concrete to test.
```

### Round 1: Challenger Response

```
You are the CHALLENGER in a structured debate.

Topic: {topic}

The PROPOSER ({proposer_tool}) argued:

---
{proposer_round1_response}
---

Find what is wrong or missing in this argument before acknowledging what is right. Cover correctness, security implications, and developer experience. Where you disagree, propose a concrete alternative. Where you agree, say what risk remains, and agree only with claims you can back with evidence of your own. If a claim has no evidence, say "This claim is unsupported." Skip compliments; they weaken the challenge.
```

### Round 2+: Proposer Defense

```
You are the PROPOSER in round {round} of a structured debate.

Topic: {topic}

{context_summary}

The CHALLENGER ({challenger_tool}) raised these points in round {previous_round}:

---
{challenger_previous_response}
---

Answer each point directly. If the challenger is right, concede and say how your position changes. If they are wrong, show why with evidence. If it is a tradeoff, name it and explain why you still favor your approach. Every concession, rebuttal and new argument cites evidence. Restating your opening is not a defense.
```

### Round 2+: Challenger Follow-up

```
You are the CHALLENGER in round {round} of a structured debate.

Topic: {topic}

{context_summary}

The PROPOSER ({proposer_tool}) responded to your challenges:

---
{proposer_previous_response}
---

Judge the defense point by point. Call out dodges and evidence-free answers ("This defense is unsupported", "This dodges the original concern"). Hold the proposer to any concession. Look for new weaknesses in the revised position. Do not accept a reframing of your challenge as agreement unless the substance was answered.

End with at least one new or still-open concern, or certify a concern as resolved and name the evidence that convinced you. "I agree now" without evidence does not resolve anything.
```

## Context between rounds

Rounds 1 and 2 carry the full text of earlier exchanges:

```
Previous exchanges:

Round 1 - Proposer ({proposer_tool}):
{full response}

Round 1 - Challenger ({challenger_tool}):
{full response}
```

From round 3, replace rounds 1 through N-2 with your own summary (500 to 800 tokens) and keep only the latest round in full. The summary keeps each side's core position, every concession as a verbatim quote, the evidence behind any agreement, the open disagreements, and any contradiction between rounds (a concession later walked back: note both). A paraphrased concession lets a side quietly retract it.

## Verdict

You are the judge. The user wants a decision, so the verdict picks a side: "both approaches have merit" is not a verdict. Cite the two or three arguments that decided it. The recommendation says what the user should do next. Unresolved questions are where the debate fell short, not a way to split the difference.

```
## Debate Summary

**Topic**: {topic}
**Proposer**: {proposer_tool} ({proposer_model})
**Challenger**: {challenger_tool} ({challenger_model})
**Rounds**: {rounds_completed}
**Rigor**: Structured perspective comparison (prompt-enforced adversarial rules, no deterministic verification)

### Verdict

{winner_tool} had the stronger argument because: {specific reasoning citing debate evidence}

### Debate Quality

- **Genuine disagreement**: high|medium|low (did the challenger hold independent positions or converge?)
- **Evidence quality**: high|medium|low
- **Challenge depth**: high|medium|low

### Key Agreements
- {point} (evidence: {what supports it})

### Key Disagreements
- {point}: {proposer_tool} argues {X}, {challenger_tool} argues {Y}

### Unresolved Questions
- {question neither side answered}

### Recommendation
{a direction and the next action}
```

## State

Save `{AI_STATE_DIR}/debate/last-debate.json` (`{AI_STATE_DIR}` is `$AI_STATE_DIR` if set, else `.claude/`, `.opencode/` or `.codex/`):

```json
{
  "id": "debate-{ISO timestamp}-{4 hex}",
  "topic": "...",
  "proposer": {"tool": "claude", "model": "claude-opus-5-5"},
  "challenger": {"tool": "gemini", "model": "gemini-3.1-pro-preview"},
  "effort": "high",
  "rounds_completed": 2,
  "max_rounds": 2,
  "status": "completed|partial|failed",
  "exchanges": [{"round": 1, "role": "proposer", "tool": "claude", "response": "...", "duration_ms": 8500}],
  "verdict": {"winner": "claude", "reasoning": "...", "agreements": [], "disagreements": [], "recommendation": "..."},
  "timestamp": "{ISO 8601}"
}
```
