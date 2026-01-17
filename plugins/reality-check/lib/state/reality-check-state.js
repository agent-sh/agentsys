/**
 * Reality Check State Management
 *
 * Persistent state management for reality-check workflow orchestration.
 * Enables parallel agent coordination and scan result tracking.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA_VERSION = '1.0.0';
const STATE_DIR = '.claude';
const STATE_FILE = 'reality-check-state.json';
const SETTINGS_FILE = 'reality-check.local.md';

const PHASES = [
  'settings-check',
  'parallel-scan',
  'synthesis',
  'report-generation',
  'complete'
];

const DEFAULT_SETTINGS = {
  sources: {
    github_issues: true,
    linear: false,
    docs_paths: ['docs/', 'README.md', 'CLAUDE.md', 'PLAN.md'],
    code_exploration: true
  },
  scan_depth: 'thorough',
  output: {
    write_to_file: true,
    file_path: 'reality-check-report.md',
    display_summary: true
  },
  priority_weights: {
    security: 10,
    bugs: 8,
    features: 5,
    docs: 3
  },
  exclusions: {
    paths: ['node_modules/', 'dist/', '.git/'],
    labels: ['wontfix', 'duplicate']
  }
};

/**
 * Generate a unique scan ID
 * @returns {string} Scan ID in format: scan-YYYYMMDD-HHMMSS-random
 */
function generateScanId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  const random = crypto.randomBytes(4).toString('hex');
  return `scan-${date}-${time}-${random}`;
}

/**
 * Get the state file path
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {string} Full path to state file
 */
function getStatePath(baseDir = process.cwd()) {
  return path.join(baseDir, STATE_DIR, STATE_FILE);
}

/**
 * Get the settings file path
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {string} Full path to settings file
 */
function getSettingsPath(baseDir = process.cwd()) {
  return path.join(baseDir, STATE_DIR, SETTINGS_FILE);
}

/**
 * Ensure state directory exists
 * @param {string} [baseDir=process.cwd()] - Base directory
 */
function ensureStateDir(baseDir = process.cwd()) {
  const stateDir = path.join(baseDir, STATE_DIR);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
}

/**
 * Check if settings file exists
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {boolean} True if settings exist
 */
function hasSettings(baseDir = process.cwd()) {
  return fs.existsSync(getSettingsPath(baseDir));
}

/**
 * Read settings from .local.md file
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Object} Settings object (defaults if not found)
 */
