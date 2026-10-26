#!/usr/bin/env node
/**
 * Generate scripts/plugins.txt from .claude-plugin/marketplace.json.
 *
 * The plugins live in their own repos, so the marketplace is the list of
 * plugins agentsys ships. plugins.txt holds their names, sorted, one per line.
 *
 * Usage:
 *   node scripts/generate-plugin-list.js           Write scripts/plugins.txt
 *   node scripts/generate-plugin-list.js --check   Exit 1 if it is stale, write nothing
 *
 * Exit codes:
 *   0 - Written, or fresh in --check mode
 *   1 - Stale or missing in --check mode
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const MARKETPLACE = path.join('.claude-plugin', 'marketplace.json');
const OUTPUT = path.join('scripts', 'plugins.txt');

/**
 * @param {{ plugins: { name: string }[] }} marketplace
 * @returns {string} plugins.txt content
 */
function renderPluginList(marketplace) {
  const names = marketplace.plugins.map((plugin) => plugin.name).sort();
  return names.join('\n') + '\n';
}

function expectedContent(rootDir) {
  const marketplace = JSON.parse(fs.readFileSync(path.join(rootDir, MARKETPLACE), 'utf8'));
  return renderPluginList(marketplace);
}

/**
 * Compare plugins.txt with the marketplace. For preflight integration.
 *
 * @param {string} [rootDir]
 * @returns {{ status: 'fresh'|'stale', message: string, staleFiles: string[] }}
 */
function checkFreshness(rootDir = ROOT_DIR) {
  const outputPath = path.join(rootDir, OUTPUT);
  const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;
  if (actual === expectedContent(rootDir)) {
    return { status: 'fresh', message: `${OUTPUT} matches ${MARKETPLACE}`, staleFiles: [] };
  }
  return {
    status: 'stale',
    message: `${OUTPUT} is ${actual === null ? 'missing' : 'out of date'}; run node scripts/generate-plugin-list.js`,
    staleFiles: [OUTPUT],
  };
}

/**
 * @param {string[]} args
 * @param {string} [rootDir]
 * @returns {number} exit code
 */
function main(args = [], rootDir = ROOT_DIR) {
  if (args.includes('--check')) {
    const result = checkFreshness(rootDir);
    if (result.status === 'fresh') {
      console.log(`[OK] ${result.message}`);
      return 0;
    }
    console.error(`[ERROR] ${result.message}`);
    return 1;
  }

  const content = expectedContent(rootDir);
  fs.writeFileSync(path.join(rootDir, OUTPUT), content);
  console.log(`[OK] Wrote ${OUTPUT} with ${content.split('\n').filter(Boolean).length} plugins`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { main, renderPluginList, checkFreshness };
