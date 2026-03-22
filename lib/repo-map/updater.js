'use strict';

/**
 * Repo map staleness checker.
 *
 * Determines whether a cached repo-map is stale relative to the current git HEAD.
 * The incremental update path is handled by agent-analyzer (repo-intel update).
 *
 * @module lib/repo-map/updater
 */

const { execFileSync } = require('child_process');

const cache = require('./cache');

/**
 * Check whether the cached map is stale
 * @param {string} basePath - Repository root path
 * @param {Object} map - Cached repo map
 * @returns {{isStale: boolean, reason: string|null, commitsBehind: number, suggestFullRebuild: boolean}}
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

function isValidCommitHash(commit) {
  return typeof commit === 'string' && /^[0-9a-fA-F]{4,40}$/.test(commit);
}

function commitExists(basePath, commit) {
  if (!isValidCommitHash(commit)) return false;
  try {
    execFileSync('git', ['cat-file', '-e', commit], { cwd: basePath, stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranch(basePath) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: basePath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

function getCommitsBehind(basePath, commit) {
  if (!isValidCommitHash(commit)) return 0;
  try {
    const out = execFileSync('git', ['rev-list', `${commit}..HEAD`, '--count'], {
      cwd: basePath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return Number(out) || 0;
  } catch {
    return 0;
  }
}

module.exports = { checkStaleness };
