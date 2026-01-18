#!/usr/bin/env node
/**
 * Platform Detection Infrastructure
 * Auto-detects project configuration for zero-config slash commands
 *
 * Usage: node lib/platform/detect-platform.js
 * Output: JSON with detected platform information
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const fsPromises = fs.promises;

// Import shared utilities
const { warnDeprecation, _resetDeprecationWarnings } = require('../utils/deprecation');
const { CacheManager } = require('../utils/cache-manager');
const {
  CI_CONFIGS,
  DEPLOYMENT_CONFIGS,
  PACKAGE_MANAGER_CONFIGS
} = require('./detection-configs');

/**
 * Default timeout for async operations (5 seconds)
 */
const DEFAULT_ASYNC_TIMEOUT_MS = 5000;

/**
 * Maximum JSON file size to parse (1MB) - prevents DoS via large files
 */
const MAX_JSON_SIZE_BYTES = 1024 * 1024;

/**
 * Safely parse JSON content with size limit
 * @param {string} content - JSON string to parse
 * @param {string} filename - Filename for error messages
 * @returns {Object|null} Parsed object or null if invalid/too large
 */
function safeJSONParse(content, filename = 'unknown') {
  if (!content || typeof content !== 'string') {
    return null;
  }
  if (content.length > MAX_JSON_SIZE_BYTES) {
    // File too large - skip parsing to prevent DoS
    return null;
  }
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operation - Operation name for error message
 * @returns {Promise} Promise that rejects on timeout
 */
function withTimeout(promise, timeoutMs = DEFAULT_ASYNC_TIMEOUT_MS, operation = 'operation') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Execute a command with timeout protection
 * @param {string} cmd - Command to execute
 * @param {Object} options - exec options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function execAsyncWithTimeout(cmd, options = {}, timeoutMs = DEFAULT_ASYNC_TIMEOUT_MS) {
  return withTimeout(execAsync(cmd, options), timeoutMs, `exec: ${cmd.substring(0, 50)}`);
}

// Maximum JSON file size and cached file size constants
const MAX_CACHED_FILE_SIZE = 64 * 1024; // 64KB max per cached file

// Cache instances using CacheManager abstraction
const _detectionCache = new CacheManager({ maxSize: 1, ttl: 60000 }); // Single detection result, 1 min TTL
const _fileCache = new CacheManager({ maxSize: 100, ttl: 60000, maxValueSize: MAX_CACHED_FILE_SIZE });
const _existsCache = new CacheManager({ maxSize: 100, ttl: 60000 });

// Note: enforceMaxCacheSize() removed - now handled by CacheManager internally

/**
 * Generic file-based detector (synchronous)
 * @param {Array} configs - Array of {file, platform} objects
 * @param {Function} existsChecker - Function to check file existence
 * @returns {string|null} Detected platform or null
 */
function detectFromFiles(configs, existsChecker) {
  for (const { file, platform } of configs) {
    if (existsChecker(file)) {
      return platform;
    }
  }
  return null;
}

/**
 * Generic file-based detector (asynchronous)
 * @param {Array} configs - Array of {file, platform} objects
 * @param {Function} existsChecker - Async function to check file existence
 * @returns {Promise<string|null>} Detected platform or null
 */
async function detectFromFilesAsync(configs, existsChecker) {
  // Check all files in parallel for better performance
  const checks = await Promise.all(
    configs.map(({ file }) => existsChecker(file))
  );

  // Return first match (maintains priority order)
  for (let i = 0; i < checks.length; i++) {
    if (checks[i]) {
      return configs[i].platform;
    }
  }
  return null;
}

/**
 * Check if a file exists (cached)
 * @param {string} filepath - Path to check
 * @returns {boolean}
 */
function existsCached(filepath) {
  const cached = _existsCache.get(filepath);
  if (cached !== undefined) {
    return cached;
  }
  const exists = fs.existsSync(filepath);
  _existsCache.set(filepath, exists);
  return exists;
}

/**
 * Check if a file exists (cached, async)
 * @param {string} filepath - Path to check
 * @returns {Promise<boolean>}
 */
async function existsCachedAsync(filepath) {
  const cached = _existsCache.get(filepath);
  if (cached !== undefined) {
    return cached;
  }
  try {
    await fsPromises.access(filepath);
    _existsCache.set(filepath, true);
    return true;
  } catch {
    _existsCache.set(filepath, false);
    return false;
  }
}

/**
 * Read file contents (cached)
 * Only caches files smaller than MAX_CACHED_FILE_SIZE to prevent memory bloat
 * Optimized: normalizes filepath to prevent cache pollution from variant paths
 * @param {string} filepath - Path to read
 * @returns {string|null}
 */
function readFileCached(filepath) {
  // Normalize filepath to prevent cache pollution (./foo vs foo vs /abs/foo)
  // This ensures that different representations of the same path use the same cache entry
  const normalizedPath = path.resolve(filepath);

  const cached = _fileCache.get(normalizedPath);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const content = fs.readFileSync(normalizedPath, 'utf8');
    // CacheManager enforces maxValueSize, so small files are cached automatically
    _fileCache.set(normalizedPath, content);
    return content;
  } catch {
    // Cache null for missing files (small memory footprint)
    _fileCache.set(normalizedPath, null);
    return null;
  }
}

