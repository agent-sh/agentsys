'use strict';

/**
 * DEPRECATED COMPAT SHIM — repo-map folded into lib/repo-intel.
 *
 * repo-map was a leftover split: it produced/converted the artifact while
 * lib/repo-intel/ only queried it. They are one pipeline over one binary, now
 * unified under lib/repo-intel. This shim re-exports the lifecycle surface so
 * existing `require('.../repo-map')` consumers keep working unchanged.
 *
 * Migrate callers to `require('.../repo-intel')` and remove this shim.
 *
 * @module lib/repo-map
 * @deprecated use lib/repo-intel
 */

const repoIntel = require('../repo-intel');

module.exports = {
  init: repoIntel.init,
  update: repoIntel.update,
  status: repoIntel.status,
  load: repoIntel.load,
  exists: repoIntel.exists,
  checkAstGrepInstalled: repoIntel.checkAstGrepInstalled,
  getInstallInstructions: repoIntel.getInstallInstructions,
  installer: repoIntel.installer,
  cache: repoIntel.cache,
  updater: repoIntel.updater
};
