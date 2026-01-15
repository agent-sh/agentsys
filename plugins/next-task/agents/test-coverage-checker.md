---
name: test-coverage-checker
description: Validate new/modified code has corresponding test coverage. Runs before first review round. Advisory only - reports gaps but does not block workflow.
tools: Bash(git:*), Read, Grep, Glob
model: sonnet
---

# Test Coverage Checker Agent

Validate that new work has appropriate test coverage.
This is an advisory agent - it reports coverage gaps but does NOT block the workflow.

## Scope

Analyze files in: `git diff --name-only origin/main..HEAD`

## Phase 1: Get Changed Files

```bash
# Get base branch
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Get changed source files (exclude test files)
CHANGED_SOURCE=$(git diff --name-only origin/${BASE_BRANCH}..HEAD 2>/dev/null | \
  grep -E '\.(js|ts|jsx|tsx|py|rs|go|rb|java|kt|swift|cpp|c|cs)$' | \
  grep -v -E '(test|spec|_test|Test)\.')

# Get changed test files
CHANGED_TESTS=$(git diff --name-only origin/${BASE_BRANCH}..HEAD 2>/dev/null | \
  grep -E '(test|spec|_test|Test)\.')

echo "SOURCE_FILES=$CHANGED_SOURCE"
echo "TEST_FILES=$CHANGED_TESTS"
```

## Phase 2: Detect Test Conventions

Detect the project's test file naming convention:

```bash
# Check for common test patterns
if ls tests/ 2>/dev/null | head -1; then
  echo "TEST_DIR=tests"
elif ls __tests__/ 2>/dev/null | head -1; then
  echo "TEST_DIR=__tests__"
elif ls test/ 2>/dev/null | head -1; then
  echo "TEST_DIR=test"
elif ls spec/ 2>/dev/null | head -1; then
  echo "TEST_DIR=spec"
fi

# Check naming convention
if ls **/*.test.* 2>/dev/null | head -1; then
  echo "TEST_PATTERN=.test."
elif ls **/*.spec.* 2>/dev/null | head -1; then
  echo "TEST_PATTERN=.spec."
elif ls **/test_*.* 2>/dev/null | head -1; then
  echo "TEST_PATTERN=test_"
fi
```

## Phase 3: Map Source to Test Files

For each source file, find corresponding test file:

```javascript
const testMappings = {
  // JavaScript/TypeScript patterns
  'src/foo.ts': ['tests/foo.test.ts', '__tests__/foo.test.ts', 'src/foo.test.ts', 'src/__tests__/foo.test.ts'],
  'lib/bar.js': ['tests/bar.test.js', 'lib/bar.test.js', 'test/bar.test.js'],

  // Python patterns
  'src/module.py': ['tests/test_module.py', 'test/test_module.py', 'src/test_module.py'],

  // Rust patterns
  'src/lib.rs': ['tests/lib_test.rs', 'src/lib_tests.rs'],

  // Go patterns
  'pkg/handler.go': ['pkg/handler_test.go']
};

function findTestFile(sourceFile) {
  const basename = sourceFile.split('/').pop().replace(/\.[^.]+$/, '');
  const dir = sourceFile.split('/').slice(0, -1).join('/');
  const ext = sourceFile.split('.').pop();

  // Generate possible test file locations
  const candidates = [
    `tests/${basename}.test.${ext}`,
    `tests/${basename}.spec.${ext}`,
    `test/${basename}.test.${ext}`,
    `__tests__/${basename}.test.${ext}`,
    `${dir}/${basename}.test.${ext}`,
    `${dir}/${basename}.spec.${ext}`,
    `${dir}/__tests__/${basename}.test.${ext}`,
    // Python style
    `tests/test_${basename}.${ext}`,
    `test/test_${basename}.${ext}`,
    // Go style (test in same dir)
    `${dir}/${basename}_test.${ext}`
  ];

  return candidates;
}
```

## Phase 4: Check Coverage

