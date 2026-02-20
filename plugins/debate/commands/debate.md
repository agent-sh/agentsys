---
name: debate
description: 'Use when user asks to "debate", "argue about", "compare perspectives", "stress test idea", "devil advocate", or "tool vs tool". Structured debate between two AI tools with proposer/challenger roles and a verdict.'
codex-description: 'Use when user asks to "debate", "argue about", "compare perspectives", "stress test idea", "devil advocate", "codex vs gemini". Runs structured multi-round debate between two AI tools with proposer/challenger roles.'
argument-hint: "[topic] [--tools=tool1,tool2] [--rounds=N] [--effort=low|medium|high|max]"
allowed-tools: Skill, Bash(claude:*), Bash(gemini:*), Bash(codex:*), Bash(opencode:*), Bash(copilot:*), Bash(git:*), Bash(where.exe:*), Bash(which:*), Read, Write, AskUserQuestion
---

# /debate - Structured AI Dialectic

You are executing the /debate command. Your job is to parse the user's request, resolve missing parameters interactively, and execute the debate directly.

## Constraints

- NEVER expose API keys in commands or output
- NEVER run with permission-bypassing flags
- MUST validate tool names against allow-list: gemini, codex, claude, opencode, copilot
- Proposer and challenger MUST be different tools
- Rounds MUST be 1-5 (default: 2)
- MUST sanitize all tool output before displaying (see Output Sanitization section below)
- MUST enforce 240s timeout on all tool executions

## Execution

### Phase 1: Parse Input (Flags + Natural Language)

Parse `$ARGUMENTS` using both explicit flags and natural language. Flags take priority.

#### Step 1a: Extract explicit flags

1. `--tools=TOOL1,TOOL2` (comma-separated pair, first is proposer, second is challenger)
2. `--rounds=N` where N is 1-5
3. `--effort=VALUE` where VALUE is one of: low, medium, high, max
4. `--model-proposer=VALUE` (any string)
5. `--model-challenger=VALUE` (any string)
6. `--context=VALUE` where VALUE is: diff, file=PATH, or none (passed through to consult skill for each tool invocation)

Remove matched flags from `$ARGUMENTS`.

#### Step 1b: Natural language extraction

**Tool pair extraction** (case-insensitive):
- "{tool} vs {tool}" (e.g., "codex vs gemini") -> proposer, challenger
- "{tool} and {tool}" -> proposer, challenger
- "with {tool} and {tool}" -> proposer, challenger
- "between {tool} and {tool}" -> proposer, challenger
- Tool names: claude, gemini, codex, opencode, copilot

**Rounds extraction**:
- "{N} rounds" -> rounds=N
- "single round" / "one round" -> rounds=1
- "deep" / "extended" -> rounds=3

**Effort extraction** (same as consult):
- "quick" / "fast" -> effort=low
- "thorough" / "deep" / "carefully" -> effort=high
- "maximum" / "max effort" -> effort=max

**Topic extraction**:
- Text after "about" is the topic
- If no "about" pattern, remaining text after removing tool/rounds/effort markers

**Validation**: rounds must be 1-5. Proposer and challenger must differ. If same tool specified for both, show: `[ERROR] Proposer and challenger must be different tools.`

If no topic found: `[ERROR] Usage: /debate "your topic" or /debate codex vs gemini about your topic`

### Phase 2: Interactive Parameter Resolution

MUST resolve ALL missing parameters. Do NOT silently default.

#### Step 2a: Detect installed tools

Run all 5 checks **in parallel** via Bash:
- `which <tool> 2>/dev/null && echo FOUND || echo NOTFOUND` (Unix)
- `where.exe <tool> 2>nul && echo FOUND || echo NOTFOUND` (Windows)

Check for: claude, gemini, codex, opencode, copilot.

If fewer than 2 tools installed: `[ERROR] Debate requires at least 2 AI CLI tools. Install more: npm i -g @anthropic-ai/claude-code, npm i -g @openai/codex`

