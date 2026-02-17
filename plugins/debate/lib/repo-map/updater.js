/**
 * Repo map incremental updater
 *
 * @module lib/repo-map/updater
 */

'use strict';

const fsPromises = require('fs').promises;
const path = require('path');
const { execFileSync } = require('child_process');

const runner = require('./runner');
const cache = require('./cache');
const installer = require('./installer');
const { runWithConcurrency } = require('./concurrency');

const SCAN_CONCURRENCY = 8;
const SCANNABLE_EXTENSIONS = new Set(Object.values(runner.LANGUAGE_EXTENSIONS).flat());

function isScannableFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SCANNABLE_EXTENSIONS.has(ext);
}

/**
 * Perform incremental update based on git diff
 * @param {string} basePath - Repository root
 * @param {Object} map - Existing repo map
 * @returns {Promise<{success: boolean, map?: Object, changes?: Object, error?: string, needsFullRebuild?: boolean}>}
 */
async function incrementalUpdate(basePath, map) {
  // Validate ast-grep
  const installed = installer.checkInstalledSync();
  if (!installed.found) {
    return {
      success: false,
      error: 'ast-grep not found',
      installSuggestion: installer.getInstallInstructions()
    };
  }

  if (!installer.meetsMinimumVersion(installed.version)) {
    return {
      success: false,
      error: `ast-grep version ${installed.version || 'unknown'} is too old. Minimum required: ${installer.getMinimumVersion()}`,
      installSuggestion: installer.getInstallInstructions()
    };
  }

  if (!map || !map.files) {
    return {
      success: false,
      error: 'Invalid repo map',
      needsFullRebuild: true
    };
  }
  map.stats = map.stats || {};
  if (!Array.isArray(map.stats.errors)) {
    map.stats.errors = [];
  }
  if (map.docs) {
    delete map.docs;
  }

  // Try git-based update first
  const gitInfo = runner.getGitInfo(basePath);
  if (!gitInfo || !map.git?.commit) {
    return updateWithoutGit(basePath, map, installed.command);
  }

  // Check if base commit exists
  if (!commitExists(basePath, map.git.commit)) {
    return {
      success: false,
      error: 'Base commit not found (history rewritten). Full rebuild required.',
      needsFullRebuild: true
    };
  }

  const diff = getGitDiff(basePath, map.git.commit);
  if (diff === null) {
    return updateWithoutGit(basePath, map, installed.command);
  }

  const changes = parseDiff(diff);

  // No changes - just update metadata
  if (changes.total === 0) {
    map.git = gitInfo;
    map.updated = new Date().toISOString();
    return {
      success: true,
      map,
      changes: { total: 0, updated: 0, added: 0, deleted: 0, renamed: 0 }
    };
  }

  // Apply deletions
  for (const file of changes.deleted) {
    delete map.files[file];
    delete map.dependencies[file];
  }

  // Apply renames
  for (const { from, to } of changes.renamed) {
    if (map.files[from]) {
      map.files[to] = map.files[from];
      delete map.files[from];
    }
    if (map.dependencies[from]) {
      map.dependencies[to] = map.dependencies[from];
      delete map.dependencies[from];
    }
  }

  // Apply added/modified - batch file existence checks
  const updatedFiles = [...changes.added, ...changes.modified];
  const fullPaths = updatedFiles.map(file => ({ file, fullPath: path.join(basePath, file) }));

  // Batch check file existence
  const existenceChecks = await Promise.all(
    fullPaths.map(async ({ file, fullPath }) => {
      try {
        await fsPromises.access(fullPath);
        return { file, fullPath, exists: true };
      } catch {
        return { file, fullPath, exists: false };
      }
    })
  );

  // Process files that exist with bounded concurrency
  const scanTargets = existenceChecks.filter(({ file, exists }) => exists && isScannableFile(file));
  const scanResults = await runWithConcurrency(scanTargets, SCAN_CONCURRENCY, async ({ file, fullPath }) => {
    const astErrors = [];
    const fileData = await runner.scanSingleFileAsync(installed.command, fullPath, basePath, {
      onError: (error) => astErrors.push(error)
    });
    return { file, fileData, astErrors };
  });

  const scanFailures = [];
  for (const result of scanResults) {
    if (!result) continue;

    if (result.astErrors.length > 0) {
      map.stats.errors.push(...result.astErrors);
    }

    if (!result.fileData) {
      if (result.astErrors.length > 0) {
        scanFailures.push(result.file);
      }
      continue;
    }

    map.files[result.file] = result.fileData;
    if (result.fileData.imports && result.fileData.imports.length > 0) {
      map.dependencies[result.file] = Array.from(new Set(result.fileData.imports.map(imp => imp.source)));
    } else {
      delete map.dependencies[result.file];
    }
  }

  if (scanFailures.length > 0) {
    return {
      success: false,
      error: `Failed to rescan ${scanFailures.length} file(s) during incremental update`,
      needsFullRebuild: true,
      failedFiles: scanFailures
    };
  }

  // Recalculate stats
  recalculateStats(map);

  // Update git metadata
  map.git = gitInfo;
  map.updated = new Date().toISOString();

  return {
    success: true,
    map,
    changes: {
      total: changes.total,
      updated: updatedFiles.length,
      added: changes.added.length,
      deleted: changes.deleted.length,
      renamed: changes.renamed.length
    }
  };
}

