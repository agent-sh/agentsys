'use strict';

/**
 * Repo Intel - unified repository intelligence over agent-analyzer.
 *
 * One surface for the whole pipeline:
 *   - lifecycle: init / update / status / load / exists  (was lib/repo-map)
 *   - queries:   typed wrappers over the binary's query subcommands (queries.js)
 *   - install:   binary availability checks
 *
 * The agent-analyzer binary is the engine and is auto-downloaded on first use.
 * init/update run the binary, persist repo-intel.json (raw), convert to the
 * repo-map.json view, and cache it. queries.* read the raw repo-intel.json.
 *
 * @module lib/repo-intel
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { execFileSync } = cp;

const installer = require('./installer');
const cache = require('./cache');
const updater = require('./updater');
const converter = require('./converter');
const queries = require('./queries');
const binary = require('../binary');
const { getStateDirPath } = require('../platform/state-dir');
const { writeJsonAtomic } = require('../utils/atomic-write');

const REPO_INTEL_FILENAME = 'repo-intel.json';

function getIntelMapPath(basePath) {
  return path.join(getStateDirPath(basePath), REPO_INTEL_FILENAME);
}

/**
 * Initialize a new repo map (full scan).
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
      error: 'Repo map already exists. Use --force to rebuild or update to refresh.',
      existing: cache.getStatus(basePath)
    };
  }

  const startTime = Date.now();

  let intelJson;
  try {
    intelJson = await binary.runAnalyzerAsync(['repo-intel', 'init', basePath]);
  } catch (e) {
    return { success: false, error: 'agent-analyzer repo-intel init failed: ' + e.message };
  }

  let intel;
  try {
    intel = JSON.parse(intelJson);
  } catch (e) {
    return { success: false, error: 'Failed to parse repo-intel output: ' + e.message };
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
 * Update an existing repo map (incremental via agent-analyzer).
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
    return { success: false, error: 'No repo map found. Run init first.' };
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
    return { success: false, error: 'agent-analyzer repo-intel update failed: ' + e.message };
  }

  let intel;
  try {
    intel = JSON.parse(intelJson);
  } catch (e) {
    return { success: false, error: 'Failed to parse repo-intel update output: ' + e.message };
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
 * Get repo map status.
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
 * Load repo map (if exists).
 * @param {string} basePath - Repository root path
 * @returns {Object|null}
 */
function load(basePath) {
  return cache.load(basePath);
}

/**
 * Check if repo map exists.
 * @param {string} basePath - Repository root path
 * @returns {boolean}
 */
function exists(basePath) {
  return cache.exists(basePath);
}

/**
 * Load the RAW repo-intel.json (the binary's native output: fileActivity,
 * coupling, symbols, importGraph, ...) — distinct from load(), which returns
 * the converted repo-map.json view. enrich + any consumer needing raw git/AST
 * structure uses this; queries.* also read raw under the hood.
 * @param {string} basePath - Repository root path
 * @returns {Object|null} parsed raw artifact, or null if absent/unreadable
 */
function loadRaw(basePath) {
  const p = getIntelMapPath(basePath);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * Spawn the analyzer with a JSON payload on stdin and capture stdout/stderr.
 *
 * Used by the post-init agent orchestration: the Haiku weighter and
 * summarizer write JSON to stdout, the orchestrating skill captures it,
 * then pipes it into the analyzer via this helper. Replaces what would
 * otherwise be a tempfile dance.
 *
 * @param {string[]} args - subcommand args (must end with `--input -`)
 * @param {string} stdinJson - the JSON payload to feed to stdin
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function runAnalyzerWithStdin(args, stdinJson) {
  const binPath = await binary.ensureBinary();
  return new Promise((resolve, reject) => {
    const proc = cp.spawn(binPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(
          `agent-analyzer ${args.join(' ')} exited ${code}: ${stderr.trim() || stdout.trim()}`
        ));
      }
    });
    proc.stdin.write(stdinJson);
    proc.stdin.end();
  });
}

/**
 * Merge per-file descriptors (from the `repo-intel-weighter` agent) into the
 * cached artifact via the binary's set-descriptors subcommand. Partial updates
 * are safe — entries the agent didn't refresh this run are preserved.
 *
 * @param {string} basePath - Repository root path
 * @param {Object<string, string>} descriptors - {path: descriptor, ...}
 * @returns {Promise<void>}
 */
async function applyDescriptors(basePath, descriptors) {
  if (!descriptors || typeof descriptors !== 'object') {
    throw new Error('applyDescriptors requires an object {path: descriptor}');
  }
  const mapFile = getIntelMapPath(basePath);
  if (!fs.existsSync(mapFile)) {
    throw new Error('No repo-intel artifact for ' + basePath + '; run init first.');
  }
  await runAnalyzerWithStdin(
    ['repo-intel', 'set-descriptors', '--map-file', mapFile, '--input', '-'],
    JSON.stringify(descriptors)
  );
}

/**
 * Set the 3-depth narrative summary (from the `repo-intel-summarizer` agent)
 * via the binary's set-summary subcommand. Fully replaces any previous summary.
 *
 * @param {string} basePath - Repository root path
 * @param {{depth1: string, depth3: string, depth10: string, inputHash: string}} summary
 * @returns {Promise<void>}
 */
async function applySummary(basePath, summary) {
  if (!summary || !summary.depth1 || !summary.depth3 || !summary.depth10) {
    throw new Error('applySummary requires {depth1, depth3, depth10, inputHash}');
  }
  const mapFile = getIntelMapPath(basePath);
  if (!fs.existsSync(mapFile)) {
    throw new Error('No repo-intel artifact for ' + basePath + '; run init first.');
  }
  await runAnalyzerWithStdin(
    ['repo-intel', 'set-summary', '--map-file', mapFile, '--input', '-'],
    JSON.stringify(summary)
  );
}

/**
 * Check if agent-analyzer is available.
 * @returns {Promise<{found: boolean, version?: string, tool: string}>}
 */
async function checkAstGrepInstalled() {
  return installer.checkInstalled();
}

/**
 * Get install instructions.
 * @returns {string}
 */
function getInstallInstructions() {
  return installer.getInstallInstructions();
}

module.exports = {
  // Lifecycle (was lib/repo-map)
  init,
  update,
  status,
  load,
  loadRaw,
  exists,
  applyDescriptors,
  applySummary,
  checkAstGrepInstalled,
  getInstallInstructions,

  // Typed query wrappers (read the cached repo-intel.json)
  queries,

  // Submodules for advanced use
  installer,
  cache,
  updater,
  converter
};

// Embedder (opt-in, separate agent-analyzer-embed binary). Lazy getter so
// `require('repo-intel')` for query/lifecycle use never loads the embed binary
// resolver or its download path — it only materializes when embed is accessed.
Object.defineProperty(module.exports, 'embed', {
  enumerable: true,
  get() { return require('./embed'); }
});