/**
 * Read file contents (cached, async)
 * Only caches files smaller than MAX_CACHED_FILE_SIZE to prevent memory bloat
 * Optimized: normalizes filepath to prevent cache pollution from variant paths
 * @param {string} filepath - Path to read
 * @returns {Promise<string|null>}
 */
async function readFileCachedAsync(filepath) {
  // Normalize filepath to prevent cache pollution (./foo vs foo vs /abs/foo)
  // This ensures that different representations of the same path use the same cache entry
  const normalizedPath = path.resolve(filepath);

  const cached = _fileCache.get(normalizedPath);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const content = await fsPromises.readFile(normalizedPath, 'utf8');
    // CacheManager enforces maxValueSize, so small files are cached automatically
    _fileCache.set(normalizedPath, content);
    return content;
  } catch {
    // Cache null for missing files (small memory footprint)
    _fileCache.set(normalizedPath, null);
    return null;
  }
}

/**
 * Detects CI platform by scanning for configuration files
 * @deprecated Use detectCIAsync() instead. Will be removed in v3.0.0.
 * @returns {string|null} CI platform name or null if not detected
 */
function detectCI() {
  warnDeprecation('detectCI', 'detectCIAsync');
  return detectFromFiles(CI_CONFIGS, existsCached);
}

/**
 * Detects CI platform by scanning for configuration files (async)
 * @returns {Promise<string|null>} CI platform name or null if not detected
 */
async function detectCIAsync() {
  return detectFromFilesAsync(CI_CONFIGS, existsCachedAsync);
}

/**
 * Detects deployment platform by scanning for platform-specific files
 * @deprecated Use detectDeploymentAsync() instead. Will be removed in v3.0.0.
 * @returns {string|null} Deployment platform name or null if not detected
 */
function detectDeployment() {
  warnDeprecation('detectDeployment', 'detectDeploymentAsync');
  return detectFromFiles(DEPLOYMENT_CONFIGS, existsCached);
}

/**
 * Detects deployment platform by scanning for platform-specific files (async)
 * @returns {Promise<string|null>} Deployment platform name or null if not detected
 */
async function detectDeploymentAsync() {
  return detectFromFilesAsync(DEPLOYMENT_CONFIGS, existsCachedAsync);
}

/**
 * Detects project type by scanning for language-specific files
 * @deprecated Use detectProjectTypeAsync() instead. Will be removed in v3.0.0.
 * @returns {string} Project type identifier
 */
function detectProjectType() {
  warnDeprecation('detectProjectType', 'detectProjectTypeAsync');
  if (existsCached('package.json')) return 'nodejs';
  if (existsCached('requirements.txt') || existsCached('pyproject.toml') || existsCached('setup.py')) return 'python';
  if (existsCached('Cargo.toml')) return 'rust';
  if (existsCached('go.mod')) return 'go';
  if (existsCached('pom.xml') || existsCached('build.gradle')) return 'java';
  return 'unknown';
}

/**
 * Detects project type by scanning for language-specific files (async)
 * @returns {Promise<string>} Project type identifier
 */
async function detectProjectTypeAsync() {
  const checks = await Promise.all([
    existsCachedAsync('package.json'),
    existsCachedAsync('requirements.txt'),
    existsCachedAsync('pyproject.toml'),
    existsCachedAsync('setup.py'),
    existsCachedAsync('Cargo.toml'),
    existsCachedAsync('go.mod'),
    existsCachedAsync('pom.xml'),
    existsCachedAsync('build.gradle')
  ]);

  if (checks[0]) return 'nodejs';
  if (checks[1] || checks[2] || checks[3]) return 'python';
  if (checks[4]) return 'rust';
  if (checks[5]) return 'go';
  if (checks[6] || checks[7]) return 'java';
  return 'unknown';
}

