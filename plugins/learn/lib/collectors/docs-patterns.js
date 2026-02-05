/**
 * Documentation Patterns Collector
 *
 * Specialized patterns for sync-docs: finding related docs,
 * detecting outdated references, and analyzing doc issues.
 *
 * @module lib/collectors/docs-patterns
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Lazy-load repo-map to avoid circular dependencies
let repoMapModule = null;
let repoMapLoadError = null;

/**
 * Get the repo-map module, loading it lazily
 * @returns {{module: Object|null, error: string|null}}
 */
function getRepoMap() {
  if (!repoMapModule && !repoMapLoadError) {
    try {
      repoMapModule = require('../repo-map');
    } catch (err) {
      // Module not found or failed to load - store error for diagnostics
      repoMapLoadError = err.message || 'Failed to load repo-map module';
      repoMapModule = null;
    }
  }
  return repoMapModule;
}

/**
 * Get the repo-map load error if any
 * @returns {string|null}
 */
function getRepoMapLoadError() {
  return repoMapLoadError;
}

const DEFAULT_OPTIONS = {
  cwd: process.cwd()
};

// Constants for configuration
const MAX_SCAN_DEPTH = 5;
const MAX_DOC_FILES = 200;
const INTERNAL_DIRS = ['internal', 'private', 'utils', 'helpers', '__tests__', 'test', 'tests'];
const ENTRY_NAMES = ['index', 'main', 'app', 'server', 'cli', 'bin'];

// Regex patterns for export detection (extracted for performance)
const EXPORT_PATTERNS = [
  /export\s+(?:function|class|const|let|var)\s+(\w+)/g,
  /export\s+\{([^}]+)\}/g,
  /module\.exports\s*=\s*\{([^}]+)\}/
];

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for use in RegExp
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if an export should be considered internal (skip documentation checks)
 * @param {string} name - Export name
 * @param {string} filePath - File path
 * @returns {boolean} True if export should be considered internal/private
 */
function isInternalExport(name, filePath) {
  // Underscore prefix convention
  if (name.startsWith('_')) return true;
  
  // Internal directory patterns
  const pathLower = filePath.toLowerCase();
  for (const dir of INTERNAL_DIRS) {
    if (pathLower.includes(`/${dir}/`) || pathLower.includes(`\\${dir}\\`)) {
      return true;
    }
  }
  
  // Test files
  if (/\.(test|spec)\.[jt]sx?$/.test(filePath)) return true;
  
  return false;
}

/**
 * Check if a file is likely an entry point (should have docs but not flagged as undocumented)
 * @param {string} filePath - File path
 * @returns {boolean} True if file appears to be an entry point (index.js, main.js, etc.)
 */
function isEntryPoint(filePath) {
  const basename = path.basename(filePath);
  const nameWithoutExt = basename.replace(/\.[^.]+$/, '').toLowerCase();
  return ENTRY_NAMES.includes(nameWithoutExt);
}

/**
 * Ensure repo-map is available, creating it if possible
 * @param {Object} options - Options
 * @param {string} [options.cwd=process.cwd()] - Working directory
 * @param {Function} [options.askUser] - Async callback to ask user questions.
 *   Signature: async ({question: string, header: string, options: Array<{label, description}>}) => string
 *   Returns the selected option label or null if declined.
 * @returns {Promise<{available: boolean, map: Object|null, fallbackReason: string|null, installInstructions?: string}>}
 */
