---
name: validate-delivery
description: "Use when user asks to \"validate delivery\", \"check readiness\", or \"verify completion\". Runs tests, build, and requirement checks with pass/fail instructions."
version: 5.1.0
---

# validate-delivery

Autonomously validate that a task is complete and ready to ship.

## Validation Checks

### Check 1: Review Status

*(JavaScript reference - not executable in OpenCode)*

### Check 2: Tests Pass

```bash
# Detect test runner and run
if grep -q '"test"' package.json; then
  npm test; TEST_EXIT_CODE=$?
elif [ -f "pytest.ini" ]; then
  pytest; TEST_EXIT_CODE=$?
elif [ -f "Cargo.toml" ]; then
  cargo test; TEST_EXIT_CODE=$?
elif [ -f "go.mod" ]; then
  go test ./...; TEST_EXIT_CODE=$?
else
  TEST_EXIT_CODE=0  # No tests
fi
```

### Check 3: Build Passes

```bash
if grep -q '"build"' package.json; then
  npm run build; BUILD_EXIT_CODE=$?
elif [ -f "Cargo.toml" ]; then
  cargo build --release; BUILD_EXIT_CODE=$?
elif [ -f "go.mod" ]; then
  go build ./...; BUILD_EXIT_CODE=$?
else
  BUILD_EXIT_CODE=0  # No build step
fi
```

### Check 4: Requirements Met

*(JavaScript reference - not executable in OpenCode)*

### Check 5: No Regressions

```bash
# Compare test counts before/after changes
git stash
BEFORE=$(npm test 2>&1 | grep -oE '[0-9]+ passing' | grep -oE '[0-9]+')
git stash pop
AFTER=$(npm test 2>&1 | grep -oE '[0-9]+ passing' | grep -oE '[0-9]+')
[ "$AFTER" -lt "$BEFORE" ] && REGRESSION=true || REGRESSION=false
```

## Aggregate Results

*(JavaScript reference - not executable in OpenCode)*

## Decision and Output

### If All Pass

- Call `workflowState.completePhase(result)` to advance workflow state


### If Any Fail

*(JavaScript reference - not executable in OpenCode)*

## Fix Instructions Generator

*(JavaScript reference - not executable in OpenCode)*

## Output Format

```json
{
  "approved": true|false,
  "checks": {
    "reviewClean": { "passed": true },
    "testsPassing": { "passed": true },
    "buildPassing": { "passed": true },
    "requirementsMet": { "passed": true },
    "noRegressions": { "passed": true }
  },
  "failedChecks": [],
  "fixInstructions": []
}
```

## Constraints

- NO human intervention - fully autonomous
- Returns structured JSON for orchestrator
- Generates specific fix instructions on failure
- Workflow retries automatically after fixes
