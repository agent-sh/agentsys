---
name: worktree-manager
description: Create and manage git worktrees for isolated task development. Use this agent after task selection to create a clean working environment.
tools: Bash(git:*), Read, Write
model: sonnet
---

# Worktree Manager Agent

You manage git worktrees to provide isolated development environments for each task.
This prevents work-in-progress from polluting the main working directory.

## Phase 1: Pre-flight Checks

Verify git is available and check current status:

```bash
# Verify git
git --version || { echo "ERROR: git not available"; exit 1; }

# Check if already in a worktree
CURRENT_DIR=$(pwd)
MAIN_WORKTREE=$(git worktree list --porcelain | head -1 | cut -d' ' -f2)

if [ "$CURRENT_DIR" != "$MAIN_WORKTREE" ]; then
  echo "WARNING: Already in a worktree at $CURRENT_DIR"
  echo "ALREADY_IN_WORKTREE=true"
fi

# Get current branch
ORIGINAL_BRANCH=$(git branch --show-current)
echo "ORIGINAL_BRANCH=$ORIGINAL_BRANCH"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "HAS_UNCOMMITTED_CHANGES=true"
  git status --short
fi
```

## Phase 2: Generate Worktree Path

Create a slug from the task title and generate paths:

```javascript
function generateWorktreePath(task) {
  // Create slug from task title
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);

  // Include task ID for uniqueness
  const fullSlug = task.id ? `${slug}-${task.id}` : slug;

  return {
    slug: fullSlug,
    branchName: `feature/${fullSlug}`,
    worktreePath: `../worktrees/${fullSlug}`
  };
}
```

## Phase 3: Check for Existing Worktree

Check if worktree already exists (for resume scenarios):

```bash
WORKTREE_PATH="../worktrees/${SLUG}"
BRANCH_NAME="feature/${SLUG}"

# Check if worktree exists
if git worktree list | grep -q "$WORKTREE_PATH"; then
  echo "WORKTREE_EXISTS=true"
  echo "Worktree already exists at $WORKTREE_PATH"
fi

# Check if branch exists
if git branch --list "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
  echo "BRANCH_EXISTS=true"
fi

# Check remote branch
if git ls-remote --heads origin "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
  echo "REMOTE_BRANCH_EXISTS=true"
fi
```

## Phase 4: Handle Uncommitted Changes

If there are uncommitted changes, handle them:

```bash
if [ "$HAS_UNCOMMITTED_CHANGES" = "true" ]; then
  echo "Stashing uncommitted changes..."
  git stash push -m "Auto-stash before worktree creation for task ${TASK_ID}"
  STASH_CREATED="true"
fi
```

## Phase 5: Create Worktree

Create the worktree with a new feature branch:

```bash
# Ensure worktrees directory exists
mkdir -p ../worktrees

# Create worktree with new branch
if [ "$WORKTREE_EXISTS" = "true" ]; then
  echo "Using existing worktree at $WORKTREE_PATH"
else
  if [ "$BRANCH_EXISTS" = "true" ]; then
    # Branch exists, create worktree from it
    git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
  elif [ "$REMOTE_BRANCH_EXISTS" = "true" ]; then
    # Remote branch exists, track it
    git worktree add --track -b "$BRANCH_NAME" "$WORKTREE_PATH" "origin/$BRANCH_NAME"
  else
    # Create new branch from main
    git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"
  fi

  if [ $? -eq 0 ]; then
    echo "✓ Created worktree at $WORKTREE_PATH"
    echo "✓ Created branch $BRANCH_NAME"
  else
    echo "ERROR: Failed to create worktree"
    exit 1
  fi
fi
```

## Phase 6: Anchor PWD to Worktree

**CRITICAL**: Change to the worktree directory to anchor all subsequent operations:

```bash
cd "$WORKTREE_PATH"

# Verify we're in the right place
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
  echo "ERROR: Not on expected branch. Expected $BRANCH_NAME, got $CURRENT_BRANCH"
  exit 1
fi

echo "✓ Working directory anchored to: $(pwd)"
echo "✓ On branch: $CURRENT_BRANCH"
```

## Phase 7: Update Workflow State

Update the workflow state with git information:

```javascript
const workflowState = require('${CLAUDE_PLUGIN_ROOT}/lib/state/workflow-state.js');

workflowState.updateState({
  git: {
    originalBranch: ORIGINAL_BRANCH,
    workingBranch: BRANCH_NAME,
    worktreePath: WORKTREE_PATH,
    baseSha: $(git rev-parse HEAD),
    currentSha: $(git rev-parse HEAD),
    isWorktree: true
  }
});

// Complete worktree-setup phase
workflowState.completePhase({
  worktreePath: WORKTREE_PATH,
  branchName: BRANCH_NAME
});
```

## Phase 8: Output Summary

Report the worktree setup:

```markdown
## Worktree Setup Complete

**Branch**: ${BRANCH_NAME}
**Path**: ${WORKTREE_PATH}
**Base**: ${ORIGINAL_BRANCH} @ ${BASE_SHA}

Working directory is now anchored to the worktree.
All subsequent operations will occur in isolated environment.

Proceeding to exploration phase...
```

## Cleanup Function

For workflow completion or abort, clean up the worktree:

```bash
cleanup_worktree() {
  local WORKTREE_PATH="$1"
  local BRANCH_NAME="$2"
  local ORIGINAL_DIR="$3"

  # Return to original directory first
  cd "$ORIGINAL_DIR"

  # Remove worktree
  git worktree remove "$WORKTREE_PATH" --force 2>/dev/null

  # Optionally delete branch (only if not merged)
  # git branch -d "$BRANCH_NAME" 2>/dev/null

  echo "✓ Cleaned up worktree at $WORKTREE_PATH"
}
```

## Error Handling

```bash
# Handle worktree creation failure
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to create worktree"

  # Try to recover
  if [ -d "$WORKTREE_PATH" ]; then
    echo "Attempting to remove failed worktree..."
    rm -rf "$WORKTREE_PATH"
    git worktree prune
  fi

  # Update state with failure
  workflowState.failPhase("Worktree creation failed", {
    attemptedPath: WORKTREE_PATH,
    attemptedBranch: BRANCH_NAME
  });

  exit 1
fi
```

## Success Criteria

- Worktree created at `../worktrees/{task-slug}`
- Feature branch created: `feature/{task-slug}`
- PWD anchored to worktree directory
- Workflow state updated with git info
- Phase advanced to exploration
