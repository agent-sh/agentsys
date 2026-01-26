/**
 * Platform-aware state directory detection
 *
 * Determines the appropriate state directory based on the AI coding assistant
 * being used (Claude Code, OpenCode, or Codex CLI).
 *
 * @module lib/platform/state-dir
 */

const fs = require('fs');
const path = require('path');

/**
 * Cached state directory name (relative, without leading dot handling)
 * @type {string|null}
 */
let _cachedStateDir = null;

/**
 * Detect which AI coding assistant is running and return appropriate state directory
 *
 * Detection order:
 * 1. AI_STATE_DIR env var (user override)
 * 2. OpenCode detection (OPENCODE_CONFIG env or .opencode/ exists)
 * 3. Codex detection (CODEX_HOME env or .codex/ exists)
 * 4. Default to .claude (Claude Code or unknown)
 *
 * @param {string} [basePath=process.cwd()] - Base path to check for project directories
 * @returns {string} State directory name (e.g., '.claude', '.opencode', '.codex')
 */
function getStateDir(basePath = process.cwd()) {
  // Check user override first
  if (process.env.AI_STATE_DIR) {
    return process.env.AI_STATE_DIR;
  }

  // Return cached value if available
  if (_cachedStateDir) {
    return _cachedStateDir;
  }

  // OpenCode detection
  if (process.env.OPENCODE_CONFIG || process.env.OPENCODE_CONFIG_DIR) {
    _cachedStateDir = '.opencode';
    return _cachedStateDir;
  }

  // Check for .opencode directory in project
  try {
    const opencodePath = path.join(basePath, '.opencode');
    if (fs.existsSync(opencodePath) && fs.statSync(opencodePath).isDirectory()) {
      _cachedStateDir = '.opencode';
      return _cachedStateDir;
    }
  } catch {
    // Ignore errors, continue detection
  }

  // Codex detection
  if (process.env.CODEX_HOME) {
    _cachedStateDir = '.codex';
    return _cachedStateDir;
  }

  // Check for .codex directory in project
  try {
    const codexPath = path.join(basePath, '.codex');
    if (fs.existsSync(codexPath) && fs.statSync(codexPath).isDirectory()) {
      _cachedStateDir = '.codex';
      return _cachedStateDir;
    }
  } catch {
    // Ignore errors, continue detection
  }

  // Default to Claude Code
  _cachedStateDir = '.claude';
  return _cachedStateDir;
}

/**
 * Get the full path to the state directory
 * @param {string} [basePath=process.cwd()] - Base path
 * @returns {string} Full path to state directory
 */
function getStateDirPath(basePath = process.cwd()) {
  return path.join(basePath, getStateDir(basePath));
}

/**
 * Get the detected platform name
 * @param {string} [basePath=process.cwd()] - Base path
 * @returns {string} Platform name ('claude', 'opencode', 'codex', or 'custom')
 */
function getPlatformName(basePath = process.cwd()) {
  const stateDir = getStateDir(basePath);

  if (process.env.AI_STATE_DIR) {
    return 'custom';
  }

  switch (stateDir) {
    case '.opencode': return 'opencode';
    case '.codex': return 'codex';
    case '.claude': return 'claude';
    default: return 'unknown';
  }
}

/**
 * Clear the cached state directory (useful for testing)
 */
function clearCache() {
  _cachedStateDir = null;
}

module.exports = {
  getStateDir,
  getStateDirPath,
  getPlatformName,
  clearCache
};
