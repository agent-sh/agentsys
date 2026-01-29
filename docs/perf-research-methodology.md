# Performance Research Methodology

This document defines how /perf investigations are executed. It complements perf-requirements.md with process detail.

## 1. Setup

- Confirm scenario, success criteria, and benchmark command.
- Capture the user quote verbatim.
- Record version label for the baseline.

## 2. Baseline

- Run the benchmark for at least 60s.
- Require PERF_METRICS markers in output.
- Parse metrics and store baseline JSON.
- Re-run if results look anomalous.

## 3. Breaking Point

- Use binary search with 30s runs.
- Parameterize via PERF_PARAM_VALUE (or configured env).
- Record the smallest value that fails or degrades beyond thresholds.

## 4. Constraints

- Apply CPU/memory limits (default CPU=1, memory=1GB).
- Measure delta vs baseline and log constraints + deltas.

## 5. Hypotheses

- Read recent git history and relevant code paths.
- Produce up to 5 hypotheses with evidence and confidence.
- No optimization changes in this phase.

## 6. Code Paths

- Use repo-map to identify entrypoints, handlers, and data access layers.
- List top candidate files/symbols for profiling focus.
- Record imports/exports when relevant to show wiring.

## 7. Profiling

- Prefer built-in tools for each language:
  - Node: --cpu-prof
  - Java: JFR
  - Python: cProfile
  - Go: pprof
  - Rust: perf
- Capture artifacts and hotspots; log file:line evidence.

## 8. Optimization

- One change per experiment.
- Run 2+ validation passes per change.
- Revert to baseline before next change.

## 9. Decision

- If improvement is not measurable, recommend stop.
- If improvement exists, document next changes to pursue.

## 10. Consolidation

- Consolidate final baseline and log evidence.
- Mark investigation complete.

## Benchmarks Output Format

Benchmarks must output PERF_METRICS markers using one of these formats:

JSON block markers:

```
PERF_METRICS_START
{"latency_ms":120.5,"throughput_rps":2400}
PERF_METRICS_END
```

Line format markers:

```
PERF_METRICS latency_ms=120.5 throughput_rps=2400
```

Scenario-specific metrics can be emitted as:

```
PERF_METRICS scenario=checkout latency_ms=180.1
```

## Noise Handling

- Re-run if deviation >5% without clear cause.
- Log anomalies and retest before recording results.
- Keep environment stable (no background tasks, same config).
