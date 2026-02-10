#!/usr/bin/env node
/**
 * Expand Agent Template Snippets
 *
 * Reads agent .md files, finds TEMPLATE markers, loads shared snippets
 * from templates/agent-snippets/, substitutes variables, and injects
 * expanded content between markers.
 *
 * Usage:
 *   node scripts/expand-templates.js           Expand and write
 *   node scripts/expand-templates.js --check   Validate freshness (exit 1 if stale)
 *   node scripts/expand-templates.js --dry-run Show what would change without writing
 *
 * Exit codes:
 *   0 - Success (or up-to-date in --check mode)
 *   1 - Stale templates detected (--check mode) or error
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SNIPPETS_DIR = path.join(ROOT_DIR, 'templates', 'agent-snippets');

// ---------------------------------------------------------------------------
// Snippet loading and variable substitution
// ---------------------------------------------------------------------------

/**
 * Load a snippet file from templates/agent-snippets/.
 *
 * @param {string} name - Snippet name (without .md extension)
 * @returns {string} Snippet content
 */
function loadSnippet(name) {
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error(`Invalid snippet name: ${name}`);
  }
  const snippetPath = path.join(SNIPPETS_DIR, `${name}.md`);
  if (!fs.existsSync(snippetPath)) {
    throw new Error(`Snippet not found: ${name}`);
  }
  return fs.readFileSync(snippetPath, 'utf8');
}

/**
 * Replace all {{key}} placeholders in a template with provided values.
 *
 * @param {string} template - Template content with {{var}} placeholders
 * @param {Object} vars - Key-value pairs for substitution
 * @param {string} snippetName - Snippet name (for error messages)
 * @returns {string} Template with all variables substituted
 */
function substituteVars(template, vars, snippetName) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), value);
  }

  // Check for any remaining unsubstituted variables
  const remaining = result.match(/\{\{(\w+)\}\}/);
  if (remaining) {
    throw new Error(`Missing variable {{${remaining[1]}}} in snippet ${snippetName}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Marker expansion
// ---------------------------------------------------------------------------

/**
 * Find and expand all TEMPLATE markers in file content.
 *
 * @param {string} content - Full file content
 * @returns {string} Content with all TEMPLATE markers expanded
 */
function expandMarkers(content) {
  const markerRegex = /<!-- TEMPLATE: (\S+) ({.*?}) -->/g;
  let result = content;
  let match;

  // Collect all markers first (to avoid regex state issues during replacement)
  const markers = [];
  while ((match = markerRegex.exec(content)) !== null) {
    markers.push({
      fullMatch: match[0],
      snippetName: match[1],
      varsJson: match[2],
      index: match.index
    });
  }

  // Process markers in reverse order to preserve indices
  for (let i = markers.length - 1; i >= 0; i--) {
    const marker = markers[i];

    // Parse JSON variables
    let vars;
    try {
      vars = JSON.parse(marker.varsJson);
    } catch {
      throw new Error(`Invalid JSON in TEMPLATE marker: ${marker.fullMatch}`);
    }

    // Find the closing marker after this opening marker
    const openEnd = marker.index + marker.fullMatch.length;
    const closeMarker = '<!-- /TEMPLATE -->';
    const closeIdx = result.indexOf(closeMarker, openEnd);
    if (closeIdx === -1) {
      throw new Error(`Missing closing <!-- /TEMPLATE --> marker after: ${marker.fullMatch}`);
    }

    // Load snippet and substitute variables
    const snippet = loadSnippet(marker.snippetName);
    const expanded = substituteVars(snippet, vars, marker.snippetName);

    // Replace content between markers (keep markers, replace inner content)
    const before = result.substring(0, openEnd);
    const after = result.substring(closeIdx);
    result = before + '\n' + expanded + after;
  }

  return result;
}

// ---------------------------------------------------------------------------
// File discovery and computation
// ---------------------------------------------------------------------------

/**
 * Scan all agent .md files for TEMPLATE markers and compute expansions.
 *
 * @returns {{ staleFiles: string[], expandedMap: Map<string, string> }}
 *   staleFiles: relative paths of files needing expansion
 *   expandedMap: map of absolute path -> expanded content (for stale files only)
 */
function computeExpansions() {
  const staleFiles = [];
  const expandedMap = new Map();
  const pluginsDir = path.join(ROOT_DIR, 'plugins');

  if (!fs.existsSync(pluginsDir)) return { staleFiles, expandedMap };

  const plugins = fs.readdirSync(pluginsDir).filter(d => {
    return fs.statSync(path.join(pluginsDir, d)).isDirectory();
  });

  for (const plugin of plugins) {
    const agentsDir = path.join(pluginsDir, plugin, 'agents');
    if (!fs.existsSync(agentsDir)) continue;

    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(agentsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Skip files without TEMPLATE markers
      if (!content.includes('<!-- TEMPLATE:')) continue;

      const expanded = expandMarkers(content);
      if (expanded !== content) {
        const relPath = path.relative(ROOT_DIR, filePath);
        staleFiles.push(relPath);
        expandedMap.set(filePath, expanded);
      }
    }
  }

  return { staleFiles, expandedMap };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run template expansion.
 *
 * @param {string[]} args - CLI arguments
 * @returns {{ changed: boolean, files: string[] } | number} Result object or exit code (--check mode)
 */
function main(args) {
  args = args || [];
  const checkMode = args.includes('--check');
  const dryRun = args.includes('--dry-run');

  const { staleFiles, expandedMap } = computeExpansions();

  if (checkMode) {
    if (staleFiles.length > 0) {
      console.log(`[ERROR] Stale templates detected in ${staleFiles.length} file(s):`);
      for (const f of staleFiles) {
        console.log(`  - ${f}`);
      }
      console.log('\nRun: node scripts/expand-templates.js');
      return 1;
    }
    return 0;
  }

  if (staleFiles.length === 0) {
    if (!dryRun) {
      console.log('[OK] All templates up to date');
    }
    return { changed: false, files: [] };
  }

  // Write expanded content (already computed by computeExpansions)
  for (const [filePath, expanded] of expandedMap) {
    const relPath = path.relative(ROOT_DIR, filePath);

    if (dryRun) {
      console.log(`[CHANGE] Would update: ${relPath}`);
    } else {
      fs.writeFileSync(filePath, expanded, 'utf8');
      console.log(`[OK] Updated: ${relPath}`);
    }
  }

  if (!dryRun) {
    console.log(`\n[OK] ${staleFiles.length} file(s) updated`);
  }

  return { changed: staleFiles.length > 0, files: staleFiles };
}

/**
 * Check if expanded templates are fresh. For preflight integration.
 *
 * @returns {{ status: string, message: string, staleFiles: string[] }}
 */
function checkFreshness() {
  const { staleFiles } = computeExpansions();  // expandedMap intentionally unused here

  if (staleFiles.length === 0) {
    return {
      status: 'fresh',
      message: 'All agent templates are up to date',
      staleFiles: []
    };
  }

  return {
    status: 'stale',
    message: `${staleFiles.length} file(s) have stale template expansions`,
    staleFiles
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const result = main(args);

  // In --check mode, main returns an exit code number
  if (typeof result === 'number') {
    process.exit(result);
  }
}

module.exports = { main, checkFreshness };