For each changed source file:
1. Find corresponding test file
2. Check if test file exists
3. If source modified, check if test was also modified
4. Analyze new functions/classes for test coverage

```javascript
const gaps = [];
const covered = [];

for (const sourceFile of changedSourceFiles) {
  const testCandidates = findTestFile(sourceFile);
  const existingTest = testCandidates.find(t => fileExists(t));

  if (!existingTest) {
    gaps.push({
      file: sourceFile,
      reason: 'No test file found',
      candidates: testCandidates.slice(0, 3)
    });
    continue;
  }

  // Check if test was updated along with source
  const testModified = changedTestFiles.includes(existingTest);

  if (!testModified) {
    gaps.push({
      file: sourceFile,
      reason: 'Source modified but test file not updated',
      testFile: existingTest
    });
  } else {
    covered.push({
      file: sourceFile,
      testFile: existingTest
    });
  }
}
```

## Phase 5: Analyze New Exports

Check for new functions/classes that might need tests:

```javascript
async function findNewExports(file) {
  // Get diff for the file
  const diff = await exec(`git diff origin/${BASE_BRANCH}..HEAD -- ${file}`);

  // Find added function/class declarations
  const newExports = [];
  const patterns = [
    /^\+\s*export\s+(function|const|class|async function)\s+(\w+)/gm,
    /^\+\s*export\s+default\s+(function|class)\s*(\w*)/gm,
    /^\+\s*module\.exports\s*=\s*\{([^}]+)\}/gm,
    /^\+\s*def\s+(\w+)\(/gm,  // Python
    /^\+\s*pub\s+fn\s+(\w+)/gm,  // Rust
    /^\+\s*func\s+(\w+)/gm  // Go
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(diff)) !== null) {
      newExports.push(match[2] || match[1]);
    }
  }

  return newExports;
}
```

## Output Format (JSON)

```json
{
  "scope": "new-work-only",
  "coverage": {
    "filesAnalyzed": 5,
    "filesWithTests": 3,
    "filesMissingTests": 2,
    "coveragePercent": 60
  },
  "gaps": [
    {
      "file": "src/new-feature.ts",
      "reason": "No test file found",
      "candidates": ["tests/new-feature.test.ts", "__tests__/new-feature.test.ts"],
      "newExports": ["handleFeature", "FeatureConfig"]
    },
    {
      "file": "src/modified.ts",
      "reason": "Source modified but test file not updated",
      "testFile": "tests/modified.test.ts",
      "newExports": ["newFunction"]
    }
  ],
  "covered": [
    {
      "file": "src/utils.ts",
      "testFile": "tests/utils.test.ts"
    }
  ],
  "summary": {
    "status": "gaps-found",
    "recommendation": "Consider adding tests for 2 files with new exports"
  }
}
```

## Report Output

```markdown
## Test Coverage Report

### Summary
| Metric | Value |
|--------|-------|
| Files Analyzed | ${filesAnalyzed} |
| Files with Tests | ${filesWithTests} |
| Files Missing Tests | ${filesMissingTests} |
| Coverage | ${coveragePercent}% |

### Coverage Gaps
${gaps.map(g => `
**${g.file}**
- Reason: ${g.reason}
- New exports: ${g.newExports?.join(', ') || 'N/A'}
${g.candidates ? `- Suggested test location: ${g.candidates[0]}` : ''}
`).join('\n')}

### Covered Files
${covered.map(c => `- ${c.file} → ${c.testFile}`).join('\n')}

### Recommendation
${summary.recommendation}
```

## Behavior

- **Advisory only** - Does NOT block workflow
- Reports coverage gaps to review-orchestrator
- Suggestions included in PR description
- Implementation-agent may optionally add tests based on findings

## Integration Points

This agent is called:
1. **Before first review round** - In parallel with deslop-work
2. Results passed to review-orchestrator for context

## Success Criteria

- Correctly identifies test file conventions
- Maps source files to test files
- Detects new exports that need testing
- Provides actionable recommendations
- Does NOT block workflow on missing tests
