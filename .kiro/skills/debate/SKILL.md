---
name: debate
description: "Structured AI debate templates and synthesis. Use when orchestrating multi-round debates between AI tools, 'debate topic', 'argue about', 'stress test idea', 'devil advocate'."
version: 5.1.0
argument-hint: "[topic] [--proposer=tool] [--challenger=tool] [--rounds=N] [--effort=level]"
---

# debate

Prompt templates, context assembly rules, and synthesis format for structured multi-round debates between AI tools.

## Arguments

Parse from `$ARGUMENTS`:
- **topic**: The debate question/topic (required)
- **--proposer**: Tool for the proposer role (claude, gemini, codex, opencode, copilot)
- **--challenger**: Tool for the challenger role (must differ from proposer)
- **--rounds**: Number of back-and-forth rounds (1-5, default: 2)
- **--effort**: Thinking effort applied to all tool invocations (low, medium, high, max)
- **--model-proposer**: Specific model for proposer (optional)
- **--model-challenger**: Specific model for challenger (optional)

## Universal Rules

ALL participants (proposer AND challenger) MUST support claims with specific evidence (file path, code pattern, benchmark, or documented behavior). Unsupported claims from either side will be flagged by the other participant and noted in the verdict. This applies to every round.

## Prompt Templates

### Round 1: Proposer Opening

```
You are participating in a structured debate as the PROPOSER.

Topic: {topic}

Your job: Analyze this topic thoroughly and present your position. Take a clear stance. Do not hedge excessively.

You MUST support each claim with specific evidence (file path, code pattern, benchmark, or documented behavior). Unsupported claims will be challenged. "I think" or "generally speaking" without evidence is not acceptable.

Provide your analysis:
```

### Round 1: Challenger Response

```
You are participating in a structured debate as the CHALLENGER.

Topic: {topic}

The PROPOSER ({proposer_tool}) argued:

---
{proposer_round1_response}
---

Your job: Find weaknesses, blind spots, and flaws in the proposer's argument. You MUST identify at least one genuine flaw or overlooked consideration before agreeing on anything. Propose concrete alternatives where you disagree.

Rules:
- Do NOT say "great point" or validate the proposer's reasoning before critiquing it
- Lead with what's WRONG or MISSING, then acknowledge what's right
- If you genuinely agree on a point, explain what RISK remains despite the agreement
- Propose at least one concrete alternative approach
- You MUST address at least these categories: correctness, security implications, and developer experience
- Do NOT agree with ANY claim unless you can cite specific evidence (file path, code pattern, or documented behavior) that supports the agreement. Unsupported agreement is not allowed.
- If the proposer makes a claim without evidence, call it out: "This claim is unsupported."

Provide your challenge:
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

Your job: Address each challenge directly. For each point:
- If they're right, concede explicitly and explain how your position evolves
- If they're wrong, explain why with specific evidence (file path, code pattern, benchmark, or documented behavior)
- If it's a tradeoff, acknowledge the tradeoff and explain why you still favor your approach with evidence

Every claim you make -- whether concession, rebuttal, or new argument -- MUST cite specific evidence. The challenger will reject unsupported claims.

Do NOT simply restate your original position. Your response must show you engaged with the specific challenges raised.

Provide your defense:
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

IMPORTANT: Do NOT let the proposer reframe your challenges as agreements. If they say "we actually agree" but haven't addressed the substance, reject it. Default to suspicion, not acceptance.

Your job: Evaluate the proposer's defense. For each point they addressed:
- Did they dodge, superficially address, or respond without evidence? Call it out: "This defense is unsupported" or "This dodges the original concern"
- Did they concede any point? Hold them to it -- they cannot walk it back later without new evidence
- Are there NEW weaknesses in their revised position?
- Did they adequately address your concern with specific evidence? Only then acknowledge it, and cite what convinced you

You MUST either identify at least one new weakness or unresolved concern, OR explicitly certify a previous concern as genuinely resolved with specific evidence for why you're now satisfied. "I'm convinced because [evidence]" is acceptable. "I agree now" without evidence is not.
If you see new problems, raise them.

Provide your follow-up:
```

## Context Assembly

