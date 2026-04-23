/**
 * Repo intel query functions
 *
 * Typed wrappers over `agent-analyzer repo-intel query <type>` subcommands.
 * Consumer plugins can call these instead of constructing CLI args by hand:
 *
 *   const { repoIntel } = require('@agentsys/lib');
 *   const hot = repoIntel.queries.hotspots(cwd, { limit: 20 });
 *
 * Each function resolves the cached `repo-intel.json` via the platform
 * state-dir helper and shells out to the binary downloaded by lib/binary.
 *
 * @module lib/repo-intel/queries
 */

'use strict';

const fs = require('fs');
const path = require('path');
const binary = require('../binary');
const { getStateDirPath } = require('../platform/state-dir');

const MAP_FILENAME = 'repo-intel.json';

// Conservative bound on a single CLI argument length. Windows cmd-line max
// is ~32 KB total; modern Linux/macOS typically allow ~128 KB. We throw an
// actionable error rather than letting `execFileSync` fail with a cryptic
// E2BIG/ENAMETOOLONG, which would otherwise look like a binary crash to
// the caller.
const MAX_FILES_ARG_LEN = 30000;

/**
 * Absolute path to the cached repo-intel artifact for `basePath`.
 *
 * @param {string} basePath
 * @returns {string}
 */
function mapFilePath(basePath) {
  return path.join(getStateDirPath(basePath), MAP_FILENAME);
}

/**
 * Error thrown when the cached repo-intel artifact is missing.
 * Distinguished by a `.code = 'REPO_INTEL_MISSING'` field so callers can
 * choose between auto-init, fallback, or surfacing the message.
 */
class RepoIntelMissingError extends Error {
  constructor(mapFile) {
    super(
      `repo-intel artifact not found at ${mapFile}. Run ` +
        '`agent-analyzer repo-intel init <path>` (or `/repo-intel init` ' +
        'in a CC plugin) first to create it.'
    );
    this.name = 'RepoIntelMissingError';
    this.code = 'REPO_INTEL_MISSING';
    this.mapFile = mapFile;
  }
}

/**
 * Run a binary query and return the parsed JSON result.
 *
 * @param {string} basePath - Repository root
 * @param {string[]} queryArgs - Arguments after `repo-intel query`
 * @returns {Object|Array} Parsed query result
 * @throws {RepoIntelMissingError} If the cached artifact is missing.
 * @throws {Error} If the binary fails or returns non-JSON output (with
 *   the failing query and an output preview included in the message).
 */
