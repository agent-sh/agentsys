# Performance Investigation Requirements

This is the canonical contract for the /perf workflow. All agents, skills, hooks, and commands must follow these rules.

## Non-Negotiable Rules

1. Run benchmarks sequentially (never in parallel).
2. Default minimum run duration is 60s (30s for binary search in breaking-point phase). For single-run benchmarks (start-to-end), use an explicit run-count (e.g. 3 runs with median aggregation) instead of time padding; record the run count + aggregation in logs. Shorter durations are allowed only for micro-benchmarks with explicit user approval and must be recorded in logs.
3. Change one thing at a time; revert to baseline between experiments.
4. Start narrow and expand only with explicit user approval.
5. Verify anomalies by re-running.
6. Establish a clean baseline before any experiment.
7. Keep resource use minimal and repeatable.
8. Check git history before hypotheses or changes.
9. Clarify terminology before acting on ambiguous requests.
10. Write logs + checkpoint commit after every phase.

## Required Phases

1. Setup and clarification
2. Baseline establishment
3. Breaking point discovery (binary search)
4. Constraint testing (CPU/memory limits)
5. Hypothesis generation
6. Code-path analysis
7. Profiling (CPU/memory/JFR/perf)
8. Optimization experiments
9. Decision point (continue/stop)
10. Consolidation

## Evidence Requirements

Every phase log must include:
- Exact user quote (verbatim)
- Phase summary
- Evidence pointers (commands, files, metrics)
- Decision and rationale (when applicable)

## Baseline Requirements

- Baseline command must output PERF_METRICS markers.
- Baseline JSON is stored at {state-dir}/perf/baselines/<version>.json.
- Baseline metrics must be numeric and comparable across runs.
- Benchmarks should honor PERF_RUN_MODE=oneshot by emitting metrics immediately without padding.

## State Requirements

All perf state is stored under {state-dir}/perf/:
- investigation.json
- investigations/<id>.md
- baselines/<version>.json

State directory is platform-specific:
- Claude Code: .claude/
- OpenCode: .opencode/
- Codex CLI: .codex/

## Scope Boundaries

- Only supported languages: Rust, Java, JavaScript, TypeScript, Go, Python.
- Use repo-map and grep for code-path analysis before profiling.
- Profiling artifacts must be captured and referenced in logs.