### Rounds 1-2: Full context

Include the full text of all prior exchanges in the prompt. Context is small enough (typically under 5000 tokens total).

Format for context block:
```
Previous exchanges:

Round 1 - Proposer ({proposer_tool}):
{full response}

Round 1 - Challenger ({challenger_tool}):
{full response}
```

### Round 3+: Summarized context

For rounds 3 and beyond, replace full exchange text from rounds 1 through N-2 with a summary. Only include the most recent round's responses in full.

Format:
```
Summary of rounds 1-{N-2}:
{summary of key positions, agreements, and open disagreements}

Round {N-1} - Proposer ({proposer_tool}):
{full response}

Round {N-1} - Challenger ({challenger_tool}):
{full response}
```

The orchestrator agent (opus) generates the summary. Target: 500-800 tokens. MUST preserve:
- Each side's core position
- All concessions (verbatim quotes, not paraphrased)
- All evidence citations that support agreements
- Points of disagreement (unresolved)
- Any contradictions between rounds (e.g., proposer concedes in round 1 but walks it back in round 2 -- note both explicitly)

## Synthesis Format

After all rounds complete, the orchestrator produces this structured output:

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

Rate the debate on these dimensions:
- **Genuine disagreement**: Did the challenger maintain independent positions, or converge toward the proposer? (high/medium/low)
- **Evidence quality**: Did both sides cite specific examples, or argue from generalities? (high/medium/low)
- **Challenge depth**: Were the challenges substantive, or surface-level? (high/medium/low)

### Key Agreements
- {agreed point 1} (evidence: {what supports this agreement})
- {agreed point 2} (evidence: {what supports this agreement})

### Key Disagreements
- {point}: {proposer_tool} argues {X}, {challenger_tool} argues {Y}

### Unresolved Questions
- {question that neither side adequately addressed}

