---
name: perf-baseline-manager
description: "Use when storing, comparing, or consolidating /perf baselines. Keeps exactly one baseline JSON per version."
version: 5.2.0
---

# perf-baseline-manager

Baselines are the reference every /perf comparison uses, so there is exactly one per version: `<stateDir>/perf/baselines/<version>.json`, holding the benchmark command, the metrics, and environment metadata (machine, runtime version, relevant config). Writing a baseline for an existing version replaces it. Two files for one version would make every comparison ambiguous.

Use `lib/perf/baseline-store.js` (`writeBaseline`, `readBaseline`, `getBaselinePath`) and `lib/perf/baseline-comparator.js` for comparisons, rather than editing the JSON by hand. `/perf`'s phase script already writes the baseline in the baseline phase and consolidates it at the end.

## Output

```
baseline_version: <version>
metrics: <summary>
file: <path>
```