async function ensureRepoMap(options = {}) {
  const { cwd = process.cwd(), askUser } = options;
  const repoMap = getRepoMap();
  
  // No repo-map module available
  if (!repoMap) {
    return { available: false, map: null, fallbackReason: 'repo-map-module-not-found' };
  }
  
  // 1. Already exists?
  if (repoMap.exists(cwd)) {
    const map = repoMap.load(cwd);
    return { available: true, map, fallbackReason: null };
  }
  
  // 2. Check ast-grep installation
  const installed = await repoMap.checkAstGrepInstalled();
  
  if (!installed.found) {
    // 3. Ask user if they want to install
    if (askUser) {
      const answer = await askUser({
        question: 'ast-grep not found. Install for better doc sync accuracy?',
        header: 'ast-grep Required',
        options: [
          { label: 'Yes, show instructions', description: 'Better accuracy with AST-based symbol detection' },
          { label: 'No, use regex fallback', description: 'Less accurate but works without additional install' }
        ]
      });
      
      if (answer && answer.includes('Yes')) {
        const instructions = repoMap.getInstallInstructions();
        return { 
          available: false, 
          map: null, 
          fallbackReason: 'ast-grep-install-pending',
          installInstructions: instructions
        };
      }
    }
    
    return { available: false, map: null, fallbackReason: 'ast-grep-not-installed' };
  }
  
  // 4. ast-grep available, try to create repo-map
  try {
    const initResult = await repoMap.init(cwd, { force: false });
    
    if (initResult.success) {
      return { available: true, map: initResult.map, fallbackReason: null };
    }
    
    // Handle "already exists" case (race condition)
    if (initResult.error && initResult.error.includes('already exists')) {
      const map = repoMap.load(cwd);
      return { available: true, map, fallbackReason: null };
    }
    
    // 5. Init failed (e.g., no supported languages)
    return { available: false, map: null, fallbackReason: initResult.error || 'init-failed' };
  } catch (err) {
    return { available: false, map: null, fallbackReason: err.message || 'init-error' };
  }
}

/**
 * Synchronous version of ensureRepoMap (no user prompts, no auto-init)
 * @param {Object} options - Options
 * @returns {{available: boolean, map: Object|null, fallbackReason: string|null}}
 */
function ensureRepoMapSync(options = {}) {
  const { cwd = process.cwd() } = options;
  const repoMap = getRepoMap();
  
  if (!repoMap) {
    return { available: false, map: null, fallbackReason: 'repo-map-module-not-found' };
  }
  
  if (repoMap.exists(cwd)) {
    const map = repoMap.load(cwd);
    return { available: true, map, fallbackReason: null };
  }
  
  return { available: false, map: null, fallbackReason: 'repo-map-not-initialized' };
}

/**
 * Get exports from repo-map for a specific file
 * @param {string} filePath - File path relative to repo root
 * @param {Object} map - Loaded repo-map
 * @returns {string[]|null} List of export names or null if not found
 */
function getExportsFromRepoMap(filePath, map) {
  if (!map || !map.files) return null;
  
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Try exact match first
  let fileData = map.files[normalizedPath];
  
  // Try without leading ./
  if (!fileData && normalizedPath.startsWith('./')) {
    fileData = map.files[normalizedPath.slice(2)];
  }
  
  // Try with leading ./
  if (!fileData && !normalizedPath.startsWith('./')) {
    fileData = map.files['./' + normalizedPath];
  }
  
  if (!fileData || !fileData.symbols || !fileData.symbols.exports) {
    return null;
  }
  
  return fileData.symbols.exports.map(e => e.name);
}

/**
 * Find exports that are not documented in any markdown file
 * @param {string[]} changedFiles - List of changed file paths
 * @param {Object} options - Options
 * @param {Object} [options.repoMapStatus] - Pre-fetched repo-map status (avoids redundant calls)
 * @returns {Array<{type: string, severity: string, file: string, name: string, line: number, certainty: string}>}
 */
