#!/usr/bin/env node
/**
 * Check for Hardcoded Platform Paths
 * Scans plugins for hardcoded .claude/, .opencode/, .codex/ paths
 *
 * CRITICAL: Per CLAUDE.md cross-platform requirement - all 3 platforms must work
 *
 * Usage: node scripts/check-hardcoded-paths.js
 * Exit code: 0 if clean, 1 if issues found
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Patterns to detect hardcoded platform paths
const HARDCODED_PATTERNS = [
  {
    pattern: /\.claude\/(?!.*\(example\)|.*for example|.*Platform|.*State directory)/,
    platform: '.claude/',
    severity: 'ERROR'
  },
  {
    pattern: /\.opencode\/(?!.*\(example\)|.*for example|.*Platform|.*State directory)/,
    platform: '.opencode/',
    severity: 'ERROR'
  },
  {
    pattern: /\.codex\/(?!.*\(example\)|.*for example|.*Platform|.*State directory)/,
    platform: '.codex/',
    severity: 'ERROR'
  }
];

// Files to exclude from checks (docs, examples, research)
const EXCLUDE_PATTERNS = [
  /RESEARCH\.md$/,
  /CLAUDE\.md$/,
  /AGENTS\.md$/,
  /README\.md$/,
  /INSTALLATION\.md$/,
  /CROSS_PLATFORM\.md$/,
  /ARCHITECTURE\.md$/,
  /examples?\//,
  /\.git\//,
  /node_modules\//,
  /__tests__\//,
  /\.json$/,
  // Enhance skills document platform differences - OK to have hardcoded paths in docs
  /plugins\/enhance\/skills\/.*\/SKILL\.md$/
];

// Lines that are OK to have hardcoded paths (documentation examples)
const SAFE_CONTEXTS = [
  'State stored in',
  'State directory:',
  'example',
  'Example',
  'Platform',
  '| State Dir |',
  'State Dir |',
  'detected by',
  'Detected by',
  'Override with',
  'Personal:',
  'Project:',
  'User settings',
  'Project settings',
  'Local settings',
  '| Claude Code |',
  '| OpenCode |',
  '| Codex |',
  'Claude Code:',
  'OpenCode:',
  'Codex CLI:',
  'Codex:',
  "Don't hardcode",
  'Support ',
  '~/.claude/',
  '~/.config/opencode/',
  '~/.opencode/', // legacy (pre-XDG) path; keep as safe context for historical docs
  '~/.codex/',
  'MCP in',
  'or `~/',
  '$CLAUDE_PROJECT_DIR'
];

function shouldExcludeFile(filePath) {
  // Normalize path separators for cross-platform regex matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(normalizedPath));
}

function isSafeContext(line) {
  return SAFE_CONTEXTS.some(ctx => line.includes(ctx));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    // Skip if line is in safe context
    if (isSafeContext(line)) {
      return;
    }

    HARDCODED_PATTERNS.forEach(({ pattern, platform, severity }) => {
      if (pattern.test(line)) {
        issues.push({
          file: path.relative(REPO_ROOT, filePath),
          line: index + 1,
          platform,
          severity,
          content: line.trim()
        });
      }
    });
  });

  return issues;
}

function scanDirectory(dir, issues = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldExcludeFile(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, issues);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const fileIssues = scanFile(fullPath);
      issues.push(...fileIssues);
    }
  }

  return issues;
}

function formatIssue(issue) {
  return `${issue.severity}: ${issue.file}:${issue.line}
  Hardcoded path: ${issue.platform}
  Line: ${issue.content}
  Fix: Use platform-aware state directory variable (${issue.platform === '.claude/' ? 'STATE_DIR or stateDir' : 'stateDir'})
`;
}

// Main execution
if (require.main === module) {
  console.log('[OK] Scanning for hardcoded platform paths...\n');

  const pluginsDir = path.join(REPO_ROOT, 'plugins');
  const issues = scanDirectory(pluginsDir);

  if (issues.length === 0) {
    console.log('[OK] No hardcoded platform paths found\n');
    console.log('All files use platform-aware state directory variables.');
    process.exit(0);
  }

  console.error(`[ERROR] Found ${issues.length} hardcoded platform path(s):\n`);

  issues.forEach(issue => {
    console.error(formatIssue(issue));
  });

  console.error(`
CLAUDE.md Critical Rule:
> 3 platforms: Claude Code + OpenCode + Codex - ALL must work

Fix guide:
1. Replace hardcoded paths with platform-aware variables:
   - In agents/commands: Use workflowState.getStateDir()
   - In prompts: Use \${stateDir} or \${STATE_DIR} template variables

2. Examples:
   BAD:  await Task({ prompt: "State file: .claude/flow.json" });
   GOOD: await Task({ prompt: \`State file: \${stateDir}/flow.json\` });

   BAD:  State files in .claude/tasks.json
   GOOD: State files in {stateDir}/tasks.json

See: checklists/cross-platform-compatibility.md
`);

  process.exit(1);
}

module.exports = { scanDirectory, scanFile, HARDCODED_PATTERNS };
