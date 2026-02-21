#!/usr/bin/env node
/**
 * Preflight Check Engine
 *
 * Unified, change-aware checklist enforcement that detects which checklists
 * apply based on changed files and runs all automatable checks.
 *
 * Usage:
 *   node scripts/preflight.js            Auto-detect from changed files
 *   node scripts/preflight.js --all      Run all checks regardless
 *   node scripts/preflight.js --release  Run all checks + release extras
 *   node scripts/preflight.js --json     Output structured JSON
 *   node scripts/preflight.js --verbose  Show detailed output
 *
 * Exit codes:
 *   0 - All checks passed (or only warnings)
 *   1 - One or more checks failed
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');

const EXCLUDED_DIRS = ['node_modules', '.git'];

// ---------------------------------------------------------------------------
// Checklist -> file pattern mapping
// ---------------------------------------------------------------------------

const CHECKLIST_PATTERNS = {
  'new-command': ['plugins/*/commands/'],
  'new-agent': ['plugins/*/agents/'],
  'new-skill': ['plugins/*/skills/'],
  'new-lib-module': ['lib/'],
  'release': ['package.json'],
  'repo-map': ['plugins/repo-map/', 'lib/repo-map/'],
  'opencode-plugin': ['adapters/opencode-plugin/'],
  'cross-platform': [] // triggered when any plugin/ or lib/ file changes
};

// Manual-only items that cannot be automated, grouped by checklist.
// Shown as reminders after automated checks complete.
const MANUAL_CHECKS = {
  'new-command': [
    'Run /enhance on the new command',
    'Test cross-platform: Claude Code, OpenCode, Codex CLI'
  ],
  'new-agent': [
    'Run /enhance on the new agent',
    'Test agent invocation end-to-end',
    'Verify agent count in README.md and docs/reference/AGENTS.md'
  ],
  'new-skill': [
    'Run /enhance on the new skill',
    'Verify skill directory name matches skill name in SKILL.md'
  ],
  'new-lib-module': [
    'Verify module loads from lib/'
  ],
  'release': [
    'Verify cross-platform install: npm pack && npm install -g',
    'Test on Claude Code, OpenCode, and Codex CLI',
    'Create git tag and push'
  ],
  'repo-map': [
    'Verify ast-grep detection works',
    'Test repo-map update with added/modified/deleted files'
  ],
  'opencode-plugin': [
    'Test plugin with OpenCode locally',
    'Verify thinking tiers for any new agents'
  ],
  'cross-platform': [
    'Verify no hardcoded .claude/ paths in new code',
    'Confirm AskUserQuestion labels are under 30 chars'
  ]
};

// ---------------------------------------------------------------------------
// Validators - existing scripts mapped to relevant checklists
// ---------------------------------------------------------------------------

const VALIDATORS = {
  'plugins': {
    requirePath: path.join(ROOT_DIR, 'scripts', 'validate-plugins.js'),
    call: (mod) => mod.main(),
    relevantChecklists: ['new-command', 'new-agent', 'new-skill', 'release']
  },
  'cross-platform': {
    requirePath: path.join(ROOT_DIR, 'scripts', 'validate-cross-platform.js'),
    call: (mod) => mod.validate().success ? 0 : 1,
    relevantChecklists: ['cross-platform', 'new-command', 'new-agent', 'release']
  },
  'consistency': {
    requirePath: path.join(ROOT_DIR, 'scripts', 'validate-repo-consistency.js'),
    call: (mod) => mod.main(),
    relevantChecklists: ['release', 'new-command', 'new-agent', 'new-skill']
  },
  'paths': {
    requirePath: path.join(ROOT_DIR, 'scripts', 'check-hardcoded-paths.js'),
    call: (mod) => {
      const pluginsDir = path.join(ROOT_DIR, 'plugins');
      const issues = mod.scanDirectory(pluginsDir);
      return issues.length === 0 ? 0 : 1;
    },
    relevantChecklists: ['cross-platform', 'new-command', 'new-agent', 'new-skill']
  },
  'counts': {
    requirePath: path.join(ROOT_DIR, 'scripts', 'validate-counts.js'),
    call: (mod) => mod.runValidation().status === 'ok' ? 0 : 1,
    relevantChecklists: ['release', 'new-agent', 'new-skill']
  },
  'platform-docs': {
    requirePath: path.join(ROOT_DIR, 'scripts', 'validate-cross-platform-docs.js'),
    call: (mod) => mod.runValidation().status === 'ok' ? 0 : 1,
    relevantChecklists: ['cross-platform', 'release', 'opencode-plugin']
  },
  'agent-skill-compliance': {
    requirePath: path.join(ROOT_DIR, 'scripts', 'validate-agent-skill-compliance.js'),
    call: (mod) => mod.main(),
    relevantChecklists: ['new-agent', 'new-skill', 'release']
  }
};

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/**
 * Detect the default branch name (main, master, etc.) from origin.
 * Falls back to 'main' if detection fails.
 */
