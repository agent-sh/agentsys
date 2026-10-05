/**
 * agentsys runtime resolver.
 *
 * Finds an agentsys-style `lib/` and exposes its `binary`, `repoIntel`, and
 * `repoMap` modules. The core sync ships `lib/binary/`, `lib/repo-intel/` and
 * `lib/repo-map/` into every plugin, so the plugin's own `lib/` (this file's
 * directory) is tried first and an external agentsys install is the fallback.
 *
 * Lookup order:
 *   0. __dirname                                       (this plugin's own vendored lib/)
 *   1. ~/.claude/plugins/marketplaces/agentsys/lib    (CC marketplace clone)
 *   2. <npm-global-root>/agentsys/lib                  (npm install -g agentsys)
 *   3. require.resolve('agentsys/lib/package.json')    (project-local install)
 *   4. ../../agentsys/lib                              (dev fallback in monorepo)
 *
 * If none resolve, throws an actionable error directing the user to install
 * agentsys via the marketplace or npm.
 *
 * @module lib/agentsys
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let cachedLibRoot = null;
let cachedModules = null;

/**
 * Resolve the npm global root without spawning npm. Node exposes it
 * indirectly: `process.execPath` is the node binary. On Windows the
 * global root is `<exec dir>/node_modules`; on Unix it's
 * `<exec prefix>/lib/node_modules`. Whichever shape contains agentsys wins.
 *
 * @returns {string|null}
 */
function npmGlobalRoot() {
  const execDir = path.dirname(process.execPath);
  const candidates = [
    path.join(execDir, 'node_modules'),
    path.join(execDir, '..', 'lib', 'node_modules'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'agentsys'))) return c;
  }
  return null;
}

/**
 * Build the platform-specific list of candidate paths to check. Order
 * matters: most-specific first, dev-fallback last.
 *
 * @returns {string[]}
 */
function candidatePaths() {
  const home = os.homedir();
  const candidates = [
    // 0. This plugin's OWN vendored lib/. The sync still ships lib/binary/
    //    (and friends) into every plugin, so the resolver's own directory
    //    already satisfies the binary/index.js contract. Preferring it means
    //    the plugin is self-sufficient - works in bare CI and offline, with no
    //    external agentsys install - and the external lookups below stay as
    //    fallbacks for hosts that intentionally share a central agentsys.
    __dirname,
    path.join(home, '.claude', 'plugins', 'marketplaces', 'agentsys', 'lib'),
  ];

  const globalRoot = npmGlobalRoot();
  if (globalRoot) {
    candidates.push(path.join(globalRoot, 'agentsys', 'lib'));
  }

  try {
    const pkgPath = require.resolve('agentsys/lib/package.json');
    candidates.push(path.dirname(pkgPath));
  } catch {
    // Not resolvable from here - fine.
  }

  candidates.push(path.resolve(__dirname, '..', '..', 'agentsys', 'lib'));

  return candidates;
}

/**
 * Find the first candidate path that contains a usable agentsys lib.
 * "Usable" means binary/index.js exists - that's the contract this
 * resolver depends on.
 *
 * @returns {string} Absolute path to agentsys/lib
 * @throws {Error} If no candidate path resolves
 */
function findAgentsysLib() {
  if (cachedLibRoot) return cachedLibRoot;

  const tried = candidatePaths();
  for (const candidate of tried) {
    if (fs.existsSync(path.join(candidate, 'binary', 'index.js'))) {
      cachedLibRoot = candidate;
      return candidate;
    }
  }

  throw new Error(
    'agentsys/lib not found. Install agentsys via the marketplace ' +
      '(/plugin marketplace add agent-sh/agentsys) or npm ' +
      '(npm install -g agentsys). Tried:\n  ' +
      tried.join('\n  ')
  );
}

/**
 * Load and return the agentsys lib modules. Cached after first call.
 *
 * @returns {{libRoot: string, binary: Object, repoIntel: Object|null, repoMap: Object|null}}
 */
function get() {
  if (cachedModules) return cachedModules;

  const libRoot = findAgentsysLib();

  // Defer-load repo-intel - older agentsys (< v5.8.6) won't have it. The
  // resolver should still produce a usable binary in that case so legacy
  // code paths keep working during the migration.
  let repoIntel = null;
  try {
    repoIntel = require(path.join(libRoot, 'repo-intel'));
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
  }

  // Legacy repo-map module (still present in agentsys for now). Provides
  // exists / load / init / update / checkAstGrepInstalled.
  let repoMap = null;
  try {
    repoMap = require(path.join(libRoot, 'repo-map'));
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
  }

  cachedModules = {
    libRoot,
    binary: require(path.join(libRoot, 'binary')),
    repoIntel,
    repoMap,
  };
  return cachedModules;
}

module.exports = {
  get,
  findAgentsysLib,
  candidatePaths,
};
