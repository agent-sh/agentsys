---
name: debate
description: Structured debate between two AI tools to stress-test ideas. Proposer/Challenger format with a verdict.
codex-description: 'Use when user asks to "debate", "argue about", "compare perspectives", "stress test idea", "devil advocate", "codex vs gemini". Runs structured multi-round debate between two AI tools with proposer/challenger roles.'
argument-hint: "[topic] [--tools=tool1,tool2] [--rounds=N] [--effort=low|medium|high|max]"
allowed-tools: Task, Skill, Bash(where.exe:*), Bash(which:*), Read, Write, AskUserQuestion
---

# /debate - Structured AI Dialectic

You are executing the /debate command. Your job is to parse the user's request, resolve missing parameters interactively, and spawn the debate orchestrator.

## Constraints

- NEVER expose API keys in commands or output
- NEVER run with permission-bypassing flags
- MUST validate tool names against allow-list: gemini, codex, claude, opencode, copilot
- Proposer and challenger MUST be different tools
- Rounds MUST be 1-5 (default: 2)

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
    - header: "Proposer"                         # SKIP if proposer resolved
      question: "Which tool should PROPOSE (argue for)?"
      multiSelect: false
      options (only installed tools):
        - label: "Claude"       description: "Deep code reasoning"
        - label: "Gemini"       description: "Fast multimodal analysis"
        - label: "Codex"        description: "Agentic coding"
        - label: "OpenCode"     description: "Flexible model choice"
        - label: "Copilot"      description: "GitHub-integrated AI"

    - header: "Challenger"                       # SKIP if challenger resolved
      question: "Which tool should CHALLENGE (find flaws)?"
      multiSelect: false
      options (only installed, excluding proposer):
        [same list minus the proposer tool]

    - header: "Effort"                           # SKIP if effort resolved
      question: "What thinking effort level?"
      multiSelect: false
      options:
        - label: "High (Recommended)"    description: "Thorough analysis for debate"
        - label: "Medium"                description: "Balanced speed and quality"
        - label: "Low"                   description: "Fast, minimal reasoning"
        - label: "Max"                   description: "Maximum reasoning depth"

    - header: "Rounds"                           # SKIP if rounds resolved
      question: "How many debate rounds?"
      multiSelect: false
      options:
        - label: "2 (Recommended)"       description: "Propose + challenge + defend + respond"
        - label: "1 (Quick)"             description: "Single propose + challenge"
        - label: "3 (Extended)"          description: "Three full exchanges"
        - label: "5 (Exhaustive)"        description: "Five rounds, deep exploration"

    - header: "Context"                          # SKIP if --context resolved
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
      - header: "File path"
        question: "Which file should both tools see?"
        multiSelect: false
        options:
          - label: "src/"               description: "Source directory file"
          - label: "README.md"          description: "Project readme"
  ```
  The user can type any path via "Other".
  After getting the path, validate it exists using the Read tool.
  If the file doesn't exist: `[ERROR] Context file not found: {PATH}`
  If valid, set context to `file={user_provided_path}`.

If proposer and challenger resolve to the same tool after selection, show error and re-ask for challenger.

### Phase 3: Spawn Debate Orchestrator

With all parameters resolved, spawn the debate orchestrator agent:

```
Task:
  subagent_type: "debate:debate-orchestrator"
  model: opus
  prompt: |
    Execute a structured debate with these pre-resolved parameters:
    - topic: [topic]
    - proposer: [proposer tool]
    - challenger: [challenger tool]
    - effort: [effort]
    - rounds: [rounds]
    - model_proposer: [model or "omit"]
    - model_challenger: [model or "omit"]

    If model is "omit" or empty, do NOT include --model in consult skill invocations. The consult skill will use effort-based defaults.
    - context: [context or "none"]

    Follow the debate skill templates. Display each round progressively.
    Deliver a verdict that picks a winner.
```

### Phase 4: Present Results

Display the orchestrator's output directly. It includes:
- Progressive round-by-round output (displayed as each round completes)
- Final synthesis with verdict, agreements, disagreements, and recommendation

On failure: `[ERROR] Debate Failed: {specific error message}`

## Error Handling

| Error | Output |
|-------|--------|
| No topic provided | `[ERROR] Usage: /debate "your topic" or /debate codex vs gemini about your topic` |
| Tool not installed | `[ERROR] {tool} is not installed. Install with: {install command}` |
| Fewer than 2 tools | `[ERROR] Debate requires at least 2 AI CLI tools installed.` |
| Same tool for both | `[ERROR] Proposer and challenger must be different tools.` |
| Rounds out of range | `[ERROR] Rounds must be 1-5. Got: {rounds}` |
| Context file not found | `[ERROR] Context file not found: {PATH}` |
| Orchestrator fails | `[ERROR] Debate failed: {error}` |

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