function getDefaultBranch() {
  const ref = gitExec('git symbolic-ref refs/remotes/origin/HEAD');
  if (ref) return ref.replace('refs/remotes/origin/', '');
  // Fallback: try 'main' then 'master'
  const branches = gitExec('git branch -r');
  if (branches.includes('origin/main')) return 'main';
  if (branches.includes('origin/master')) return 'master';
  return 'main';
}

/**
 * Run a git command safely and return trimmed stdout, or empty string on error.
 * Only uses hardcoded git commands (no user input) so execSync is safe here.
 */
function gitExec(cmd) {
  try {
    return execSync(cmd, {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim();
  } catch {
    return '';
  }
}

/**
 * Get the union of uncommitted and branch-diverged changed files.
 * Returns [] on any error (e.g. not in a git repo).
 */
function getChangedFiles() {
  const files = new Set();

  // Uncommitted changes (staged + unstaged)
  const uncommitted = gitExec('git diff --name-only HEAD');
  if (uncommitted) {
    for (const f of uncommitted.split('\n')) {
      if (f.trim()) files.add(f.trim());
    }
  }

  // If HEAD failed (fresh repo), try staged only
  if (!uncommitted) {
    const staged = gitExec('git diff --cached --name-only');
    if (staged) {
      for (const f of staged.split('\n')) {
        if (f.trim()) files.add(f.trim());
      }
    }
  }

  // Branch changes compared to default branch
  const defaultBranch = getDefaultBranch();
  const branchChanges = gitExec(`git diff --name-only origin/${defaultBranch}...HEAD`);
  if (branchChanges) {
    for (const f of branchChanges.split('\n')) {
      if (f.trim()) files.add(f.trim());
    }
  }

  // Untracked files
  const untracked = gitExec('git ls-files --others --exclude-standard');
  if (untracked) {
    for (const f of untracked.split('\n')) {
      if (f.trim()) files.add(f.trim());
    }
  }

  return Array.from(files);
}

/**
 * Get truly new files (added, not just modified) using git diff-filter.
 * Returns [] on any error.
 */
function getNewFiles() {
  const files = new Set();

  const defaultBranch = getDefaultBranch();
  const added = gitExec(`git diff --diff-filter=A --name-only origin/${defaultBranch}...HEAD`);
  if (added) {
    for (const f of added.split('\n')) {
      if (f.trim()) files.add(f.trim());
    }
  }

  // Also count untracked files as "new"
  const untracked = gitExec('git ls-files --others --exclude-standard');
  if (untracked) {
    for (const f of untracked.split('\n')) {
      if (f.trim()) files.add(f.trim());
    }
  }

  return Array.from(files);
}

// ---------------------------------------------------------------------------
// Checklist detection
// ---------------------------------------------------------------------------

/**
 * Determine which checklists are relevant based on changed files.
 */
function detectRelevantChecklists(changedFiles) {
  const relevant = new Set();

  for (const file of changedFiles) {
    // Check each checklist's patterns
    for (const [checklist, patterns] of Object.entries(CHECKLIST_PATTERNS)) {
      if (checklist === 'cross-platform') continue; // handled separately below

      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          // Convert simple glob to anchored regex to avoid false positives.
          // 'plugins/*/commands/' becomes /^plugins\/[^/]+\/commands\//
          const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]+'));
          if (regex.test(file)) {
            relevant.add(checklist);
          }
        } else {
          if (file.startsWith(pattern) || file === pattern) {
            relevant.add(checklist);
          }
        }
      }
    }

    // Cross-platform is triggered by any plugin/ or lib/ change
    // (but NOT node_modules anywhere in path)
    if ((file.startsWith('plugins/') || file.startsWith('lib/')) && !file.includes('/node_modules/') && !file.startsWith('lib/node_modules/')) {
      relevant.add('cross-platform');
    }
  }

  return relevant;
}

// ---------------------------------------------------------------------------
// Console capture helper
// ---------------------------------------------------------------------------