function readSettings(baseDir = process.cwd()) {
  const settingsPath = getSettingsPath(baseDir);

  if (!fs.existsSync(settingsPath)) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf8');
    // Parse YAML frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      // Simple YAML parsing for our known structure
      const yaml = match[1];
      const settings = parseSimpleYaml(yaml);
      return { ...DEFAULT_SETTINGS, ...settings };
    }
    return { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error(`Error reading settings: ${error.message}`);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Simple YAML parser for settings
 * @param {string} yaml - YAML content
 * @returns {Object} Parsed settings
 */
function parseSimpleYaml(yaml) {
  const settings = {};
  const lines = yaml.split('\n');
  let currentSection = null;
  let currentSubSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check indentation level
    const indent = line.search(/\S/);

    if (indent === 0 && trimmed.endsWith(':')) {
      // Top-level section
      currentSection = trimmed.slice(0, -1);
      settings[currentSection] = {};
      currentSubSection = null;
    } else if (indent === 2 && trimmed.endsWith(':')) {
      // Sub-section
      currentSubSection = trimmed.slice(0, -1);
      if (currentSection) {
        settings[currentSection][currentSubSection] = {};
      }
    } else if (trimmed.includes(':')) {
      // Key-value pair
      const [key, ...valueParts] = trimmed.split(':');
      let value = valueParts.join(':').trim();

      // Parse value type
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(value) && value !== '') value = Number(value);
      else if (value.startsWith('[') && value.endsWith(']')) {
        // Array
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
      } else {
        value = value.replace(/['"]/g, '');
      }

      if (currentSubSection && currentSection) {
        settings[currentSection][currentSubSection][key.trim()] = value;
      } else if (currentSection) {
        settings[currentSection][key.trim()] = value;
      } else {
        settings[key.trim()] = value;
      }
    }
  }

  return settings;
}

/**
 * Write settings to .local.md file
 * @param {Object} settings - Settings object
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {boolean} Success status
 */
function writeSettings(settings, baseDir = process.cwd()) {
  ensureStateDir(baseDir);
  const settingsPath = getSettingsPath(baseDir);

  try {
    const content = `---
sources:
  github_issues: ${settings.sources?.github_issues ?? true}
  linear: ${settings.sources?.linear ?? false}
  docs_paths: [${(settings.sources?.docs_paths || DEFAULT_SETTINGS.sources.docs_paths).map(p => `"${p}"`).join(', ')}]
  code_exploration: ${settings.sources?.code_exploration ?? true}
scan_depth: ${settings.scan_depth || 'thorough'}
output:
  write_to_file: ${settings.output?.write_to_file ?? true}
  file_path: "${settings.output?.file_path || 'reality-check-report.md'}"
  display_summary: ${settings.output?.display_summary ?? true}
priority_weights:
  security: ${settings.priority_weights?.security ?? 10}
  bugs: ${settings.priority_weights?.bugs ?? 8}
  features: ${settings.priority_weights?.features ?? 5}
  docs: ${settings.priority_weights?.docs ?? 3}
exclusions:
  paths: [${(settings.exclusions?.paths || DEFAULT_SETTINGS.exclusions.paths).map(p => `"${p}"`).join(', ')}]
  labels: [${(settings.exclusions?.labels || DEFAULT_SETTINGS.exclusions.labels).map(l => `"${l}"`).join(', ')}]
---

# Reality Check Settings

Configuration for the reality-check plugin. Edit the YAML frontmatter above to customize behavior.

## Sources
- **github_issues**: Scan GitHub issues and PRs
- **linear**: Scan Linear issues (requires Linear MCP)
- **docs_paths**: Paths to documentation files
- **code_exploration**: Enable deep codebase analysis

## Scan Depth
- **quick**: Fast scan, surface-level analysis
- **medium**: Balanced scan depth
- **thorough**: Deep analysis (recommended)

## Output
- **write_to_file**: Save report to file
- **file_path**: Report file location
- **display_summary**: Show summary in conversation

## Priority Weights
Higher numbers = higher priority in the final plan

## Exclusions
- **paths**: Directories to skip during code exploration
- **labels**: Issue labels to exclude from scanning
`;

    fs.writeFileSync(settingsPath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing settings: ${error.message}`);
    return false;
  }
}

/**
 * Create a new scan state
 * @param {Object} [settings={}] - Settings overrides
 * @returns {Object} New scan state
 */
function createState(settings = {}) {
  const now = new Date().toISOString();

  return {
    version: SCHEMA_VERSION,
    scan: {
      id: generateScanId(),
      status: 'pending',
      startedAt: now,
      lastUpdatedAt: now,
      completedAt: null
    },
    settings: { ...DEFAULT_SETTINGS, ...settings },
    phases: {
      current: 'settings-check',
      history: []
    },
    agents: {
      issueScanner: null,
      docAnalyzer: null,
      codeExplorer: null,
      planSynthesizer: null
    },
    findings: {
      issues: [],
      docs: [],
      code: [],
      drift: [],
      gaps: []
    },
    report: null
  };
}

/**
 * Read scan state from file
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Object|null} Scan state or null if not found
 */
function readState(baseDir = process.cwd()) {
  const statePath = getStatePath(baseDir);

  if (!fs.existsSync(statePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading state: ${error.message}`);
    return null;
  }
}

/**
 * Write scan state to file
 * @param {Object} state - Scan state
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {boolean} Success status
 */
function writeState(state, baseDir = process.cwd()) {
  ensureStateDir(baseDir);
  const statePath = getStatePath(baseDir);

  try {
    state.scan.lastUpdatedAt = new Date().toISOString();
    const content = JSON.stringify(state, null, 2);
    fs.writeFileSync(statePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing state: ${error.message}`);
    return false;
  }
}

/**
 * Update agent results in state
 * @param {string} agentName - Agent identifier (issueScanner, docAnalyzer, codeExplorer)
 * @param {Object} result - Agent result
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Object|null} Updated state or null on error
 */
function updateAgentResult(agentName, result, baseDir = process.cwd()) {
  const state = readState(baseDir);
  if (!state) return null;

  state.agents[agentName] = {
    status: 'completed',
    completedAt: new Date().toISOString(),
    result
  };

  if (writeState(state, baseDir)) {
    return state;
  }
  return null;
}

/**
 * Add findings to state
 * @param {string} category - Finding category (issues, docs, code, drift, gaps)
 * @param {Array} items - Finding items to add
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Object|null} Updated state or null on error
 */
function addFindings(category, items, baseDir = process.cwd()) {
  const state = readState(baseDir);
  if (!state) return null;

  state.findings[category] = [
    ...(state.findings[category] || []),
    ...items
  ];

  if (writeState(state, baseDir)) {
    return state;
  }
  return null;
}

/**
 * Start a phase
 * @param {string} phaseName - Phase name
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Object|null} Updated state or null on error
 */
function startPhase(phaseName, baseDir = process.cwd()) {
  if (!PHASES.includes(phaseName)) {
    console.error(`Invalid phase: ${phaseName}`);
    return null;
  }

  const state = readState(baseDir);
  if (!state) return null;

  state.phases.current = phaseName;
  state.phases.history.push({
    phase: phaseName,
    status: 'in_progress',
    startedAt: new Date().toISOString()
  });
  state.scan.status = 'in_progress';

  if (writeState(state, baseDir)) {
    return state;
  }
  return null;
}

/**
 * Complete the current phase
 * @param {Object} [result={}] - Phase result
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Object|null} Updated state or null on error
 */
function completePhase(result = {}, baseDir = process.cwd()) {
  const state = readState(baseDir);
  if (!state) return null;

  const currentEntry = state.phases.history[state.phases.history.length - 1];
  if (currentEntry) {
    currentEntry.status = 'completed';
    currentEntry.completedAt = new Date().toISOString();
    currentEntry.result = result;
  }

  const currentIndex = PHASES.indexOf(state.phases.current);
  state.phases.current = currentIndex < PHASES.length - 1
    ? PHASES[currentIndex + 1]
    : 'complete';

  if (state.phases.current === 'complete') {
    state.scan.status = 'completed';
    state.scan.completedAt = new Date().toISOString();
  }

  if (writeState(state, baseDir)) {
    return state;
  }
  return null;
}

/**
 * Set the final report
 * @param {Object} report - Report data
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Object|null} Updated state or null on error
 */
function setReport(report, baseDir = process.cwd()) {
  const state = readState(baseDir);
  if (!state) return null;

  state.report = report;

  if (writeState(state, baseDir)) {
    return state;
  }
  return null;
}

/**
 * Delete scan state (cleanup)
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {boolean} Success status
 */
function deleteState(baseDir = process.cwd()) {
  const statePath = getStatePath(baseDir);

  try {
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
    return true;
  } catch (error) {
    console.error(`Error deleting state: ${error.message}`);
    return false;
  }
}

module.exports = {
  // Constants
  SCHEMA_VERSION,
  PHASES,
  DEFAULT_SETTINGS,

  // Path functions
  getStatePath,
  getSettingsPath,
  ensureStateDir,

  // Settings
  hasSettings,
  readSettings,
  writeSettings,

  // State CRUD
  generateScanId,
  createState,
  readState,
  writeState,
  deleteState,

  // State updates
  updateAgentResult,
  addFindings,
  startPhase,
  completePhase,
  setReport
};