#### Step 2b: Batch selection for missing params

Use a SINGLE AskUserQuestion call for all missing params:

```
AskUserQuestion:
  questions:
    - id: "debate-proposer"
      header: "Proposer"                         # SKIP if proposer resolved
      question: "Which tool should PROPOSE (argue for)?"
      multiSelect: false
      options (only installed tools):
        - label: "Claude"       description: "Deep code reasoning"
        - label: "Gemini"       description: "Fast multimodal analysis"
        - label: "Codex"        description: "Agentic coding"
        - label: "OpenCode"     description: "Flexible model choice"
        - label: "Copilot"      description: "GitHub-integrated AI"

    - id: "debate-challenger"
      header: "Challenger"                       # SKIP if challenger resolved
      question: "Which tool should CHALLENGE (find flaws)?"
      multiSelect: false
      options (only installed, excluding proposer):
        [same list minus the proposer tool]

    - id: "debate-effort"
      header: "Effort"                           # SKIP if effort resolved
      question: "What thinking effort level?"
      multiSelect: false
      options:
        - label: "High (Recommended)"    description: "Thorough analysis for debate"
        - label: "Medium"                description: "Balanced speed and quality"
        - label: "Low"                   description: "Fast, minimal reasoning"
        - label: "Max"                   description: "Maximum reasoning depth"

    - id: "debate-rounds"
      header: "Rounds"                           # SKIP if rounds resolved
      question: "How many debate rounds?"
      multiSelect: false
      options:
        - label: "2 (Recommended)"       description: "Propose + challenge + defend + respond"
        - label: "1 (Quick)"             description: "Single propose + challenge"
        - label: "3 (Extended)"          description: "Three full exchanges"
        - label: "5 (Exhaustive)"        description: "Five rounds, deep exploration"

    - id: "debate-context"
      header: "Context"                          # SKIP if --context resolved
      question: "Include codebase context for both tools?"
      multiSelect: false
      options:
        - label: "None (Recommended)"    description: "No extra context, just the topic"
        - label: "Diff"                  description: "Include current git diff"
        - label: "File"                  description: "Include a specific file (will ask path)"
```

Map choices: "Claude" -> "claude", "High (Recommended)" -> "high", "2 (Recommended)" -> 2, "None (Recommended)" -> "none", "Diff" -> "diff", "File" -> "file" (then ask for path). Strip " (Recommended)" suffix.

If context resolved to "file":
  Use a follow-up AskUserQuestion to ask for the file path:
  ```
  AskUserQuestion:
    questions:
      - id: "debate-file-path"
        header: "File path"
        question: "Which file should both tools see?"
        multiSelect: false
        options:
          - label: "src/"               description: "Source directory file"
          - label: "README.md"          description: "Project readme"
  ```
  The user can type any path via "Other".
  After getting the path:
  1. Reject absolute paths outside the current working directory
  2. Reject paths containing `..` that escape the project root
  3. Reject UNC paths (`\\` or `//` prefix)
  4. Validate the file exists using the Read tool
  If the path escapes the project: `[ERROR] Context file must be within the project directory`
  If the file doesn't exist: `[ERROR] Context file not found: {PATH}`
  If valid, set context to `file={user_provided_path}`.

If proposer and challenger resolve to the same tool after selection, show error and re-ask for challenger.

### Phase 3: Execute Debate

With all parameters resolved (topic, proposer, challenger, effort, rounds, optional model_proposer, model_challenger, context), execute the debate directly.

#### Phase 3a: Load Debate Templates

Invoke the `debate` skill to load prompt templates, context assembly rules, and synthesis format:

```
Skill: debate
Args: "[topic]" --proposer=[proposer] --challenger=[challenger] --rounds=[rounds] --effort=[effort]
```

The skill returns the prompt templates and rules. Use them for all subsequent steps.

#### Phase 3b: Execute Debate Rounds

For each round (1 through N):

**Build Proposer Prompt:**

