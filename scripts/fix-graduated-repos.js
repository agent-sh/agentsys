#!/usr/bin/env node
/**
 * Fix Graduated Plugin Repos
 *
 * Each graduated repo under agent-sh org contains ALL 13 plugin directories
 * at root (because `git subtree split -P plugins/` extracted the entire
 * plugins/ dir). This script fixes each repo to contain only its own
 * plugin content at root.
 *
 * Usage:
 *   node scripts/fix-graduated-repos.js --all
 *   node scripts/fix-graduated-repos.js --all --dry-run
 *   node scripts/fix-graduated-repos.js deslop
 *   node scripts/fix-graduated-repos.js deslop --dry-run
 *
 * Security: All commands use execFileSync with argument arrays (no shell).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const GITHUB_ORG = 'agent-sh';
const WORK_DIR = '/tmp/fix-repos';

// 12 graduated plugins (agnix excluded — it stays in monorepo)
const PLUGINS = [
  'next-task', 'ship', 'enhance', 'deslop', 'learn', 'consult',
  'debate', 'drift-detect', 'repo-intel', 'sync-docs', 'audit-project',
  'perf'
];

// All 13 plugin dir names that may exist in the repos
const ALL_PLUGIN_DIRS = [
  'next-task', 'ship', 'enhance', 'deslop', 'learn', 'consult',
  'debate', 'drift-detect', 'repo-intel', 'sync-docs', 'audit-project',
  'perf', 'agnix'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(msg);
}

function run(bin, args, opts = {}) {
  const { cwd = process.cwd(), quiet = false } = opts;
  try {
    const result = execFileSync(bin, args, {
      cwd,
      encoding: 'utf8',
      stdio: quiet ? 'pipe' : ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    return (result || '').trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    throw new Error(`Command failed: ${bin} ${args.join(' ')}\n${stderr || stdout}`);
  }
}

function rmrf(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function mkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Recursively copy src into dest, merging directories.
 */
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    mkdirp(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    mkdirp(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

/**
 * Generate components.json by scanning agents/, skills/, commands/.
 */
function generateComponents(repoDir) {
  const components = { agents: [], skills: [], commands: [] };

  // agents/*.md
  const agentsDir = path.join(repoDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      if (f.endsWith('.md')) {
        components.agents.push(f.replace(/\.md$/, ''));
      }
    }
  }

  // skills/*/SKILL.md
  const skillsDir = path.join(repoDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir)) {
      const skillFile = path.join(skillsDir, d, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        components.skills.push(d);
      }
    }
  }

  // commands/*.md
  const commandsDir = path.join(repoDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    for (const f of fs.readdirSync(commandsDir)) {
      if (f.endsWith('.md')) {
        components.commands.push(f.replace(/\.md$/, ''));
      }
    }
  }

  return components;
}

// ---------------------------------------------------------------------------
// Main fix logic
// ---------------------------------------------------------------------------

