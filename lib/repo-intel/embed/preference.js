'use strict';

/**
 * User preference for the embedder. Persists the answer to two
 * one-time prompts so subsequent enrich runs don't re-ask:
 *
 *   embedder       : "none" | "small" | "big"
 *   embedderDetail : "compact" | "balanced" | "maximum"
 *
 * Stored in `<stateDir>/sources/preference.json` alongside the existing
 * task source preference (so the user has a single place to clear all
 * cached choices via `/repo-intel embed reset`).
 *
 * @module lib/embed/preference
 */

const fs = require('fs');
const path = require('path');
const cache = require('../cache');

const VALID_EMBEDDER = ['none', 'small', 'big'];
const VALID_DETAIL = ['compact', 'balanced', 'maximum'];

// State-directory resolution delegates to `cache.getStateDirPath` so
// the embedder reads/writes the same directory the artifact loader
// uses. Reviewer-flagged split-brain risk: an inline copy here would
// drift on candidate order, env-var support, or other policy and
// silently land preferences in a different place than the map file.
function preferencePath(cwd) {
  return path.join(cache.getStateDirPath(cwd), 'sources', 'preference.json');
}

/**
 * Load preference from disk. Returns an empty object when absent or
 * unreadable so callers can treat "unset" uniformly.
 *
 * @param {string} cwd
 * @returns {{embedder?: string, embedderDetail?: string}}
 */
function read(cwd) {
  const p = preferencePath(cwd);
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) {
    return {};
  }
}

/**
 * Merge updates into the on-disk preference file. Creates the
 * containing directory if needed.
 *
 * @param {string} cwd
 * @param {Object} patch  fields to set/overwrite
 * @returns {Object} the merged preference
 */
function update(cwd, patch) {
  const current = read(cwd);
  const next = Object.assign({}, current, patch || {});
  const p = preferencePath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2));
  return next;
}

/**
 * Strip embedder fields from preference. Used by `embed reset` to
 * trigger fresh prompts on the next enrich.
 *
 * @param {string} cwd
 */
function reset(cwd) {
  const current = read(cwd);
  delete current.embedder;
  delete current.embedderDetail;
  const p = preferencePath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(current, null, 2));
}

/**
 * Did the user already answer the embedder install prompt?
 *
 * @param {string} cwd
 * @returns {boolean}
 */
function hasEmbedderChoice(cwd) {
  const pref = read(cwd);
  return VALID_EMBEDDER.includes(pref.embedder);
}

/**
 * Did the user already answer the detail prompt? Only meaningful when
 * embedder !== 'none'.
 *
 * @param {string} cwd
 * @returns {boolean}
 */
function hasDetailChoice(cwd) {
  const pref = read(cwd);
  return VALID_DETAIL.includes(pref.embedderDetail);
}

/**
 * Translate the user-facing detail label into the analyzer-embed CLI
 * value. Centralizes the mapping so the CLI flag never appears as a
 * string literal scattered across modules.
 *
 * @param {string} detail
 * @returns {string}
 */
function detailToCliArg(detail) {
  switch (detail) {
    case 'compact':
      return 'compact';
    case 'maximum':
      return 'maximum';
    case 'balanced':
    default:
      return 'balanced';
  }
}

module.exports = {
  read,
  update,
  reset,
  hasEmbedderChoice,
  hasDetailChoice,
  detailToCliArg,
  preferencePath,
  VALID_EMBEDDER,
  VALID_DETAIL
};