/**
 * Temporarily redirect console.log and console.error during fn execution.
 * Returns { output: string[], result: any }.
 */
function captureConsole(fn) {
  const output = [];
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;

  console.log = (...args) => output.push(args.join(' '));
  console.error = (...args) => output.push(args.join(' '));
  console.warn = (...args) => output.push(args.join(' '));

  let result;
  let error;
  try {
    result = fn();
  } catch (err) {
    error = err;
  } finally {
    console.log = origLog;
    console.error = origError;
    console.warn = origWarn;
  }

  if (error) {
    return { output, error };
  }
  return { output, result };
}

// ---------------------------------------------------------------------------
// Run existing validators
// ---------------------------------------------------------------------------

/**
 * Run existing validator scripts that are relevant to detected checklists.
 */
function runExistingValidators(relevantChecklists, options) {
  const results = [];
  const runAll = options.all || options.release;

  for (const [name, validator] of Object.entries(VALIDATORS)) {
    // Check if this validator is relevant
    const isRelevant = runAll ||
      validator.relevantChecklists.some(cl => relevantChecklists.has(cl));

    if (!isRelevant) {
      results.push({
        name: `validator:${name}`,
        status: 'skip',
        message: 'Not relevant to changed files',
        duration: 0
      });
      continue;
    }

    const start = Date.now();
    try {
      const mod = require(validator.requirePath);
      const { output, result, error } = captureConsole(() => validator.call(mod));

      if (error) {
        results.push({
          name: `validator:${name}`,
          status: 'error',
          message: error.message,
          output: output,
          duration: Date.now() - start
        });
      } else {
        const exitCode = typeof result === 'number' ? result : 0;
        results.push({
          name: `validator:${name}`,
          status: exitCode === 0 ? 'pass' : 'fail',
          message: exitCode === 0 ? 'Passed' : 'Failed',
          output: options.verbose ? output : [],
          duration: Date.now() - start
        });
      }
    } catch (err) {
      results.push({
        name: `validator:${name}`,
        status: 'error',
        message: err.message,
        duration: Date.now() - start
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Gap check functions
// ---------------------------------------------------------------------------

/**
 * a) If any file under plugins/{name}/commands/, plugins/{name}/agents/, or
 *    plugins/{name}/skills/ is NEW (truly added), verify CHANGELOG.md is
 *    also in the changed files list.
 */
function checkChangelogModified(changedFiles) {
  const newFiles = getNewFiles();

  const hasNewFeatureFile = newFiles.some(f =>
    /^plugins\/[^/]+\/commands\//.test(f) ||
    /^plugins\/[^/]+\/agents\//.test(f) ||
    /^plugins\/[^/]+\/skills\//.test(f)
  );

  if (!hasNewFeatureFile) {
    return {
      name: 'gap:changelog-modified',
      status: 'pass',
      message: 'No new feature files detected'
    };
  }

  const changelogModified = changedFiles.some(f => f === 'CHANGELOG.md');

  return {
    name: 'gap:changelog-modified',
    status: changelogModified ? 'pass' : 'warn',
    message: changelogModified
      ? 'CHANGELOG.md updated for new feature files'
      : 'New command/agent/skill files detected but CHANGELOG.md not modified'
  };
}

/**
 * b) Scan .md files under plugins/ for AskUserQuestion label patterns.
 *    Flag any label string over 30 characters (OpenCode limit).
 */
function checkAskUserQuestionLabels() {
  const pluginsDir = path.join(ROOT_DIR, 'plugins');
  const issues = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !EXCLUDED_DIRS.includes(entry.name)) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Match patterns like "label": "..." or label: "..."
        const labelPatterns = [
          /"label"\s*:\s*"([^"]+)"/g,
          /label:\s*"([^"]+)"/g
        ];

        for (const pattern of labelPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const label = match[1];
            if (label.length > 30) {
              const relPath = path.relative(ROOT_DIR, fullPath);
              issues.push(`${relPath}: label "${label.substring(0, 30)}..." (${label.length} chars)`);
            }
          }
        }
      }
    }
  }

  scanDir(pluginsDir);

  if (issues.length === 0) {
    return {
      name: 'gap:label-length',
      status: 'pass',
      message: 'All AskUserQuestion labels are 30 chars or under'
    };
  }

  return {
    name: 'gap:label-length',
    status: 'warn',
    message: `${issues.length} label(s) exceed 30-char OpenCode limit`,
    details: issues
  };
}

