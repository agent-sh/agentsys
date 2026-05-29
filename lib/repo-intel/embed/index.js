'use strict';

/**
 * Public surface for the embed module — preference cache, binary
 * resolver, and high-level orchestrator (scan / update / status).
 *
 * Skill code should import from here, not the internal modules,
 * so the wiring stays swappable.
 *
 * @module lib/embed
 */

const preference = require('./preference');
const binary = require('./binary');
const orchestrator = require('./orchestrator');

module.exports = {
  preference,
  binary,
  orchestrator,
  // Convenience re-exports for the common cases.
  isEnabled: orchestrator.isEnabled,
  runScan: orchestrator.runScan,
  runUpdate: orchestrator.runUpdate,
  status: orchestrator.status
};
