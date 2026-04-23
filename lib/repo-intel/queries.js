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

const path = require('path');
const binary = require('../binary');
const { getStateDirPath } = require('../platform/state-dir');

const MAP_FILENAME = 'repo-intel.json';

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
 * Run a binary query and return the parsed JSON result.
 *
 * @param {string} basePath - Repository root
 * @param {string[]} queryArgs - Arguments after `repo-intel query`
 * @returns {Object|Array} Parsed query result
 */
function runQuery(basePath, queryArgs) {
  const args = ['repo-intel', 'query', ...queryArgs, '--map-file', mapFilePath(basePath), basePath];
  const output = binary.runAnalyzer(args);
  return JSON.parse(output);
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
 * @param {string} basePath
 * @param {string[]} files - List of changed file paths
 */
function diffRisk(basePath, files) {
  return runQuery(basePath, ['diff-risk', '--files', files.join(',')]);
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
  return runQuery(basePath, ['community-health', String(id)]);
}

module.exports = {
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
