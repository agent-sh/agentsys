---
description: This skill should be used when the user asks to "clean up slop", "remove AI artifacts", "deslop the codebase", "find debug statements", "remove console.logs", "repo hygiene", or mentions "AI slop", "code cleanup", "slop detection".
argument-hint: "[report|apply] [--scope=path] [--thoroughness=quick|normal|deep]"
allowed-tools: Task, Read
---

# /deslop - AI Slop Cleanup

Senior maintainer performing periodic repo hygiene. Mission: remove AI-generated slop while preserving behavior and minimizing diffs.

## Constraints (Priority Order)

When constraints conflict, follow this priority:

1. **Preserve behavior and public APIs** (highest priority)
2. **Minimal diffs** - do not reformat unrelated code
3. **Prefer deletion over invention**
4. **No new dependencies or abstractions**
5. **Respect repo conventions** (check CLAUDE.md/AGENTS.md)

## Arguments

Parse from $ARGUMENTS or use defaults:

- **Mode**: `report` (default) or `apply`
- **Scope**: `all` (default), `diff`, or path
- **Thoroughness**: `quick`, `normal` (default), or `deep`

## Execution

### Phase 1: Spawn Deslop Agent

```javascript
// Parse arguments
const args = '$ARGUMENTS'.split(' ').filter(Boolean);
const mode = args.includes('apply') ? 'apply' : 'report';
const thoroughness = args.find(a => a.startsWith('--thoroughness='))?.split('=')[1] || 'normal';
const scope = args.find(a => a.startsWith('--scope='))?.split('=')[1] ||
              args.find(a => !a.startsWith('-') && a !== 'report' && a !== 'apply') || 'all';

// Spawn agent to get findings
const result = await Task({
  subagent_type: "deslop:deslop-agent",
  prompt: `Scan for AI slop patterns.
Mode: ${mode}
Scope: ${scope}
Thoroughness: ${thoroughness}

Return structured results between === DESLOP_RESULT === markers.`
});
```

### Phase 2: Parse Agent Results

Extract structured JSON from agent output:

```javascript
function parseDeslop(output) {
  const match = output.match(/=== DESLOP_RESULT ===[\s\S]*?({[\s\S]*?})[\s\S]*?=== END_RESULT ===/);
  return match ? JSON.parse(match[1]) : { fixes: [] };
}

const findings = parseDeslop(result);
```

### Phase 3: Handle Mode

#### Report Mode (Default)

Present findings as markdown table:

```markdown
## Slop Hotspots

| Priority | File | Issue | Certainty | Fix |
|----------|------|-------|-----------|-----|
| 1 | src/api.js:42 | console.log | HIGH | auto |
| 2 | src/auth.js:15 | empty catch | HIGH | auto |
| 3 | lib/utils.js:88 | excessive comments | MEDIUM | review |

## Summary

- **HIGH certainty**: N (auto-fixable)
- **MEDIUM certainty**: N (review required)
- **LOW certainty**: N (flagged only)

## Do Next

- [ ] Run `/deslop apply` to auto-fix HIGH certainty items
- [ ] Review MEDIUM certainty items manually
```

#### Apply Mode

If fixes array is non-empty, spawn simple-fixer:

```javascript
if (mode === 'apply' && findings?.fixes?.length > 0) {
  await Task({
    subagent_type: "next-task:simple-fixer",
    model: "haiku",
    prompt: `Apply these slop fixes:
${JSON.stringify(findings.fixes, null, 2)}

For each fix:
- remove-line: Delete the line at the specified line number
- add-comment: Add "// Error intentionally ignored" to empty catch
- remove-block: Delete the entire code block

Use Edit tool to apply. Commit message: "fix: clean up AI slop (auto-applied)"`
  });
}
```

Present results:

```markdown
## Applied Fixes

| File | Line | Fix |
|------|------|-----|
| src/api.js | 42 | remove-line (console.log) |
| src/auth.js | 15 | add-comment (empty catch) |

**Total**: N fixes applied

## Remaining (manual review needed)

| File | Line | Issue | Certainty |
|------|------|-------|-----------|
| lib/utils.js | 88 | excessive comments | MEDIUM |
```

## Verification Strategy

After fixes are applied, run project's test command:

```bash
npm test
# or pytest, cargo test, go test ./...
```

On failure: `git restore .` and report which change failed.

## Ignore Zones

Skip these paths (handled by detection script):
- Build artifacts: `dist/`, `build/`, `target/`, `out/`, `.next/`
- Vendored: `vendor/`, `node_modules/`, `**/*.min.*`
- Generated: `**/*.gen.*`, lockfiles

## Error Handling

- Git not available: Exit with "Git required for rollback safety"
- Invalid scope path: Exit with "Path not found: <path>"
- Verification fails: Rollback with `git restore .`, report failure

## Additional Resources

### Reference Files

For detailed pattern documentation, consult:
- **`references/slop-categories.md`** - All pattern categories, severity levels, certainty thresholds, auto-fix strategies

### Scripts

- **`scripts/detect.js`** - Detection pipeline CLI (run with `--help` for options)
</path>