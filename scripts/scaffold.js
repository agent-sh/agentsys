#!/usr/bin/env node
/**
 * Scaffold new plugins, agents, skills, and commands
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 64;

/**
 * Validate a name for use as a plugin/agent/skill/command identifier.
 * @param {string} name
 * @param {string} type - e.g. 'plugin', 'agent', 'skill', 'command'
 * @returns {{ valid: boolean, error?: string }}
 */
function validateName(name, type) {
  if (!name) {
    return { valid: false, error: `${type} name is required` };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `${type} name must be ${MAX_NAME_LENGTH} characters or fewer (got ${name.length})` };
  }
  if (!NAME_REGEX.test(name)) {
    return { valid: false, error: `${type} name must match ${NAME_REGEX} (lowercase letters, digits, hyphens, must start with letter or digit)` };
  }
  return { valid: true };
}

/**
 * Parse flags from argument array.
 * Extracts --plugin, --model, and --description values.
 * @param {string[]} args
 * @returns {{ plugin?: string, model?: string, description?: string }}
 */
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--plugin' && i + 1 < args.length) {
      flags.plugin = args[++i];
    } else if (arg.startsWith('--plugin=')) {
      flags.plugin = arg.slice(arg.indexOf('=') + 1);
    } else if (arg === '--model' && i + 1 < args.length) {
      flags.model = args[++i];
    } else if (arg.startsWith('--model=')) {
      flags.model = arg.slice(arg.indexOf('=') + 1);
    } else if (arg === '--description' && i + 1 < args.length) {
      flags.description = args[++i];
    } else if (arg.startsWith('--description=')) {
      flags.description = arg.slice(arg.indexOf('=') + 1);
    }
  }
  return flags;
}

/**
 * Escape a string for safe inclusion in double-quoted YAML values.
 * @param {string} str
 * @returns {string}
 */