/**
 * Update without git (hash comparison)
 * @param {string} basePath - Repository root
 * @param {Object} map - Existing repo map
 * @param {string} cmd - ast-grep command
 * @returns {Promise<{success: boolean, map?: Object, changes?: Object}>}
 */
async function updateWithoutGit(basePath, map, cmd) {
  const currentFiles = new Set();
  const languages = map.project?.languages || [];
  map.stats = map.stats || {};
  if (!Array.isArray(map.stats.errors)) {
    map.stats.errors = [];
  }
  if (map.docs) {
    delete map.docs;
  }

  for (const lang of languages) {
    const files = runner.findFilesForLanguage(basePath, lang);
    for (const file of files) {
      currentFiles.add(path.relative(basePath, file).replace(/\\/g, '/'));
    }
  }

  const changes = {
    added: [],
    modified: [],
    deleted: [],
    renamed: [],
    total: 0
  };

  // Collect existing files to check
  const existingFiles = Object.keys(map.files);
  const filesToCheck = [];
  const filesToDelete = [];

  for (const file of existingFiles) {
    if (!currentFiles.has(file)) {
      filesToDelete.push(file);
    } else {
      filesToCheck.push(file);
      currentFiles.delete(file);
    }
  }

  // Process deletions
  for (const file of filesToDelete) {
    changes.deleted.push(file);
    delete map.files[file];
    delete map.dependencies[file];
  }

  // Process existing files for modifications (async file reads)
  const checkResults = await runWithConcurrency(filesToCheck, SCAN_CONCURRENCY, async (file) => {
    const fullPath = path.join(basePath, file);
    const astErrors = [];
    const fileData = await runner.scanSingleFileAsync(cmd, fullPath, basePath, {
      onError: (error) => astErrors.push(error)
    });
    return { file, fileData, astErrors };
  });

  const scanFailures = [];
  for (const result of checkResults) {
    if (!result) continue;

    if (result.astErrors.length > 0) {
      map.stats.errors.push(...result.astErrors);
    }

    if (!result.fileData) {
      scanFailures.push(result.file);
      continue;
    }

    if (result.fileData.hash !== map.files[result.file].hash) {
      map.files[result.file] = result.fileData;
      if (result.fileData.imports && result.fileData.imports.length > 0) {
        map.dependencies[result.file] = Array.from(new Set(result.fileData.imports.map(imp => imp.source)));
      } else {
        delete map.dependencies[result.file];
      }
      changes.modified.push(result.file);
    }
  }

  // Process new files (async file reads)
  const addedFiles = Array.from(currentFiles);
  const addResults = await runWithConcurrency(addedFiles, SCAN_CONCURRENCY, async (file) => {
    const fullPath = path.join(basePath, file);
    const astErrors = [];
    const fileData = await runner.scanSingleFileAsync(cmd, fullPath, basePath, {
      onError: (error) => astErrors.push(error)
    });
    return { file, fileData, astErrors };
  });

  for (const result of addResults) {
    if (!result) continue;

    if (result.astErrors.length > 0) {
      map.stats.errors.push(...result.astErrors);
    }

    if (!result.fileData) {
      scanFailures.push(result.file);
      continue;
    }

    map.files[result.file] = result.fileData;
    if (result.fileData.imports && result.fileData.imports.length > 0) {
      map.dependencies[result.file] = Array.from(new Set(result.fileData.imports.map(imp => imp.source)));
    }
    changes.added.push(result.file);
  }

  if (scanFailures.length > 0) {
    return {
      success: false,
      error: `Failed to rescan ${scanFailures.length} file(s) during non-git update`,
      needsFullRebuild: true,
      failedFiles: scanFailures
    };
  }

  changes.total = changes.added.length + changes.modified.length + changes.deleted.length;

  recalculateStats(map);
  map.updated = new Date().toISOString();

  return {
    success: true,
    map,
    changes: {
      total: changes.total,
      updated: changes.modified.length,
      added: changes.added.length,
      deleted: changes.deleted.length,
      renamed: changes.renamed.length
    }
  };
}

/**
 * Check if repo-map is stale
 * @param {string} basePath - Repository root
 * @param {Object} map - Repo map
 * @returns {Object} Staleness info
 */