function runQuery(basePath, queryArgs) {
  const mapFile = mapFilePath(basePath);

  // Surface a clear "run init first" message instead of letting the binary
  // exit non-zero with a low-level "no such file" error that would bubble
  // up unannotated through `binary.runAnalyzer`.
  if (!fs.existsSync(mapFile)) {
    throw new RepoIntelMissingError(mapFile);
  }

  const args = ['repo-intel', 'query', ...queryArgs, '--map-file', mapFile, basePath];

  let output;
  try {
    output = binary.runAnalyzer(args);
  } catch (err) {
    // Wrap so the caller learns which query failed without having to dig
    // through the CLI argv. The original error stays as `cause`.
    const wrapped = new Error(
      `repo-intel query failed (${queryArgs.join(' ')}): ${err.message}`
    );
    wrapped.cause = err;
    throw wrapped;
  }

  try {
    return JSON.parse(output);
  } catch (err) {
    const preview = output && output.length > 0 ? output.slice(0, 200) : '<empty>';
    const wrapped = new Error(
      `repo-intel query returned non-JSON output (${queryArgs.join(' ')}): ${preview}`
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

// ─── Activity ───────────────────────────────────────────────────────────────

/**
 * Return files sorted by recency-weighted change score.
 *
 * @param {string} basePath
 * @param {Object} [options={}]
 * @param {number} [options.limit] - Maximum number of results
 */
function hotspots(basePath, options = {}) {
  const args = ['hotspots'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

/**
 * Return least-changed files (no recent activity).
 */
function coldspots(basePath, options = {}) {
  const args = ['coldspots'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

/**
 * Return change history for a specific file.
 */
function fileHistory(basePath, file) {
  return runQuery(basePath, ['file-history', file]);
}

// ─── Quality ────────────────────────────────────────────────────────────────

/**
 * Return files with highest bug-fix density.
 */
function bugspots(basePath, options = {}) {
  const args = ['bugspots'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

/**
 * Return hot source files with no co-changing test file.
 */
function testGaps(basePath, options = {}) {
  const args = ['test-gaps'];
  if (options.limit) args.push('--top', String(options.limit));
  if (options.minChanges) args.push('--min-changes', String(options.minChanges));
  return runQuery(basePath, args);
}

/**
 * Score changed files by composite risk.
 *
 * Validates the joined file argument fits within the platform's argv length
 * cap before shelling out (Windows is the tight constraint at ~32 KB).
 * Callers with very large diffs should batch.
 *
 * @param {string} basePath
 * @param {string[]} files - List of changed file paths
 * @throws {TypeError} If `files` is not an array of strings.
 * @throws {RangeError} If the joined argument exceeds {@link MAX_FILES_ARG_LEN}.
 */
function diffRisk(basePath, files) {
  if (!Array.isArray(files) || !files.every((f) => typeof f === 'string')) {
    throw new TypeError('diffRisk: `files` must be an array of strings');
  }
  const joined = files.join(',');
  if (joined.length > MAX_FILES_ARG_LEN) {
    throw new RangeError(
      `diffRisk: joined file argument is ${joined.length} chars, ` +
        `exceeds platform-safe limit of ${MAX_FILES_ARG_LEN}. ` +
        `Split the request into batches (~500 paths each is typically safe).`
    );
  }
  return runQuery(basePath, ['diff-risk', '--files', joined]);
}

/**
 * Files ranked by hotspot × (1 + bug_rate) × (1 + complexity/30). Requires
 * Phase 2 AST data; falls back to git-only when unavailable.
 */
function painspots(basePath, options = {}) {
  const args = ['painspots'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

// ─── People ─────────────────────────────────────────────────────────────────

/**
 * Return ownership breakdown for a file or directory.
 */
function ownership(basePath, file) {
  return runQuery(basePath, ['ownership', file]);
}

/**
 * Return contributors sorted by commit count.
 */
function contributors(basePath, options = {}) {
  const args = ['contributors'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

/**
 * Detailed bus factor with critical owners and at-risk areas.
 */
function busFactor(basePath, options = {}) {
  const args = ['bus-factor'];
  if (options.adjustForAi) args.push('--adjust-for-ai');
  return runQuery(basePath, args);
}

// ─── Coupling ───────────────────────────────────────────────────────────────

/**
 * Files that frequently change together with `file`.
 */
function coupling(basePath, file) {
  return runQuery(basePath, ['coupling', file]);
}

// ─── Standards ──────────────────────────────────────────────────────────────

/**
 * Project norms (commit conventions, etc.) detected from git history.
 */
function norms(basePath) {
  return runQuery(basePath, ['norms']);
}

/**
 * Commit message style + prefixes + scope usage.
 */
function conventions(basePath) {
  return runQuery(basePath, ['conventions']);
}

// ─── Health ─────────────────────────────────────────────────────────────────

/**
 * Directory-level health overview.
 */
function areas(basePath) {
  return runQuery(basePath, ['areas']);
}

/**
 * Repository-wide health summary.
 */
function health(basePath) {
  return runQuery(basePath, ['health']);
}

/**
 * Release cadence and tag history.
 */
function releaseInfo(basePath) {
  return runQuery(basePath, ['release-info']);
}

// ─── AI detection ───────────────────────────────────────────────────────────

/**
 * AI vs human contribution ratio.
 */
function aiRatio(basePath, options = {}) {
  const args = ['ai-ratio'];
  if (options.pathFilter) args.push('--path-filter', options.pathFilter);
  return runQuery(basePath, args);
}

/**
 * Files with recent AI-authored changes.
 */
function recentAi(basePath, options = {}) {
  const args = ['recent-ai'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

// ─── Contributor guidance ───────────────────────────────────────────────────

/**
 * Newcomer-oriented repo summary (tech stack, key areas, pain points).
 */
function onboard(basePath) {
  return runQuery(basePath, ['onboard']);
}

/**
 * Contribution guidance: good-first areas, test gaps, doc drift, bugspots.
 */
function canIHelp(basePath) {
  return runQuery(basePath, ['can-i-help']);
}

// ─── Documentation ──────────────────────────────────────────────────────────

/**
 * Doc files with low code coupling (likely stale).
 */
function docDrift(basePath, options = {}) {
  const args = ['doc-drift'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

/**
 * Doc files with stale references to source symbols. Requires Phase 4
 * sync-check data.
 */
function staleDocs(basePath, options = {}) {
  const args = ['stale-docs'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

// ─── AST symbols ────────────────────────────────────────────────────────────

/**
 * AST symbols (exports, imports, definitions) for a specific file. Requires
 * Phase 2 AST data.
 */
function symbols(basePath, file) {
  return runQuery(basePath, ['symbols', file]);
}

/**
 * Files that import a given symbol (reverse dependency lookup). Requires
 * Phase 2 AST data.
 */
function dependents(basePath, symbol, file) {
  const args = ['dependents', symbol];
  if (file) args.push('--file', file);
  return runQuery(basePath, args);
}

// ─── Phase 5: Graph-derived (analyzer-graph crate) ──────────────────────────

/**
 * Communities discovered by Louvain modularity over the co-change graph.
 * Returns clusters of files that consistently change together - the natural
 * feature areas, independent of directory layout. Requires agent-analyzer
 * v0.4.0+.
 *
 * @param {string} basePath
 * @returns {Array<{id: number, size: number, files: string[]}>}
 */
function communities(basePath) {
  return runQuery(basePath, ['communities']);
}

/**
 * Files bridging multiple communities (high betweenness centrality). These
 * are the architectural seams - the highest-leverage files for refactoring
 * decisions. Requires agent-analyzer v0.4.0+.
 *
 * @param {string} basePath
 * @param {Object} [options={}]
 * @param {number} [options.limit] - Maximum number of results
 * @returns {Array<{path: string, betweenness: number, community: number|null}>}
 */
function boundaries(basePath, options = {}) {
  const args = ['boundaries'];
  if (options.limit) args.push('--top', String(options.limit));
  return runQuery(basePath, args);
}

/**
 * Look up which community a given file belongs to. Requires agent-analyzer
 * v0.4.0+.
 *
 * @param {string} basePath
 * @param {string} file - File path (relative to repo root)
 * @returns {{file: string, community: number|null, size: number|null}}
 */
function areaOf(basePath, file) {
  return runQuery(basePath, ['area-of', file]);
}

/**
 * Composite per-community health: total/recent changes, bug-fix rate,
 * AI ratio, stale-owner count. Use to identify communities under stress
 * (high bug rate or stale ownership). Requires agent-analyzer v0.4.0+.
 *
 * @param {string} basePath
 * @param {number} id - Community id (from `communities()`)
 * @returns {Object|null}
 */
function communityHealth(basePath, id) {
  if (!Number.isInteger(id) || id < 0) {
    throw new TypeError(
      `communityHealth: \`id\` must be a non-negative integer, got: ${id} (${typeof id})`
    );
  }
  return runQuery(basePath, ['community-health', String(id)]);
}

module.exports = {
  // Errors
  RepoIntelMissingError,
  // Activity
  hotspots,
  coldspots,
  fileHistory,
  // Quality
  bugspots,
  testGaps,
  diffRisk,
  painspots,
  // People
  ownership,
  contributors,
  busFactor,
  // Coupling
  coupling,
  // Standards
  norms,
  conventions,
  // Health
  areas,
  health,
  releaseInfo,
  // AI detection
  aiRatio,
  recentAi,
  // Contributor guidance
  onboard,
  canIHelp,
  // Documentation
  docDrift,
  staleDocs,
  // AST symbols
  symbols,
  dependents,
  // Phase 5: graph-derived
  communities,
  boundaries,
  areaOf,
  communityHealth,
};
