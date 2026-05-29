'use strict';

/**
 * Typed wrappers over `agent-analyzer repo-intel query <type>` subcommands.
 *
 * Each function constructs the exact argv expected by the binary, delegates to
 * `binary.runAnalyzer`, parses the JSON output, and returns the result.
 *
 * All functions throw `RepoIntelMissingError` when the repo-intel map file
 * has not been generated yet (run `agentsys repo-intel update` first).
 *
 * @module lib/repo-intel/queries
 */

const fs = require('fs');
const path = require('path');
const { getStateDir } = require('../platform/state-dir');
const binary = require('../binary');

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown when the repo-intel map file is absent.
 */
class RepoIntelMissingError extends Error {
  /**
   * @param {string} mapFile - Expected path to the map file
   */
  constructor(mapFile) {
    super(
      `repo-intel map not found at ${mapFile}. ` +
      'Run `agentsys repo-intel update` to generate it first.'
    );
    this.name = 'RepoIntelMissingError';
    this.code = 'REPO_INTEL_MISSING';
    this.mapFile = mapFile;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MAP_FILE_NAME = 'repo-intel.json';

/**
 * Resolve the map file path for a given project root.
 * @param {string} cwd
 * @returns {string}
 */
function resolveMapFile(cwd) {
  const stateDir = getStateDir(cwd);
  return path.join(cwd, stateDir, MAP_FILE_NAME);
}

/**
 * Assert the map file exists, throwing `RepoIntelMissingError` if not.
 * @param {string} cwd
 * @returns {string} resolved map file path
 */
function requireMapFile(cwd) {
  const mapFile = resolveMapFile(cwd);
  if (!fs.existsSync(mapFile)) {
    throw new RepoIntelMissingError(mapFile);
  }
  return mapFile;
}

/**
 * Run a repo-intel query and parse JSON output.
 * @param {string} queryName - The subcommand name (e.g. 'hotspots')
 * @param {string[]} extraArgs - Additional argv elements
 * @param {string} cwd - Project root
 * @returns {*} Parsed JSON result
 */
function runQuery(queryName, extraArgs, cwd) {
  const mapFile = requireMapFile(cwd);
  const args = ['repo-intel', 'query', queryName, ...extraArgs, '--map-file', mapFile, cwd];
  let raw;
  try {
    raw = binary.runAnalyzer(args);
  } catch (err) {
    throw new Error(
      `repo-intel query failed [${queryName}]: ${err.message}`,
      { cause: err }
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_parseErr) {
    const preview = raw.slice(0, 200);
    throw new Error(
      `repo-intel query [${queryName}] returned non-JSON output: ${preview}`
    );
  }
  return parsed;
}

/**
 * Assert a query argument is a non-empty string. Centralizes the validation
 * that file/symbol/concept-taking queries share, so a wrong-typed arg fails
 * with a clear message instead of being stringified into a bogus CLI argument.
 * @param {*} val - the value to check
 * @param {string} label - "<fn>: <arg>" for the error message
 */
function assertString(val, label) {
  if (typeof val !== 'string' || val.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Hotspot files by change frequency.
 * @param {string} cwd
 * @param {{ limit?: number }} [opts]
 * @returns {Array}
 */
function hotspots(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('hotspots', extra, cwd);
}

/**
 * Co-change coupling for a file.
 * @param {string} cwd
 * @param {string} file
 * @param {{ limit?: number }} [opts]
 * @returns {Array}
 */
function coupling(cwd, file, opts = {}) {
  assertString(file, 'coupling: file');
  const extra = [file];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('coupling', extra, cwd);
}

/**
 * Bus factor report.
 * @param {string} cwd
 * @param {{ adjustForAi?: boolean, limit?: number }} [opts]
 * @returns {Object}
 */
function busFactor(cwd, opts = {}) {
  const extra = [];
  if (opts.adjustForAi) extra.push('--adjust-for-ai');
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('bus-factor', extra, cwd);
}

/**
 * Files with low test coverage relative to change frequency.
 * @param {string} cwd
 * @param {{ limit?: number, minChanges?: number }} [opts]
 * @returns {Array}
 */
function testGaps(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  if (opts.minChanges != null) extra.push('--min-changes', String(opts.minChanges));
  return runQuery('test-gaps', extra, cwd);
}


/**
 * Risk score for a diff (set of changed files).
 * @param {string} cwd
 * @param {string[]} files
 * @returns {Array}
 */
function diffRisk(cwd, files) {
  if (!Array.isArray(files)) {
    throw new TypeError('diffRisk: files must be an array of strings');
  }
  if (!files.every(f => typeof f === 'string')) {
    throw new TypeError('diffRisk: all entries in files must be strings');
  }
  const joined = files.join(',');
  if (joined.length > 30000) {
    throw new RangeError(
      `diffRisk: files argument exceeds 30000 character limit (got ${joined.length})`
    );
  }
  const extra = ['--files', joined];
  return runQuery('diff-risk', extra, cwd);
}

/**
 * Call-graph dependents of a symbol.
 * @param {string} cwd
 * @param {string} symbol
 * @param {string} [file] - Scope to a specific file
 * @returns {Object}
 */
function dependents(cwd, symbol, file) {
  assertString(symbol, 'dependents: symbol');
  const extra = [symbol];
  if (file != null) {
    assertString(file, 'dependents: file');
    extra.push('--file', file);
  }
  return runQuery('dependents', extra, cwd);
}

/**
 * Bugspot risk scores.
 * @param {string} cwd
 * @param {{ limit?: number }} [opts]
 * @returns {Array}
 */
function bugspots(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('bugspots', extra, cwd);
}

/**
 * Project health summary.
 * @param {string} cwd
 * @returns {Object}
 */
function health(cwd) {
  return runQuery('health', [], cwd);
}

// ---------------------------------------------------------------------------
// Graph queries (Phase 5.1 - agent-analyzer v0.4.0+)
// ---------------------------------------------------------------------------

/**
 * Louvain-discovered file communities.
 * @param {string} cwd
 * @returns {Array}
 */
function communities(cwd) {
  return runQuery('communities', [], cwd);
}

/**
 * Files bridging multiple communities (architectural seams).
 * @param {string} cwd
 * @param {{ limit?: number }} [opts]
 * @returns {Array}
 */
function boundaries(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('boundaries', extra, cwd);
}

/**
 * Which community a file belongs to.
 * @param {string} cwd
 * @param {string} file
 * @returns {Object}
 */
function areaOf(cwd, file) {
  assertString(file, 'areaOf: file');
  return runQuery('area-of', [file], cwd);
}

/**
 * Composite health roll-up for a community.
 * @param {string} cwd
 * @param {number} id - Community id (non-negative integer)
 * @returns {Object}
 */
function communityHealth(cwd, id) {
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) {
    throw new TypeError(
      'communityHealth: id must be a non-negative integer'
    );
  }
  return runQuery('community-health', [String(id)], cwd);
}

// ---------------------------------------------------------------------------
// Activity / git queries
// ---------------------------------------------------------------------------

/** Least-changed files (no recent activity). @param {string} cwd @param {{limit?:number}} [opts] */
function coldspots(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('coldspots', extra, cwd);
}

/** Ownership for a file or directory. @param {string} cwd @param {string} file */
function ownership(cwd, file) {
  assertString(file, 'ownership: file');
  return runQuery('ownership', [file], cwd);
}

/** Project norms detected from git history. @param {string} cwd */
function norms(cwd) {
  return runQuery('norms', [], cwd);
}

/** Area-level health overview. @param {string} cwd */
function areas(cwd) {
  return runQuery('areas', [], cwd);
}

/** Contributors sorted by commit count. @param {string} cwd @param {{limit?:number}} [opts] */
function contributors(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('contributors', extra, cwd);
}

/** Release cadence and tag info. @param {string} cwd */
function releaseInfo(cwd) {
  return runQuery('release-info', [], cwd);
}

/** History for a specific file. @param {string} cwd @param {string} file */
function fileHistory(cwd, file) {
  assertString(file, 'fileHistory: file');
  return runQuery('file-history', [file], cwd);
}

/** Commit message conventions. @param {string} cwd */
function conventions(cwd) {
  return runQuery('conventions', [], cwd);
}

/** Doc files with low code coupling (likely stale). @param {string} cwd @param {{limit?:number}} [opts] */
function docDrift(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('doc-drift', extra, cwd);
}

// ---------------------------------------------------------------------------
// Narrative / guidance queries
// ---------------------------------------------------------------------------

/** Newcomer-oriented repo summary. @param {string} cwd */
function onboard(cwd) {
  return runQuery('onboard', [], cwd);
}

/** Contributor guidance matching skills to areas needing work. @param {string} cwd */
function canIHelp(cwd) {
  return runQuery('can-i-help', [], cwd);
}

/** Files ranked by pain score (hotspot x complexity x bug density). @param {string} cwd @param {{limit?:number}} [opts] */
function painspots(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('painspots', extra, cwd);
}

/** Every place execution can start (binaries, main fns, npm scripts). @param {string} cwd @param {{files?:string[]|string}} [opts] */
function entryPoints(cwd, opts = {}) {
  const extra = [];
  if (opts.files) {
    const list = Array.isArray(opts.files) ? opts.files.join(',') : String(opts.files);
    extra.push('--files', list);
  }
  return runQuery('entry-points', extra, cwd);
}

/** Project metadata: languages, CI, license, README. @param {string} cwd */
function projectInfo(cwd) {
  return runQuery('project-info', [], cwd);
}

// ---------------------------------------------------------------------------
// AST / symbol queries
// ---------------------------------------------------------------------------

/** AST symbols (exports/imports/definitions) for a file. @param {string} cwd @param {string} file */
function symbols(cwd, file) {
  assertString(file, 'symbols: file');
  return runQuery('symbols', [file], cwd);
}

/** Doc files with stale references to source symbols. @param {string} cwd @param {{limit?:number}} [opts] */
function staleDocs(cwd, opts = {}) {
  const extra = [];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('stale-docs', extra, cwd);
}

/** Concept-to-file search (ranked, replaces grep -r). @param {string} cwd @param {string} query @param {{limit?:number}} [opts] */
function find(cwd, query, opts = {}) {
  assertString(query, 'find: query');
  const extra = [query];
  if (opts.limit != null) extra.push('--top', String(opts.limit));
  return runQuery('find', extra, cwd);
}

// ---------------------------------------------------------------------------
// Deslop-agent queries
// ---------------------------------------------------------------------------

/** Structured slop fix actions for the deslop agent. @param {string} cwd */
function slopFixes(cwd) {
  return runQuery('slop-fixes', [], cwd);
}

/** Ranked slop targets (Sonnet/Opus tiers). @param {string} cwd @param {{top?:number}} [opts] */
function slopTargets(cwd, opts = {}) {
  const extra = [];
  if (opts.top != null) extra.push('--top', String(opts.top));
  return runQuery('slop-targets', extra, cwd);
}

/**
 * Cached 3-depth narrative summary. Returns null when not yet generated;
 * with opts.depth returns that single depth as plain text. Bypasses the
 * JSON-parse path because the binary emits the literal 'null' or raw text.
 * @param {string} cwd @param {{depth?:1|3|10}} [opts]
 */
function summary(cwd, opts = {}) {
  const mapFile = requireMapFile(cwd);
  const extra = [];
  if (opts.depth != null) extra.push('--depth', String(opts.depth));
  const args = ['repo-intel', 'query', 'summary', ...extra, '--map-file', mapFile, cwd];
  // summary bypasses runQuery (a single --depth returns plain text, not JSON),
  // so it must wrap the analyzer call + parse itself to match runQuery's error
  // contract instead of leaking a raw spawn / SyntaxError.
  let raw;
  try {
    raw = binary.runAnalyzer(args).trim();
  } catch (err) {
    throw new Error(`repo-intel query failed [summary]: ${err.message}`, { cause: err });
  }
  if (raw === 'null') return null;
  if (opts.depth != null) return raw; // plain-text single depth
  try {
    return JSON.parse(raw);
  } catch (_parseErr) {
    throw new Error(
      `repo-intel query [summary] returned non-JSON output: ${raw.slice(0, 200)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Error class
  RepoIntelMissingError,

  // Core queries
  hotspots,
  coupling,
  busFactor,
  testGaps,
  diffRisk,
  dependents,
  bugspots,
  health,

  // Graph queries
  communities,
  boundaries,
  areaOf,
  communityHealth,

  // Activity / git queries
  coldspots,
  ownership,
  norms,
  areas,
  contributors,
  releaseInfo,
  fileHistory,
  conventions,
  docDrift,

  // Narrative / guidance queries
  onboard,
  canIHelp,
  painspots,
  entryPoints,
  projectInfo,

  // AST / symbol queries
  symbols,
  staleDocs,
  find,

  // Deslop-agent queries
  slopFixes,
  slopTargets,
  summary,
};
