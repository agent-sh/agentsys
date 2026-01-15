/**
 * Context Optimizer Utilities
 * Provides optimized git commands to minimize token usage while gathering context
 *
 * Target: Keep command execution under 50k tokens
 *
 * @author Avi Fenesh
 * @license MIT
 */

/**
 * Git command optimization utilities for context efficiency
 */
const contextOptimizer = {
  /**
   * Get recent commits with minimal formatting
   * @param {number} limit - Number of commits to retrieve (default: 10)
   * @returns {string} Git command
   */
  recentCommits: (limit = 10) =>
    `git log --oneline --no-decorate -${limit} --format="%h %s"`,

  /**
   * Get compact git status (untracked files excluded)
   * @returns {string} Git command
   */
  compactStatus: () =>
    'git status -uno --porcelain',

  /**
   * Get file changes between refs
   * @param {string} ref - Reference to compare from (default: 'HEAD~5')
   * @returns {string} Git command
   */
  fileChanges: (ref = 'HEAD~5') =>
    `git diff ${ref}..HEAD --name-status`,

  /**
   * Get current branch name
   * @returns {string} Git command
   */
  currentBranch: () =>
    'git branch --show-current',

  /**
   * Get remote information (limited to 2 lines)
   * @returns {string} Git command
   */
  remoteInfo: () =>
    'git remote -v | head -2',

  /**
   * Check if there are stashed changes
   * @returns {string} Git command
   */
  hasStashes: () =>
    'git stash list --oneline | wc -l',

  /**
   * Get worktree list in porcelain format
   * @returns {string} Git command
   */
  worktreeList: () =>
    'git worktree list --porcelain',

  /**
   * Get the age of a specific line (for TODO checking)
   * @param {string} file - File path
   * @param {number} line - Line number
   * @returns {string} Git command
   */
  lineAge: (file, line) =>
    `git blame -L ${line},${line} ${file} --porcelain | grep '^committer-time' | cut -d' ' -f2`,

  /**
   * Find source files by extension
   * @param {string} extension - File extension (e.g., 'ts', 'py', 'rs')
   * @returns {string} Git command
   */
  findSourceFiles: (extension = 'ts') =>
    `git ls-files | grep '\\.${extension}$'`,

  /**
   * Get diff stat summary
   * @param {string} ref - Reference to compare from (default: 'HEAD~5')
   * @returns {string} Git command
   */
  diffStat: (ref = 'HEAD~5') =>
    `git diff ${ref}..HEAD --stat | head -20`,

  /**
   * Get contributors list (limited to top 10)
   * @returns {string} Git command
   */
  contributors: () =>
    'git shortlog -sn --no-merges | head -10',

  /**
   * Get last commit message
   * @returns {string} Git command
   */
  lastCommitMessage: () =>
    'git log -1 --format=%s',

  /**
   * Get files changed in last commit
   * @returns {string} Git command
   */
  lastCommitFiles: () =>
    'git diff-tree --no-commit-id --name-only -r HEAD',

  /**
   * Get branch list (local only, limited)
   * @param {number} limit - Number of branches (default: 10)
   * @returns {string} Git command
   */
  branches: (limit = 10) =>
    `git branch --format='%(refname:short)' | head -${limit}`,

  /**
   * Get tags list (limited)
   * @param {number} limit - Number of tags (default: 10)
   * @returns {string} Git command
   */
  tags: (limit = 10) =>
    `git tag --sort=-creatordate | head -${limit}`,

  /**
   * Get count of commits on current branch since branching from main
   * @param {string} mainBranch - Main branch name (default: 'main')
   * @returns {string} Git command
   */
  commitsSinceBranch: (mainBranch = 'main') =>
    `git rev-list --count ${mainBranch}..HEAD`,

  /**
   * Check if working directory is clean
   * @returns {string} Git command
   */
  isClean: () =>
    'git status --porcelain | wc -l',

  /**
   * Get merge base with main branch
   * @param {string} mainBranch - Main branch name (default: 'main')
   * @returns {string} Git command
   */
  mergeBase: (mainBranch = 'main') =>
    `git merge-base ${mainBranch} HEAD`,

  /**
   * Get files modified in current branch (since branching)
   * @param {string} mainBranch - Main branch name (default: 'main')
   * @returns {string} Git command
   */
  branchChangedFiles: (mainBranch = 'main') =>
    `git diff ${mainBranch}...HEAD --name-only`,

  /**
   * Get commit count by author
   * @param {string} author - Author name or email
   * @returns {string} Git command
   */
  authorCommitCount: (author) =>
    `git log --author="${author}" --oneline | wc -l`,

  /**
   * Check if file exists in repository
   * @param {string} file - File path
   * @returns {string} Git command
   */
  fileExists: (file) =>
    `git ls-files | grep -q '${file}' && echo 'true' || echo 'false'`
};

module.exports = contextOptimizer;
