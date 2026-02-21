#!/usr/bin/env node
/**
 * Setup git hooks for development
 * - pre-commit: Placeholder (lib/ sync handled by agent-core CI)
 * - pre-push: Runs preflight checks, /enhance reminder, release validation
 */

const fs = require('fs');
const path = require('path');

const hookDir = path.join(__dirname, '..', '.git', 'hooks');
const preCommitPath = path.join(hookDir, 'pre-commit');
const prePushPath = path.join(hookDir, 'pre-push');

const preCommitHook = `#!/bin/sh
# Pre-commit hook (lib/ sync now handled by agent-core)
`;

const prePushHook = `#!/bin/sh
# Pre-push validations:
# 1. Run preflight checks (validators + gap checks)
# 2. Warn if agents/skills/hooks/prompts modified (run /enhance)
# 3. Block version tag pushes until release preflight passes
# See: CLAUDE.md Critical Rule #7, checklists/release.md

REPO_ROOT=\$(git rev-parse --show-toplevel)

echo ""
echo "=============================================="
echo "  Pre-Push Validation"
echo "=============================================="
echo ""

# Step 1: Run preflight checks (replaces validate + agent-skill compliance)
echo "[1/3] Running preflight checks..."
if ! node "\$REPO_ROOT/scripts/preflight.js"; then
  echo ""
  echo "[ERROR] BLOCKED: Preflight checks failed"
  echo "   Fix issues and try again"
  echo "   Skip: git push --no-verify"
  exit 1
fi
echo ""

# Step 2: Check for modified agents/skills/hooks/prompts (/enhance reminder)
echo "[2/3] Checking for enhanced content modifications..."
modified_files=\$(git diff --name-only origin/\$(git remote show origin | grep "HEAD branch" | cut -d' ' -f5)..HEAD 2>/dev/null || git diff --name-only HEAD~1..HEAD)

agents_modified=\$(echo "\$modified_files" | grep -E "agents/.*\\.md\$" || true)
skills_modified=\$(echo "\$modified_files" | grep -E "skills/.*/SKILL\\.md\$" || true)
hooks_modified=\$(echo "\$modified_files" | grep -E "hooks/.*\\.md\$" || true)
prompts_modified=\$(echo "\$modified_files" | grep -E "prompts/.*\\.md\$" || true)

if [ -n "\$agents_modified" ] || [ -n "\$skills_modified" ] || [ -n "\$hooks_modified" ] || [ -n "\$prompts_modified" ]; then
  echo ""
  echo "CLAUDE.md Critical Rule #7 requires running /enhance"
  echo "on modified agents, skills, hooks, or prompts."
  echo ""
  echo "Modified files:"
  echo "\$agents_modified\$skills_modified\$hooks_modified\$prompts_modified"
  echo ""
  # Check for env var first (for non-interactive/CI contexts)
  if [ "\$ENHANCE_CONFIRMED" = "1" ]; then
    echo "[OK] /enhance confirmed via ENHANCE_CONFIRMED=1"
  elif [ -t 0 ]; then
    # Interactive mode - prompt user
    read -p "Have you run /enhance on these files? (y/N) " response
    if [ "\$response" != "y" ] && [ "\$response" != "Y" ]; then
      echo "[BLOCKED] Run /enhance first"
      echo "   Skip: ENHANCE_CONFIRMED=1 git push"
      exit 1
    fi
    echo "[OK] /enhance confirmed"
  else
    # Non-interactive, no env var - block
    echo "[BLOCKED] Run /enhance first"
    echo "   For non-interactive: ENHANCE_CONFIRMED=1 git push"
    exit 1
  fi
else
  echo "[OK] No enhanced content modified"
fi
echo ""

# Step 3: Check if pushing a version tag (v*)
echo "[3/3] Checking for version tag..."
pushing_tag=false
while read local_ref local_sha remote_ref remote_sha; do
  if echo "\$local_ref" | grep -q "^refs/tags/v"; then
    pushing_tag=true
    tag_name=\$(echo "\$local_ref" | sed 's|refs/tags/||')
    break
  fi
done

if [ "\$pushing_tag" = "false" ]; then
  echo "[OK] No version tag detected"
  echo ""
  echo "=============================================="
  echo "  [OK] Pre-Push Validation PASSED"
  echo "=============================================="
  echo ""
  exit 0
fi

echo ""
echo "=============================================="
echo "  RELEASE TAG DETECTED: \$tag_name"
echo "=============================================="
echo ""
echo "Running release preflight checks..."
echo ""

if ! node "\$REPO_ROOT/scripts/preflight.js" --release; then
  echo ""
  echo "[ERROR] BLOCKED: Release preflight failed"
  echo "   Fix issues and try again"
  exit 1
fi

echo ""
echo "=============================================="
echo "  [OK] Release preflight validation PASSED"
echo "=============================================="
echo ""
echo "Reminder: Did you also verify cross-platform?"
echo "  See: checklists/release.md"
echo ""
`;

function main() {
  // Only run in git repo (not when installed as npm package)
  if (!fs.existsSync(hookDir)) {
    // Not a git repo or installed as dependency - skip silently
    return 0;
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

  return 0;
}

if (require.main === module) {
  const code = main();
  if (typeof code === 'number') process.exit(code);
}

module.exports = { main };
