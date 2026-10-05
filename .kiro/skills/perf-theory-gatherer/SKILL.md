---
name: perf-theory-gatherer
description: "Use when generating performance hypotheses for a scenario, backed by git history, measurements, and code evidence."
version: 5.2.0
---

# perf-theory-gatherer

Propose at most 5 explanations for the scenario, ranked by how likely they are and how cheap they are to test. Hypotheses only: the fix comes after an experiment confirms one.

Start from what changed: read recent git history for the paths involved (a recent change is the most likely cause of a regression). Then use what the investigation already measured: baseline, breaking point, constraint deltas, and the pain spots in `repoIntelContext` in `<stateDir>/perf/investigation.json`, if setup found any. Look at the code on the scenario's path. Every hypothesis names its evidence: a commit, a `file:line`, or a measurement.

## Output

Write this JSON (the caller saves it and passes it to `/perf --hypotheses-file`):

```json
{
  "hypotheses": [
    { "id": "H1", "hypothesis": "<short>", "evidence": "<commit, file:line, or measurement>", "confidence": "low|medium|high" }
  ]
}
```