function escapeYaml(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Get the project version from package.json.
 * @param {string} projectRoot
 * @returns {string}
 */
function getVersion(projectRoot) {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

/**
 * Scaffold a new plugin with standard directory structure.
 * @param {string} name
 * @param {string} projectRoot
 * @returns {{ success: boolean, files: string[], errors: string[] }}
 */
function scaffoldPlugin(name, projectRoot) {
  const result = { success: false, files: [], errors: [] };

  const check = validateName(name, 'plugin');
  if (!check.valid) {
    result.errors.push(check.error);
    return result;
  }

  const pluginDir = path.join(projectRoot, 'plugins', name);
  if (fs.existsSync(pluginDir)) {
    result.errors.push(`Plugin directory already exists: plugins/${name}`);
    return result;
  }

  const version = getVersion(projectRoot);

  const pluginJson = {
    name: name,
    version: version,
    description: 'TODO: Add plugin description',
    author: {
      name: 'Avi Fenesh',
      email: '[email protected]',
      url: 'https://github.com/avifenesh'
    },
    homepage: `https://github.com/agent-sh/agentsys#${name}`,
    repository: 'https://github.com/agent-sh/agentsys',
    license: 'MIT',
    keywords: [name]
  };

  // Create directory structure (lib/ must exist before sync-lib.sh runs)
  const dirs = [
    path.join(pluginDir, '.claude-plugin'),
    path.join(pluginDir, 'commands'),
    path.join(pluginDir, 'agents'),
    path.join(pluginDir, 'skills'),
    path.join(pluginDir, 'lib')
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write plugin.json
  const pluginJsonPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
  fs.writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');
  result.files.push(`plugins/${name}/.claude-plugin/plugin.json`);

  // Write default command
  const commandPath = path.join(pluginDir, 'commands', `${name}.md`);
  fs.writeFileSync(commandPath, buildCommandTemplate(name));
  result.files.push(`plugins/${name}/commands/${name}.md`);

  // Run sync-lib.sh to copy shared lib into plugins/<name>/lib/
  // Check bash availability on Windows
  if (process.platform === 'win32') {
    try {
      execFileSync('where', ['bash'], { stdio: 'pipe' });
    } catch {
      result.errors.push('bash not found. Install Git Bash or WSL to run sync-lib. Run \'npx agentsys-dev sync-lib\' manually after installing bash.');
      return result;
    }
  }

  try {
    execFileSync('bash', ['scripts/sync-lib.sh'], { cwd: projectRoot, stdio: 'pipe' });
  } catch (e) {
    result.errors.push(`sync-lib.sh failed: ${e.message}. Run 'npx agentsys-dev sync-lib' manually.`);
    return result;
  }

  result.success = true;
  return result;
}

/**
 * Scaffold a new agent markdown file.
 * @param {string} name
 * @param {string[]} args
 * @param {string} projectRoot
 * @returns {{ success: boolean, files: string[], errors: string[] }}
 */
function scaffoldAgent(name, args, projectRoot) {
  const result = { success: false, files: [], errors: [] };

  const check = validateName(name, 'agent');
  if (!check.valid) {
    result.errors.push(check.error);
    return result;
  }

  const flags = parseFlags(args);
  if (!flags.plugin) {
    result.errors.push('--plugin flag is required for agent scaffolding');
    return result;
  }

  const pluginCheck = validateName(flags.plugin, 'plugin');
  if (!pluginCheck.valid) {
    result.errors.push(`Invalid --plugin value: ${pluginCheck.error}`);
    return result;
  }

  const allowedModels = ['opus', 'sonnet', 'haiku'];
  if (flags.model && !allowedModels.includes(flags.model)) {
    result.errors.push(`Invalid --model value: ${flags.model}. Allowed: ${allowedModels.join(', ')}`);
    return result;
  }

  const pluginDir = path.join(projectRoot, 'plugins', flags.plugin);
  if (!fs.existsSync(pluginDir)) {
    result.errors.push(`Plugin not found: plugins/${flags.plugin}`);
    return result;
  }

  const agentsDir = path.join(pluginDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  const agentPath = path.join(agentsDir, `${name}.md`);
  if (fs.existsSync(agentPath)) {
    result.errors.push(`Agent file already exists: plugins/${flags.plugin}/agents/${name}.md`);
    return result;
  }

  const model = flags.model || 'sonnet';
  const description = escapeYaml(flags.description || 'TODO: Add agent description. Use this agent when TODO: add trigger conditions.');

  const content = `---
name: ${name}
description: "${description}"
tools:
  - Read
  - Glob
  - Grep
model: ${model}
---

# ${capitalize(name)} Agent

TODO: Add agent instructions.

## Workflow

1. TODO: Define workflow steps

## Output Format

TODO: Define expected output format
`;

  fs.writeFileSync(agentPath, content);
  result.files.push(`plugins/${flags.plugin}/agents/${name}.md`);
  result.success = true;
  return result;
}

/**
 * Scaffold a new skill directory with SKILL.md.
 * @param {string} name
 * @param {string[]} args
 * @param {string} projectRoot
 * @returns {{ success: boolean, files: string[], errors: string[] }}
 */
function scaffoldSkill(name, args, projectRoot) {
  const result = { success: false, files: [], errors: [] };

  const check = validateName(name, 'skill');
  if (!check.valid) {
    result.errors.push(check.error);
    return result;
  }

  const flags = parseFlags(args);
  if (!flags.plugin) {
    result.errors.push('--plugin flag is required for skill scaffolding');
    return result;
  }

  const pluginCheck = validateName(flags.plugin, 'plugin');
  if (!pluginCheck.valid) {
    result.errors.push(`Invalid --plugin value: ${pluginCheck.error}`);
    return result;
  }

  const pluginDir = path.join(projectRoot, 'plugins', flags.plugin);
  if (!fs.existsSync(pluginDir)) {
    result.errors.push(`Plugin not found: plugins/${flags.plugin}`);
    return result;
  }

  const skillDir = path.join(pluginDir, 'skills', name);
  if (fs.existsSync(skillDir)) {
    result.errors.push(`Skill directory already exists: plugins/${flags.plugin}/skills/${name}`);
    return result;
  }

  fs.mkdirSync(skillDir, { recursive: true });

  const description = escapeYaml(flags.description || 'TODO: Add skill description. Use when TODO: add triggers.');

  const content = `---
name: ${name}
description: "${description}"
version: 1.0.0
argument-hint: "[options]"
---

# ${name}

TODO: Add skill implementation.

## Arguments

Parse from \`$ARGUMENTS\`:
- No arguments defined yet

## Workflow

1. TODO: Define workflow steps
`;

  const skillPath = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(skillPath, content);
  result.files.push(`plugins/${flags.plugin}/skills/${name}/SKILL.md`);
  result.success = true;
  return result;
}

/**
 * Scaffold a new command markdown file.
 * @param {string} name
 * @param {string[]} args
 * @param {string} projectRoot
 * @returns {{ success: boolean, files: string[], errors: string[] }}
 */
function scaffoldCommand(name, args, projectRoot) {
  const result = { success: false, files: [], errors: [] };

  const check = validateName(name, 'command');
  if (!check.valid) {
    result.errors.push(check.error);
    return result;
  }

  const flags = parseFlags(args);
  if (!flags.plugin) {
    result.errors.push('--plugin flag is required for command scaffolding');
    return result;
  }

  const pluginCheck = validateName(flags.plugin, 'plugin');
  if (!pluginCheck.valid) {
    result.errors.push(`Invalid --plugin value: ${pluginCheck.error}`);
    return result;
  }

  const pluginDir = path.join(projectRoot, 'plugins', flags.plugin);
  if (!fs.existsSync(pluginDir)) {
    result.errors.push(`Plugin not found: plugins/${flags.plugin}`);
    return result;
  }

  const commandsDir = path.join(pluginDir, 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });

  const commandPath = path.join(commandsDir, `${name}.md`);
  if (fs.existsSync(commandPath)) {
    result.errors.push(`Command file already exists: plugins/${flags.plugin}/commands/${name}.md`);
    return result;
  }

  fs.writeFileSync(commandPath, buildCommandTemplate(name));
  result.files.push(`plugins/${flags.plugin}/commands/${name}.md`);
  result.success = true;
  return result;
}

/**
 * Build a command .md template string.
 * @param {string} name
 * @returns {string}
 */
function buildCommandTemplate(name) {
  return `---
description: "TODO: Add command description"
codex-description: 'Use when user asks to "TODO: add triggers". TODO: what it does.'
argument-hint: "[options]"
allowed-tools: Task, Read, Glob, Grep
---

# ${name}

TODO: Add command implementation instructions.
`;
}

/**
 * Capitalize a hyphenated name: "my-agent" -> "My Agent"
 * Strips trailing "-agent" before capitalizing to avoid double "Agent" in headings.
 * @param {string} name
 * @returns {string}
 */
function capitalize(name) {
  let normalized = name.endsWith('-agent') ? name.slice(0, -6) : name;
  return normalized.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Entry point for CLI usage.
 * @param {string[]} args - e.g. ['plugin', 'my-name'] or ['agent', 'my-agent', '--plugin', 'enhance']
 * @returns {number} Exit code 0 or 1
 */
function main(args) {
  if (!args || args.length < 2) {
    console.log('Usage: agentsys-dev new <type> <name> [options]');
    console.log('');
    console.log('Types: plugin, agent, skill, command');
    console.log('');
    console.log('Options:');
    console.log('  --plugin <name>       Target plugin (required for agent/skill/command)');
    console.log('  --model <model>       Agent model (default: sonnet)');
    console.log('  --description <text>  Description text');
    console.log('');
    console.log('Examples:');
    console.log('  agentsys-dev new plugin my-plugin');
    console.log('  agentsys-dev new agent my-agent --plugin enhance');
    console.log('  agentsys-dev new skill my-skill --plugin enhance');
    console.log('  agentsys-dev new command my-cmd --plugin enhance');
    return 1;
  }

  const type = args[0];
  const name = args[1];
  const projectRoot = path.resolve(__dirname, '..');

  let result;
  switch (type) {
    case 'plugin':
      result = scaffoldPlugin(name, projectRoot);
      break;
    case 'agent':
      result = scaffoldAgent(name, args.slice(2), projectRoot);
      break;
    case 'skill':
      result = scaffoldSkill(name, args.slice(2), projectRoot);
      break;
    case 'command':
      result = scaffoldCommand(name, args.slice(2), projectRoot);
      break;
    default:
      console.log(`[ERROR] Unknown type: ${type}`);
      console.log('Valid types: plugin, agent, skill, command');
      return 1;
  }

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(err.startsWith('[WARN]') ? err : `[ERROR] ${err}`);
    }
  }

  if (!result.success) {
    return 1;
  }

  console.log('');
  console.log(`[OK] Scaffolded ${type}: ${name}`);
  console.log('');
  console.log('Created files:');
  for (const file of result.files) {
    console.log(`  ${file}`);
  }

  console.log('');
  console.log('Next steps:');
  if (type === 'plugin') {
    console.log('  1. Edit plugin.json with a real description and keywords');
    console.log('  2. Add agents and skills to the plugin');
    console.log('  3. See checklists/new-command.md for command requirements');
  } else if (type === 'agent') {
    console.log('  1. Edit the agent file with real instructions');
    console.log('  2. See checklists/new-agent.md for agent requirements');
  } else if (type === 'skill') {
    console.log('  1. Edit the SKILL.md with real implementation');
    console.log('  2. See checklists/new-skill.md for skill requirements');
  } else if (type === 'command') {
    console.log('  1. Edit the command file with real instructions');
    console.log('  2. See checklists/new-command.md for command requirements');
  }
  console.log('  - Run /enhance on new files to improve quality');

  return 0;
}

if (require.main === module) {
  const code = main(process.argv.slice(2));
  if (typeof code === 'number') process.exit(code);
}

module.exports = { main, scaffoldPlugin, scaffoldAgent, scaffoldSkill, scaffoldCommand, validateName };