- **Round 1**: Use the "Round 1: Proposer Opening" template from the skill. Substitute {topic}.
- **Round 2+**: Use the "Round 2+: Proposer Defense" template. Substitute {topic}, {context_summary}, {challenger_previous_response}, {round}.

**Context assembly rules:**
- **Rounds 1-2**: Include full text of all prior exchanges per the skill's context format.
- **Round 3+**: Summarize rounds 1 through {round}-2 (target 500-800 tokens, preserving core positions, key evidence, all concessions as verbatim quotes, points of disagreement, and any contradictions between rounds). Include only the most recent round's responses in full.

**Invoke Proposer via Consult Skill:**

Only include `--model=[model_proposer]` if the user provided a specific model. If model is "omit", empty, or "auto", do NOT pass --model to the consult skill.

```
Skill: consult
Args: "{proposer_prompt}" --tool=[proposer] --effort=[effort] [--model=[model_proposer]] [--context=[context]]
```

Set a 240-second timeout on this invocation. If it exceeds 240s, treat as a tool failure for this round.

Parse the JSON result. Extract the response text. Record: round, role="proposer", tool, response, duration_ms.

If the proposer call fails on round 1, abort: `[ERROR] Debate aborted: proposer ({tool}) failed on opening round. {error}`
If the proposer call fails on round 2+, skip remaining rounds and proceed to Phase 3c (synthesize from completed rounds, note the early stop).

Display to user immediately:
```
--- Round {round}: {proposer_tool} (Proposer) ---

{proposer_response}
```

**Build Challenger Prompt:**

- **Round 1**: Use the "Round 1: Challenger Response" template from the skill. Substitute {topic}, {proposer_tool}, {proposer_round1_response}.
- **Round 2+**: Use the "Round 2+: Challenger Follow-up" template. Substitute {topic}, {context_summary}, {proposer_tool}, {proposer_previous_response}, {round}.

**Invoke Challenger via Consult Skill:**

Only include `--model=[model_challenger]` if the user provided a specific model. If model is "omit", empty, or "auto", do NOT pass --model to the consult skill.

```
Skill: consult
Args: "{challenger_prompt}" --tool=[challenger] --effort=[effort] [--model=[model_challenger]] [--context=[context]]
```

Set a 240-second timeout on this invocation. If it exceeds 240s, treat as a tool failure for this round.

Parse the JSON result. Record: round, role="challenger", tool, response, duration_ms.

If the challenger call fails on round 1, emit `[WARN] Challenger ({tool}) failed on round 1. Proceeding with uncontested proposer position.` then proceed to Phase 3c.
If the challenger call fails on round 2+, skip remaining rounds and proceed to Phase 3c.

Display to user immediately:
```
--- Round {round}: {challenger_tool} (Challenger) ---

{challenger_response}
```

Assemble context for the next round using the context assembly rules above.

#### Phase 3c: Synthesize and Deliver Verdict

After all rounds complete (or after a partial failure), YOU are the JUDGE. Read all exchanges carefully. Use the synthesis format from the debate skill:

1. **Pick a winner.** Which tool made the stronger argument overall? Why? Cite 2-3 specific arguments that were decisive.
2. **List agreements.** What did both tools agree on? Include evidence that supports each agreement.
3. **List disagreements.** Where do they still diverge? What's each side's position?
4. **List unresolved questions.** What did neither side address adequately?
5. **Make a recommendation.** What should the user DO? Be specific and actionable.

**Verdict rules (from the debate skill):**
- You MUST pick a side. "Both approaches have merit" is NOT acceptable.
- Cite specific arguments from the debate as evidence.
- The recommendation must be actionable.
- Be honest about what wasn't resolved.

Display the full synthesis using the format from the debate skill's Synthesis Format section.

#### Phase 3d: Save State

Write the debate state to `{AI_STATE_DIR}/debate/last-debate.json` using the schema from the debate skill.

Platform state directory: use the AI_STATE_DIR environment variable if set. Otherwise:
- Claude Code: `.claude/`
- OpenCode: `.opencode/`
- Codex CLI: `.codex/`