/**
 * c) Scan command .md files for codex-description in frontmatter.
 *    Flag any command missing it.
 */
function checkCodexTriggerPhrases() {
  const pluginsDir = path.join(ROOT_DIR, 'plugins');
  const missing = [];

  if (!fs.existsSync(pluginsDir)) {
    return {
      name: 'gap:codex-trigger-phrases',
      status: 'error',
      message: 'plugins/ directory not found'
    };
  }

  const plugins = fs.readdirSync(pluginsDir).filter(f => {
    const stat = fs.statSync(path.join(pluginsDir, f));
    return stat.isDirectory();
  });

  for (const plugin of plugins) {
    const commandsDir = path.join(pluginsDir, plugin, 'commands');
    if (!fs.existsSync(commandsDir)) continue;

    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
      // Check frontmatter for codex-description
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch || !frontmatterMatch[1].includes('codex-description')) {
        missing.push(`${plugin}/commands/${file}`);
      }
    }
  }

  if (missing.length === 0) {
    return {
      name: 'gap:codex-trigger-phrases',
      status: 'pass',
      message: 'All commands have codex-description frontmatter'
    };
  }

  return {
    name: 'gap:codex-trigger-phrases',
    status: 'warn',
    message: `${missing.length} command(s) missing codex-description`,
    details: missing
  };
}

/**
 * d) Check that every lib/ subdirectory with an index.js is required
 *    from lib/index.js.
 */
function checkLibIndexExports() {
  const libDir = path.join(ROOT_DIR, 'lib');
  const libIndexPath = path.join(libDir, 'index.js');

  if (!fs.existsSync(libIndexPath)) {
    return {
      name: 'gap:lib-index-exports',
      status: 'error',
      message: 'lib/index.js not found'
    };
  }

  const libIndexContent = fs.readFileSync(libIndexPath, 'utf8');
  const missing = [];

  const subdirs = fs.readdirSync(libDir).filter(f => {
    const stat = fs.statSync(path.join(libDir, f));
    return stat.isDirectory() && f !== 'node_modules';
  });

  for (const subdir of subdirs) {
    const hasIndex = fs.existsSync(path.join(libDir, subdir, 'index.js'));
    if (!hasIndex) continue;

    // Check if lib/index.js requires this subdirectory
    // Match patterns like require('./subdir'), require('./subdir/index'),
    // or require('./subdir/something')
    const requirePattern = new RegExp(`require\\(['"]\\./${subdir}(?:/|'|")`, 'm');
    if (!requirePattern.test(libIndexContent)) {
      missing.push(`lib/${subdir}/`);
    }
  }

  if (missing.length === 0) {
    return {
      name: 'gap:lib-index-exports',
      status: 'pass',
      message: 'All lib/ subdirectories with index.js are exported from lib/index.js'
    };
  }

  return {
    name: 'gap:lib-index-exports',
    status: 'fail',
    message: `${missing.length} lib module(s) not exported from lib/index.js`,
    details: missing
  };
}

/**
 * e) Compare MD5 hashes of files in lib/ with their copies in
 *    each plugin's lib/ directory. Flag any mismatches indicating
 *    lib is out of sync.
 */
