'use strict';

/**
 * Repo Map - repository symbol mapping via agent-analyzer
 *
 * Uses agent-analyzer for symbol extraction. The binary is auto-downloaded
 * on first use - no external tool installation required.
 *
 * @module lib/repo-map
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const installer = require('./installer');
const cache = require('./cache');
const updater = require('./updater');
const converter = require('./converter');
const binary = require('../binary');
const { getStateDirPath } = require('../platform/state-dir');
const { writeJsonAtomic } = require('../utils/atomic-write');

const REPO_INTEL_FILENAME = 'repo-intel.json';

function getIntelMapPath(basePath) {
  return path.join(getStateDirPath(basePath), REPO_INTEL_FILENAME);
}

/**
 * Initialize a new repo map (full scan)
 * @param {string} basePath - Repository root path
 * @param {Object} options - Options
 * @param {boolean} options.force - Force rebuild even if map exists
 * @returns {Promise<{success: boolean, map?: Object, error?: string}>}
 */
async function init(basePath, options = {}) {
  const installed = await installer.checkInstalled();
  if (!installed.found) {
    return {
      success: false,
      error: 'agent-analyzer binary unavailable: ' + (installed.error || 'unknown error'),
      installSuggestion: installer.getInstallInstructions()
    };
  }

  const existing = cache.load(basePath);
  if (existing && !options.force) {
    return {
      success: false,
      error: 'Repo map already exists. Use --force to rebuild or /repo-map update to refresh.',
      existing: cache.getStatus(basePath)
    };
  }

  const startTime = Date.now();

  let intelJson;
  try {
    intelJson = await binary.runAnalyzerAsync(['repo-intel', 'init', basePath]);
  } catch (e) {
    return {
      success: false,
      error: 'agent-analyzer repo-intel init failed: ' + e.message
    };
  }

  let intel;
  try {
    intel = JSON.parse(intelJson);
  } catch (e) {
    return {
      success: false,
      error: 'Failed to parse repo-intel output: ' + e.message
    };
  }

  // Persist repo-intel.json for future incremental updates
  const intelPath = getIntelMapPath(basePath);
  try {
    writeJsonAtomic(intelPath, intel);
  } catch {
    // Non-fatal: update() will fall back to full init
  }

  const map = converter.convertIntelToRepoMap(intel);
  map.stats.scanDurationMs = Date.now() - startTime;
  cache.save(basePath, map);

  return {
    success: true,
    map,
    summary: {
      files: Object.keys(map.files).length,
      symbols: map.stats.totalSymbols,
      languages: map.project.languages,
      duration: map.stats.scanDurationMs
    }
  };
}

/**
 * Update an existing repo map (incremental via agent-analyzer)
 * @param {string} basePath - Repository root path
 * @param {Object} options - Options
 * @param {boolean} options.full - Force full rebuild instead of incremental
 * @returns {Promise<{success: boolean, summary?: Object, error?: string}>}
 */
async function update(basePath, options = {}) {
  const installed = await installer.checkInstalled();
  if (!installed.found) {
    return {
      success: false,
      error: 'agent-analyzer binary unavailable: ' + (installed.error || 'unknown error'),
      installSuggestion: installer.getInstallInstructions()
    };
  }

  if (!cache.exists(basePath)) {
    return {
      success: false,
      error: 'No repo map found. Run /repo-map init first.'
    };
  }

  if (options.full) {
    return init(basePath, { force: true });
  }

  const intelPath = getIntelMapPath(basePath);
  if (!fs.existsSync(intelPath)) {
    return init(basePath, { force: true });
  }

  const startTime = Date.now();

  let intelJson;
  try {
    intelJson = await binary.runAnalyzerAsync([
      'repo-intel', 'update',
      '--map-file', intelPath,
      basePath
    ]);
  } catch (e) {
    return {
      success: false,
      error: 'agent-analyzer repo-intel update failed: ' + e.message
    };
  }

  let intel;
  try {
    intel = JSON.parse(intelJson);
  } catch (e) {
    return {
      success: false,
      error: 'Failed to parse repo-intel update output: ' + e.message
    };
  }

  try {
    writeJsonAtomic(intelPath, intel);
  } catch {
    // Non-fatal
  }

  const map = converter.convertIntelToRepoMap(intel);
  map.stats.scanDurationMs = Date.now() - startTime;
  cache.save(basePath, map);

  return {
    success: true,
    map,
    summary: {
      files: Object.keys(map.files).length,
      symbols: map.stats.totalSymbols,
      duration: map.stats.scanDurationMs
    }
  };
}

/**
 * Get repo map status
 * @param {string} basePath - Repository root path
 * @returns {{exists: boolean, status?: Object}}
 */
function status(basePath) {
  const map = cache.load(basePath);
  if (!map) {
    return { exists: false };
  }

  const staleness = updater.checkStaleness(basePath, map);

  let branch;
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: basePath, encoding: 'utf8' }).trim();
  } catch {
    // Non-fatal
  }

  return {
    exists: true,
    status: {
      generated: map.generated,
      updated: map.updated,
      commit: map.git?.commit,
      branch,
      files: Object.keys(map.files).length,
      symbols: map.stats?.totalSymbols || 0,
      languages: map.project?.languages || [],
      staleness
    }
  };
}

/**
 * Load repo map (if exists)
 * @param {string} basePath - Repository root path
 * @returns {Object|null}
 */
function load(basePath) {
  return cache.load(basePath);
}

/**
 * Check if repo map exists
 * @param {string} basePath - Repository root path
 * @returns {boolean}
 */
function exists(basePath) {
  return cache.exists(basePath);
}

/**
 * Check if agent-analyzer is available (compat alias for checkInstalled).
 * Previously checked ast-grep; now checks agent-analyzer.
 * @returns {Promise<{found: boolean, version?: string, tool: string}>}
 */
async function checkAstGrepInstalled() {
  return installer.checkInstalled();
}

/**
 * Get install instructions (compat alias).
 * @returns {string}
 */
function getInstallInstructions() {
  return installer.getInstallInstructions();
}

module.exports = {
  init,
  update,
  status,
  load,
  exists,
  checkAstGrepInstalled,
  getInstallInstructions,

  // Re-export submodules for advanced usage
  installer,
  cache,
  updater
};
