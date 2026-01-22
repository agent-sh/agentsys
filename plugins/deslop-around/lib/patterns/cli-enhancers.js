/**
 * CLI Enhancers for Slop Detection Pipeline
 *
 * Optional CLI tool integration for Phase 2 detection.
 * All tools are user-installed globally - zero npm dependencies for this module.
 * Functions gracefully degrade when tools are not available.
 *
 * Supported tools:
 * - jscpd: Duplicate code detection
 * - madge: Circular dependency detection
 * - escomplex: Cyclomatic complexity analysis
 *
 * @module patterns/cli-enhancers
 * @author Avi Fenesh
 * @license MIT
 */

const { execSync } = require('child_process');
const path = require('path');

/**
 * CLI tool definitions
 */
const CLI_TOOLS = {
  jscpd: {
    name: 'jscpd',
    description: 'Copy/paste detector for code duplication',
    checkCommand: 'jscpd --version',
    installHint: 'npm install -g jscpd'
  },
  madge: {
    name: 'madge',
    description: 'Circular dependency detector',
    checkCommand: 'madge --version',
    installHint: 'npm install -g madge'
  },
  escomplex: {
    name: 'escomplex',
    description: 'Cyclomatic complexity analyzer',
    checkCommand: 'escomplex --version',
    installHint: 'npm install -g escomplex'
  }
};

/**
 * Check if a CLI tool is available in PATH
 *
 * @param {string} command - Command to check (e.g., 'jscpd --version')
 * @returns {boolean} True if tool is available
 */