function checkLibPluginSync(changedFiles, options) {
  // Only run if lib/ or plugins/*/lib/ files changed (or --all)
  if (!options.all && !options.release) {
    const libChanged = changedFiles.some(f =>
      (f.startsWith('lib/') && !f.includes('node_modules')) ||
      /^plugins\/[^/]+\/lib\//.test(f)
    );
    if (!libChanged) {
      return {
        name: 'gap:lib-plugin-sync',
        status: 'skip',
        message: 'No lib/ changes detected'
      };
    }
  }

  const libDir = path.join(ROOT_DIR, 'lib');
  const pluginsDir = path.join(ROOT_DIR, 'plugins');
  const mismatches = [];

  // Post-extraction: plugins/ no longer exists, sync handled by agent-core
  if (!fs.existsSync(pluginsDir)) {
    return {
      name: 'gap:lib-plugin-sync',
      status: 'pass',
      message: 'Plugins extracted to standalone repos (agent-core handles sync)'
    };
  }

  if (!fs.existsSync(libDir)) {
    return {
      name: 'gap:lib-plugin-sync',
      status: 'error',
      message: 'lib/ directory not found'
    };
  }

  // Build file info map for all files in lib/ (path -> {mtime, size})
  const libFiles = {};

  function collectFilesRecursive(dir, relativeTo) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFilesRecursive(fullPath, relativeTo);
      } else if (entry.isFile()) {
        const relPath = path.relative(relativeTo, fullPath);
        const stat = fs.statSync(fullPath);
        libFiles[relPath] = { fullPath, mtime: stat.mtimeMs, size: stat.size };
      }
    }
  }

  collectFilesRecursive(libDir, libDir);

  // Exclude package.json - only belongs to lib/ root, not synced to plugins
  delete libFiles['package.json'];

  // Compare with each plugin's lib/ directory using mtime+size first, hash only on mismatch
  const plugins = fs.readdirSync(pluginsDir).filter(f => {
    const stat = fs.statSync(path.join(pluginsDir, f));
    return stat.isDirectory();
  });

  for (const plugin of plugins) {
    const pluginLibDir = path.join(pluginsDir, plugin, 'lib');
    if (!fs.existsSync(pluginLibDir)) continue;

    for (const [relPath, libInfo] of Object.entries(libFiles)) {
      const pluginFilePath = path.join(pluginLibDir, relPath);
      if (!fs.existsSync(pluginFilePath)) {
        mismatches.push(`${plugin}/lib/${relPath}: missing (exists in lib/)`);
        continue;
      }

      const pluginStat = fs.statSync(pluginFilePath);

      // Quick check: if size matches and mtime is identical, skip hash
      if (pluginStat.size === libInfo.size && pluginStat.mtimeMs === libInfo.mtime) {
        continue;
      }

      // Size mismatch is a definite mismatch
      if (pluginStat.size !== libInfo.size) {
        mismatches.push(`${plugin}/lib/${relPath}: size mismatch`);
        continue;
      }

      // Same size but different mtime: compare by hash
      const libContent = fs.readFileSync(libInfo.fullPath);
      const pluginContent = fs.readFileSync(pluginFilePath);
      const libHash = crypto.createHash('md5').update(libContent).digest('hex');
      const pluginHash = crypto.createHash('md5').update(pluginContent).digest('hex');
      if (pluginHash !== libHash) {
        mismatches.push(`${plugin}/lib/${relPath}: content mismatch`);
      }
    }

    // Reverse check: detect stale files in plugin lib/ that don't exist in lib/
    function checkStaleFiles(dir, relativeTo) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (EXCLUDED_DIRS.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkStaleFiles(fullPath, relativeTo);
        } else if (entry.isFile()) {
          const relPath = path.relative(relativeTo, fullPath);
          if (!libFiles[relPath]) {
            mismatches.push(`${plugin}/lib/${relPath}: stale (not in lib/)`);
          }
        }
      }
    }
    checkStaleFiles(pluginLibDir, pluginLibDir);
  }

  if (mismatches.length === 0) {
    return {
      name: 'gap:lib-plugin-sync',
      status: 'pass',
      message: 'lib/ and plugins/*/lib/ are in sync'
    };
  }

  return {
    name: 'gap:lib-plugin-sync',
    status: 'fail',
    message: `${mismatches.length} file(s) out of sync between lib/ and plugins/*/lib/`,
    details: mismatches.slice(0, 20) // Cap detail output
  };
}

/**
 * f) For changed files matching lib/{name}/, check if __tests__/ has a
 *    corresponding test file. Only applies to new lib modules.
 */
function checkTestFileExistence(changedFiles) {
  const newFiles = getNewFiles();
  const testsDir = path.join(ROOT_DIR, '__tests__');
  const missing = [];

  // Find new files under lib/ subdirectories (e.g. lib/my-module/foo.js)
  const newLibFiles = newFiles.filter(f =>
    /^lib\/[^/]+\//.test(f) && f.endsWith('.js')
  );

  if (newLibFiles.length === 0) {
    return {
      name: 'gap:test-file-existence',
      status: 'pass',
      message: 'No new lib module files detected'
    };
  }

  // Extract unique lib module names
  const newModules = new Set();
  for (const f of newLibFiles) {
    const match = f.match(/^lib\/([^/]+)\//);
    if (match) newModules.add(match[1]);
  }

  for (const moduleName of newModules) {
    // Check if __tests__/ has any test file referencing this module
    if (!fs.existsSync(testsDir)) {
      missing.push(`${moduleName}: no __tests__/ directory found`);
      continue;
    }

    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));
    const hasTest = testFiles.some(f => {
      const base = f.replace('.test.js', '');
      return base === moduleName || base.startsWith(`${moduleName}-`) || base.startsWith(`${moduleName}.`);
    });

    if (!hasTest) {
      missing.push(`${moduleName}: no test file found in __tests__/`);
    }
  }

  if (missing.length === 0) {
    return {
      name: 'gap:test-file-existence',
      status: 'pass',
      message: 'Test files exist for new lib modules'
    };
  }

  return {
    name: 'gap:test-file-existence',
    status: 'warn',
    message: `${missing.length} new lib module(s) missing test files`,
    details: missing
  };
}