function fixRepo(name, dryRun) {
  const repoDir = path.join(WORK_DIR, name);

  log(`\n=== Fixing ${GITHUB_ORG}/${name} ===`);

  // 1. Clone
  rmrf(repoDir);
  mkdirp(WORK_DIR);
  log(`  [1] Cloning...`);
  if (dryRun) {
    log(`  [DRY-RUN] Would clone https://github.com/${GITHUB_ORG}/${name}.git`);
    // Still clone for dry-run inspection
  }
  run('git', ['clone', `https://github.com/${GITHUB_ORG}/${name}.git`, repoDir]);

  // 2. Check that the plugin's own subdir exists
  const pluginSubdir = path.join(repoDir, name);
  if (!fs.existsSync(pluginSubdir)) {
    log(`  [SKIP] No '${name}/' subdirectory found — repo may already be fixed`);
    rmrf(repoDir);
    return;
  }

  // Verify it's the broken state (multiple plugin dirs at root)
  const rootEntries = fs.readdirSync(repoDir).filter(e => !e.startsWith('.') || e === '.claude-plugin');
  const pluginDirsPresent = rootEntries.filter(e => ALL_PLUGIN_DIRS.includes(e));
  if (pluginDirsPresent.length <= 1) {
    log(`  [SKIP] Only ${pluginDirsPresent.length} plugin dir(s) at root — may already be fixed`);
    rmrf(repoDir);
    return;
  }
  log(`  [2] Found ${pluginDirsPresent.length} plugin dirs at root: ${pluginDirsPresent.join(', ')}`);

  // 3. Move plugin's own content to root
  log(`  [3] Moving ${name}/ contents to root...`);
  const pluginEntries = fs.readdirSync(pluginSubdir);
  for (const entry of pluginEntries) {
    const src = path.join(pluginSubdir, entry);
    const dest = path.join(repoDir, entry);
    if (dryRun) {
      log(`  [DRY-RUN] ${name}/${entry} -> ${entry}`);
    } else {
      if (fs.existsSync(dest)) {
        // Merge (e.g., .claude-plugin/)
        copyRecursive(src, dest);
      } else {
        fs.renameSync(src, dest);
      }
    }
  }

  // 4. Delete ALL plugin directories (including the now-empty own dir)
  log(`  [4] Removing plugin directories...`);
  for (const dir of ALL_PLUGIN_DIRS) {
    const dirPath = path.join(repoDir, dir);
    if (fs.existsSync(dirPath)) {
      if (dryRun) {
        log(`  [DRY-RUN] Would delete ${dir}/`);
      } else {
        rmrf(dirPath);
      }
    }
  }

  // 5. Generate components.json
  log(`  [5] Generating components.json...`);
  const components = generateComponents(repoDir);
  if (dryRun) {
    log(`  [DRY-RUN] components.json: ${JSON.stringify(components)}`);
  } else {
    fs.writeFileSync(
      path.join(repoDir, 'components.json'),
      JSON.stringify(components, null, 2) + '\n'
    );
  }

  // 6. Verify expected structure
  const finalEntries = dryRun
    ? ['(dry-run)']
    : fs.readdirSync(repoDir).filter(e => !e.startsWith('.') || e === '.claude-plugin');
  log(`  [6] Final root contents: ${finalEntries.join(', ')}`);

  // 7. Commit and push
  if (dryRun) {
    log(`  [DRY-RUN] Would commit and force-push to main`);
  } else {
    log(`  [7] Committing and pushing...`);
    run('git', ['add', '-A'], { cwd: repoDir });
    run('git', ['commit', '-m', 'fix: restructure to single-plugin layout + add components.json'], { cwd: repoDir });
    run('git', ['push', '--force', 'origin', 'main'], { cwd: repoDir });
    log(`  [OK] ${GITHUB_ORG}/${name} fixed and pushed`);
  }

  // Cleanup
  rmrf(repoDir);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');
  const positional = args.filter(a => !a.startsWith('--'));

  if (!all && positional.length === 0) {
    console.error('Usage: node scripts/fix-graduated-repos.js [--all | <plugin-name>] [--dry-run]');
    process.exit(1);
  }

  const targets = all ? PLUGINS : positional;

  // Validate targets
  for (const t of targets) {
    if (!PLUGINS.includes(t)) {
      console.error(`Unknown plugin: ${t}. Valid: ${PLUGINS.join(', ')}`);
      process.exit(1);
    }
  }

  if (dryRun) {
    log('[DRY-RUN MODE] No changes will be pushed.\n');
  }

  log(`Fixing ${targets.length} repo(s): ${targets.join(', ')}`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const name of targets) {
    try {
      fixRepo(name, dryRun);
      fixed++;
    } catch (err) {
      log(`  [ERROR] ${name}: ${err.message}`);
      failed++;
      // Cleanup on failure
      rmrf(path.join(WORK_DIR, name));
    }
  }

  log(`\n=== Summary ===`);
  log(`Fixed: ${fixed}, Skipped: ${skipped}, Failed: ${failed}`);

  // Cleanup work dir if empty
  if (fs.existsSync(WORK_DIR)) {
    try { fs.rmdirSync(WORK_DIR); } catch (_) { /* not empty */ }
  }
}

main();