Create the `debate/` subdirectory if it doesn't exist.

## Output Sanitization

Apply the FULL redaction pattern table from the consult skill (`plugins/consult/skills/consult/SKILL.md`, Output Sanitization section). The skill is the canonical source with all 14 patterns. Do NOT maintain a separate subset here.

The consult skill's table covers: Anthropic keys (`sk-*`, `sk-ant-*`), OpenAI project keys (`sk-proj-*`), Google keys (`AIza*`), GitHub tokens (`ghp_*`, `gho_*`, `github_pat_*`), AWS keys (`AKIA*`, `ASIA*`), env assignments (`ANTHROPIC_API_KEY=*`, `OPENAI_API_KEY=*`, `GOOGLE_API_KEY=*`, `GEMINI_API_KEY=*`), and auth headers (`Bearer *`).

Read the consult skill file to get the exact patterns and replacements.

## External Tool Quick Reference

> Canonical source: `plugins/consult/skills/consult/SKILL.md`. This table is for **planning reference only** -- always invoke via `Skill: consult`, which handles safe question passing, temp file creation, and cleanup. Do NOT execute these commands directly.

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
| low | claude-haiku-4-5 (1 turn) | gemini-2.5-flash | o4-mini (low) | default (low) | no control |
| medium | claude-sonnet-4-6 (3 turns) | gemini-3-flash-preview | o4-mini (medium) | default (medium) | no control |
| high | claude-opus-4-6 (5 turns) | gemini-3-pro-preview | o3 (high) | default (high) | no control |
| max | claude-opus-4-6 (10 turns) | gemini-3.1-pro-preview | o3 (high) | default + --thinking | no control |

### Output Parsing

| Provider | Parse Expression |
|----------|-----------------|
| Claude | `JSON.parse(stdout).result` |
| Gemini | `JSON.parse(stdout).response` |
| Codex | `JSON.parse(stdout).message` or raw text |
| OpenCode | Parse JSON events, extract final text block |
| Copilot | Raw stdout text |

## Error Handling

| Error | Output |
|-------|--------|
| No topic provided | `[ERROR] Usage: /debate "your topic" or /debate codex vs gemini about your topic` |
| Tool not installed | `[ERROR] {tool} is not installed. Install with: {install command}` |
| Fewer than 2 tools | `[ERROR] Debate requires at least 2 AI CLI tools installed.` |
| Same tool for both | `[ERROR] Proposer and challenger must be different tools.` |
| Rounds out of range | `[ERROR] Rounds must be 1-5. Got: {rounds}` |
| Context file not found | `[ERROR] Context file not found: {PATH}` |
| Proposer fails round 1 | `[ERROR] Debate aborted: proposer ({tool}) failed on opening round. {error}` |
| Challenger fails round 1 | `[WARN] Challenger ({tool}) failed on round 1. Proceeding with uncontested proposer position.` Then synthesize from available exchanges. |
| Any tool fails mid-debate | Synthesize from completed rounds. Note the incomplete round in output. |
| Tool invocation timeout (>240s) | Round 1 proposer: abort with `[ERROR] Debate aborted: proposer ({tool}) timed out after 240s`. Round 1 challenger: proceed with uncontested position. Round 2+: synthesize from completed rounds, note `[WARN] {role} ({tool}) timed out in round {N}`. |
| All rounds timeout | `[ERROR] Debate failed: all tool invocations timed out.` |

## Example Usage

```bash
# Natural language
/debate codex vs gemini about microservices vs monolith
/debate with claude and codex about our auth implementation
/debate thoroughly gemini vs codex about database schema design
/debate codex vs gemini 3 rounds about event sourcing

# Explicit flags
/debate "Should we use event sourcing?" --tools=claude,gemini --rounds=3 --effort=high
/debate "Redis vs PostgreSQL for caching" --tools=codex,opencode

# Mixed
/debate codex vs gemini --effort=max about performance optimization strategies
```