/**
 * Detects package manager by scanning for lockfiles
 * @deprecated Use detectPackageManagerAsync() instead. Will be removed in v3.0.0.
 * @returns {string|null} Package manager name or null if not detected
 */
function detectPackageManager() {
  warnDeprecation('detectPackageManager', 'detectPackageManagerAsync');
  return detectFromFiles(
    PACKAGE_MANAGER_CONFIGS.map(({ file, manager }) => ({ file, platform: manager })),
    existsCached
  );
}

/**
 * Detects package manager by scanning for lockfiles (async)
 * @returns {Promise<string|null>} Package manager name or null if not detected
 */
async function detectPackageManagerAsync() {
  return detectFromFilesAsync(
    PACKAGE_MANAGER_CONFIGS.map(({ file, manager }) => ({ file, platform: manager })),
    existsCachedAsync
  );
}

/**
 * Detects branch strategy (single-branch vs multi-branch with dev+prod)
 * @deprecated Use detectBranchStrategyAsync() instead. Will be removed in v3.0.0.
 * @returns {string} 'single-branch' or 'multi-branch'
 */
function detectBranchStrategy() {
  warnDeprecation('detectBranchStrategy', 'detectBranchStrategyAsync');
  try {
    // Check both local and remote branches
    const localBranches = execSync('git branch', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    let remoteBranches = '';
    try {
      remoteBranches = execSync('git branch -r', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    } catch {}

    const allBranches = localBranches + remoteBranches;

    const hasStable = allBranches.includes('stable');
    const hasProduction = allBranches.includes('production') || allBranches.includes('prod');

    if (hasStable || hasProduction) {
      return 'multi-branch'; // dev + prod workflow
    }

    // Check deployment configs for multi-environment setup (uses cache)
    if (existsCached('railway.json')) {
      try {
        const content = readFileCached('railway.json');
        if (content) {
          const config = safeJSONParse(content, 'railway.json');
          // Validate JSON structure before accessing properties
          if (config &&
              typeof config === 'object' &&
              typeof config.environments === 'object' &&
              config.environments !== null &&
              Object.keys(config.environments).length > 1) {
            return 'multi-branch';
          }
        }
      } catch {}
    }

    return 'single-branch'; // main only
  } catch {
    return 'single-branch';
  }
}

/**
 * Detects branch strategy (single-branch vs multi-branch with dev+prod) (async)
 * @returns {Promise<string>} 'single-branch' or 'multi-branch'
 */
async function detectBranchStrategyAsync() {
  try {
    // Run git commands in parallel with timeout protection
    const [localResult, remoteResult] = await Promise.all([
      execAsyncWithTimeout('git branch', { encoding: 'utf8' }).catch(() => ({ stdout: '' })),
      execAsyncWithTimeout('git branch -r', { encoding: 'utf8' }).catch(() => ({ stdout: '' }))
    ]);

    const allBranches = (localResult.stdout || '') + (remoteResult.stdout || '');

    const hasStable = allBranches.includes('stable');
    const hasProduction = allBranches.includes('production') || allBranches.includes('prod');

    if (hasStable || hasProduction) {
      return 'multi-branch';
    }

    // Check deployment configs for multi-environment setup (uses cache)
    if (await existsCachedAsync('railway.json')) {
      try {
        const content = await readFileCachedAsync('railway.json');
        if (content) {
          const config = safeJSONParse(content, 'railway.json');
          if (config &&
              typeof config === 'object' &&
              typeof config.environments === 'object' &&
              config.environments !== null &&
              Object.keys(config.environments).length > 1) {
            return 'multi-branch';
          }
        }
      } catch {}
    }

    return 'single-branch';
  } catch {
    return 'single-branch';
  }
}

/**
 * Detects the main branch name
 * @deprecated Use detectMainBranchAsync() instead. Will be removed in v3.0.0.
 * @returns {string} Main branch name ('main' or 'master')
 */
function detectMainBranch() {
  warnDeprecation('detectMainBranch', 'detectMainBranchAsync');
  try {
    const defaultBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    })
      .trim()
      .replace('refs/remotes/origin/', '');
    return defaultBranch;
  } catch {
    // Fallback: check common names
    try {
      execSync('git rev-parse --verify main', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      return 'main';
    } catch {
      return 'master';
    }
  }
}

/**
 * Detects the main branch name (async)
 * @returns {Promise<string>} Main branch name ('main' or 'master')
 */
async function detectMainBranchAsync() {
  try {
    const { stdout } = await execAsyncWithTimeout('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf8' });
    return stdout.trim().replace('refs/remotes/origin/', '');
  } catch {
    // Fallback: check common names
    try {
      await execAsyncWithTimeout('git rev-parse --verify main', { encoding: 'utf8' });
      return 'main';
    } catch {
      return 'master';
    }
  }
}

