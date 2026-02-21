#!/usr/bin/env node
/**
 * Version Stamp Tool
 *
 * Reads the version from package.json (the single source of truth)
 * and stamps it into all downstream version files.
 *
 * Usage:
 *   node scripts/stamp-version.js          # Stamp current package.json version everywhere
 *
 * Designed to run as an npm `version` lifecycle hook:
 *   "version": "node scripts/stamp-version.js && git add -A"
 *
 * Files stamped:
 *   - .claude-plugin/plugin.json
 *   - .claude-plugin/marketplace.json (root version only, plugin versions are independent)
 *   - site/content.json (meta.version)
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Update the "version" field in a JSON file.
 *
 * @param {string} filePath - Absolute or relative path to the JSON file
 * @param {string} version - Version string to set
 * @returns {boolean} true if file was updated, false if skipped
 */
function updateJsonFile(filePath, version) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT_DIR, filePath);
  if (!fs.existsSync(absPath)) {
    console.log(`  [SKIP] ${filePath} (not found)`);
    return false;
  }

  const content = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  const oldVersion = content.version;
  content.version = version;
  fs.writeFileSync(absPath, JSON.stringify(content, null, 2) + '\n');
  console.log(`  [OK] ${filePath}: ${oldVersion} -> ${version}`);
  return true;
}

/**
 * Update all "version" occurrences in marketplace.json via regex.
 *
 * @param {string} filePath - Path to marketplace.json
 * @param {string} version - Version string to set
 * @returns {boolean} true if file was updated, false if skipped
 */
function updateMarketplaceJson(filePath, version) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT_DIR, filePath);
  if (!fs.existsSync(absPath)) {
    console.log(`  [SKIP] ${filePath} (not found)`);
    return false;
  }

  let content = fs.readFileSync(absPath, 'utf8');
  const oldVersionMatch = content.match(/"version":\s*"([^"]+)"/);
  const oldVersion = oldVersionMatch ? oldVersionMatch[1] : 'unknown';

  // Replace all version occurrences
  content = content.replace(/"version":\s*"[^"]+"/g, `"version": "${version}"`);
  fs.writeFileSync(absPath, content);

  const count = (content.match(/"version":/g) || []).length;
  console.log(`  [OK] ${filePath}: ${oldVersion} -> ${version} (${count} occurrences)`);
  return true;
}

/**
 * Update the meta.version field in site/content.json.
 * Uses regex replacement to preserve original formatting.
 *
 * @param {string} filePath - Path to content.json
 * @param {string} version - Version string to set
 * @returns {boolean} true if file was updated, false if skipped
 */
function updateContentJson(filePath, version) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT_DIR, filePath);
  if (!fs.existsSync(absPath)) {
    console.log(`  [SKIP] ${filePath} (not found)`);
    return false;
  }

  let content = fs.readFileSync(absPath, 'utf8');
  const oldVersionMatch = content.match(/"version":\s*"([^"]+)"/);
  const oldVersion = oldVersionMatch ? oldVersionMatch[1] : 'unknown';

  // Replace only the first "version" occurrence (inside meta block)
  content = content.replace(/"version":\s*"[^"]+"/,  `"version": "${version}"`);
  fs.writeFileSync(absPath, content);
  console.log(`  [OK] ${filePath}: ${oldVersion} -> ${version}`);
  return true;
}

/**
 * Stamp the version from package.json into all downstream files.
 *
 * @param {string} [rootDir] - Repository root. Defaults to parent of scripts/.
 * @returns {number} 0 on success, 1 on error
 */
function stampVersion(rootDir) {
  if (!rootDir) rootDir = ROOT_DIR;

  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('[ERROR] package.json not found');
    return 1;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version;

  console.log(`\nStamping version: ${version}\n`);

  // Root plugin.json
  console.log('Root plugin:');
  updateJsonFile(path.join(rootDir, '.claude-plugin', 'plugin.json'), version);

  // Marketplace (root version only - plugin versions are independent)
  console.log('\nMarketplace:');
  updateJsonFile(path.join(rootDir, '.claude-plugin', 'marketplace.json'), version);

  // Site content.json
  console.log('\nSite:');
  updateContentJson(path.join(rootDir, 'site', 'content.json'), version);

  console.log(`\n[OK] Version ${version} stamped to all files\n`);
  return 0;
}

if (require.main === module) {
  const code = stampVersion();
  if (typeof code === 'number') process.exit(code);
}

module.exports = { stampVersion, updateJsonFile, updateMarketplaceJson, updateContentJson };
