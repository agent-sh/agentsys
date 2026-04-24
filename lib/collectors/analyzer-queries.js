/**
 * Analyzer Queries Collector
 *
 * Runs the agent-analyzer `repo-intel query ...` commands we consume and
 * returns them as a single indexed bundle. Replaces the per-file regex +
 * git-show path in docs-patterns.js with the analyzer's symbol table and
 * slop-fix outputs, both of which are deterministic and cross-language.
 *
 * All queries degrade gracefully: if the binary is missing or the map
 * file isn't present, each field is `null` and the reason is recorded on
 * the bundle. Callers should treat `null` as "signal unavailable" and
 * skip the corresponding checks rather than invent fallback data.
 *
 * @module lib/collectors/analyzer-queries
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_OPTIONS = {
  cwd: process.cwd()
};

// Docs that `doc-drift` flags as uncoupled by design. These are never
// expected to co-change with code (Docusaurus snapshots, test fixtures,
// generated rule pages, CHANGELOG is append-only). Matching these is
// not evidence of drift; they're just not part of the live doc surface.
const DEFAULT_DOC_DRIFT_IGNORE = [
  /(^|\/)versioned_docs\//,
  /(^|\/)versioned_sidebars\//,
  /(^|\/)tests\/fixtures\//,
  /(^|\/)__fixtures__\//,
  /(^|\/)generated\//,
  /\.generated\.md$/,
  /(^|\/)CHANGELOG\.md$/i,
  /(^|\/)node_modules\//,
  /(^|\/)target\//,
  /(^|\/)dist\//,
  /(^|\/)build\//
];

function resolveStateDir(cwd) {
  for (const dir of ['.claude', '.opencode', '.codex']) {
    if (fs.existsSync(path.join(cwd, dir))) {
      return dir;
    }
  }
  return '.claude';
}

function resolveMapFile(cwd) {
  return path.join(cwd, resolveStateDir(cwd), 'repo-intel.json');
}

/**
 * Get the agent-analyzer binary runner. On main the binary is vendored
 * at `lib/binary`; once the agentsys resolver PR lands this will switch
 * to `../agentsys`. Returns `null` when unavailable — callers should
 * treat the bundle as empty rather than erroring out.
 */
function getBinary() {
  try {
    // Prefer the agentsys resolver when present (post PR #21)
    const { binary } = require('../agentsys').get();
    if (binary) return binary;
  } catch {
    // agentsys resolver not available; fall through to vendored binary
  }
  try {
    return require('../binary');
  } catch {
    return null;
  }
}

