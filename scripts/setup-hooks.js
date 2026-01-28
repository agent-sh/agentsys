#!/usr/bin/env node
/**
 * Setup git hooks for development
 * - pre-commit: Auto-syncs lib/ to plugins/
 * - pre-push: Blocks version tag pushes until validation passes
 */

const fs = require('fs');
const path = require('path');

const hookDir = path.join(__dirname, '..', '.git', 'hooks');
const preCommitPath = path.join(hookDir, 'pre-commit');
const prePushPath = path.join(hookDir, 'pre-push');

const preCommitHook = `#!/bin/sh
# Auto-sync lib/ to plugins/ when lib/ files are staged

if git diff --cached --name-only | grep -q "^lib/"; then
  echo "lib/ changes detected, syncing to plugins..."
  bash scripts/sync-lib.sh
  git add plugins/*/lib/
  echo "Synced and staged plugin lib/ copies"
fi
`;

const prePushHook = `#!/bin/sh
# Block version tag pushes until release checklist validation passes
# See: checklists/release.md

# Check if pushing a version tag (v*)
pushing_tag=false
while read local_ref local_sha remote_ref remote_sha; do
  if echo "$local_ref" | grep -q "^refs/tags/v"; then
    pushing_tag=true
    tag_name=$(echo "$local_ref" | sed 's|refs/tags/||')
    break
  fi
done

if [ "$pushing_tag" = "false" ]; then
  exit 0
fi

echo ""
echo "=============================================="
echo "  RELEASE TAG DETECTED: $tag_name"
echo "=============================================="
echo ""
echo "Running release checklist validation..."
echo ""

# 1. Run validation
echo "[1/3] Running npm run validate..."
if ! npm run validate --silent; then
  echo ""
  echo "❌ BLOCKED: Validation failed"
  echo "   Fix issues and try again"
  exit 1
fi
echo "✓ Validation passed"

# 2. Run tests
echo ""
echo "[2/3] Running npm test..."
if ! npm test --silent 2>/dev/null; then
  echo ""
  echo "❌ BLOCKED: Tests failed"
  echo "   Fix failing tests and try again"
  exit 1
fi
echo "✓ Tests passed"

# 3. Verify package builds
echo ""
echo "[3/3] Running npm pack --dry-run..."
if ! npm pack --dry-run --silent 2>/dev/null; then
  echo ""
  echo "❌ BLOCKED: Package build failed"
  echo "   Fix package issues and try again"
  exit 1
fi
echo "✓ Package builds correctly"

echo ""
echo "=============================================="
echo "  ✅ Release checklist validation PASSED"
echo "=============================================="
echo ""
echo "Reminder: Did you also verify cross-platform?"
echo "  See: checklists/release.md"
echo ""
`;

// Only run in git repo (not when installed as npm package)
if (!fs.existsSync(hookDir)) {
  // Not a git repo or installed as dependency - skip silently
  process.exit(0);
}

try {
  fs.writeFileSync(preCommitPath, preCommitHook, { mode: 0o755 });
  console.log('Git pre-commit hook installed');
} catch (err) {
  // Non-fatal - might not have write permissions
  console.warn('Could not install pre-commit hook:', err.message);
}

try {
  fs.writeFileSync(prePushPath, prePushHook, { mode: 0o755 });
  console.log('Git pre-push hook installed (release tag validation)');
} catch (err) {
  // Non-fatal - might not have write permissions
  console.warn('Could not install pre-push hook:', err.message);
}