/**
 * Main detection function - aggregates all platform information (sync)
 * Uses caching to avoid repeated filesystem/git operations
 * @deprecated Use detectAsync() instead. Will be removed in v3.0.0.
 * @param {boolean} forceRefresh - Force cache refresh
 * @returns {Object} Platform configuration object
 */
function detect(forceRefresh = false) {
  warnDeprecation('detect', 'detectAsync');

  // Return cached result if still valid
  if (!forceRefresh) {
    const cached = _detectionCache.get('detection');
    if (cached !== undefined) {
      return cached;
    }
  }

  const detection = {
    ci: detectCI(),
    deployment: detectDeployment(),
    projectType: detectProjectType(),
    packageManager: detectPackageManager(),
    branchStrategy: detectBranchStrategy(),
    mainBranch: detectMainBranch(),
    hasPlanFile: existsCached('PLAN.md'),
    hasTechDebtFile: existsCached('TECHNICAL_DEBT.md'),
    timestamp: new Date().toISOString()
  };

  _detectionCache.set('detection', detection);
  return detection;
}

/**
 * Main detection function - aggregates all platform information (async)
 * Uses Promise.all for parallel execution and caching
 * @param {boolean} forceRefresh - Force cache refresh
 * @returns {Promise<Object>} Platform configuration object
 */
async function detectAsync(forceRefresh = false) {
  // Return cached result if still valid
  if (!forceRefresh) {
    const cached = _detectionCache.get('detection');
    if (cached !== undefined) {
      return cached;
    }
  }

  // Run all detections in parallel
  const [
    ci,
    deployment,
    projectType,
    packageManager,
    branchStrategy,
    mainBranch,
    hasPlanFile,
    hasTechDebtFile
  ] = await Promise.all([
    detectCIAsync(),
    detectDeploymentAsync(),
    detectProjectTypeAsync(),
    detectPackageManagerAsync(),
    detectBranchStrategyAsync(),
    detectMainBranchAsync(),
    existsCachedAsync('PLAN.md'),
    existsCachedAsync('TECHNICAL_DEBT.md')
  ]);

  const detection = {
    ci,
    deployment,
    projectType,
    packageManager,
    branchStrategy,
    mainBranch,
    hasPlanFile,
    hasTechDebtFile,
    timestamp: new Date().toISOString()
  };

  _detectionCache.set('detection', detection);
  return detection;
}

/**
 * Invalidate all detection caches
 * Call this after making changes that affect platform detection
 */
function invalidateCache() {
  _detectionCache.clear();
  _fileCache.clear();
  _existsCache.clear();
}

// When run directly, output JSON (uses async for better performance)
if (require.main === module) {
  (async () => {
    try {
      const result = await detectAsync();
      // Optimize: only use pretty-printing when output is to terminal (TTY)
      // When piped to another program, use compact JSON for better performance
      const indent = process.stdout.isTTY ? 2 : 0;
      console.log(JSON.stringify(result, null, indent));
    } catch (error) {
      const indent = process.stderr.isTTY ? 2 : 0;
      console.error(JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }, null, indent));
      process.exit(1);
    }
  })();
}

// Export for use as module
module.exports = {
  detect,
  detectAsync,
  invalidateCache,
  detectCI,
  detectCIAsync,
  detectDeployment,
  detectDeploymentAsync,
  detectProjectType,
  detectProjectTypeAsync,
  detectPackageManager,
  detectPackageManagerAsync,
  detectBranchStrategy,
  detectBranchStrategyAsync,
  detectMainBranch,
  detectMainBranchAsync,
  // Testing utilities (prefixed with _ to indicate internal use)
  _resetDeprecationWarnings
};