### Recommendation
{Orchestrator's recommendation - must pick a direction, not "both have merit"}
```

**Synthesis rules:**
- The verdict MUST pick a side. "Both approaches have merit" is NOT acceptable.
- Cite specific arguments from the debate as evidence for the verdict.
- The recommendation must be actionable - what should the user DO based on this debate.
- Unresolved questions highlight where the debate fell short, not where both sides are "equally valid."

## State File Schema

Save to `{AI_STATE_DIR}/debate/last-debate.json`:

```json
{
  "id": "debate-{ISO timestamp}-{4 char random hex}",
  "topic": "original topic text",
  "proposer": {"tool": "claude", "model": "opus"},
  "challenger": {"tool": "gemini", "model": "gemini-3.1-pro-preview"},
  "effort": "high",
  "rounds_completed": 2,
  "max_rounds": 2,
  "status": "completed",
  "exchanges": [
    {"round": 1, "role": "proposer", "tool": "claude", "response": "...", "duration_ms": 8500},
    {"round": 1, "role": "challenger", "tool": "gemini", "response": "...", "duration_ms": 12000},
    {"round": 2, "role": "proposer", "tool": "claude", "response": "...", "duration_ms": 9200},
    {"round": 2, "role": "challenger", "tool": "gemini", "response": "...", "duration_ms": 11000}
  ],
  "verdict": {
    "winner": "claude",
    "reasoning": "...",
    "agreements": ["..."],
    "disagreements": ["..."],
    "recommendation": "..."
  },
  "timestamp": "{ISO 8601 timestamp}"
}
```

Platform state directory:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`

## Error Handling

| Error | Action |
|-------|--------|
| Proposer fails round 1 | Abort debate. Cannot proceed without opening position. |
| Challenger fails round 1 | Show proposer's position with note: "[WARN] Challenger failed. Showing proposer's uncontested position." |
| Any tool fails mid-debate | Synthesize from completed rounds. Note incomplete round in output. |
| Tool invocation timeout (>240s) | Round 1 proposer: abort. Round 1 challenger: proceed with uncontested. Round 2+: synthesize from completed rounds with timeout note. |
| Consult result envelope indicates failure (status/exit/error/empty output) | Treat as tool failure for that role/round and apply the same role+round policy above. |
| Structured parse fails after successful envelope | Treat as tool failure for that role/round, include only sanitized parse metadata (`PARSE_ERROR:<type>:<code>`, redact secrets, strip control chars, max 200 chars), then apply the same role+round policy above. |
| All rounds timeout | "[ERROR] Debate failed: all tool invocations timed out." |
| No successful exchanges recorded (non-timeout) | "[ERROR] Debate failed: no successful exchanges were recorded." |

## External Tool Quick Reference

> Canonical source: `plugins/consult/skills/consult/SKILL.md`. Build and execute CLI commands directly using these templates. Do NOT invoke via `Skill: consult` - in Claude Code that loads the interactive command wrapper and causes a recursive loop. Write the question to `{AI_STATE_DIR}/consult/question.tmp` first, then execute the command via Bash.

### Safe Command Patterns

| Provider | Safe Command Pattern |
|----------|---------------------|
| Claude | `claude -p - --output-format json --model "MODEL" --max-turns TURNS --allowedTools "Read,Glob,Grep" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Gemini | `gemini -p - --output-format json -m "MODEL" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Codex | `codex exec "$(cat "{AI_STATE_DIR}/consult/question.tmp")" --json -m "MODEL" -c model_reasoning_effort="LEVEL"` |
| OpenCode | `opencode run - --format json --model "MODEL" --variant "VARIANT" < "{AI_STATE_DIR}/consult/question.tmp"` |
| Copilot | `copilot -p - < "{AI_STATE_DIR}/consult/question.tmp"` |

### Effort-to-Model Mapping

| Effort | Claude | Gemini | Codex | OpenCode | Copilot |
|--------|--------|--------|-------|----------|---------|
| low | claude-haiku-4-5 (1 turn) | gemini-3-flash-preview | gpt-6-sol (low) | default (low) | no control |
| medium | claude-sonnet-5 (3 turns) | gemini-3-flash-preview | gpt-6-sol (medium) | default (medium) | no control |
| high | claude-opus-5-5 (5 turns) | gemini-3.1-pro-preview | gpt-6-astra (high) | default (high) | no control |
| max | claude-opus-5-5 (10 turns) | gemini-3.1-pro-preview | gpt-6-astra (max) | default + --thinking | no control |

### Output Parsing

| Provider | Parse Expression |
|----------|-----------------|
| Claude | `JSON.parse(stdout).result` |
| Gemini | `JSON.parse(stdout).response` |
| Codex | `JSON.parse(stdout).message` or raw text |
| OpenCode | Newline-delimited JSON. Concatenate `part.text` from events where `type === "text"`. Session ID from `event.sessionID`. |
| Copilot | Raw stdout text |

Parse discipline:
1. Evaluate execution status first (timeout/non-zero/error/empty output) before any parsing.
2. Parse only when execution status is successful.
3. If parse fails, surface only sanitized parse metadata (never raw stdout/stderr snippets) and apply role/round failure policy instead of hanging or continuing silently.

### ACP Transport Commands

> ACP is an alternative transport available when providers support it. Build and execute CLI commands directly - do NOT use `Skill: consult` (recursive loop in Claude Code).

| Provider | ACP Command Pattern |
|----------|-------------------|
| Claude | `node acp/run.js --provider="claude" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=240000 --model="MODEL"` |
| Gemini | `node acp/run.js --provider="gemini" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=240000 --model="MODEL"` |
| Codex | `node acp/run.js --provider="codex" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=240000 --model="MODEL"` |
| OpenCode | `node acp/run.js --provider="opencode" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=240000 --model="MODEL"` |
| Copilot | `node acp/run.js --provider="copilot" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=240000` |
| Kiro | `node acp/run.js --provider="kiro" --question-file="{AI_STATE_DIR}/consult/question.tmp" --timeout=240000` |

Note the 240000ms timeout (240s) for debate rounds vs 120000ms (120s) for consult.

**Kiro**: ACP-only provider. No CLI mode. Available when `kiro-cli` is on PATH.

### ACP Output Parsing

ACP transport output is parsed identically to CLI transport - the ACP runner (`acp/run.js`) normalizes responses into the same JSON envelope format. The `transport` field in the envelope indicates `"acp"` or `"cli"`.