function checkStaleness(basePath, map) {
  const result = {
    isStale: false,
    reason: null,
    commitsBehind: 0,
    suggestFullRebuild: false
  };

  if (!map?.git?.commit) {
    result.isStale = true;
    result.reason = 'Missing base commit in repo-map';
    result.suggestFullRebuild = true;
    return result;
  }

  if (cache.isMarkedStale(basePath)) {
    result.isStale = true;
    result.reason = 'Marked stale by hook';
  }

  if (!commitExists(basePath, map.git.commit)) {
    result.isStale = true;
    result.reason = 'Base commit no longer exists (rebased?)';
    result.suggestFullRebuild = true;
    return result;
  }

  const currentBranch = getCurrentBranch(basePath);
  if (currentBranch && map.git.branch && currentBranch !== map.git.branch) {
    result.isStale = true;
    result.reason = `Branch changed from ${map.git.branch} to ${currentBranch}`;
    result.suggestFullRebuild = true;
  }

  const commitsBehind = getCommitsBehind(basePath, map.git.commit);
  if (commitsBehind > 0) {
    result.isStale = true;
    result.commitsBehind = commitsBehind;
    if (!result.reason) {
      result.reason = `${commitsBehind} commits behind HEAD`;
    }
  }

  return result;
}

/**
 * Parse git diff output
 * @param {string} diff - Git diff output
 * @returns {Object}
 */
function parseDiff(diff) {
  const changes = {
    added: [],
    modified: [],
    deleted: [],
    renamed: [],
    total: 0
  };

  const lines = diff.split('\n').filter(Boolean);
  for (const line of lines) {
    const parts = line.split('\t');
    const status = parts[0];

    if (status.startsWith('R')) {
      const from = normalizePath(parts[1]);
      const to = normalizePath(parts[2]);
      changes.renamed.push({ from, to });
      const renameScore = Number(status.slice(1));
      if (!Number.isNaN(renameScore) && renameScore < 100 && to) {
        changes.modified.push(to);
      }
      continue;
    }

    const file = normalizePath(parts[1]);
    if (!file) continue;

    if (status === 'A') changes.added.push(file);
    else if (status === 'M') changes.modified.push(file);
    else if (status === 'D') changes.deleted.push(file);

  }

  changes.total = changes.added.length + changes.modified.length + changes.deleted.length + changes.renamed.length;
  return changes;
}

/**
 * Validate git commit hash format
 * @param {string} commit - Commit hash to validate
 * @returns {boolean} True if valid hex commit hash
 */
function isValidCommitHash(commit) {
  // Git commit hashes are 4-40 hex characters (short to full SHA)
  return typeof commit === 'string' && /^[0-9a-fA-F]{4,40}$/.test(commit);
}

/**
 * Get git diff name-status
 * @param {string} basePath - Repository root
 * @param {string} sinceCommit - Base commit
 * @returns {string|null}
 */
function getGitDiff(basePath, sinceCommit) {
  // Validate commit hash to prevent command injection
  if (!isValidCommitHash(sinceCommit)) {
    return null;
  }
  try {
    // Use execFileSync with arg array to prevent command injection
    return execFileSync('git', ['diff', '--name-status', '-M', sinceCommit, 'HEAD'], {
      cwd: basePath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if commit exists
 * @param {string} basePath - Repository root
 * @param {string} commit - Commit hash
 * @returns {boolean}
 */
function commitExists(basePath, commit) {
  // Validate commit hash to prevent command injection
  if (!isValidCommitHash(commit)) {
    return false;
  }
  try {
    // Use execFileSync with arg array to prevent command injection
    execFileSync('git', ['cat-file', '-e', commit], {
      cwd: basePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current branch name
 * @param {string} basePath - Repository root
 * @returns {string|null}
 */
function getCurrentBranch(basePath) {
  try {
    // Use execFileSync with arg array for consistency
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: basePath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get number of commits behind HEAD
 * @param {string} basePath - Repository root
 * @param {string} commit - Base commit
 * @returns {number}
 */
function getCommitsBehind(basePath, commit) {
  // Validate commit hash to prevent command injection
  if (!isValidCommitHash(commit)) {
    return 0;
  }
  try {
    // Use execFileSync with arg array to prevent command injection
    const out = execFileSync('git', ['rev-list', `${commit}..HEAD`, '--count'], {
      cwd: basePath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return Number(out) || 0;
  } catch {
    return 0;
  }
}

/**
 * Normalize file path to forward slashes
 * @param {string} filePath - Path to normalize
 * @returns {string}
 */
function normalizePath(filePath) {
  return filePath ? filePath.replace(/\\/g, '/') : filePath;
}

/**
 * Recalculate map stats
 * @param {Object} map - Repo map
 */
function recalculateStats(map) {
  const files = Object.values(map.files || {});
  map.stats.totalFiles = files.length;
  map.stats.totalSymbols = files.reduce((sum, file) => {
    return sum +
      (file.symbols?.functions?.length || 0) +
      (file.symbols?.classes?.length || 0) +
      (file.symbols?.types?.length || 0) +
      (file.symbols?.constants?.length || 0);
  }, 0);
}

module.exports = {
  incrementalUpdate,
  updateWithoutGit,
  checkStaleness
};