function runJson(binary, args) {
  try {
    const out = binary.runAnalyzer(args);
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/**
 * Normalize a repo-relative path: backslashes to forward slashes,
 * empty/nullish input returns `''`. Centralized so every index-key
 * construction in this module uses the same shape.
 */
function normalizePath(p) {
  return (p || '').replace(/\\/g, '/');
}

/**
 * Coerce a parsed analyzer result into an array. Nearly every query
 * returns a JSON array, but if the analyzer hands back a non-array
 * (error object, bare null, malformed output) we must not let the
 * value flow into a for-of loop where it would throw. Returns `[]`
 * for anything non-iterable.
 */
function asArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Run all analyzer queries sync-docs consumes and return an indexed
 * bundle. See `DEFAULT_DOC_DRIFT_IGNORE` for the docs filtered from
 * `docDrift`. A raw `docDriftAll` field is included so callers that
 * need the unfiltered list (e.g. explicit `--include-versioned-docs`)
 * can recover it without a second binary call.
 *
 * @param {Object} options
 * @param {string} [options.cwd]
 * @param {RegExp[]} [options.docDriftIgnore] - Override default ignore globs
 * @param {number} [options.docDriftTop=50]
 * @param {number} [options.staleDocsTop=500]
 * @returns {{
 *   available: boolean,
 *   reason: string|null,
 *   mapFile: string,
 *   staleDocs: Array|null,
 *   staleDocsByKey: Map<string, Object>|null,
 *   docDrift: Array|null,
 *   docDriftAll: Array|null,
 *   entryPoints: Array|null,
 *   entryPointSet: Set<string>|null,
 *   slopFixes: Array|null,
 *   orphanExports: Array|null,
 *   passthroughWrappers: Array|null,
 *   alwaysTrueConditions: Array|null,
 *   commentedOutCode: Array|null,
 *   staleSuppressions: Array|null
 * }}
 */
function collect(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cwd = opts.cwd;
  const mapFile = resolveMapFile(cwd);

  // Return shape is identical whether analyzer succeeded or not; the
  // `available` flag + `reason` tell callers which it is. Keeping the
  // shape stable means consumers can use `?.` uniformly without having
  // to guard per-field.
  const empty = {
    available: false,
    reason: null,
    queryErrors: [],
    mapFile,
    staleDocs: null,
    staleDocsByKey: null,
    staleDocsByDoc: null,
    docDrift: null,
    docDriftAll: null,
    entryPoints: null,
    entryPointSet: null,
    entryPointSymbols: null,
    slopFixes: null,
    orphanExports: null,
    passthroughWrappers: null,
    alwaysTrueConditions: null,
    commentedOutCode: null,
    staleSuppressions: null
  };

  const binary = getBinary();
  if (!binary) {
    return { ...empty, reason: 'analyzer-binary-unavailable' };
  }
  if (!fs.existsSync(mapFile)) {
    return { ...empty, reason: 'repo-intel-map-missing' };
  }

  const staleTop = opts.staleDocsTop ?? 500;
  const driftTop = opts.docDriftTop ?? 50;

  // Query failure tracking: if runJson returns null for any query
  // (binary exec failure, JSON parse failure), we record it in
  // `queryErrors` so the bundle can signal partial-success rather
  // than pretending the empty result was "successfully empty".
  // Callers who only care about happy-path use the category arrays
  // directly; callers who want to reason about reliability can
  // check `queryErrors`.
  const queryErrors = [];
  const runSafe = (queryName, args) => {
    const raw = runJson(binary, args);
    if (raw === null) {
      queryErrors.push(queryName);
    }
    return raw;
  };

  const staleDocs = asArray(runSafe('stale-docs', [
    'repo-intel', 'query', 'stale-docs',
    '--top', String(staleTop),
    '--map-file', mapFile,
    cwd
  ]));

  const docDriftAll = asArray(runSafe('doc-drift', [
    'repo-intel', 'query', 'doc-drift',
    '--top', String(driftTop),
    '--map-file', mapFile,
    cwd
  ]));

  const entryPoints = asArray(runSafe('entry-points', [
    'repo-intel', 'query', 'entry-points',
    '--map-file', mapFile,
    cwd
  ]));

  const slopRaw = runSafe('slop-fixes', [
    'repo-intel', 'query', 'slop-fixes',
    '--map-file', mapFile,
    cwd
  ]);
  // slop-fixes returns either a bare array or `{fixes, by_file}`.
  const slopFixes = Array.isArray(slopRaw)
    ? slopRaw
    : asArray(slopRaw?.fixes);

  // Index stale-docs by "doc:line:reference" for O(1) lookup during
  // per-file issue analysis. Also keep a second index by doc path.
  // Both keys normalize backslashes to forward slashes so Windows-path
  // output from the analyzer matches the normalized paths call sites
  // construct in docs-patterns.js.
  const staleDocsByKey = new Map();
  const staleDocsByDoc = new Map();
  for (const entry of staleDocs) {
    const normalizedDoc = normalizePath(entry.doc);
    entry.doc = normalizedDoc;
    const key = `${normalizedDoc}:${entry.line}:${entry.reference}`;
    staleDocsByKey.set(key, entry);
    if (!staleDocsByDoc.has(normalizedDoc)) {
      staleDocsByDoc.set(normalizedDoc, []);
    }
    staleDocsByDoc.get(normalizedDoc).push(entry);
  }

  // Entry-point sets are keyed on normalized paths so lookups from
  // `findUndocumentedExports` (which normalizes the file path before
  // lookup) succeed on Windows. `entryPointSymbols` is `path:name`; it
  // MUST use the same normalization as the set to keep lookups
  // consistent.
  const entryPointSet = new Set();
  const entryPointSymbols = new Set();
  for (const ep of entryPoints) {
    const normalizedPath = normalizePath(ep.path);
    if (normalizedPath) entryPointSet.add(normalizedPath);
    if (ep.name && normalizedPath) {
      entryPointSymbols.add(`${normalizedPath}:${ep.name}`);
    }
  }

  // Filter doc-drift using ignore globs. The unfiltered list stays on
  // `docDriftAll` so callers can opt back into it.
  const ignore = opts.docDriftIgnore || DEFAULT_DOC_DRIFT_IGNORE;
  const docDrift = docDriftAll.filter((entry) => {
    const p = normalizePath(entry.path);
    return !ignore.some((re) => re.test(p));
  });

  // Partition slop-fixes by category so consumers don't re-scan.
  // Single-pass loop - each category string lives in exactly one
  // place (SLOP_CATEGORY_MAP), and we walk the fixes once instead
  // of once per category. Covers the four categories plus
  // staleSuppression added in agent-analyzer v0.7.
  const SLOP_CATEGORY_MAP = {
    'orphan-export': 'orphanExports',
    'passthrough-wrapper': 'passthroughWrappers',
    'always-true-condition': 'alwaysTrueConditions',
    'commented-out-code': 'commentedOutCode',
    'stale-suppression': 'staleSuppressions'
  };
  const orphanExports = [];
  const passthroughWrappers = [];
  const alwaysTrueConditions = [];
  const commentedOutCode = [];
  const staleSuppressions = [];
  const bucketByKey = {
    orphanExports,
    passthroughWrappers,
    alwaysTrueConditions,
    commentedOutCode,
    staleSuppressions
  };
  for (const fix of slopFixes) {
    const key = SLOP_CATEGORY_MAP[fix.category];
    if (key) bucketByKey[key].push(fix);
  }

  // `available` is true when at least one query succeeded and we
  // have a usable bundle. `queryErrors` lists which specific queries
  // failed so callers can distinguish "binary missing entirely"
  // (empty arrays from the unavailable branch, reason set) from
  // "some queries succeeded, some failed" (partial bundle).
  const available = queryErrors.length < 4;
  return {
    available,
    reason: available ? null : 'all-queries-failed',
    queryErrors,
    mapFile,
    staleDocs,
    staleDocsByKey,
    staleDocsByDoc,
    docDrift,
    docDriftAll,
    entryPoints,
    entryPointSet,
    entryPointSymbols,
    slopFixes,
    orphanExports,
    passthroughWrappers,
    alwaysTrueConditions,
    commentedOutCode,
    staleSuppressions
  };
}

/**
 * Check whether a given (path, symbol) pair is an entry point. Used by
 * undocumented-export filtering to skip `main()`, CLI commands, and
 * framework-loaded config files that don't need prose docs.
 */
function isEntryPointSymbol(bundle, filePath, symbolName) {
  if (!bundle?.entryPointSymbols) return false;
  const normalized = normalizePath(filePath);
  return bundle.entryPointSymbols.has(`${normalized}:${symbolName}`)
    || bundle.entryPointSet.has(normalized);
}

module.exports = {
  DEFAULT_OPTIONS,
  DEFAULT_DOC_DRIFT_IGNORE,
  collect,
  isEntryPointSymbol,
  resolveMapFile,
  resolveStateDir
};
