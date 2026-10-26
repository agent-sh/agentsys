#!/usr/bin/env node
/**
 * Setup git hooks for development
 * - pre-push: Runs preflight checks, agnix on changed agent configs, release validation
 */

const fs = require('fs');
const path = require('path');

const hookDir = path.join(__dirname, '..', '.git', 'hooks');
const prePushPath = path.join(hookDir, 'pre-push');

const prePushHook = `#!/bin/sh
# Pre-push validations:
# 1. Run preflight checks (validators + gap checks)
# 2. Lint modified agents/skills/hooks/prompts with agnix
# 3. Block version tag pushes until release preflight passes
# See: AGENTS.md Critical Rule #7, checklists/release.md

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

# Step 2: Lint modified agents/skills/hooks/prompts with agnix
echo "[2/3] Linting modified agent configs with agnix..."
modified_files=\$(git diff --name-only --diff-filter=d origin/\$(git remote show origin | grep "HEAD branch" | cut -d' ' -f5)..HEAD 2>/dev/null || git diff --name-only --diff-filter=d HEAD~1..HEAD)
config_files=\$(echo "\$modified_files" | grep -E "(agents/.*\\.md|skills/.*/SKILL\\.md|hooks/.*\\.md|prompts/.*\\.md)\$" || true)

if [ -n "\$config_files" ]; then
  echo "AGENTS.md Critical Rule #7: agnix lints new or changed agents, skills, hooks and prompts."
  echo "\$config_files"
  echo ""
  if command -v agnix >/dev/null 2>&1; then
    AGNIX="agnix"
  else
    AGNIX="npx --yes agnix"
  fi
  # shellcheck disable=SC2086
  if ! (cd "\$REPO_ROOT" && \$AGNIX \$config_files); then
    echo ""
    echo "[ERROR] BLOCKED: agnix reported errors in the files above"
    echo "   Fix them and push again (install agnix: npm install -g agnix)"
    exit 1
  fi
  echo "[OK] agnix found no errors"
else
  echo "[OK] No agent configs modified"
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
