#!/usr/bin/env node
/**
 * OpenCode Migration Tool
 *
 * Migrates agentsys commands for OpenCode compatibility:
 * 1. Creates native OpenCode agent definitions in .opencode/agents/
 * 2. Updates command files to use @ mention syntax instead of Task tool
 *
 * Usage:
 *   node scripts/migrate-opencode.js [--target <path>] [--dry-run]
 *
 * Options:
 *   --target <path>  Target project directory (default: current directory)
 *   --dry-run        Show what would be done without making changes
 */

const fs = require('fs');
const path = require('path');

// Agent definitions to create for OpenCode
const OPENCODE_AGENTS = {
  'deslop-agent': {
    description: 'Detect and clean AI slop patterns from code',
    model: 'anthropic/claude-sonnet-4-20250514',
    mode: 'subagent',
    temperature: 0.1,
    permissions: { read: 'allow', edit: 'allow', bash: 'allow' }
  }
};

// Task tool patterns to detect and migrate
const TASK_TOOL_PATTERNS = [
  {
    pattern: /await\s+Task\s*\(\s*\{\s*subagent_type:\s*["']([^"']+)["'][^}]*\}\s*\)/g,
    replacement: (match, agentType) => {
      const agentName = agentType.split(':').pop();
      return `// OpenCode: Use @ mention instead of Task tool\n// @${agentName} <prompt>`;
    }
  },
  {
    pattern: /Task\s*\(\s*\{\s*subagent_type:\s*["']([^"']+)["']/g,
    replacement: (match, agentType) => {
      const agentName = agentType.split(':').pop();
      return `// OpenCode alternative: @${agentName}`;
    }
  }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    target: process.cwd(),
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) {
      options.target = path.resolve(args[++i]);
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

function generateAgentFile(name, config) {
  return `---
description: ${config.description}
mode: ${config.mode}
model: ${config.model}
temperature: ${config.temperature}
permission:
  read: ${config.permissions.read}
  edit: ${config.permissions.edit}
  bash: ${config.permissions.bash}
---

# ${name}

${config.description}

## Instructions

Follow the skill file for this agent's specific behavior.
Use the tools available to complete the task.

## Output

Return structured results when complete.
`;
}

function createNativeAgents(targetDir, dryRun) {
  const agentDir = path.join(targetDir, '.opencode', 'agent');
  const results = [];

  if (!dryRun) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  for (const [name, config] of Object.entries(OPENCODE_AGENTS)) {
    const filePath = path.join(agentDir, `${name}.md`);
    const content = generateAgentFile(name, config);

    if (dryRun) {
      results.push({ action: 'create', path: filePath, preview: content.slice(0, 200) + '...' });
    } else {
      fs.writeFileSync(filePath, content);
      results.push({ action: 'created', path: filePath });
    }
  }

  return results;
}

function migrateCommandFile(filePath, dryRun) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let modified = content;
  const changes = [];

  for (const { pattern, replacement } of TASK_TOOL_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      modified = modified.replace(pattern, replacement);
      changes.push({ pattern: pattern.toString(), count: matches.length });
    }
  }

  if (changes.length > 0) {
    if (dryRun) {
      return { path: filePath, changes, preview: modified.slice(0, 500) };
    } else {
      fs.writeFileSync(filePath, modified);
      return { path: filePath, changes, status: 'migrated' };
    }
  }

  return null;
}

function findCommandFiles(baseDir) {
  const files = [];
  const pluginsDir = path.join(baseDir, 'plugins');

  if (fs.existsSync(pluginsDir)) {
    const plugins = fs.readdirSync(pluginsDir);
    for (const plugin of plugins) {
      const commandsDir = path.join(pluginsDir, plugin, 'commands');
      if (fs.existsSync(commandsDir)) {
        const commands = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
        for (const cmd of commands) {
          files.push(path.join(commandsDir, cmd));
        }
      }
    }
  }

  return files;
}

function main() {
  const options = parseArgs();

  console.log('OpenCode Migration Tool');
  console.log('=======================');
  console.log(`Target: ${options.target}`);
  console.log(`Mode: ${options.dryRun ? 'Dry run' : 'Live'}`);
  console.log('');

  // Step 1: Create native OpenCode agents
  console.log('Step 1: Creating native OpenCode agents...');
  const agentResults = createNativeAgents(options.target, options.dryRun);
  for (const result of agentResults) {
    console.log(`  ${result.action}: ${result.path}`);
  }
  console.log(`  Total: ${agentResults.length} agent(s)`);
  console.log('');

  // Step 2: Migrate command files
  console.log('Step 2: Migrating command files...');
  const commandFiles = findCommandFiles(options.target);
  let migratedCount = 0;
  for (const file of commandFiles) {
    const result = migrateCommandFile(file, options.dryRun);
    if (result) {
      console.log(`  ${options.dryRun ? 'Would migrate' : 'Migrated'}: ${path.basename(file)}`);
      for (const change of result.changes) {
        console.log(`    - ${change.count} Task tool pattern(s)`);
      }
      migratedCount++;
    }
  }
  console.log(`  Total: ${migratedCount} file(s) ${options.dryRun ? 'would be ' : ''}modified`);
  console.log('');

  // Summary
  console.log('Summary');
  console.log('-------');
  console.log(`Agents created: ${agentResults.length}`);
  console.log(`Commands migrated: ${migratedCount}`);

  if (options.dryRun) {
    console.log('');
    console.log('This was a dry run. Run without --dry-run to apply changes.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
