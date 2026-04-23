/**
 * Repo intel module - typed wrappers over agent-analyzer's repo-intel
 * subcommands. Consumers can import via:
 *
 *   const { repoIntel } = require('@agentsys/lib');
 *   const hot = repoIntel.queries.hotspots(cwd, { limit: 20 });
 *   const communities = repoIntel.queries.communities(cwd);
 *
 * The Rust binary is downloaded lazily on first call by lib/binary; this
 * module just constructs the right argv and parses the JSON output.
 *
 * @module lib/repo-intel
 */

'use strict';

const queries = require('./queries');

module.exports = {
  queries,
};
