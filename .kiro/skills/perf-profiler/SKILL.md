---
name: perf-profiler
description: "Use when profiling CPU or memory hot paths, generating flame graphs, or capturing JFR or perf evidence for a /perf scenario."
version: 5.2.0
argument-hint: "[tool] [command]"
---

# perf-profiler

Find where the time or memory goes, down to `file:line`. Input (`$ARGUMENTS`): an optional profiler and the command to profile. Default to the runtime's built-in profiler: Node `--cpu-prof` or `--heap-prof`, Java JFR, Python cProfile, Go pprof, Rust `perf` with symbols. `lib/perf/profiling-runner.js` (`runProfiling`) picks one from the repo.

Profile the scenario from setup, not the whole program. Check that debug symbols are present first: a profile of stripped frames shows addresses instead of `file:line`. Produce a flame graph or equivalent when the tool supports it.

## Output

```
tool: <profiler>
command: <command>
hotspots:
  - <file:line> - <share of time or memory, and why it matters>
artifacts:
  - <path to profile or flame graph>
```
