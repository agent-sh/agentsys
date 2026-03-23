'use strict';

/**
 * Convert agent-analyzer repo-intel.json format to repo-map.json format.
 *
 * agent-analyzer outputs: { symbols: { [filePath]: { exports, imports, definitions } } }
 * repo-map expects:       { files: { [filePath]: { language, symbols, imports } } }
 *
 * @module lib/repo-map/converter
 */

const path = require('path');

const LANGUAGE_BY_EXTENSION = {
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.py': 'python', '.pyw': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java'
};

// SymbolKind values from agent-analyzer (kebab-case serialized)
const CLASS_KINDS = new Set(['class', 'struct', 'interface', 'enum', 'impl']);
const TYPE_KINDS = new Set(['trait', 'type-alias']);
const FUNCTION_LIKE_KINDS = new Set(['method', 'arrow', 'closure']);
const CONSTANT_KINDS = new Set(['constant', 'variable', 'const', 'field', 'property']);

function detectLanguage(filePath) {
  return LANGUAGE_BY_EXTENSION[path.extname(filePath).toLowerCase()] || 'unknown';
}

function detectLanguagesFromFiles(filePaths) {
  const langs = new Set();
  for (const fp of filePaths) {
    const lang = detectLanguage(fp);
    if (lang !== 'unknown') langs.add(lang);
  }
  return Array.from(langs);
}

/**
 * Convert a single file's symbols from repo-intel format to repo-map format.
 * @param {string} filePath
 * @param {Object} fileSym - { exports, imports, definitions }
 * @returns {Object} repo-map file entry
 */
function convertFile(filePath, fileSym) {
  const exportNames = new Set((fileSym.exports || []).map(e => e.name));

  const exports = (fileSym.exports || []).map(e => ({
    name: e.name,
    kind: e.kind,
    line: e.line
  }));

  const functions = [];
  const classes = [];
  const types = [];
  const constants = [];

  for (const def of fileSym.definitions || []) {
    const entry = {
      name: def.name,
      kind: def.kind,
      line: def.line,
      exported: exportNames.has(def.name)
    };
    if (def.kind === 'function' || FUNCTION_LIKE_KINDS.has(def.kind)) {
      functions.push(entry);
    } else if (CLASS_KINDS.has(def.kind)) {
      classes.push(entry);
    } else if (TYPE_KINDS.has(def.kind)) {
      types.push(entry);
    } else if (CONSTANT_KINDS.has(def.kind)) {
      constants.push(entry);
    } else {
      // Unknown kind - default to constants for backward compat
      constants.push(entry);
    }
  }

  // agent-analyzer imports: [{ from, names }] → repo-map imports: [{ source, kind, names }]
  const imports = (fileSym.imports || []).map(imp => ({
    source: imp.from,
    kind: 'import',
    names: imp.names || []
  }));

  return {
    language: detectLanguage(filePath),
    symbols: { exports, functions, classes, types, constants },
    imports
  };
}

/**
 * Convert a full repo-intel data object to repo-map format.
 * @param {Object} intel - RepoIntelData from agent-analyzer
 * @returns {Object} repo-map.json compatible object
 */
function convertIntelToRepoMap(intel) {
  const files = {};
  let totalSymbols = 0;
  let totalImports = 0;

  for (const [filePath, fileSym] of Object.entries(intel.symbols || {})) {
    files[filePath] = convertFile(filePath, fileSym);
    const s = files[filePath].symbols;
    totalSymbols += s.functions.length + s.classes.length +
                    s.types.length + s.constants.length;
    totalImports += files[filePath].imports.length;
  }

  return {
    version: '2.0',
    generated: intel.generated || new Date().toISOString(),
    git: intel.git ? { commit: intel.git.analyzedUpTo } : undefined,
    project: { languages: detectLanguagesFromFiles(Object.keys(files)) },
    stats: {
      totalFiles: Object.keys(files).length,
      totalSymbols,
      totalImports,
      errors: []
    },
    files
  };
}

module.exports = { convertIntelToRepoMap, convertFile, detectLanguage };
