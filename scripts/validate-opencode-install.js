#!/usr/bin/env node
/**
 * Validate OpenCode Installation
 *
 * Checks all installed files for OpenCode compatibility:
 * - Commands: No require() statements, no Task tool syntax
 * - Agents: No plugin prefixes, no skill execution references
 * - Skills: No require() statements, have proper frontmatter
 *
 * Run after installation to validate everything works.
 */

const fs = require('fs');
const path = require('path');

const home = process.env.HOME || process.env.USERPROFILE;

/**
 * Get OpenCode config directory following XDG Base Directory Specification.
 * OpenCode uses ~/.config/opencode/ by default, or $XDG_CONFIG_HOME/opencode if set.
 */
function getOpenCodeConfigDir() {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.trim()) {
    return path.join(xdgConfigHome, 'opencode');
  }
  return path.join(home, '.config', 'opencode');
}

const OPENCODE_DIR = getOpenCodeConfigDir();

const issues = [];

function checkFile(filePath, checks) {
  if (!fs.existsSync(filePath)) {
    issues.push({ file: filePath, error: 'File not found' });
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);

  for (const check of checks) {
    const matches = content.match(check.pattern);
    if (matches) {
      issues.push({
        file: fileName,
        error: check.message,
        matches: matches.slice(0, 3).map(m => m.substring(0, 50))
      });
    }
  }
}

// Patterns that should NOT appear in OpenCode files
const FORBIDDEN_PATTERNS = {
  commands: [
    { pattern: /require\s*\([^)]+\)/g, message: 'Contains require() - OpenCode commands cannot execute JS' },
    { pattern: /await\s+Task\s*\(/g, message: 'Contains Task tool - use @agent-name syntax' },
    { pattern: /next-task:|deslop:|enhance:|ship:/g, message: 'Contains plugin prefix - should be stripped' },
    { pattern: /\$\{CLAUDE_PLUGIN_ROOT\}/g, message: 'Contains CLAUDE_PLUGIN_ROOT - should use PLUGIN_ROOT' },
  ],
  agents: [
    { pattern: /next-task:|deslop:|enhance:|ship:|sync-docs:|audit-project:/g, message: 'Contains plugin prefix' },
    { pattern: /await\s+Task\s*\(/g, message: 'Contains Task tool syntax' },
    { pattern: /\.claude\//g, message: 'Contains .claude/ path - should be .opencode/' },
  ],
  skills: [
    { pattern: /require\s*\(['"][^'"]+['"]\)/g, message: 'Contains require() - skills cannot execute JS' },
    { pattern: /\.claude\//g, message: 'Contains .claude/ path' },
  ]
};

// Required patterns that MUST appear
const REQUIRED_PATTERNS = {
  commands: [
    { pattern: /^---\n/m, message: 'Missing frontmatter' },
  ],
  agents: [
    { pattern: /^---\n/m, message: 'Missing frontmatter' },
    { pattern: /mode:\s*(subagent|primary|all)/m, message: 'Missing or invalid mode' },
  ],
  skills: [
    { pattern: /^---\n/m, message: 'Missing frontmatter' },
    { pattern: /name:\s*[a-z0-9-]+/m, message: 'Missing skill name' },
    { pattern: /description:/m, message: 'Missing description' },
  ]
};

function validateDirectory(dir, type) {
  if (!fs.existsSync(dir)) {
    console.log(`[SKIP] ${type} directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir, { withFileTypes: true });
  let checked = 0;

  for (const file of files) {
    let filePath;
    if (file.isDirectory()) {
      // For skills, check SKILL.md inside directory
      filePath = path.join(dir, file.name, 'SKILL.md');
      if (!fs.existsSync(filePath)) continue;
    } else if (file.name.endsWith('.md')) {
      filePath = path.join(dir, file.name);
    } else {
      continue;
    }

    // Check forbidden patterns
    checkFile(filePath, FORBIDDEN_PATTERNS[type] || []);

    // Check required patterns
    const content = fs.readFileSync(filePath, 'utf8');
    for (const req of (REQUIRED_PATTERNS[type] || [])) {
      if (!req.pattern.test(content)) {
        issues.push({
          file: path.basename(filePath),
          error: req.message
        });
      }
    }

    checked++;
  }

  console.log(`[CHECK] ${type}: ${checked} files validated`);
}

console.log('Validating OpenCode Installation...\n');
console.log(`OpenCode directory: ${OPENCODE_DIR}\n`);

// Validate each type
// OpenCode expects commands directly in commands/, not a subdirectory
validateDirectory(path.join(OPENCODE_DIR, 'commands'), 'commands');
validateDirectory(path.join(OPENCODE_DIR, 'agents'), 'agents');
validateDirectory(path.join(OPENCODE_DIR, 'skills'), 'skills');

// Report results
console.log('\n--- Results ---\n');

if (issues.length === 0) {
  console.log('[OK] All files valid for OpenCode');
  process.exit(0);
} else {
  console.log(`[ERROR] Found ${issues.length} issues:\n`);

  // Group by file
  const byFile = {};
  for (const issue of issues) {
    if (!byFile[issue.file]) byFile[issue.file] = [];
    byFile[issue.file].push(issue);
  }

  for (const [file, fileIssues] of Object.entries(byFile)) {
    console.log(`${file}:`);
    for (const issue of fileIssues) {
      console.log(`  - ${issue.error}`);
      if (issue.matches) {
        for (const m of issue.matches) {
          console.log(`    > ${m}...`);
        }
      }
    }
    console.log('');
  }

  process.exit(1);
}
