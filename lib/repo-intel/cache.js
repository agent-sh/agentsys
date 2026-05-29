/**
 * Repo map cache management
 *
 * @module lib/repo-intel/cache
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getStateDirPath } = require('../platform/state-dir');
const { writeJsonAtomic, writeFileAtomic } = require('../utils/atomic-write');

const MAP_FILENAME = 'repo-map.json';
const STALE_FILENAME = 'repo-map.stale';
const INTEL_FILENAME = 'repo-intel.json';

/**
 * Get repo-map path (the converted view artifact).
 * @param {string} basePath - Repository root
 * @returns {string}
 */
function getMapPath(basePath) {
  return path.join(getStateDirPath(basePath), MAP_FILENAME);
}

/**
 * Get the RAW repo-intel.json path (the binary's native artifact).
 * The embed submodule (orchestrator.js) feeds this to the embed binary's
 * --map-file. In the standalone layout cache.getPath returned repo-intel.json;
 * the fold renamed the converted-view accessor to getMapPath, so getPath keeps
 * its original raw-artifact meaning. Mirrors index.js getIntelMapPath.
 * @param {string} basePath - Repository root
 * @returns {string}
 */
function getPath(basePath) {
  return path.join(getStateDirPath(basePath), INTEL_FILENAME);
}

/**
 * Get stale marker path
 * @param {string} basePath - Repository root
 * @returns {string}
 */
function getStalePath(basePath) {
  return path.join(getStateDirPath(basePath), STALE_FILENAME);
}

/**
 * Ensure state directory exists
 * @param {string} basePath - Repository root
 * @returns {string}
 */
function ensureStateDir(basePath) {
  const stateDir = getStateDirPath(basePath);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  return stateDir;
}

/**
 * Load repo-map from cache
 * @param {string} basePath - Repository root
 * @returns {Object|null}
 */
function load(basePath) {
  const mapPath = getMapPath(basePath);
  if (!fs.existsSync(mapPath)) return null;

  try {
    const raw = fs.readFileSync(mapPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save repo-map to cache
 * @param {string} basePath - Repository root
 * @param {Object} map - Map object
 */
function save(basePath, map) {
  ensureStateDir(basePath);
  const mapPath = getMapPath(basePath);

  const output = {
    ...map,
    updated: new Date().toISOString()
  };

  writeJsonAtomic(mapPath, output);

  // Clear stale marker if present
  clearStale(basePath);
}

/**
 * Check if repo-map exists
 * @param {string} basePath - Repository root
 * @returns {boolean}
 */
function exists(basePath) {
  return fs.existsSync(getMapPath(basePath));
}

/**
 * Mark repo-map as stale
 * @param {string} basePath - Repository root
 */
function markStale(basePath) {
  ensureStateDir(basePath);
  writeFileAtomic(getStalePath(basePath), new Date().toISOString());
}

/**
 * Clear stale marker
 * @param {string} basePath - Repository root
 */
function clearStale(basePath) {
  const stalePath = getStalePath(basePath);
  if (fs.existsSync(stalePath)) {
    fs.unlinkSync(stalePath);
  }
}

/**
 * Check if stale marker exists
 * @param {string} basePath - Repository root
 * @returns {boolean}
 */
function isMarkedStale(basePath) {
  return fs.existsSync(getStalePath(basePath));
}

/**
 * Get basic status summary
 * @param {string} basePath - Repository root
 * @returns {Object|null}
 */
function getStatus(basePath) {
  const map = load(basePath);
  if (!map) return null;

  return {
    generated: map.generated,
    updated: map.updated,
    commit: map.git?.commit,
    branch: map.git?.branch,
    files: Object.keys(map.files || {}).length,
    symbols: map.stats?.totalSymbols || 0,
    languages: map.project?.languages || []
  };
}

module.exports = {
  load,
  save,
  exists,
  getStatus,
  getMapPath,
  // getPath -> raw repo-intel.json (embed orchestrator); getStateDirPath
  // re-exported for embed/preference.js. Both delegate to platform/state-dir
  // and match the names the standalone cache exposed.
  getPath,
  getStateDirPath,
  markStale,
  clearStale,
  isMarkedStale
};
