---
description: Structured performance investigation with baselines, profiling, and evidence-backed decisions
agent: general
---

> **OpenCode Note**: Invoke agents using `@agent-name` syntax.
> Available agents: task-discoverer, exploration-agent, planning-agent,
> implementation-agent, deslop-agent, delivery-validator, sync-docs-agent, consult-agent
> Example: `@exploration-agent analyze the codebase`


# /perf - Performance Investigation Workflow

Run a rigorous, evidence-driven performance investigation with strict rules, baselines, and reproducible benchmarks.

## Canonical Requirements

Check whether `docs/perf-requirements.md` and `docs/perf-research-methodology.md` exist in the current repo (they exist in the agentsys repo). If present, read them and follow them as the source of truth. If absent, proceed with the phase workflow below as written.

## Arguments

- `--resume`: Continue the latest investigation from `{state-dir}/perf/investigation.json`
- `--phase <phase>`: Force starting phase (use only when resuming)
- `--id <id>`: Set investigation id (new only)
- `--scenario <text>`: Short scenario description
- `--command <cmd>`: Benchmark command (prints PERF_METRICS markers)
- `--version <ver>`: Baseline version label
- `--duration <seconds>`: Benchmark duration override (default 60s; use smaller values for micro-benchmarks)
- `--runs <n>`: Number of runs for start-to-end benchmarks (use with median aggregation)
- `--aggregate <median|mean|min|max>`: Aggregation method for multi-run benchmarks (default median)
- `--quote <text>`: User quote to record in logs
- `--hypotheses-file <path>`: JSON file with hypothesis list (for hypotheses phase)
- `--param-env <name>`: Env var for breaking-point value (default PERF_PARAM_VALUE)
- `--param-min <n>`: Breaking-point min value (default 1)
- `--param-max <n>`: Breaking-point max value (default 500)
- `--cpu <limit>`: Constraint CPU limit (default 1)
- `--memory <limit>`: Constraint memory limit (default 1GB)
- `--change <summary>`: Optimization change summary
- `--verdict <continue|stop>`: Decision verdict
- `--rationale <text>`: Decision rationale

## Phase 1: Initialize Investigation State

*(JavaScript reference - not executable in OpenCode)*

## Output

- Updated `{state-dir}/perf/investigation.json`
- Investigation log at `{state-dir}/perf/investigations/<id>.md`
- Baseline files at `{state-dir}/perf/baselines/<version>.json`

Begin the performance investigation now.