function findUndocumentedExports(changedFiles, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Use pre-fetched status if provided, otherwise fetch
  const repoMapStatus = opts.repoMapStatus || ensureRepoMapSync(opts);
  
  if (!repoMapStatus.available || !repoMapStatus.map) {
    return []; // Can't detect without repo-map
  }
  
  const map = repoMapStatus.map;
  const allDocs = findMarkdownFiles(opts.cwd);
  
  // Read all doc content for searching
  let allDocContent = '';
  for (const doc of allDocs) {
    try {
      allDocContent += fs.readFileSync(path.join(opts.cwd, doc), 'utf8') + '\n';
    } catch {
      // Skip unreadable docs
    }
  }
  
  const issues = [];
  
  for (const file of changedFiles) {
    // Normalize path
    const normalizedFile = file.replace(/\\/g, '/');
    const fileData = map.files[normalizedFile] || map.files[normalizedFile.replace(/^\.\//, '')];
    
    if (!fileData || !fileData.symbols || !fileData.symbols.exports) {
      continue;
    }
    
    for (const exp of fileData.symbols.exports) {
      // Skip internal exports
      if (isInternalExport(exp.name, normalizedFile)) continue;
      
      // Skip entry points (they're expected to have many exports)
      if (isEntryPoint(normalizedFile)) continue;
      
      // Check if mentioned in any doc
      // Use word boundary to avoid partial matches
      // Escape regex metacharacters to prevent injection/errors
      const namePattern = new RegExp(`\\b${escapeRegex(exp.name)}\\b`);
      if (!namePattern.test(allDocContent)) {
        issues.push({
          type: 'undocumented-export',
          severity: 'low',
          file: normalizedFile,
          name: exp.name,
          line: exp.line || 0,
          kind: exp.kind || 'export',
          certainty: 'MEDIUM',
          suggestion: `Export '${exp.name}' in ${normalizedFile} is not mentioned in any documentation`
        });
      }
    }
  }
  
  return issues;
}

/**
 * Find documentation files related to changed source files
 * @param {string[]} changedFiles - List of changed file paths
 * @param {Object} options - Options
 * @returns {Array<Object>} Related docs with reference types
 */
function findRelatedDocs(changedFiles, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const basePath = opts.cwd;
  const results = [];

  // Find all markdown files
  const docFiles = findMarkdownFiles(basePath);

  for (const file of changedFiles) {
    const basename = path.basename(file).replace(/\.[^.]+$/, '');
    const modulePath = file.replace(/\.[^.]+$/, '');
    const dirName = path.dirname(file);

    for (const doc of docFiles) {
      let content;
      try {
        content = fs.readFileSync(path.join(basePath, doc), 'utf8');
      } catch {
        // File unreadable (permissions, deleted after scan, etc.) - skip
        continue;
      }

      const references = [];

      // Check for various reference types
      if (content.includes(basename)) {
        references.push('filename');
      }
      if (content.includes(file)) {
        references.push('full-path');
      }
      if (content.includes(`from '${modulePath}'`) || content.includes(`from "${modulePath}"`)) {
        references.push('import');
      }
      if (content.includes(`require('${modulePath}')`) || content.includes(`require("${modulePath}")`)) {
        references.push('require');
      }
      if (content.includes(`/${basename}`) || content.includes(`/${basename}.`)) {
        references.push('url-path');
      }

      if (references.length > 0) {
        results.push({
          doc,
          referencedFile: file,
          referenceTypes: references
        });
      }
    }
  }

  return results;
}

/**
 * Find all markdown files in the repository
 * @param {string} basePath - Repository root
 * @returns {string[]} List of markdown file paths
 */
function findMarkdownFiles(basePath) {
  const files = [];
  const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage', 'vendor'];

  function scan(dir, depth = 0) {
    if (depth > MAX_SCAN_DEPTH || files.length > MAX_DOC_FILES) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            scan(fullPath, depth + 1);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(relativePath);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  scan(basePath);
  return files;
}

/**
 * Analyze a documentation file for issues
 * @param {string} docPath - Path to the doc file
 * @param {string} changedFile - Path of the changed source file
 * @param {Object} options - Options
 * @returns {Array<Object>} List of issues found
 */
function analyzeDocIssues(docPath, changedFile, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const basePath = opts.cwd;
  const issues = [];

  let content;
  try {
    content = fs.readFileSync(path.join(basePath, docPath), 'utf8');
  } catch {
    // Doc file unreadable - no issues to report
    return issues;
  }

  const lines = content.split('\n');

  // 1. Check code blocks for outdated imports
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = content.match(codeBlockRegex) || [];

  for (const block of codeBlocks) {
    const importRegex = /import .* from ['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(block)) !== null) {
      const importPath = match[1];
      const changedModulePath = changedFile.replace(/\.[^.]+$/, '');
      if (importPath.includes(path.basename(changedModulePath))) {
        issues.push({
          type: 'code-example',
          severity: 'medium',
          line: findLineNumber(content, match[0]),
          current: match[0],
          suggestion: 'Verify import path is still valid'
        });
      }
    }
  }

  // 2. Check for function/export references that may have changed
  // Try repo-map first for accurate exports, fallback to git-based regex
  const repoMapStatus = ensureRepoMapSync(opts);
  
  let oldExports, newExports;
  let usingRepoMap = false;
  
  if (repoMapStatus.available && repoMapStatus.map) {
    // Use repo-map for current exports (more accurate)
    const repoMapExports = getExportsFromRepoMap(changedFile, repoMapStatus.map);
    if (repoMapExports) {
      newExports = repoMapExports;
      // For old exports, still need git-based approach
      oldExports = getExportsFromGit(changedFile, 'HEAD~1', opts);
      usingRepoMap = true;
    }
  }
  
  // Fallback to git-based detection
  if (!usingRepoMap) {
    oldExports = getExportsFromGit(changedFile, 'HEAD~1', opts);
    newExports = getExportsFromGit(changedFile, 'HEAD', opts);
  }

  const removed = oldExports.filter(e => !newExports.includes(e));
  for (const fn of removed) {
    if (content.includes(fn)) {
      issues.push({
        type: 'removed-export',
        severity: 'high',
        reference: fn,
        suggestion: `'${fn}' was removed or renamed`,
        detectionMethod: usingRepoMap ? 'repo-map' : 'regex'
      });
    }
  }

  // 3. Check for outdated version numbers
  try {
    const pkgContent = fs.readFileSync(path.join(basePath, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgContent);
    const currentVersion = pkg.version;

    const versionMatches = content.matchAll(/version[:\s]+['"]?(\d+\.\d+\.\d+)/gi);
    for (const match of versionMatches) {
      const docVersion = match[1];
      if (docVersion !== currentVersion && compareVersions(docVersion, currentVersion) < 0) {
        issues.push({
          type: 'outdated-version',
          severity: 'low',
          line: findLineNumber(content, match[0]),
          current: docVersion,
          expected: currentVersion,
          suggestion: `Update version from ${docVersion} to ${currentVersion}`
        });
      }
    }
  } catch {
    // No package.json or parse error
  }

  return issues;
}

/**
 * Find line number of a string in content
 * @param {string} content - Full content
 * @param {string} search - String to find
 * @returns {number} Line number (1-indexed)
 */
function findLineNumber(content, search) {
  const index = content.indexOf(search);
  if (index === -1) return 0;
  return content.substring(0, index).split('\n').length;
}

/**
 * Validate git ref format (e.g., HEAD, HEAD~1, branch names)
 * @param {string} ref - Git ref to validate
 * @returns {boolean} True if valid
 */
function isValidGitRef(ref) {
  if (typeof ref !== 'string' || !ref) return false;
  // Allow: HEAD, HEAD~N, HEAD^N, branch names (alphanumeric, /, -, _, .)
  // Reject: shell metacharacters, spaces, null bytes
  return /^[a-zA-Z0-9_./-]+(?:[~^][0-9]+)?$/.test(ref);
}

/**
 * Get exports from a file at a specific git ref
 * @param {string} filePath - File path
 * @param {string} ref - Git ref (HEAD, HEAD~1, etc.)
 * @param {Object} options - Options
 * @returns {string[]} List of export names
 */
function getExportsFromGit(filePath, ref, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate ref to prevent command injection
  if (!isValidGitRef(ref)) {
    return [];
  }

  try {
    // Use execFileSync with arguments array to prevent command injection
    // git show requires the ref:path as a single argument
    const content = execFileSync('git', ['show', `${ref}:${filePath}`], {
      cwd: opts.cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const exports = [];

    // Use module-level patterns - clone regex to reset lastIndex for global patterns
    for (const pattern of EXPORT_PATTERNS) {
      // Create new regex to avoid lastIndex issues with global patterns
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (match[1].includes(',')) {
          // Multiple exports (e.g., export { a, b, c })
          const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
          exports.push(...names.filter(n => n && /^\w+$/.test(n)));
        } else {
          exports.push(match[1]);
        }
      }
    }

    return [...new Set(exports)];
  } catch {
    // Git command failed (file not in repo, invalid ref, etc.) - return empty
    return [];
  }
}

/**
 * Compare semantic versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

/**
 * Check CHANGELOG for undocumented changes
 * @param {string[]} changedFiles - Changed files
 * @param {Object} options - Options
 * @returns {Object} CHANGELOG status
 */
function checkChangelog(changedFiles, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const basePath = opts.cwd;
  const changelogPath = path.join(basePath, 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    return { exists: false };
  }

  let changelog;
  try {
    changelog = fs.readFileSync(changelogPath, 'utf8');
  } catch {
    return { exists: false, error: 'Could not read CHANGELOG.md' };
  }

  const hasUnreleased = changelog.includes('## [Unreleased]');

  // Get recent commits
  let recentCommits = [];
  try {
    // Use execFileSync with arguments array for safer execution
    const output = execFileSync('git', ['log', '--oneline', '-10', 'HEAD'], {
      cwd: basePath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    recentCommits = output.trim().split('\n');
  } catch {
    // Git command failed
  }

  const documented = [];
  const undocumented = [];

  for (const commit of recentCommits) {
    if (!commit) continue;
    const msg = commit.substring(8); // Skip hash
    if (changelog.includes(msg) || changelog.includes(commit.substring(0, 7))) {
      documented.push(msg);
    } else if (msg.match(/^(feat|fix|breaking)/i)) {
      undocumented.push(msg);
    }
  }

  return {
    exists: true,
    hasUnreleased,
    documented,
    undocumented,
    suggestion: undocumented.length > 0
      ? `${undocumented.length} commits may need CHANGELOG entries`
      : null
  };
}

/**
 * Collect all documentation-related data
 * @param {Object} options - Collection options
 * @returns {Object} Collected data
 */
function collect(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const changedFiles = opts.changedFiles || [];

  // Check repo-map availability
  const repoMapStatus = ensureRepoMapSync(opts);

  return {
    relatedDocs: findRelatedDocs(changedFiles, opts),
    changelog: checkChangelog(changedFiles, opts),
    markdownFiles: findMarkdownFiles(opts.cwd),
    // New: repo-map integration
    repoMap: {
      available: repoMapStatus.available,
      fallbackReason: repoMapStatus.fallbackReason,
      stats: repoMapStatus.map ? {
        files: Object.keys(repoMapStatus.map.files || {}).length,
        symbols: repoMapStatus.map.stats?.totalSymbols || 0
      } : null
    },
    // New: undocumented exports detection (pass repoMapStatus to avoid redundant call)
    undocumentedExports: repoMapStatus.available 
      ? findUndocumentedExports(changedFiles, { ...opts, repoMapStatus })
      : []
  };
}

module.exports = {
  DEFAULT_OPTIONS,
  findRelatedDocs,
  findMarkdownFiles,
  analyzeDocIssues,
  checkChangelog,
  getExportsFromGit,
  compareVersions,
  findLineNumber,
  collect,
  // New: repo-map integration
  ensureRepoMap,
  ensureRepoMapSync,
  getExportsFromRepoMap,
  findUndocumentedExports,
  isInternalExport,
  isEntryPoint,
  // Utilities
  escapeRegex,
  // Diagnostic
  getRepoMapLoadError
};
