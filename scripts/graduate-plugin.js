#!/usr/bin/env node
/**
 * Graduate Plugin Script
 *
 * Extracts plugins from the agentsys monorepo into standalone repos
 * under the agent-sh GitHub org, preserving git history via subtree split.
 *
 * Usage:
 *   node scripts/graduate-plugin.js <plugin-name>
 *   node scripts/graduate-plugin.js --all
 *   node scripts/graduate-plugin.js --all --dry-run
 *   node scripts/graduate-plugin.js deslop --dry-run
 *
 * Security note: All shell commands use execFileSync with argument arrays
 * (no shell injection risk). No user-supplied input reaches commands.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GITHUB_ORG = 'agent-sh';
const TODAY = new Date().toISOString().slice(0, 10);

const PLUGINS = [
  'next-task', 'ship', 'enhance', 'deslop', 'learn', 'consult',
  'debate', 'drift-detect', 'repo-map', 'sync-docs', 'audit-project',
  'perf', 'agnix'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(msg);
}

function logStep(step, total, msg) {
  console.log(`  [${step}/${total}] ${msg}`);
}

/**
 * Run a command with execFileSync (no shell). Returns stdout string.
 * All arguments are passed as an array for safety.
 */
function run(bin, args, opts = {}) {
  const { cwd = PROJECT_ROOT } = opts;
  try {
    return execFileSync(bin, args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    throw new Error(`Command failed: ${bin} ${args.join(' ')}\n${stderr || stdout || err.message}`);
  }
}

/**
 * Run a command, returning { ok, stdout, stderr } without throwing.
 */
function tryRun(bin, args, opts = {}) {
  const { cwd = PROJECT_ROOT } = opts;
  try {
    const stdout = execFileSync(bin, args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
    return { ok: true, stdout, stderr: '' };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout ? err.stdout.toString().trim() : '',
      stderr: err.stderr ? err.stderr.toString().trim() : ''
    };
  }
}

/**
 * Read the plugin.json for a given plugin.
 */
function readPluginJson(pluginName) {
  const p = path.join(PROJECT_ROOT, 'plugins', pluginName, '.claude-plugin', 'plugin.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Read the marketplace entry for a plugin (from monorepo marketplace.json).
 */
function readMarketplaceEntry(pluginName) {
  const mp = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  return mp.plugins.find(p => p.name === pluginName) || null;
}

/**
 * Read the add-to-project workflow template.
 */
function readWorkflowTemplate() {
  return fs.readFileSync(path.join(PROJECT_ROOT, '.github', 'workflows', 'add-to-project.yml'), 'utf8');
}

// ---------------------------------------------------------------------------
// Scaffolding generators for the new standalone repo
// ---------------------------------------------------------------------------

function generatePackageJson(pluginName, pluginJson, marketplaceEntry) {
  const pkg = {
    name: `@agentsys/${pluginName}`,
    version: '1.0.0',
    description: pluginJson.description || (marketplaceEntry && marketplaceEntry.description) || '',
    author: pluginJson.author || {
      name: 'Avi Fenesh',
      email: '[email protected]',
      url: 'https://github.com/avifenesh'
    },
    license: pluginJson.license || 'MIT',
    repository: {
      type: 'git',
      url: `https://github.com/${GITHUB_ORG}/${pluginName}.git`
    },
    homepage: `https://github.com/${GITHUB_ORG}/${pluginName}`,
    keywords: pluginJson.keywords || [pluginName]
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function generatePluginJson(pluginName, pluginJson) {
  const updated = {
    ...pluginJson,
    version: '1.0.0',
    homepage: `https://github.com/${GITHUB_ORG}/${pluginName}`,
    repository: `https://github.com/${GITHUB_ORG}/${pluginName}`
  };
  return JSON.stringify(updated, null, 2) + '\n';
}

function generateMarketplaceJson(pluginName, marketplaceEntry) {
  const mp = {
    name: pluginName,
    description: (marketplaceEntry && marketplaceEntry.description) || '',
    version: '1.0.0',
    owner: {
      name: 'Avi Fenesh',
      url: 'https://github.com/avifenesh'
    },
    repository: `https://github.com/${GITHUB_ORG}/${pluginName}`,
    keywords: (marketplaceEntry && marketplaceEntry.keywords) || [pluginName],
    plugins: [
      {
        name: pluginName,
        source: '.',
        description: (marketplaceEntry && marketplaceEntry.description) || '',
        version: '1.0.0',
        category: (marketplaceEntry && marketplaceEntry.category) || 'development'
      }
    ]
  };
  return JSON.stringify(mp, null, 2) + '\n';
}

function generateReadme(pluginName, pluginJson, marketplaceEntry) {
  const desc = pluginJson.description || (marketplaceEntry && marketplaceEntry.description) || '';
  const keywords = (pluginJson.keywords || []).map(k => `\`${k}\``).join(', ');
  return `# ${pluginName}

${desc}

## Installation

\`\`\`bash
# Claude Code
claude mcp add-plugin ${GITHUB_ORG}/${pluginName}

# Or install from marketplace
agentsys install ${pluginName}
\`\`\`

## Usage

\`\`\`
/${pluginName}
\`\`\`

## Keywords

${keywords || 'N/A'}

## License

MIT
`;
}

function generateChangelog(pluginName) {
  return `# Changelog

## [1.0.0] - ${TODAY}

Initial release. Extracted from [agentsys](https://github.com/${GITHUB_ORG}/agentsys) monorepo.
`;
}

// ---------------------------------------------------------------------------
// Core graduation logic
// ---------------------------------------------------------------------------

function graduatePlugin(pluginName, opts = {}) {
  const { dryRun = false } = opts;
  const totalSteps = 6;
  const prefix = dryRun ? '[DRY RUN] ' : '';
  const pluginDir = path.join(PROJECT_ROOT, 'plugins', pluginName);

  log(`\n${prefix}Graduating plugin: ${pluginName}`);
  log('-'.repeat(50));

  // Validate plugin exists
  if (!fs.existsSync(pluginDir)) {
    log(`[ERROR] Plugin directory not found: plugins/${pluginName}`);
    return false;
  }

  const pluginJsonPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginJsonPath)) {
    log(`[ERROR] Missing plugin.json: plugins/${pluginName}/.claude-plugin/plugin.json`);
    return false;
  }

  const pluginJson = readPluginJson(pluginName);
  const marketplaceEntry = readMarketplaceEntry(pluginName);

  // Step 1: Create GitHub repo
  logStep(1, totalSteps, `${prefix}Creating repo ${GITHUB_ORG}/${pluginName}`);
  if (!dryRun) {
    const check = tryRun('gh', ['repo', 'view', `${GITHUB_ORG}/${pluginName}`, '--json', 'name']);
    if (check.ok) {
      log(`    [WARN] Repo ${GITHUB_ORG}/${pluginName} already exists, skipping creation`);
    } else {
      run('gh', ['repo', 'create', `${GITHUB_ORG}/${pluginName}`, '--public',
        '--description', pluginJson.description || pluginName]);
    }
  }

  // Step 2: Subtree split to extract history
  const extractBranch = `extract/${pluginName}`;
  logStep(2, totalSteps, `${prefix}Extracting history with git subtree split`);
  if (!dryRun) {
    // Delete branch if it already exists locally
    tryRun('git', ['branch', '-D', extractBranch]);
    run('git', ['subtree', 'split', '-P', `plugins/${pluginName}`, '-b', extractBranch]);
  }

  // Step 3: Clone into temp dir and push extracted history
  const tmpDir = path.join(PROJECT_ROOT, '.tmp-graduate', pluginName);
  logStep(3, totalSteps, `${prefix}Pushing extracted history to new repo`);
  if (!dryRun) {
    // Clean up any previous tmp dir
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    run('git', ['clone', '--no-checkout', `https://github.com/${GITHUB_ORG}/${pluginName}.git`, tmpDir]);

    // Fetch the extracted branch from the monorepo
    run('git', ['remote', 'add', 'monorepo', PROJECT_ROOT], { cwd: tmpDir });
    run('git', ['fetch', 'monorepo', extractBranch], { cwd: tmpDir });
    run('git', ['checkout', '-b', 'main', `monorepo/${extractBranch}`], { cwd: tmpDir });
    run('git', ['remote', 'remove', 'monorepo'], { cwd: tmpDir });
  }

  // Step 4: Add scaffolding files
  logStep(4, totalSteps, `${prefix}Adding scaffolding files`);
  const scaffoldFiles = {
    'package.json': generatePackageJson(pluginName, pluginJson, marketplaceEntry),
    '.claude-plugin/plugin.json': generatePluginJson(pluginName, pluginJson),
    '.claude-plugin/marketplace.json': generateMarketplaceJson(pluginName, marketplaceEntry),
    '.github/workflows/add-to-project.yml': readWorkflowTemplate(),
    'README.md': generateReadme(pluginName, pluginJson, marketplaceEntry),
    'CHANGELOG.md': generateChangelog(pluginName)
  };

  if (!dryRun) {
    for (const [relPath, content] of Object.entries(scaffoldFiles)) {
      const fullPath = path.join(tmpDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  } else {
    for (const relPath of Object.keys(scaffoldFiles)) {
      log(`    Would create: ${relPath}`);
    }
  }

  // Step 5: Commit scaffolding
  logStep(5, totalSteps, `${prefix}Committing scaffolding`);
  if (!dryRun) {
    run('git', ['add', '-A'], { cwd: tmpDir });
    run('git', ['commit', '-m', 'chore: add standalone repo scaffolding for v1.0.0'], { cwd: tmpDir });
  }

  // Step 6: Push to remote
  logStep(6, totalSteps, `${prefix}Pushing main branch to origin`);
  if (!dryRun) {
    run('git', ['push', '-u', 'origin', 'main'], { cwd: tmpDir });

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tryRun('git', ['branch', '-D', extractBranch]);
  }

  log(`[OK] ${prefix}Graduated ${pluginName} -> ${GITHUB_ORG}/${pluginName}`);
  return true;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(args) {
  if (!args) args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(a => a !== '--dry-run');

  if (filteredArgs.length === 0 || filteredArgs[0] === '--help' || filteredArgs[0] === '-h') {
    console.log(`
Graduate Plugin Script

Extracts plugins from the agentsys monorepo into standalone repos
under the ${GITHUB_ORG} GitHub org, preserving git history.

Usage:
  node scripts/graduate-plugin.js <plugin-name> [--dry-run]
  node scripts/graduate-plugin.js --all [--dry-run]

Options:
  --all       Graduate all ${PLUGINS.length} plugins
  --dry-run   Show what would happen without making changes

Plugins: ${PLUGINS.join(', ')}

Examples:
  node scripts/graduate-plugin.js deslop
  node scripts/graduate-plugin.js deslop --dry-run
  node scripts/graduate-plugin.js --all --dry-run
  node scripts/graduate-plugin.js --all
`);
    return 0;
  }

  const isAll = filteredArgs[0] === '--all';
  const pluginsToGraduate = isAll ? [...PLUGINS] : [filteredArgs[0]];

  // Validate plugin names
  for (const name of pluginsToGraduate) {
    if (!PLUGINS.includes(name)) {
      console.log(`[ERROR] Unknown plugin: ${name}`);
      console.log(`Valid plugins: ${PLUGINS.join(', ')}`);
      return 1;
    }
  }

  // Verify gh CLI is available
  const ghCheck = tryRun('gh', ['--version']);
  if (!ghCheck.ok) {
    console.log('[ERROR] gh CLI not found. Install from https://cli.github.com/');
    return 1;
  }

  // Verify gh is authenticated
  const authCheck = tryRun('gh', ['auth', 'status']);
  if (!authCheck.ok) {
    console.log('[ERROR] gh CLI not authenticated. Run: gh auth login');
    return 1;
  }

  // Verify clean working tree (subtree split requires it)
  if (!dryRun) {
    const status = run('git', ['status', '--porcelain']);
    if (status) {
      console.log('[ERROR] Working tree is not clean. Commit or stash changes first.');
      console.log(status);
      return 1;
    }
  }

  if (dryRun) {
    console.log('[DRY RUN] No changes will be made.\n');
  }

  console.log(`Graduating ${pluginsToGraduate.length} plugin(s)...`);

  const results = { success: [], failed: [] };

  for (const name of pluginsToGraduate) {
    try {
      const ok = graduatePlugin(name, { dryRun });
      if (ok) {
        results.success.push(name);
      } else {
        results.failed.push(name);
      }
    } catch (err) {
      console.log(`[ERROR] Failed to graduate ${name}: ${err.message}`);
      results.failed.push(name);
    }
  }

  // Cleanup tmp dir
  const tmpBase = path.join(PROJECT_ROOT, '.tmp-graduate');
  if (!dryRun && fs.existsSync(tmpBase)) {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`  Succeeded: ${results.success.length} (${results.success.join(', ') || 'none'})`);
  if (results.failed.length > 0) {
    console.log(`  Failed:    ${results.failed.length} (${results.failed.join(', ')})`);
  }

  return results.failed.length > 0 ? 1 : 0;
}

if (require.main === module) {
  const code = main();
  if (typeof code === 'number') process.exit(code);
}

module.exports = { main, graduatePlugin, PLUGINS };
