---
name: perf-investigation-logger
description: "Use when appending a structured entry to a /perf investigation log: user quotes, phase summary, evidence, decisions."
version: 5.2.0
---

# perf-investigation-logger

Append one entry per phase to `<stateDir>/perf/investigations/<id>.md` (`stateDir` is `AI_STATE_DIR` if set, else `.claude`). The log is how the investigation gets audited and resumed, so it records what was measured and decided, not a narrative. `lib/perf/investigation-state.js` has an `append<Phase>Log` helper for each phase; the phase script already calls them, so use this skill for notes the script does not capture.

Quote the user verbatim. A paraphrase loses the exact requirement they stated.

## Output

```
## <Phase> - <YYYY-MM-DD>

**User Quote:** "<exact quote>"

**Summary**
- ...

**Evidence**
- Command: `...`
- File: `path:line`

**Decision**
- ...
```
