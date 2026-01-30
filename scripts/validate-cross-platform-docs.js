#!/usr/bin/env node
/**
 * Cross-Platform Documentation Validator
 * Ensures platform-specific documentation is consistent and non-conflicting
 *
 * Validates:
 * 1. Command prefix consistency (/, $)
 * 2. State directory references are platform-aware
 * 3. Installation instructions are accurate
 * 4. MCP server configurations are correct
 * 5. Feature parity across platforms
 * 6. No conflicting information between platform docs
 *
 * CRITICAL: Per CLAUDE.md rule - 3 platforms must work (Claude Code, OpenCode, Codex)
 *
 * Usage: node scripts/validate-cross-platform-docs.js
 * Exit code: 0 if valid, 1 if conflicts found
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Platform-specific documentation files
const PLATFORM_DOCS = {
  general: [
    'README.md',
    'docs/INSTALLATION.md',
    'docs/CROSS_PLATFORM.md',
    'docs/ARCHITECTURE.md'
  ],
  claudeCode: [
    'CLAUDE.md',
    '.claude/settings.json'
  ],
  openCode: [
    'AGENTS.md',
    'adapters/opencode-plugin/README.md',
    'adapters/opencode/README.md'
  ],
  codex: [
    'AGENTS.md',
    'adapters/codex/README.md'
  ]
};

// Expected command prefixes by platform
const COMMAND_PREFIXES = {
  claudeCode: '/',
  openCode: '/',
  codex: '$'
};

// Expected state directories by platform
const STATE_DIRS = {
  claudeCode: '.claude',
  openCode: '.opencode',
  codex: '.codex'
};

// Features that must work on all platforms
const REQUIRED_FEATURES = [
  '/next-task',
  '/ship',
  '/deslop',
  '/enhance',
  '/audit-project',
  '/drift-detect',
  '/repo-map',
  '/perf',
  '/sync-docs'
];

function readFileIfExists(filePath) {
  const fullPath = path.join(REPO_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

// Check command prefix consistency
function validateCommandPrefixes() {
  const issues = [];

  Object.entries(PLATFORM_DOCS).forEach(([platform, docs]) => {
    docs.forEach(doc => {
      const content = readFileIfExists(doc);
      if (!content) return;

      const expectedPrefix = COMMAND_PREFIXES[platform];
      if (!expectedPrefix) return; // general docs

      // Check for wrong prefix usage
      const wrongPrefix = platform === 'codex' ? '/' : '$';
      const commandPattern = new RegExp(`${wrongPrefix}(next-task|ship|deslop|enhance|audit-project|drift-detect|repo-map|perf|sync-docs)`, 'g');

      const matches = content.match(commandPattern);
      if (matches && matches.length > 0) {
        // Filter out code blocks and examples showing other platforms
        const lines = content.split('\n');
        const actualIssues = [];

        matches.forEach(match => {
          const lineIdx = content.indexOf(match);
          const lineNum = content.substring(0, lineIdx).split('\n').length;
          const line = lines[lineNum - 1];

          // Skip if it's in a comparison table or example
          if (line.includes('|') && (line.includes('Claude Code') || line.includes('OpenCode') || line.includes('Codex'))) {
            return; // This is a comparison table
          }
          if (line.includes('example') || line.includes('Example')) {
            return; // This is an example
          }
          // Skip checklist references, skill names, and general command lists
          if (line.includes('checklists/') || line.includes('`enhance') || line.includes('commands, agents, skills')) {
            return; // Checklist path, skill name, or general list
          }
          // Skip if it's documenting the command itself (markdown headers, code blocks)
          if (line.trim().startsWith('#') || line.trim().startsWith('```') || line.trim().startsWith('-')) {
            return; // Header, code block, or list item (likely documentation)
          }

          actualIssues.push({ line: lineNum, match, context: line.trim() });
        });

        if (actualIssues.length > 0) {
          issues.push({
            file: doc,
            platform,
            expectedPrefix,
            wrongPrefix,
            occurrences: actualIssues
          });
        }
      }
    });
  });

  return issues;
}

// Check state directory references
function validateStateDirReferences() {
  const issues = [];

  Object.entries(PLATFORM_DOCS).forEach(([platform, docs]) => {
    docs.forEach(doc => {
      const content = readFileIfExists(doc);
      if (!content) return;

      // Look for hardcoded state directory paths
      Object.entries(STATE_DIRS).forEach(([refPlatform, stateDir]) => {
        if (platform === 'general') {
          // General docs should mention all platforms or use variables
          return;
        }

        if (refPlatform !== platform) {
          // Check if doc mentions wrong platform's state dir
          const pattern = new RegExp(`\\b${stateDir}\\b`, 'g');
          const matches = content.match(pattern);

          if (matches) {
            // Check if it's in a comparison context
            const lines = content.split('\n');
            const wrongMentions = [];

            matches.forEach(match => {
              const lineIdx = content.indexOf(match);
              const lineNum = content.substring(0, lineIdx).split('\n').length;
              const line = lines[lineNum - 1];

              // Skip comparison tables, platform docs, checklist references, and skill names
              if (line.includes('|') || line.includes('Platform') || line.includes('State Dir')) {
                return;
              }
              if (line.includes('checklists/') || line.includes('update-opencode') || line.includes('skill name') || line.includes('`enhance-') || line.includes('CLAUDE.md patterns')) {
                return; // Checklist, skill name, or documentation reference
              }

              wrongMentions.push({ line: lineNum, context: line.trim() });
            });

            if (wrongMentions.length > 0) {
              issues.push({
                file: doc,
                platform,
                wrongStateDir: stateDir,
                expectedStateDir: STATE_DIRS[platform],
                occurrences: wrongMentions
              });
            }
          }
        }
      });
    });
  });

  return issues;
}

// Check feature parity
function validateFeatureParity() {
  const issues = [];
  const featuresByPlatform = {};

  // Extract features mentioned in each platform's docs
  Object.entries(PLATFORM_DOCS).forEach(([platform, docs]) => {
    featuresByPlatform[platform] = new Set();

    docs.forEach(doc => {
      const content = readFileIfExists(doc);
      if (!content) return;

      REQUIRED_FEATURES.forEach(feature => {
        // Normalize for codex ($)
        const featureName = feature.replace('/', '');
        const patterns = [
          new RegExp(`/${featureName}\\b`, 'g'),
          new RegExp(`\\$${featureName}\\b`, 'g'),
          new RegExp(`\`${featureName}\``, 'g')
        ];

        if (patterns.some(p => p.test(content))) {
          featuresByPlatform[platform].add(feature);
        }
      });
    });
  });

  // Check that all platforms document all required features
  REQUIRED_FEATURES.forEach(feature => {
    Object.entries(featuresByPlatform).forEach(([platform, features]) => {
      if (platform === 'general') return; // General docs don't need to list all features

      if (!features.has(feature)) {
        issues.push({
          platform,
          feature,
          message: `Required feature ${feature} not documented for ${platform}`
        });
      }
    });
  });

  return { featuresByPlatform, issues };
}

// Check for conflicting installation instructions
function validateInstallationInstructions() {
  const issues = [];

  const installDoc = readFileIfExists('docs/INSTALLATION.md');
  const readme = readFileIfExists('README.md');
  const crossPlatform = readFileIfExists('docs/CROSS_PLATFORM.md');

  if (!installDoc || !readme || !crossPlatform) {
    return [{ error: 'Missing required documentation files' }];
  }

  // Check that npm install command is consistent (with optional @latest)
  const npmPattern = /npm install -g awesome-slash(@latest)?/;
  const docs = { 'README.md': readme, 'docs/INSTALLATION.md': installDoc, 'docs/CROSS_PLATFORM.md': crossPlatform };

  Object.entries(docs).forEach(([file, content]) => {
    if (!npmPattern.test(content)) {
      issues.push({
        file,
        message: 'Missing or incorrect npm install command'
      });
    }
  });

  // Check that all platforms are mentioned in installation docs
  const platforms = ['Claude Code', 'OpenCode', 'Codex'];
  platforms.forEach(platform => {
    if (!installDoc.includes(platform)) {
      issues.push({
        file: 'docs/INSTALLATION.md',
        message: `Platform "${platform}" not mentioned in installation guide`
      });
    }
  });

  return issues;
}

// Check MCP server configuration consistency
function validateMCPConfigurations() {
  const issues = [];

  const crossPlatform = readFileIfExists('docs/CROSS_PLATFORM.md');
  const mcpTools = readFileIfExists('docs/reference/MCP-TOOLS.md');

  if (!crossPlatform || !mcpTools) {
    return [{ error: 'Missing MCP documentation files' }];
  }

  // Expected MCP tool names
  const expectedTools = [
    'workflow_status',
    'workflow_start',
    'workflow_resume',
    'workflow_abort',
    'task_discover',
    'review_code',
    'slop_detect',
    'enhance_analyze',
    'repo_map'
  ];

  // Check that all tools are documented
  expectedTools.forEach(tool => {
    if (!mcpTools.includes(tool)) {
      issues.push({
        file: 'docs/reference/MCP-TOOLS.md',
        message: `MCP tool "${tool}" not documented`
      });
    }
  });

  // Check that CROSS_PLATFORM.md mentions MCP for all platforms
  const mcpConfigs = {
    opencode: 'opencode.json',
    codex: 'config.toml'
  };

  Object.entries(mcpConfigs).forEach(([platform, configFile]) => {
    if (!crossPlatform.includes(configFile)) {
      issues.push({
        file: 'docs/CROSS_PLATFORM.md',
        message: `MCP configuration for ${platform} (${configFile}) not documented`
      });
    }
  });

  return issues;
}

// Main execution
if (require.main === module) {
  console.log('[OK] Validating cross-platform documentation...\n');

  let hasErrors = false;

  // 1. Command prefix validation
  console.log('## Command Prefix Validation\n');
  const prefixIssues = validateCommandPrefixes();
  if (prefixIssues.length > 0) {
    console.error('[ERROR] Command prefix conflicts found:\n');
    prefixIssues.forEach(issue => {
      console.error(`  ${issue.file} (${issue.platform}):`);
      console.error(`    Expected: ${issue.expectedPrefix}<command>`);
      console.error(`    Found ${issue.occurrences.length} occurrences of ${issue.wrongPrefix}<command>:`);
      issue.occurrences.slice(0, 3).forEach(occ => {
        console.error(`      Line ${occ.line}: ${occ.context}`);
      });
      if (issue.occurrences.length > 3) {
        console.error(`      ... and ${issue.occurrences.length - 3} more`);
      }
      console.error('');
    });
    hasErrors = true;
  } else {
    console.log('[OK] Command prefixes consistent across platforms\n');
  }

  // 2. State directory validation
  console.log('## State Directory Reference Validation\n');
  const stateDirIssues = validateStateDirReferences();
  if (stateDirIssues.length > 0) {
    console.error('[ERROR] State directory reference conflicts found:\n');
    stateDirIssues.forEach(issue => {
      console.error(`  ${issue.file} (${issue.platform}):`);
      console.error(`    Expected: ${issue.expectedStateDir}`);
      console.error(`    Found ${issue.occurrences.length} references to ${issue.wrongStateDir}:`);
      issue.occurrences.slice(0, 3).forEach(occ => {
        console.error(`      Line ${occ.line}: ${occ.context}`);
      });
      console.error('');
    });
    hasErrors = true;
  } else {
    console.log('[OK] State directory references correct\n');
  }

  // 3. Feature parity validation
  console.log('## Feature Parity Validation\n');
  const { featuresByPlatform, issues: parityIssues } = validateFeatureParity();

  console.log('Features documented by platform:');
  Object.entries(featuresByPlatform).forEach(([platform, features]) => {
    console.log(`  ${platform}: ${features.size} features`);
  });
  console.log('');

  if (parityIssues.length > 0) {
    console.error('[ERROR] Feature parity issues found:\n');
    parityIssues.forEach(issue => {
      console.error(`  ${issue.message}`);
    });
    console.error('');
    hasErrors = true;
  } else {
    console.log('[OK] All required features documented for all platforms\n');
  }

  // 4. Installation instructions validation
  console.log('## Installation Instructions Validation\n');
  const installIssues = validateInstallationInstructions();
  if (installIssues.length > 0 && installIssues[0].error) {
    console.error(`[ERROR] ${installIssues[0].error}\n`);
    hasErrors = true;
  } else if (installIssues.length > 0) {
    console.error('[ERROR] Installation instruction issues found:\n');
    installIssues.forEach(issue => {
      console.error(`  ${issue.file}: ${issue.message}`);
    });
    console.error('');
    hasErrors = true;
  } else {
    console.log('[OK] Installation instructions consistent\n');
  }

  // 5. MCP configuration validation
  console.log('## MCP Configuration Validation\n');
  const mcpIssues = validateMCPConfigurations();
  if (mcpIssues.length > 0 && mcpIssues[0].error) {
    console.error(`[ERROR] ${mcpIssues[0].error}\n`);
    hasErrors = true;
  } else if (mcpIssues.length > 0) {
    console.error('[ERROR] MCP configuration issues found:\n');
    mcpIssues.forEach(issue => {
      console.error(`  ${issue.file}: ${issue.message}`);
    });
    console.error('');
    hasErrors = true;
  } else {
    console.log('[OK] MCP configurations documented correctly\n');
  }

  if (hasErrors) {
    console.error('[ERROR] Cross-platform validation failed\n');
    console.error('CLAUDE.md Critical Rule: 3 platforms must work\n');
    process.exit(1);
  }

  console.log('[OK] All cross-platform documentation valid\n');
  process.exit(0);
}

module.exports = {
  validateCommandPrefixes,
  validateStateDirReferences,
  validateFeatureParity,
  validateInstallationInstructions,
  validateMCPConfigurations
};
