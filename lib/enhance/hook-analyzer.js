/**
 * Hook analyzer for /enhance.
 */

const fs = require('fs');
const path = require('path');
const { hookPatterns } = require('./hook-patterns');
const { parseMarkdownFrontmatter } = require('./agent-analyzer');

function analyzeHook(hookPath, options = {}) {
  const results = {
    hookName: path.basename(hookPath, '.md'),
    hookPath,
    structureIssues: []
  };

  if (!fs.existsSync(hookPath)) {
    results.structureIssues.push({
      issue: 'File not found',
      file: hookPath,
      certainty: 'HIGH',
      patternId: 'file_not_found'
    });
    return results;
  }

  let content = '';
  try {
    content = fs.readFileSync(hookPath, 'utf8');
  } catch (err) {
    results.structureIssues.push({
      issue: `Failed to read file: ${err.message}`,
      file: hookPath,
      certainty: 'HIGH',
      patternId: 'read_error'
    });
    return results;
  }

  const missingFm = hookPatterns.missing_frontmatter.check(content);
  if (missingFm) {
    results.structureIssues.push({
      ...missingFm,
      file: hookPath,
      certainty: hookPatterns.missing_frontmatter.certainty,
      patternId: hookPatterns.missing_frontmatter.id
    });
  }

  const { frontmatter } = parseMarkdownFrontmatter(content);
  const missingName = hookPatterns.missing_name.check(frontmatter);
  if (missingName) {
    results.structureIssues.push({
      ...missingName,
      file: hookPath,
      certainty: hookPatterns.missing_name.certainty,
      patternId: hookPatterns.missing_name.id
    });
  }

  const missingDescription = hookPatterns.missing_description.check(frontmatter);
  if (missingDescription) {
    results.structureIssues.push({
      ...missingDescription,
      file: hookPath,
      certainty: hookPatterns.missing_description.certainty,
      patternId: hookPatterns.missing_description.id
    });
  }

  // LOW certainty findings only with verbose, as in the other analyzers.
  if (!options.verbose) {
    results.structureIssues = results.structureIssues.filter(i => i.certainty !== 'LOW');
  }

  return results;
}

/**
 * Analyze every hook markdown file under a directory, or one hook file
 * @param {string} hooksDir - Directory to walk, or one hook file
 * @param {Object} options - Analysis options
 * @param {boolean} options.verbose - Include LOW certainty issues
 * @returns {Array} Array of analysis results (one entry for a .md file)
 */
function analyzeAllHooks(hooksDir, options = {}) {
  const results = [];
  if (!fs.existsSync(hooksDir)) return results;

  // Callers pass whatever path the user gave. The walker below returns
  // nothing for a file, so analyze a file path as the one hook it names.
  // Only markdown hooks have the frontmatter this analyzer checks: a JSON
  // config or a script gives [] here, as it does inside a directory.
  if (!fs.statSync(hooksDir).isDirectory()) {
    return hooksDir.endsWith('.md') ? [analyzeHook(hooksDir, options)] : [];
  }

  const hookFiles = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'target']);

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          walk(fullPath);
        }
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const parts = fullPath.split(path.sep);
      if (parts.includes('hooks')) {
        hookFiles.push(fullPath);
      }
    }
  }

  walk(hooksDir);

  for (const file of hookFiles) {
    results.push(analyzeHook(file, options));
  }

  return results;
}

function analyze(options = {}) {
  const {
    hook,
    hooksDir = 'plugins/enhance/hooks',
    verbose = false
  } = options;

  if (hook) {
    const hookPath = hook.endsWith('.md')
      ? hook
      : path.join(hooksDir, `${hook}.md`);
    return analyzeHook(hookPath, { verbose });
  }

  return analyzeAllHooks(hooksDir, { verbose });
}

module.exports = {
  analyzeHook,
  analyzeAllHooks,
  analyze
};
