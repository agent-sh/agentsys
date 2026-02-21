#!/usr/bin/env node
/**
 * Validate plugin structure for all plugins
 */

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');
const ROOT_PLUGIN = path.join(__dirname, '..', '.claude-plugin');

function validatePlugin(pluginPath, name) {
  const errors = [];

  // Check plugin.json exists
  const pluginJson = path.join(pluginPath, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginJson)) {
    errors.push(`${name}: Missing .claude-plugin/plugin.json`);
  } else {
    try {
      const pkg = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
      if (!pkg.name) errors.push(`${name}: plugin.json missing 'name'`);
      if (!pkg.version) errors.push(`${name}: plugin.json missing 'version'`);
    } catch (e) {
      errors.push(`${name}: Invalid plugin.json - ${e.message}`);
    }
  }

  // Check for commands or agents
  const commandsDir = path.join(pluginPath, 'commands');
  const agentsDir = path.join(pluginPath, 'agents');

  const hasCommands = fs.existsSync(commandsDir) &&
    fs.readdirSync(commandsDir).some(f => f.endsWith('.md'));
  const hasAgents = fs.existsSync(agentsDir) &&
    fs.readdirSync(agentsDir).some(f => f.endsWith('.md'));

  if (!hasCommands && !hasAgents) {
    errors.push(`${name}: No commands/*.md or agents/*.md found`);
  }

  return errors;
}

function main() {
  console.log('Validating plugin structure...\n');

  const allErrors = [];

  // Validate root plugin
  if (fs.existsSync(ROOT_PLUGIN)) {
    console.log('Checking: root plugin');
    const pluginJson = path.join(ROOT_PLUGIN, 'plugin.json');
    if (fs.existsSync(pluginJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
        if (!pkg.name) allErrors.push('root: plugin.json missing name');
        if (!pkg.version) allErrors.push('root: plugin.json missing version');
        console.log(`  [OK] plugin.json valid (${pkg.name}@${pkg.version})`);
      } catch (e) {
        allErrors.push(`root: Invalid plugin.json - ${e.message}`);
      }
    }
  }

  // Validate each plugin
  if (!fs.existsSync(PLUGINS_DIR)) {
    console.log('[OK] No plugins/ directory (plugins extracted to standalone repos)');
    return 0;
  }
  const plugins = fs.readdirSync(PLUGINS_DIR).filter(f =>
    fs.statSync(path.join(PLUGINS_DIR, f)).isDirectory()
  );

  for (const plugin of plugins) {
    console.log(`Checking: ${plugin}`);
    const pluginPath = path.join(PLUGINS_DIR, plugin);
    const errors = validatePlugin(pluginPath, plugin);

    if (errors.length > 0) {
      errors.forEach(e => console.log(`  [X] ${e}`));
      allErrors.push(...errors);
    } else {
      console.log(`  [OK] Valid`);
    }
  }

  console.log('');

  if (allErrors.length > 0) {
    console.log(`[ERROR] Validation failed with ${allErrors.length} error(s)`);
    return 1;
  }

  console.log(`[OK] All ${plugins.length + 1} plugins valid`);
  return 0;
}

if (require.main === module) {
  const code = main();
  if (typeof code === 'number') process.exit(code);
}

module.exports = { main };