function isToolAvailable(command) {
  try {
    execSync(command, {
      stdio: 'pipe',
      timeout: 5000,
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which CLI tools are available on the system
 *
 * @returns {Object} Available tools { jscpd: boolean, madge: boolean, escomplex: boolean }
 */
function detectAvailableTools() {
  return {
    jscpd: isToolAvailable(CLI_TOOLS.jscpd.checkCommand),
    madge: isToolAvailable(CLI_TOOLS.madge.checkCommand),
    escomplex: isToolAvailable(CLI_TOOLS.escomplex.checkCommand)
  };
}

/**
 * Run duplicate code detection using jscpd
 *
 * @param {string} repoPath - Repository root path
 * @param {Object} options - Options
 * @param {number} [options.minLines=5] - Minimum lines for duplicate detection
 * @param {number} [options.minTokens=50] - Minimum tokens for duplicate detection
 * @returns {Array|null} Duplicates found, or null if tool not available
 */
function runDuplicateDetection(repoPath, options = {}) {
  if (!isToolAvailable(CLI_TOOLS.jscpd.checkCommand)) {
    return null;
  }

  const minLines = options.minLines || 5;
  const minTokens = options.minTokens || 50;

  try {
    // Run jscpd with JSON output
    const command = `jscpd "${repoPath}" --min-lines ${minLines} --min-tokens ${minTokens} --reporters json --output /dev/null --silent 2>&1`;

    const result = execSync(command, {
      stdio: 'pipe',
      timeout: 60000,
      windowsHide: true,
      cwd: repoPath,
      encoding: 'utf8'
    });

    // Parse JSON output
    try {
      const report = JSON.parse(result);
      const duplicates = [];

      if (report.duplicates) {
        for (const dup of report.duplicates) {
          duplicates.push({
            firstFile: dup.firstFile?.name || 'unknown',
            firstLine: dup.firstFile?.start || 0,
            secondFile: dup.secondFile?.name || 'unknown',
            secondLine: dup.secondFile?.start || 0,
            lines: dup.lines || 0,
            tokens: dup.tokens || 0,
            fragment: dup.fragment?.substring(0, 100) || ''
          });
        }
      }

      return duplicates;
    } catch {
      // JSON parsing failed, return empty array
      return [];
    }
  } catch {
    // Tool execution failed
    return null;
  }
}

/**
 * Run circular dependency detection using madge
 *
 * @param {string} repoPath - Repository root path
 * @param {Object} options - Options
 * @param {string} [options.entry] - Entry file (defaults to src/index.js or index.js)
 * @returns {Array|null} Circular dependency cycles, or null if tool not available
 */
function runDependencyAnalysis(repoPath, options = {}) {
  if (!isToolAvailable(CLI_TOOLS.madge.checkCommand)) {
    return null;
  }

  // Determine entry point
  let entry = options.entry;
  if (!entry) {
    const possibleEntries = [
      'src/index.js',
      'src/index.ts',
      'index.js',
      'index.ts',
      'lib/index.js',
      'main.js'
    ];

    for (const e of possibleEntries) {
      const fs = require('fs');
      if (fs.existsSync(path.join(repoPath, e))) {
        entry = e;
        break;
      }
    }
  }

  if (!entry) {
    // No entry point found, scan entire directory
    entry = '.';
  }

  try {
    // Run madge with circular flag and JSON output
    const command = `madge --circular --json "${entry}"`;

    const result = execSync(command, {
      stdio: 'pipe',
      timeout: 60000,
      windowsHide: true,
      cwd: repoPath,
      encoding: 'utf8'
    });

    // Parse JSON output
    try {
      const cycles = JSON.parse(result);
      // madge returns array of arrays (each cycle is an array of file paths)
      return Array.isArray(cycles) ? cycles : [];
    } catch {
      return [];
    }
  } catch {
    // Tool execution failed
    return null;
  }
}

/**
 * Run complexity analysis using escomplex
 *
 * @param {string} repoPath - Repository root path
 * @param {string[]} targetFiles - Files to analyze
 * @param {Object} options - Options
 * @returns {Array|null} Complexity results, or null if tool not available
 */
function runComplexityAnalysis(repoPath, targetFiles, options = {}) {
  if (!isToolAvailable(CLI_TOOLS.escomplex.checkCommand)) {
    return null;
  }

  const results = [];

  // escomplex works on individual files
  for (const file of targetFiles) {
    // Only analyze JS/TS files
    if (!file.match(/\.[jt]sx?$/)) continue;

    const filePath = path.isAbsolute(file) ? file : path.join(repoPath, file);

    try {
      const command = `escomplex "${filePath}" --format json`;

      const result = execSync(command, {
        stdio: 'pipe',
        timeout: 30000,
        windowsHide: true,
        cwd: repoPath,
        encoding: 'utf8'
      });

      try {
        const report = JSON.parse(result);

        // Extract function-level complexity
        if (report.functions) {
          for (const fn of report.functions) {
            results.push({
              file,
              name: fn.name || 'anonymous',
              line: fn.line || 0,
              complexity: fn.cyclomatic || 0,
              halstead: fn.halstead?.difficulty || 0,
              sloc: fn.sloc?.logical || 0
            });
          }
        }

        // Also include module-level metrics
        if (report.aggregate) {
          results.push({
            file,
            name: 'module',
            line: 0,
            complexity: report.aggregate.cyclomatic || 0,
            halstead: report.aggregate.halstead?.difficulty || 0,
            sloc: report.aggregate.sloc?.logical || 0,
            maintainability: report.maintainability || 0
          });
        }
      } catch {
        // JSON parsing failed for this file
      }
    } catch {
      // Tool execution failed for this file
    }
  }

  return results.length > 0 ? results : null;
}

/**
 * Get user-friendly message about missing tools
 *
 * @param {string[]} missingTools - Array of missing tool names
 * @returns {string} Formatted message
 */
function getMissingToolsMessage(missingTools) {
  if (!missingTools || missingTools.length === 0) {
    return '';
  }

  let message = '\n## Optional CLI Tools Not Found\n\n';
  message += 'For deeper analysis, consider installing:\n\n';

  for (const toolName of missingTools) {
    const tool = CLI_TOOLS[toolName];
    if (tool) {
      message += `- **${tool.name}**: ${tool.description}\n`;
      message += `  Install: \`${tool.installHint}\`\n`;
    }
  }

  message += '\nThese tools are optional and enhance detection capabilities.\n';

  return message;
}

/**
 * Get all CLI tool definitions
 *
 * @returns {Object} CLI tool definitions
 */
function getToolDefinitions() {
  return { ...CLI_TOOLS };
}

module.exports = {
  detectAvailableTools,
  runDuplicateDetection,
  runDependencyAnalysis,
  runComplexityAnalysis,
  getMissingToolsMessage,
  getToolDefinitions,
  // Exported for testing
  isToolAvailable,
  CLI_TOOLS
};
