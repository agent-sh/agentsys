#!/usr/bin/env node
/**
 * Tool Verification System
 * Checks availability and versions of development tools for graceful degradation
 *
 * Usage: node lib/platform/verify-tools.js
 * Output: JSON with tool availability and versions
 *
 * @author Avi Fenesh
 * @license MIT
 */

const { execFileSync, spawnSync, spawn } = require('child_process');

// Detect Windows platform
const isWindows = process.platform === 'win32';

// Import shared deprecation utilities
const { warnDeprecation, _resetDeprecationWarnings } = require('../utils/deprecation');

/**
 * Checks if a tool is available and returns its version (sync)
 * Uses safe execution methods to avoid shell injection vulnerabilities
 * @deprecated Use checkToolAsync() instead. Will be removed in v3.0.0.
 * @param {string} command - Command to check (e.g., 'git', 'node')
 * @param {string} versionFlag - Flag to get version (default: '--version')
 * @returns {Object} { available: boolean, version: string|null }
 */
function checkTool(command, versionFlag = '--version') {
  warnDeprecation('checkTool', 'checkToolAsync');
  // Validate command contains only safe characters (alphanumeric, underscore, hyphen)
  if (!/^[a-zA-Z0-9_-]+$/.test(command)) {
    return { available: false, version: null };
  }
  // Validate versionFlag contains only safe characters
  if (!/^[a-zA-Z0-9_-]+$/.test(versionFlag)) {
    return { available: false, version: null };
  }

  try {
    let output;

    if (isWindows) {
      // On Windows, use spawnSync with shell to handle .cmd/.bat scripts
      // Input is validated above so this is safe
      const result = spawnSync(command, [versionFlag], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 5000,
        windowsHide: true,
        shell: true
      });
      if (result.error || result.status !== 0) {
        return { available: false, version: null };
      }
      output = (result.stdout || '').trim();
    } else {
      // On Unix, use execFileSync (more secure, no shell)
      output = execFileSync(command, [versionFlag], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 5000
      }).trim();
    }

    // Extract version from first line
    const version = output.split('\n')[0];
    return { available: true, version };
  } catch {
    return { available: false, version: null };
  }
}

/**
 * Checks if a tool is available and returns its version (async)
 * Uses safe execution methods to avoid shell injection vulnerabilities
 * @param {string} command - Command to check (e.g., 'git', 'node')
 * @param {string} versionFlag - Flag to get version (default: '--version')
 * @returns {Promise<Object>} { available: boolean, version: string|null }
 */
function checkToolAsync(command, versionFlag = '--version') {
  return new Promise((resolve) => {
    // Validate command contains only safe characters (alphanumeric, underscore, hyphen)
    if (!/^[a-zA-Z0-9_-]+$/.test(command)) {
      return resolve({ available: false, version: null });
    }
    // Validate versionFlag contains only safe characters
    if (!/^[a-zA-Z0-9_-]+$/.test(versionFlag)) {
      return resolve({ available: false, version: null });
    }

    let child;

    if (isWindows) {
      // On Windows, spawn shell directly with command as single argument to avoid deprecation warning
      // Input is validated above so this is safe
      child = spawn('cmd.exe', ['/c', command, versionFlag], {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true
      });
    } else {
      // On Unix, spawn directly without shell
      child = spawn(command, [versionFlag], {
        stdio: ['pipe', 'pipe', 'ignore']
      });
    }

    let stdout = '';

    // Set timeout
    const timeout = setTimeout(() => {
      child.kill();
      resolve({ available: false, version: null });
    }, 5000);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.on('error', () => {
      clearTimeout(timeout);
      resolve({ available: false, version: null });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        return resolve({ available: false, version: null });
      }
      const version = stdout.trim().split('\n')[0];
      resolve({ available: true, version });
    });
  });
}

/**
 * Tool definitions with their version flags
 */
const TOOL_DEFINITIONS = [
  // Version control
  { name: 'git', flag: '--version' },
  { name: 'gh', flag: '--version' },

  // Node.js ecosystem
  { name: 'node', flag: '--version' },
  { name: 'npm', flag: '--version' },
  { name: 'pnpm', flag: '--version' },
  { name: 'yarn', flag: '--version' },
  { name: 'bun', flag: '--version' },

  // Python ecosystem
  { name: 'python', flag: '--version' },
  { name: 'python3', flag: '--version' },
  { name: 'pip', flag: '--version' },
  { name: 'pip3', flag: '--version' },
  { name: 'poetry', flag: '--version' },

  // Rust ecosystem
  { name: 'cargo', flag: '--version' },
  { name: 'rustc', flag: '--version' },
  { name: 'rustup', flag: '--version' },

  // Go ecosystem
  { name: 'go', flag: 'version' },

  // Java ecosystem
  { name: 'java', flag: '--version' },
  { name: 'javac', flag: '--version' },
  { name: 'mvn', flag: '--version' },
  { name: 'gradle', flag: '--version' },

  // Containerization
  { name: 'docker', flag: '--version' },

  // Deployment platforms
  { name: 'railway', flag: '--version' },
  { name: 'vercel', flag: '--version' },
  { name: 'netlify', flag: '--version' },
  { name: 'flyctl', flag: 'version' },

  // CI/CD tools
  { name: 'circleci', flag: 'version' }
];

/**
 * Verifies all development tools (sync)
 * @deprecated Use verifyToolsAsync() instead. Will be removed in v3.0.0.
 * @returns {Object} Tool availability map
 */
function verifyTools() {
  warnDeprecation('verifyTools', 'verifyToolsAsync');
  const result = {};
  for (const tool of TOOL_DEFINITIONS) {
    result[tool.name] = checkTool(tool.name, tool.flag);
  }
  return result;
}

/**
 * Verifies all development tools (async, parallel)
 * Runs all tool checks in parallel for ~10x faster execution
 * @returns {Promise<Object>} Tool availability map
 */
async function verifyToolsAsync() {
  // Run all checks in parallel
  const results = await Promise.all(
    TOOL_DEFINITIONS.map(tool => checkToolAsync(tool.name, tool.flag))
  );

  // Build result object
  const toolMap = {};
  TOOL_DEFINITIONS.forEach((tool, index) => {
    toolMap[tool.name] = results[index];
  });

  return toolMap;
}

// When run directly, output JSON (uses async for better performance)
if (require.main === module) {
  (async () => {
    try {
      const result = await verifyToolsAsync();
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }, null, 2));
      process.exit(1);
    }
  })();
}

// Export for use as module
module.exports = {
  verifyTools,
  verifyToolsAsync,
  checkTool,
  checkToolAsync,
  TOOL_DEFINITIONS,
  // Testing utilities (prefixed with _ to indicate internal use)
  _resetDeprecationWarnings
};
