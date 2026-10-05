---
name: validate-delivery
description: "Use when the user asks to validate delivery, check readiness, or verify a branch is done. Runs tests and build, checks the task's requirements and review status, returns approve or fix instructions."
version: 0.2.0
---

# validate-delivery

Decide, without asking anyone, whether the branch is ready to ship, and if not, say exactly what to fix. This gate runs after review and before docs sync.

`<plugin>` is this plugin's root, two directories up from this skill.

## Inputs

From the caller: the base ref, the changed and deleted files, the review outcome, and the task description when there is one. In the `/next-task` flow the flow state (`{stateDir}/flow.json`) has `task` and `reviewResult`. Missing context: run `node <plugin>/scripts/delivery.js context` for base, `changedFiles`, `deletedFiles` and `diffRisk`.

## Checks

| Check | Passes when |
|---|---|
| `reviewClean` | the review approved, was skipped by flag, or the user overrode it. A pipeline caller that passes no review outcome fails this check, because a gate was skipped. A user asking directly gets `"notRun": true` and a pass. |
| `testsPassing` | the repo's test command exits 0. Find it the way a maintainer would: `package.json` scripts, `Cargo.toml`, `go.mod`, `pyproject.toml` or `pytest.ini`, a Makefile target, CI config. No test suite at all passes with a note. |
| `buildPassing` | the build or type check exits 0 (`npm run build`, `cargo build`, `go build ./...`, `tsc --noEmit`). No build step passes with a note. |
| `requirementsMet` | each requirement in the task description is implemented in the diff. Read the task, then the diff; a bullet list is a hint, not the only source. No task description passes with a note. |
| `noRegressions` | the branch does not delete (check `deletedFiles`), skip or weaken existing tests (`.skip`, `xit`, `#[ignore]`, `@pytest.mark.skip`, removed assertions) without a stated reason in the commit or task. |
| `diffRisk` | always passes; advisory. |

Run tests and build on the working tree as it is. Do not stash, reset or check out other refs to compare: the user's uncommitted work lives there.

`diffRisk` uses repo-intel scores for the changed files. Files over 0.6 need evidence that a test exercises them, not only a green suite; list them in `requiresTestEvidence`, and fail `testsPassing` when you find no such test. Files over 0.7 go in `requiresHumanReview` for the orchestrator to show the user. No map: mark the check skipped.

## Done

Every check has a result. Approve only when all non-advisory checks pass. On a fail, each failed check gets one fix instruction naming the file or command, specific enough that the implementer can act without re-running this skill.

## Output

Return this JSON (with the `/next-task` flow, also record it with `completePhase` on approve or `failPhase('Validation failed', ...)` on fail):

```json
{
  "approved": false,
  "reason": "npm test fails: 2 tests in tests/parse.test.js",
  "checks": {
    "reviewClean": { "passed": true },
    "testsPassing": { "passed": false, "command": "npm test" },
    "buildPassing": { "passed": true, "note": "no build step" },
    "requirementsMet": { "passed": true, "requirements": [{ "requirement": "...", "implemented": true }] },
    "noRegressions": { "passed": true },
    "diffRisk": { "passed": true, "advisory": true, "summary": "1 file at high risk (>0.7)", "requiresTestEvidence": ["lib/core.js"], "requiresHumanReview": ["lib/auth.js"] }
  },
  "failedChecks": ["testsPassing"],
  "fixInstructions": [{ "action": "Fix failing tests", "command": "npm test", "details": "parse() returns undefined for empty input" }],
  "riskSummary": "1 file at high risk (>0.7)"
}
```

Skipped diff risk looks like `{ "passed": true, "advisory": true, "skipped": true, "reason": "no repo-intel map" }`.
