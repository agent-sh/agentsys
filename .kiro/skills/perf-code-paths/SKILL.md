---
name: perf-code-paths
description: "Use when mapping the code paths, entry points, and likely hot files for a performance scenario before profiling."
version: 5.2.0
---

# perf-code-paths

Find the code a performance scenario actually runs, so profiling and hypotheses start in the right place. Use the repo map when it exists (`/repo-intel init` creates it; `lib/perf/code-paths.js` `collectCodePaths` matches scenario keywords against it). Otherwise search for the entry point the scenario exercises (route, handler, CLI command, job) and follow the calls.

Keep to the 10 to 15 most relevant files. Include the call chain when it explains why a file matters. Supported languages: Rust, Java, JavaScript and TypeScript, Go, Python.

## Output

```
keywords: <comma-separated>
paths:
  - file: <path>
    symbols: [<symbol>, ...]
    evidence: <why this file is on the path>
```