/**
 * g) Lib sync check - no longer needed since agent-core handles sync.
 *    Kept as a pass-through for backward compatibility with check runners.
 */
function checkLibStagedTogether() {
  return {
    name: 'gap:lib-staged-together',
    status: 'pass',
    message: 'lib/ sync handled by agent-core (no local check needed)'
  };
}

/**
 * h) Check that generated documentation sections are up to date.
 *    Uses generate-docs.js checkFreshness() to detect stale markers.
 */
function checkDocsFreshness() {
  try {
    const { checkFreshness } = require(path.join(ROOT_DIR, 'scripts', 'generate-docs.js'));
    const result = checkFreshness();

    if (result.status === 'fresh') {
      return {
        name: 'gap:docs-freshness',
        status: 'pass',
        message: result.message
      };
    }

    return {
      name: 'gap:docs-freshness',
      status: 'fail',
      message: result.message,
      details: result.staleFiles.map(f => `${f}: generated section out of date`)
    };
  } catch (err) {
    return {
      name: 'gap:docs-freshness',
      status: 'error',
      message: `Failed to check docs freshness: ${err.message}`
    };
  }
}

/**
 * i) Check that agent template expansions are up to date.
 *    Uses expand-templates.js checkFreshness() to detect stale markers.
 */
function checkTemplateFreshness() {
  try {
    const { checkFreshness } = require(path.join(ROOT_DIR, 'scripts', 'expand-templates.js'));
    const result = checkFreshness();

    if (result.status === 'fresh') {
      return {
        name: 'gap:template-freshness',
        status: 'pass',
        message: result.message
      };
    }

    return {
      name: 'gap:template-freshness',
      status: 'fail',
      message: result.message,
      details: result.staleFiles.map(f => `${f}: template expansion out of date`)
    };
  } catch (err) {
    return {
      name: 'gap:template-freshness',
      status: 'error',
      message: `Failed to check template freshness: ${err.message}`
    };
  }
}

/**
 * j) Check that generated adapter files are up to date.
 *    Uses gen-adapters.js checkFreshness() to detect stale files.
 */
function checkAdapterFreshness() {
  try {
    const { checkFreshness } = require(path.join(ROOT_DIR, 'scripts', 'gen-adapters.js'));
    const result = checkFreshness();

    if (result.status === 'fresh') {
      return {
        name: 'gap:adapter-freshness',
        status: 'pass',
        message: result.message
      };
    }

    return {
      name: 'gap:adapter-freshness',
      status: 'fail',
      message: result.message,
      details: result.staleFiles.map(f => `${f}: adapter out of date`)
    };
  } catch (err) {
    return {
      name: 'gap:adapter-freshness',
      status: 'error',
      message: `Failed to check adapter freshness: ${err.message}`
    };
  }
}

// ---------------------------------------------------------------------------
// Gap check orchestrator
// ---------------------------------------------------------------------------

/**
 * Run gap checks relevant to detected checklists.
 */
