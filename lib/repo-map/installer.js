'use strict';

/**
 * agent-analyzer binary availability check.
 *
 * Replaces the former ast-grep installer. The agent-analyzer binary is
 * auto-downloaded by agent-core on first use - no manual install required.
 *
 * @module lib/repo-map/installer
 */

const binary = require('../binary');

/**
 * Check if agent-analyzer is available (async). Downloads if missing.
 * @returns {Promise<{found: boolean, version?: string, tool: string}>}
 */
async function checkInstalled() {
  if (binary.isAvailable()) {
    return { found: true, version: binary.getVersion(), tool: 'agent-analyzer' };
  }
  try {
    await binary.ensureBinary();
    return { found: true, version: binary.getVersion(), tool: 'agent-analyzer' };
  } catch (e) {
    return { found: false, error: e.message, tool: 'agent-analyzer' };
  }
}

/**
 * Check if agent-analyzer is available (sync). Downloads if missing.
 * @returns {{found: boolean, version?: string, tool: string}}
 */
function checkInstalledSync() {
  if (binary.isAvailable()) {
    return { found: true, version: binary.getVersion(), tool: 'agent-analyzer' };
  }
  try {
    binary.ensureBinarySync();
    return { found: true, version: binary.getVersion(), tool: 'agent-analyzer' };
  } catch (e) {
    return { found: false, error: e.message, tool: 'agent-analyzer' };
  }
}

/**
 * Version check is handled by the binary module - always true when found.
 * @returns {boolean}
 */
function meetsMinimumVersion() {
  return true;
}

/**
 * Get install instructions (binary is auto-downloaded, but here for compat).
 * @returns {string}
 */
function getInstallInstructions() {
  return 'agent-analyzer is downloaded automatically on first use from https://github.com/agent-sh/agent-analyzer/releases';
}

/**
 * Get minimum version string.
 * @returns {string}
 */
function getMinimumVersion() {
  return '0.3.0';
}

module.exports = {
  checkInstalled,
  checkInstalledSync,
  meetsMinimumVersion,
  getInstallInstructions,
  getMinimumVersion,
  // Stub: runner.js references this but is no longer the scan path
  getCommand: () => null
};
