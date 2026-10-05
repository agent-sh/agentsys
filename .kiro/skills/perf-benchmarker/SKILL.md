---
name: perf-benchmarker
description: "Use when running performance benchmarks, establishing baselines, or validating a regression with sequential runs. Keeps runs sequential and long enough to trust."
version: 5.2.0
argument-hint: "[command] [duration]"
---

# perf-benchmarker

Produce benchmark numbers that can be compared: same command, same conditions, one run at a time. Input (`$ARGUMENTS`): the benchmark command and an optional duration in seconds (default 60).

The command prints its metrics as JSON between `PERF_METRICS_START` and `PERF_METRICS_END` lines. `lib/perf/benchmark-runner.js` (`runBenchmark`, `runBenchmarkSeries`) runs it, enforces the minimum duration, parses the markers, and aggregates repeated runs.

## Constraints

- One benchmark at a time, never in parallel: concurrent runs compete for the same CPU, memory and caches.
- 60s per run by default, 30s inside a breaking-point search. For start-to-end benchmarks, run several one-shot executions (`runs`) and aggregate with the median. Shorter runs only for micro-benchmarks, and say so.
- Warm up (10s or the benchmark's own warmup) before measuring.
- Do not change code while benchmarking.
- Re-run any result that looks anomalous, and report the spread across runs.

## Output

```
command: <benchmark command>
duration: <seconds or runs x one-shot>
warmup: <seconds>
results: <metrics, with spread>
notes: <anomalies and re-runs>
```