function runGapChecks(relevantChecklists, changedFiles, options) {
  const results = [];
  const runAll = options.all || options.release;

  // changelog check: relevant to new-command, new-agent, new-skill
  if (runAll || relevantChecklists.has('new-command') ||
      relevantChecklists.has('new-agent') || relevantChecklists.has('new-skill')) {
    results.push(checkChangelogModified(changedFiles));
  }

  // label length: relevant to cross-platform, new-command
  if (runAll || relevantChecklists.has('cross-platform') ||
      relevantChecklists.has('new-command')) {
    results.push(checkAskUserQuestionLabels());
  }

  // codex trigger phrases: relevant to new-command, release
  if (runAll || relevantChecklists.has('new-command') ||
      relevantChecklists.has('release')) {
    results.push(checkCodexTriggerPhrases());
  }

  // lib/index.js exports: relevant to new-lib-module, release
  if (runAll || relevantChecklists.has('new-lib-module') ||
      relevantChecklists.has('release')) {
    results.push(checkLibIndexExports());
  }

  // lib/plugin sync: relevant to new-lib-module, cross-platform, release
  if (runAll || relevantChecklists.has('new-lib-module') ||
      relevantChecklists.has('cross-platform') || relevantChecklists.has('release')) {
    results.push(checkLibPluginSync(changedFiles, options));
  }

  // test file existence: relevant to new-lib-module
  if (runAll || relevantChecklists.has('new-lib-module')) {
    results.push(checkTestFileExistence(changedFiles));
  }

  // lib staged together: always useful when lib is touched
  if (runAll || relevantChecklists.has('new-lib-module') ||
      relevantChecklists.has('cross-platform')) {
    results.push(checkLibStagedTogether());
  }

  // docs freshness: relevant to new-agent, new-skill, new-command, release
  if (runAll || relevantChecklists.has('new-agent') ||
      relevantChecklists.has('new-skill') || relevantChecklists.has('new-command') ||
      relevantChecklists.has('release')) {
    results.push(checkDocsFreshness());
  }

  // template freshness: relevant to new-agent, release, or when agent/snippet files change
  const hasTemplateChanges = changedFiles.some(f =>
    f.includes('templates/agent-snippets/') || f.match(/plugins\/.*\/agents\/.*\.md$/));
  if (runAll || relevantChecklists.has('new-agent') ||
      relevantChecklists.has('release') || hasTemplateChanges) {
    results.push(checkTemplateFreshness());
  }

  // adapter freshness: relevant to cross-platform, new-command, new-agent, new-skill, release,
  // or when plugin source or adapter files change
  const hasAdapterChanges = changedFiles.some(f =>
    f.startsWith('adapters/opencode/') || f.startsWith('adapters/codex/') ||
    f.startsWith('lib/adapter-transforms') ||
    f.match(/plugins\/.*\/commands\/.*\.md$/) ||
    f.match(/plugins\/.*\/agents\/.*\.md$/) ||
    f.match(/plugins\/.*\/skills\/.*\/SKILL\.md$/));
  if (runAll || relevantChecklists.has('cross-platform') ||
      relevantChecklists.has('new-command') || relevantChecklists.has('new-agent') ||
      relevantChecklists.has('new-skill') || relevantChecklists.has('release') ||
      hasAdapterChanges) {
    results.push(checkAdapterFreshness());
  }

  return results;
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

/**
 * Format and display results. Returns exit code.
 */
function formatResults(allResults, relevantChecklists, options) {
  const passed = allResults.filter(r => r.status === 'pass');
  const failed = allResults.filter(r => r.status === 'fail');
  const warned = allResults.filter(r => r.status === 'warn');
  const skipped = allResults.filter(r => r.status === 'skip');
  const errored = allResults.filter(r => r.status === 'error');

  if (options.json) {
    const jsonOutput = {
      summary: {
        passed: passed.length,
        failed: failed.length + errored.length,
        warnings: warned.length,
        skipped: skipped.length,
        total: allResults.length
      },
      relevantChecklists: Array.from(relevantChecklists),
      results: allResults,
      exitCode: (failed.length + errored.length) > 0 ? 1 : 0
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return jsonOutput.exitCode;
  }

  // Header
  console.log('Preflight Check Results');
  console.log('=======================\n');

  if (relevantChecklists.size > 0) {
    console.log(`Detected checklists: ${Array.from(relevantChecklists).join(', ')}\n`);
  }

  // Results by status
  const statusIcon = {
    pass: '[OK]',
    fail: '[ERROR]',
    warn: '[WARN]',
    skip: '[SKIP]',
    error: '[ERROR]'
  };

  for (const result of allResults) {
    const icon = statusIcon[result.status] || '[??]';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.name}: ${result.message}${duration}`);

    if (options.verbose && result.output && result.output.length > 0) {
      for (const line of result.output.slice(0, 10)) {
        console.log(`     ${line}`);
      }
    }

    if (result.details && result.details.length > 0) {
      const maxDetails = options.verbose ? result.details.length : 5;
      for (const detail of result.details.slice(0, maxDetails)) {
        console.log(`     - ${detail}`);
      }
      if (result.details.length > maxDetails) {
        console.log(`     ... and ${result.details.length - maxDetails} more`);
      }
    }
  }

  // Summary line
  console.log('');
  console.log(`Summary: ${passed.length} passed, ${failed.length + errored.length} failed, ${warned.length} warnings, ${skipped.length} skipped`);

  // Manual checks reminder
  const manualItems = [];
  for (const checklist of relevantChecklists) {
    const items = MANUAL_CHECKS[checklist];
    if (items) {
      for (const item of items) {
        manualItems.push(item);
      }
    }
  }

  if (manualItems.length > 0) {
    // Deduplicate
    const unique = [...new Set(manualItems)];
    console.log('\nManual checks still needed:');
    for (const item of unique) {
      console.log(`  - ${item}`);
    }
  }

  console.log('');

  if (failed.length + errored.length > 0) {
    console.log('[ERROR] Preflight checks failed');
    return 1;
  }

  if (warned.length > 0) {
    console.log('[WARN] Preflight checks passed with warnings');
    return 0;
  }

  console.log('[OK] All preflight checks passed');
  return 0;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full preflight check suite.
 *
 * @param {Object} options - { all, release, json, verbose }
 * @returns {{ exitCode: number, results: Array }}
 */
function runPreflight(options) {
  options = options || {};

  // 1. Get changed files (unless --all)
  let changedFiles = [];
  let relevantChecklists;

  if (options.all || options.release) {
    relevantChecklists = new Set(Object.keys(CHECKLIST_PATTERNS));
    // Still gather changed files for gap checks that need them
    changedFiles = getChangedFiles();
  } else {
    changedFiles = getChangedFiles();

    if (changedFiles.length === 0 && !options.json) {
      console.log('[OK] No changed files detected. Use --all to run all checks.');
      return { exitCode: 0, results: [] };
    }

    relevantChecklists = detectRelevantChecklists(changedFiles);

    if (relevantChecklists.size === 0 && !options.json) {
      console.log('[OK] No relevant checklists for the changed files.');
      return { exitCode: 0, results: [] };
    }
  }

  // 2. Run existing validators
  const validatorResults = runExistingValidators(relevantChecklists, options);

  // 3. Run gap checks
  const gapResults = runGapChecks(relevantChecklists, changedFiles, options);

  // 4. Release extras (npm test, npm pack --dry-run)
  const releaseResults = [];
  if (options.release) {
    // npm test
    const testStart = Date.now();
    try {
      execSync('npm test', {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 300000 // 5 min timeout
      });
      releaseResults.push({
        name: 'release:npm-test',
        status: 'pass',
        message: 'All tests passed',
        duration: Date.now() - testStart
      });
    } catch {
      releaseResults.push({
        name: 'release:npm-test',
        status: 'fail',
        message: 'Tests failed',
        duration: Date.now() - testStart
      });
    }

    // npm pack --dry-run
    const packStart = Date.now();
    try {
      execSync('npm pack --dry-run', {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000
      });
      releaseResults.push({
        name: 'release:npm-pack',
        status: 'pass',
        message: 'Package builds correctly',
        duration: Date.now() - packStart
      });
    } catch {
      releaseResults.push({
        name: 'release:npm-pack',
        status: 'fail',
        message: 'Package build failed',
        duration: Date.now() - packStart
      });
    }
  }

  // 5. Combine and format
  const allResults = [...validatorResults, ...gapResults, ...releaseResults];
  const exitCode = formatResults(allResults, relevantChecklists, options);

  return { exitCode, results: allResults };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments and run preflight checks.
 *
 * @param {string[]} args - CLI arguments
 * @returns {number} Exit code
 */
function main(args) {
  args = args || [];

  const options = {
    all: args.includes('--all'),
    release: args.includes('--release'),
    json: args.includes('--json'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  const { exitCode } = runPreflight(options);
  return exitCode;
}

// ---------------------------------------------------------------------------
// require.main guard and exports
// ---------------------------------------------------------------------------

if (require.main === module) {
  const code = main(process.argv.slice(2));
  if (typeof code === 'number' && code !== 0) {
    process.exit(code);
  }
}

module.exports = {
  main,
  runPreflight,
  getChangedFiles,
  detectRelevantChecklists,
  runExistingValidators,
  runGapChecks,
  checkChangelogModified,
  checkAskUserQuestionLabels,
  checkCodexTriggerPhrases,
  checkLibIndexExports,
  checkLibPluginSync,
  checkTestFileExistence,
  checkLibStagedTogether,
  checkDocsFreshness,
  checkAdapterFreshness,
  CHECKLIST_PATTERNS,
  VALIDATORS,
  MANUAL_CHECKS
};
