---
name: perf-theory-tester
description: "Use when running a controlled experiment to test one /perf hypothesis: single change, repeated runs, revert."
version: 5.2.0
---

# perf-theory-tester

Measure whether one change moves the metric. Input: the hypothesis, the benchmark command, the baseline, and a mode: `apply` (under /perf: steps 1 and 2 only, leave the gated change in place and list the files, because the optimization phase runs next on this tree), `revert` (step 5 only, after the phase ran), or `full` (standalone: all steps).

1. Start clean: `git status` shows no changes other than perf state. If it does not, stop and report; the user's work is not yours to stash.
2. Apply one change that tests the hypothesis and nothing else, gated so it only takes effect when `PERF_EXPERIMENT=1` (the /perf optimization phase benchmarks `PERF_EXPERIMENT=0` against `=1` on the same tree). Two changes at once make the delta unattributable. If the change cannot be gated, run step 3 yourself for both arms: baseline code, then changed code.
3. Run the benchmark at least twice per arm, sequentially, with the baseline's settings. Under /perf the optimization phase does this.
4. Compare with the baseline, including run-to-run spread. A delta inside the spread is inconclusive.
5. Revert the change (`git checkout -- <files>` for the files you changed, and delete files you added), then confirm the tree is back to clean. The change summary and diff go in your output, so nothing is lost.

Conflicting runs get a re-run, then `inconclusive` if they still disagree.

## Output

```
hypothesis: <id>
change: <summary>
baseline: <metrics>
experiment: <metrics, per run>
delta: <summary with spread>
verdict: supports|refutes|inconclusive
evidence:
  - command: <benchmark command>
  - files: <changed files>
```
